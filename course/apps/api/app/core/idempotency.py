from datetime import datetime, timezone
from app.db.mongodb import get_db


async def deduplicate(event_id: str) -> bool:
    """Deduplicate an event using a unique index for atomicity."""
    db = get_db()
    try:
        await db.events.insert_one({
            "stripe_event_id": event_id,
            "processed_at": datetime.now(timezone.utc).isoformat(),
        })
        return True
    except Exception:
        return False
