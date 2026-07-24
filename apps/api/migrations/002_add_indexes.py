"""
Ensure all database indexes are created.
"""


async def run(db):
    from app.db.indexes import ensure_indexes
    await ensure_indexes()
    return {"indexes_ensured": True}
