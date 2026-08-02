"""
Ensure all database indexes are created.
"""


async def run(db):
    from app.db.indexes import create_indexes
    await create_indexes(db)
    return {"indexes_ensured": True}
