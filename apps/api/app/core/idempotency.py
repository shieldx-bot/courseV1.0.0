from datetime import datetime, timezone
from app.db.mongodb import get_db


async def is_already_processed(event_id: str) -> bool:
    db = get_db()
    existing = await db.events.find_one({"stripe_event_id": event_id})
    return existing is not None


async def mark_processed(event_id: str):
    db = get_db()
    await db.events.insert_one({
        "stripe_event_id": event_id,
        "processed_at": datetime.now(timezone.utc).isoformat(),
    })


async def deduplicate(event_id: str) -> bool:
    if await is_already_processed(event_id):
        return False
    await mark_processed(event_id)
    return True
