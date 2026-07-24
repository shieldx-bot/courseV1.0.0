import logging
from app.core.config import settings
from app.db.mongodb import get_db

logger = logging.getLogger(__name__)

INDEX_NAME = "courses"

search_available = False
_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client
    try:
        import meilisearch
        _client = meilisearch.Client(settings.meili_url, settings.meili_master_key)
        _client.health()
        return _client
    except Exception as exc:
        logger.warning("Meilisearch unavailable, falling back to MongoDB search: %s", exc)
        return None


async def init_search():
    global search_available
    client = _get_client()
    if client is None:
        search_available = False
        return
    try:
        if INDEX_NAME not in client.get_indexes():
            client.create_index(INDEX_NAME, {"primaryKey": "id"})
        index = client.index(INDEX_NAME)
        index.update_searchable_attributes(["title", "description", "category_name"])
        index.update_filterable_attributes(["category_slug", "category_name"])
        index.update_sortable_attributes(["lesson_count"])
        search_available = True
        logger.info("Meilisearch index '%s' ready", INDEX_NAME)
    except Exception as exc:
        logger.warning("Meilisearch init failed: %s", exc)
        search_available = False


async def sync_all_courses():
    if not search_available:
        return
    try:
        db = get_db()
        courses = await db.courses.find().to_list(1000)
        documents = [_course_to_doc(c) for c in courses]
        client = _get_client()
        if client:
            client.index(INDEX_NAME).add_documents(documents)
            logger.info("Indexed %d courses", len(documents))
    except Exception as exc:
        logger.warning("Failed to sync courses to Meilisearch: %s", exc)


def index_course(course: dict):
    if not search_available:
        return
    try:
        client = _get_client()
        if client:
            client.index(INDEX_NAME).add_documents([_course_to_doc(course)])
    except Exception as exc:
        logger.warning("Failed to index course: %s", exc)


def delete_course(course_id: str):
    if not search_available:
        return
    try:
        client = _get_client()
        if client:
            client.index(INDEX_NAME).delete_document(course_id)
    except Exception as exc:
        logger.warning("Failed to delete course from index: %s", exc)


async def search_courses(
    q: str,
    category: str = "",
    sort_by: str = "",
    page: int = 1,
    per_page: int = 20,
):
    if not search_available:
        return None

    try:
        client = _get_client()
        if client is None:
            return None
        index = client.index(INDEX_NAME)

        filters = []
        if category:
            filters.append(f'category_slug = "{category}"')

        sort = []
        if sort_by == "lesson_count":
            sort.append("lesson_count:asc")
        elif sort_by == "-lesson_count":
            sort.append("lesson_count:desc")

        search_params = {
            "limit": per_page,
            "offset": (page - 1) * per_page,
        }
        if filters:
            search_params["filter"] = " AND ".join(filters)
        if sort:
            search_params["sort"] = sort

        results = index.search(q, search_params)
        return results
    except Exception as exc:
        logger.warning("Meilisearch search failed: %s", exc)
        return None


def _course_to_doc(course: dict) -> dict:
    lesson_count = course.get("lesson_count", len(course.get("syllabus", [])))
    return {
        "id": course["_id"],
        "title": course.get("title", ""),
        "slug": course.get("slug", ""),
        "description": course.get("description", ""),
        "category_id": course.get("category_id", ""),
        "category_slug": course.get("category_slug", ""),
        "category_name": course.get("category_name", ""),
        "image_url": course.get("image_url", ""),
        "lesson_count": lesson_count,
        "instructor_name": course.get("instructor", {}).get("name", "") if course.get("instructor") else "",
    }
