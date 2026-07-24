from fastapi import APIRouter, HTTPException
from app.db.mongodb import get_db

router = APIRouter()


@router.get("/blog")
async def list_posts():
    db = get_db()
    posts = await db.blog.find().to_list(100)
    return [{"id": p["_id"], **{k: v for k, v in p.items() if k != "_id"}} for p in posts]


@router.get("/blog/{slug}")
async def get_post(slug: str):
    db = get_db()
    post = await db.blog.find_one({"slug": slug})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"id": post["_id"], **{k: v for k, v in post.items() if k != "_id"}}
