from fastapi import APIRouter
from app.db.mongodb import get_db

router = APIRouter()


@router.get("/reviews")
async def list_reviews():
    db = get_db()
    reviews = await db.reviews.find().to_list(100)
    return [{"id": r["_id"], **{k: v for k, v in r.items() if k != "_id"}} for r in reviews]
