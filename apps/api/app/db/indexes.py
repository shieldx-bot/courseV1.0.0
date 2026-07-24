import logging
from pymongo import IndexModel, ASCENDING, DESCENDING
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

COLLECTION_INDEXES: dict[str, list[IndexModel]] = {
    "users": [
        IndexModel([("email", ASCENDING)], name="email_1"),
    ],
    "categories": [
        IndexModel([("slug", ASCENDING)], name="slug_1", unique=True),
    ],
    "courses": [
        IndexModel([("slug", ASCENDING)], name="slug_1", unique=True),
        IndexModel([("category_slug", ASCENDING)], name="category_slug_1"),
        IndexModel([("title", ASCENDING), ("category_slug", ASCENDING)], name="title_1_category_slug_1"),
    ],
    "progress": [
        IndexModel(
            [("user_id", ASCENDING), ("course_id", ASCENDING), ("lesson_id", ASCENDING)],
            name="user_id_1_course_id_1_lesson_id_1",
            unique=True,
        ),
        IndexModel([("user_id", ASCENDING)], name="user_id_1"),
    ],
    "subscriptions": [
        IndexModel([("user_id", ASCENDING)], name="user_id_1"),
    ],
    "reviews": [
        IndexModel([("rating", DESCENDING)], name="rating_-1"),
    ],
    "coupons": [
        IndexModel([("code", ASCENDING)], name="code_1", unique=True),
    ],
    "blog": [
        IndexModel([("slug", ASCENDING)], name="slug_1", unique=True),
    ],
    "contacts": [
        IndexModel([("created_at", DESCENDING)], name="created_at_-1"),
    ],
    "email_campaigns": [
        IndexModel([("user_id", ASCENDING), ("campaign_type", ASCENDING)], name="user_id_1_campaign_type_1"),
        IndexModel([("user_id", ASCENDING), ("campaign_type", ASCENDING), ("ref_id", ASCENDING)], name="user_id_1_campaign_type_1_ref_id_1"),
        IndexModel([("sent_at", DESCENDING)], name="sent_at_-1"),
    ],
    "learning_paths": [
        IndexModel([("slug", ASCENDING)], name="slug_1", unique=True),
        IndexModel([("goal", ASCENDING)], name="goal_1"),
    ],
    "user_learning_paths": [
        IndexModel(
            [("user_id", ASCENDING), ("path_id", ASCENDING)],
            name="user_id_1_path_id_1",
            unique=True,
        ),
        IndexModel([("user_id", ASCENDING)], name="user_id_1"),
    ],
    "discussions": [
        IndexModel([("course_id", ASCENDING), ("lesson_id", ASCENDING), ("created_at", DESCENDING)], name="course_id_1_lesson_id_1_created_at_-1"),
        IndexModel([("user_id", ASCENDING)], name="user_id_1"),
        IndexModel([("vote_score", DESCENDING)], name="vote_score_-1"),
    ],
    "replies": [
        IndexModel([("discussion_id", ASCENDING), ("parent_reply_id", ASCENDING), ("created_at", ASCENDING)], name="discussion_id_1_parent_reply_id_1_created_at_1"),
        IndexModel([("user_id", ASCENDING)], name="user_id_1"),
        IndexModel([("vote_score", DESCENDING)], name="vote_score_-1"),
    ],
    "discussion_votes": [
        IndexModel([("discussion_id", ASCENDING), ("user_id", ASCENDING)], name="discussion_id_1_user_id_1", unique=True),
    ],
    "reply_votes": [
        IndexModel([("reply_id", ASCENDING), ("user_id", ASCENDING)], name="reply_id_1_user_id_1", unique=True),
    ],
}


async def create_indexes(db: AsyncIOMotorDatabase) -> None:
    for collection_name, index_models in COLLECTION_INDEXES.items():
        try:
            col = db[collection_name]
            existing = await col.index_information()
            for model in index_models:
                if model.document["name"] not in existing:
                    await col.create_indexes([model])
                    logger.info(
                        "Created index %s on %s",
                        model.document["name"],
                        collection_name,
                    )
        except Exception as exc:
            logger.warning(
                "Could not create indexes for %s: %s", collection_name, exc
            )
