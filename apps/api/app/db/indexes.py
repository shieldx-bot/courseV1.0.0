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
    "support_tickets": [
        IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_id_1_created_at_-1"),
        IndexModel([("status", ASCENDING), ("priority", ASCENDING), ("created_at", DESCENDING)], name="status_1_priority_1_created_at_-1"),
        IndexModel([("assigned_to", ASCENDING)], name="assigned_to_1"),
        IndexModel([("category", ASCENDING)], name="category_1"),
    ],
    "ticket_messages": [
        IndexModel([("ticket_id", ASCENDING), ("created_at", ASCENDING)], name="ticket_id_1_created_at_1"),
    ],
    "help_articles": [
        IndexModel([("is_published", ASCENDING), ("category", ASCENDING)], name="is_published_1_category_1"),
        IndexModel([("slug", ASCENDING)], name="slug_1", unique=True),
        IndexModel([("tags", ASCENDING)], name="tags_1"),
    ],
    "support_conversations": [
        IndexModel([("user_id", ASCENDING)], name="user_id_1", unique=True),
    ],
    "user_behavior_events": [
        IndexModel([("user_id", ASCENDING), ("event_type", ASCENDING), ("created_at", DESCENDING)], name="user_id_1_event_type_1_created_at_-1"),
    ],
    "interventions": [
        IndexModel(
            [("user_id", ASCENDING), ("intervention_type", ASCENDING), ("created_at", DESCENDING)],
            name="user_id_1_intervention_type_1_created_at_-1",
        ),
        IndexModel(
            [("status", ASCENDING), ("created_at", DESCENDING)],
            name="status_1_created_at_-1",
        ),
        IndexModel([("user_id", ASCENDING), ("status", ASCENDING)], name="user_id_1_status_1"),
    ],
    "concept_definitions": [
        IndexModel([("course_id", ASCENDING), ("slug", ASCENDING)], name="course_id_1_slug_1"),
        IndexModel([("course_id", ASCENDING)], name="course_id_1"),
        IndexModel([("course_id", ASCENDING), ("is_active", ASCENDING)], name="course_id_1_is_active_1"),
        IndexModel([("slug", ASCENDING)], name="slug_1", unique=True),
        IndexModel([("tags", ASCENDING)], name="tags_1"),
    ],
    "concept_mastery": [
        IndexModel([("user_id", ASCENDING), ("course_id", ASCENDING), ("concept_id", ASCENDING)], name="user_id_1_course_id_1_concept_id_1", unique=True),
        IndexModel([("user_id", ASCENDING), ("concept_id", ASCENDING)], name="user_id_1_concept_id_1"),
        IndexModel([("user_id", ASCENDING), ("course_id", ASCENDING)], name="user_id_1_course_id_1"),
        IndexModel([("concept_id", ASCENDING)], name="concept_id_1"),
    ],
    "quiz_attempts": [
        IndexModel([("user_id", ASCENDING), ("course_id", ASCENDING), ("created_at", DESCENDING)], name="user_id_1_course_id_1_created_at_-1"),
        IndexModel([("user_id", ASCENDING), ("lesson_id", ASCENDING)], name="user_id_1_lesson_id_1"),
    ],
    "quiz_questions": [
        IndexModel(
            [("course_id", ASCENDING), ("concept_id", ASCENDING), ("difficulty", ASCENDING)],
            name="course_id_1_concept_id_1_difficulty_1",
        ),
        IndexModel(
            [("course_id", ASCENDING), ("concept_id", ASCENDING)],
            name="course_id_1_concept_id_1",
        ),
        IndexModel([("concept_id", ASCENDING)], name="concept_id_1"),
    ],
    "remedial_content": [
        IndexModel(
            [("concept_id", ASCENDING), ("content_hash", ASCENDING)],
            name="concept_id_1_content_hash_1",
            unique=True,
        ),
        IndexModel(
            [("course_id", ASCENDING), ("concept_id", ASCENDING)],
            name="course_id_1_concept_id_1",
        ),
    ],
    "error_logs": [
        IndexModel([("timestamp", DESCENDING)], name="timestamp_-1"),
        IndexModel([("source", ASCENDING), ("timestamp", DESCENDING)], name="source_1_timestamp_-1"),
        IndexModel([("level", ASCENDING), ("timestamp", DESCENDING)], name="level_1_timestamp_-1"),
        IndexModel([("fingerprint", ASCENDING)], name="fingerprint_1"),
        IndexModel([("user_id", ASCENDING), ("timestamp", DESCENDING)], name="user_id_1_timestamp_-1"),
        IndexModel([("resolved", ASCENDING), ("timestamp", DESCENDING)], name="resolved_1_timestamp_-1"),
        IndexModel([("category", ASCENDING)], name="category_1"),
        IndexModel([("service", ASCENDING)], name="service_1"),
        IndexModel([("environment", ASCENDING)], name="environment_1"),
        IndexModel([("id", ASCENDING)], name="id_1", unique=True),
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
