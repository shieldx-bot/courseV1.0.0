from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.core.deps import require_admin
from app.db.mongodb import get_db

router = APIRouter()


class ContactIn(BaseModel):
    name: str
    email: str
    subject: str
    message: str


@router.post("/contact")
async def submit_contact(body: ContactIn):
    db = get_db()
    contact_id = f"contact-{body.email}-{datetime.now(timezone.utc).timestamp()}"
    await db.contacts.insert_one({
        "_id": contact_id,
        "name": body.name,
        "email": body.email,
        "subject": body.subject,
        "message": body.message,
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"success": True, "id": contact_id}


@router.get("/admin/contacts", dependencies=[Depends(require_admin)])
async def list_contacts():
    db = get_db()
    contacts = await db.contacts.find().to_list(1000)
    return [{"id": c["_id"], **{k: v for k, v in c.items() if k != "_id"}} for c in contacts]
