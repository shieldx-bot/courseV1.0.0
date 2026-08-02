"""Database helper utilities.

These helpers abstract away the differences between a real MongoDB
(`motor`) and the lightweight in-memory database used by the test suite
(`InMemoryDB`). The key issue: the in-memory implementation ignores
MongoDB operators such as ``$push``, ``$addToSet``, ``$inc``, … because it
only handles ``$set``. Calling ``$push`` against the in-memory backend
silently does nothing — the audit history / array field never grows, so
tests that assert on it fail.

The helpers below use a **read-modify-write** strategy instead of the
atomic operator, which works identically on both backends.
"""

from typing import Any, AsyncIterator, Optional

from app.db.mongodb import get_db


async def safe_push_to_array(
    collection_name: str,
    query: dict[str, Any],
    array_field: str,
    value: Any,
    *,
    create_missing: bool = True,
    db: Optional[Any] = None,
) -> dict[str, Any]:
    """Append ``value`` to ``array_field`` on the first document matching ``query``.

    This is a portable, cross-backend alternative to MongoDB's atomic
    ``$push`` operator:

        await db.ops_tasks.update_one({"_id": task_id}, {"$push": {"history": entry}})

    The in-memory DB used by tests only understands ``$set``, so the
    ``$push`` above would be *silently ignored*. Instead we implement:

      1. **Read**  the document (``find_one``).
      2. **Modify** the array in Python (append + guard against missing key).
      3. **Write**  the whole array back with a ``$set``.

    This produces identical results on real MongoDB and the in-memory DB.

    Args:
        collection_name: Collection to operate on (e.g. ``"ops_tasks"``).
        query: Document filter, e.g. ``{"_id": task_id}``.
        array_field: Name of the list field to append to.
        value: Value (dict / scalar) to append.
        create_missing: When True, initialize missing array to ``[value]``;
            when False, a missing array is left untouched.
        db: Optional database handle. Defaults to ``get_db()``.

    Returns:
        dict with ``success``, ``task``-style info::

            {"success": True, "modified": True, "field": array_field,
             "length": n}
    """
    db = db or get_db()
    collection = db[collection_name]

    # 1. READ — load the current document from storage.
    doc = await collection.find_one(query)
    if doc is None:
        return {"success": False, "error": "document_not_found", "field": array_field}

    # 2. MODIFY — work on a copy in Python; this is the "safe" part that
    #    works even when the update operator ($push) is unsupported.
    entries = list(doc.get(array_field) or [])
    entries.append(value)

    # 3. WRITE — persist the entire array back. `$set` is supported by
    #    both the real driver and the in-memory implementation.
    await collection.update_one(query, {"$set": {array_field: entries}})

    return {
        "success": True,
        "modified": True,
        "field": array_field,
        "length": len(entries),
    }


async def safe_add_to_set(
    collection_name: str,
    query: dict[str, Any],
    array_field: str,
    value: Any,
    *,
    db: Optional[Any] = None,
) -> dict[str, Any]:
    """Append ``value`` to ``array_field`` only if it is not already present.

    Portable replacement for MongoDB's ``$addToSet`` operator, which is also
    not emulated by the in-memory backend.

    Args:
        collection_name: Collection to operate on.
        query: Document filter.
        array_field: Name of the list field to mutate.
        value: Value to append (deduplicated).
        db: Optional database handle. Defaults to ``get_db()``.

    Returns:
        ``{"success": True, "modified": bool, "length": n}`` — ``modified``
        is ``False`` when the value was already in the array.
    """
    db = db or get_db()
    collection = db[collection_name]

    doc = await collection.find_one(query)
    if doc is None:
        return {"success": False, "error": "document_not_found", "field": array_field}

    entries = list(doc.get(array_field) or [])
    if value in entries:
        return {"success": True, "modified": False, "field": array_field, "length": len(entries)}

    # Only re-write when the value is actually new.
    entries.append(value)
    await collection.update_one(query, {"$set": {array_field: entries}})
    return {"success": True, "modified": True, "field": array_field, "length": len(entries)}


# ── Canonical mutation helpers (shared by real Mongo + in-memory) ────────────


async def create_doc(
    collection_name: str,
    doc: dict,
    *,
    db=None,
) -> dict:
    """Insert a document. Falls back to upsert if the ``_id`` already exists."""
    db = db or get_db()
    if "_id" in doc and await db[collection_name].find_one({"_id": doc["_id"]}):
        await db[collection_name].update_one({"_id": doc["_id"]}, {"$set": doc}, upsert=True)
        return {"success": True, "created": False, "doc": doc}
    await db[collection_name].insert_one(doc)
    return {"success": True, "created": True, "doc": doc}


async def update_doc(
    collection_name: str,
    query: dict,
    updates: dict,
    *,
    upsert: bool = False,
    db=None,
) -> dict:
    """Portable ``$set`` update. Returns ``{"success", "modified"}``."""
    db = db or get_db()
    await db[collection_name].update_one(query, {"$set": updates}, upsert=upsert)
    return {"success": True, "modified": True}


async def push_to_array(
    collection_name: str,
    query: dict,
    array_field: str,
    value,
    *,
    db=None,
) -> dict:
    """Alias of ``safe_push_to_array`` — portable ``$push``."""
    return await safe_push_to_array(collection_name, query, array_field, value, db=db)


async def increment_field(
    collection_name: str,
    query: dict,
    field: str,
    amount: float = 1,
    *,
    db=None,
) -> dict:
    """Portable ``$inc`` — ``field`` may be a dotted path (e.g. ``stats.attempts``)."""
    db = db or get_db()
    await db[collection_name].update_one(query, {"$inc": {field: amount}})
    return {"success": True, "field": field, "amount": amount}


async def set_fields(
    collection_name: str,
    query: dict,
    fields: dict,
    *,
    upsert: bool = False,
    db=None,
) -> dict:
    """Alias of ``update_doc`` — portable ``$set`` for multiple fields."""
    return await update_doc(collection_name, query, fields, upsert=upsert, db=db)
