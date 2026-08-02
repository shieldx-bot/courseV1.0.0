"""Parity tests: in-memory DB operators must behave like MongoDB."""
import os
import asyncio

os.environ["MONGODB_URI"] = "memory://test"

from app.db.mongodb import get_db, InMemoryDB  # noqa: E402
from app.db.helpers import (  # noqa: E402
    safe_push_to_array,
    safe_add_to_set,
    create_doc,
    update_doc,
    push_to_array,
    increment_field,
    set_fields,
)


def _run(coro):
    return asyncio.run(coro)


def _clean():
    _run(get_db().parity_test_items.delete_many({}))


def test_push_persists():
    _clean()
    db = get_db()
    _run(db.parity_test_items.insert_one({"_id": "t1", "history": []}))
    _run(db.parity_test_items.update_one({"_id": "t1"}, {"$push": {"history": {"action": "created"}}}))
    _run(db.parity_test_items.update_one({"_id": "t1"}, {"$push": {"history": {"action": "resolved"}}}))
    doc = _run(db.parity_test_items.find_one({"_id": "t1"}))
    assert [h["action"] for h in doc["history"]] == ["created", "resolved"]


def test_push_each_and_add_to_set():
    _clean()
    db = get_db()
    _run(db.parity_test_items.insert_one({"_id": "t2", "tags": ["a"]}))
    _run(db.parity_test_items.update_one({"_id": "t2"}, {"$push": {"tags": {"$each": ["b", "c"]}}}))
    _run(db.parity_test_items.update_one({"_id": "t2"}, {"$addToSet": {"tags": "b"}}))
    _run(db.parity_test_items.update_one({"_id": "t2"}, {"$addToSet": {"tags": "d"}}))
    doc = _run(db.parity_test_items.find_one({"_id": "t2"}))
    assert doc["tags"] == ["a", "b", "c", "d"]


def test_inc_and_dotted_paths():
    _clean()
    db = get_db()
    _run(db.parity_test_items.insert_one({"_id": "t3", "stats": {"attempts": 0}}))
    _run(db.parity_test_items.update_one({"_id": "t3"}, {"$inc": {"stats.attempts": 1}}))
    _run(db.parity_test_items.update_one({"_id": "t3"}, {"$set": {"stats.completion_rate": 0.5}}))
    doc = _run(db.parity_test_items.find_one({"_id": "t3"}))
    assert doc["stats"]["attempts"] == 1
    assert doc["stats"]["completion_rate"] == 0.5


def test_dotted_query_match():
    _clean()
    db = get_db()
    _run(db.parity_test_items.insert_one({"_id": "t4", "related_entity": {"id": "ch-1"}}))
    assert _run(db.parity_test_items.find_one({"related_entity.id": "ch-1"})) is not None


def test_insert_many_ordered_and_upsert_replace():
    _clean()
    db = get_db()
    _run(db.parity_test_items.insert_many([{"_id": "m1"}, {"_id": "m2"}], ordered=False))
    assert _run(db.parity_test_items.count_documents({})) == 2
    _run(db.parity_test_items.update_one({"_id": "u1"}, {"$set": {"name": "first"}}, upsert=True))
    _run(db.parity_test_items.replace_one({"_id": "u1"}, {"_id": "u1", "name": "second"}))
    assert _run(db.parity_test_items.find_one({"_id": "u1"}))["name"] == "second"


def test_unset_and_helpers():
    _clean()
    db = get_db()
    _run(db.parity_test_items.insert_one({"_id": "t5", "a": 1, "b": 2}))
    _run(db.parity_test_items.update_one({"_id": "t5"}, {"$unset": {"a": ""}}))
    assert "a" not in _run(db.parity_test_items.find_one({"_id": "t5"}))

    _run(db.parity_test_items.insert_one({"_id": "h1", "history": []}))
    _run(safe_push_to_array("parity_test_items", {"_id": "h1"}, "history", {"n": 1}))
    _run(safe_add_to_set("parity_test_items", {"_id": "h1"}, "history", {"n": 2}))
    r3 = _run(safe_add_to_set("parity_test_items", {"_id": "h1"}, "history", {"n": 2}))
    assert r3["modified"] is False
    assert len(_run(db.parity_test_items.find_one({"_id": "h1"}))["history"]) == 2


def test_array_containment_and_backend():
    _clean()
    db = get_db()
    _run(db.parity_test_items.insert_many([
        {"_id": "a1", "lesson_ids": ["sql-1", "sql-2"]},
        {"_id": "a2", "lesson_ids": ["sql-3"]},
    ]))
    matches = _run(db.parity_test_items.find({"lesson_ids": "sql-1"}).to_list(length=10))
    assert [m["_id"] for m in matches] == ["a1"]

    from app.core.config import settings
    assert settings.mongodb_uri.startswith("memory:")
    assert isinstance(get_db(), InMemoryDB)

def test_canonical_helpers():
    """create_doc/update_doc/push_to_array/increment_field/set_fields work."""
    _clean()
    db = get_db()
    _run(create_doc("parity_test_items", {"_id": "c1", "stats": {"n": 0}, "tags": [], "name": "x"}))
    _run(update_doc("parity_test_items", {"_id": "c1"}, {"name": "y"}))
    _run(push_to_array("parity_test_items", {"_id": "c1"}, "tags", "a"))
    _run(increment_field("parity_test_items", {"_id": "c1"}, "stats.n"))
    _run(set_fields("parity_test_items", {"_id": "c1"}, {"status": "ok"}))
    doc = _run(db.parity_test_items.find_one({"_id": "c1"}))
    assert doc["name"] == "y"
    assert doc["tags"] == ["a"]
    assert doc["stats"]["n"] == 1
    assert doc["status"] == "ok"
    _run(create_doc("parity_test_items", {"_id": "c1", "name": "z"}))
    doc = _run(db.parity_test_items.find_one({"_id": "c1"}))
    assert doc["name"] == "z"
