"""
Seed categories from seed/categories.json if collection is empty.
"""


async def run(db):
    import json
    from pathlib import Path

    count = await db.categories.count_documents({})
    if count > 0:
        return {"skipped": True, "reason": "categories already exist"}

    path = Path(__file__).parent.parent / "seed" / "categories.json"
    if not path.exists():
        return {"skipped": True, "reason": "seed/categories.json not found"}

    with open(path) as f:
        data = json.load(f)
    await db.categories.insert_many(data)
    return {"inserted": len(data)}
