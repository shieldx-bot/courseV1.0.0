"""Seed concept definitions for Adaptive Learning.

Runs during app startup (see ``app.db.mongodb.seed_db``) if the target
collection is empty. Idempotent: re-running after the collection has data
is a no-op.

Concept ids follow the admin convention ``conc-{course_id}-{slug}``
(see ``app/api/v1/admin_adaptive.py``).
"""
import logging
import re
from datetime import datetime, timezone
from typing import Any

from app.db.mongodb import get_db

logger = logging.getLogger(__name__)


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower().strip())
    return slug.strip("-")


def _concept_id(course_id: str, name: str) -> str:
    return f"conc-{course_id}-{_slugify(name)}"


CONCEPTS: dict[str, list[dict]] = {
    # ── Course 1: SQL for Data Analysis ──
    "course-sql": [
        {
            "name": "SELECT & FROM",
            "description": "Core query structure, filtering rows, selecting columns, and basic query syntax.",
            "difficulty_base": 2,
            "tags": ["sql", "select", "basics"],
            "lesson_ids": ["sql-1"],
            "prerequisite_concepts": [],
        },
        {
            "name": "WHERE & Filtering",
            "description": "Comparison operators, IN, BETWEEN, LIKE, NULL handling, and combined conditions.",
            "difficulty_base": 3,
            "tags": ["sql", "where", "filtering"],
            "lesson_ids": ["sql-2"],
            "prerequisite_concepts": [_concept_id("course-sql", "SELECT & FROM")],
        },
        {
            "name": "JOINs",
            "description": "INNER, LEFT, RIGHT, FULL joins, self-joins, and choosing the right join type.",
            "difficulty_base": 6,
            "tags": ["sql", "joins", "relations"],
            "lesson_ids": ["sql-3"],
            "prerequisite_concepts": [
                _concept_id("course-sql", "SELECT & FROM"),
                _concept_id("course-sql", "WHERE & Filtering"),
            ],
        },
        {
            "name": "Aggregations",
            "description": "GROUP BY, HAVING, aggregate functions, and summarizing datasets.",
            "difficulty_base": 5,
            "tags": ["sql", "aggregation", "groupby"],
            "lesson_ids": ["sql-4"],
            "prerequisite_concepts": [_concept_id("course-sql", "WHERE & Filtering")],
        },
        {
            "name": "Subqueries",
            "description": "Nested queries, correlated subqueries, CTEs, and when to use them vs joins.",
            "difficulty_base": 7,
            "tags": ["sql", "subquery", "cte"],
            "lesson_ids": ["sql-5"],
            "prerequisite_concepts": [
                _concept_id("course-sql", "JOINs"),
                _concept_id("course-sql", "Aggregations"),
            ],
        },
    ],
    # ── Course 2: Python for Data Analytics ──
    "course-python-data": [
        {
            "name": "Jupyter Notebooks Setup",
            "description": "Installation, configuration, and basic usage of Jupyter notebooks for data analysis workflows.",
            "difficulty_base": 2,
            "tags": ["python", "jupyter", "setup"],
            "lesson_ids": ["pyd-1"],
            "prerequisite_concepts": [],
        },
        {
            "name": "Pandas DataFrames",
            "description": "Creating, indexing, and manipulating DataFrames for tabular data analysis.",
            "difficulty_base": 4,
            "tags": ["python", "pandas", "dataframes"],
            "lesson_ids": ["pyd-2"],
            "prerequisite_concepts": [_concept_id("course-python-data", "Jupyter Notebooks Setup")],
        },
        {
            "name": "Data Cleaning",
            "description": "Handling missing values, removing duplicates, and transforming messy datasets.",
            "difficulty_base": 5,
            "tags": ["python", "pandas", "cleaning"],
            "lesson_ids": ["pyd-3"],
            "prerequisite_concepts": [_concept_id("course-python-data", "Pandas DataFrames")],
        },
        {
            "name": "NumPy Arrays",
            "description": "Working with NumPy arrays for efficient numerical computation and data transformation.",
            "difficulty_base": 4,
            "tags": ["python", "numpy", "arrays"],
            "lesson_ids": ["pyd-4"],
            "prerequisite_concepts": [_concept_id("course-python-data", "Jupyter Notebooks Setup")],
        },
        {
            "name": "Data Visualization",
            "description": "Creating plots and charts with Matplotlib and Seaborn to communicate insights.",
            "difficulty_base": 5,
            "tags": ["python", "visualization", "matplotlib"],
            "lesson_ids": ["pyd-5"],
            "prerequisite_concepts": [_concept_id("course-python-data", "Pandas DataFrames")],
        },
    ],
    # ── Course 3: JavaScript Fundamentals ──
    "course-js": [
        {
            "name": "Variables & Types",
            "description": "let, const, var, primitive types, type coercion, and best practices for declaring variables.",
            "difficulty_base": 2,
            "tags": ["javascript", "variables", "types"],
            "lesson_ids": ["js-1"],
            "prerequisite_concepts": [],
        },
        {
            "name": "Functions & Scope",
            "description": "Function declarations vs expressions, arrow functions, lexical scope, and closures.",
            "difficulty_base": 4,
            "tags": ["javascript", "functions", "scope"],
            "lesson_ids": ["js-2"],
            "prerequisite_concepts": [_concept_id("course-js", "Variables & Types")],
        },
        {
            "name": "Closures",
            "description": "How functions retain access to outer scope variables and common closure patterns.",
            "difficulty_base": 6,
            "tags": ["javascript", "closures", "scope"],
            "lesson_ids": ["js-2"],
            "prerequisite_concepts": [_concept_id("course-js", "Functions & Scope")],
        },
        {
            "name": "Promises & Async/Await",
            "description": "Asynchronous JavaScript: Promises, async/await syntax, error handling with try/catch.",
            "difficulty_base": 7,
            "tags": ["javascript", "async", "promises"],
            "lesson_ids": ["js-3"],
            "prerequisite_concepts": [_concept_id("course-js", "Functions & Scope")],
        },
        {
            "name": "DOM Manipulation",
            "description": "Selecting elements, modifying attributes, event listeners, and basic interactivity.",
            "difficulty_base": 4,
            "tags": ["javascript", "dom", "events"],
            "lesson_ids": ["js-1"],
            "prerequisite_concepts": [_concept_id("course-js", "Variables & Types")],
        },
        {
            "name": "Error Handling",
            "description": "try/catch, custom error classes, and defensive programming patterns.",
            "difficulty_base": 5,
            "tags": ["javascript", "errors", "debugging"],
            "lesson_ids": ["js-2"],
            "prerequisite_concepts": [_concept_id("course-js", "Functions & Scope")],
        },
    ],
}


def _concept_docs(course_id: str, concepts: list[dict], now: str) -> list[dict]:
    docs = []
    for c in concepts:
        name = c["name"]
        docs.append({
            "_id": _concept_id(course_id, name),
            "course_id": course_id,
            "name": name,
            "slug": _slugify(name),
            "description": c.get("description", ""),
            "difficulty_base": max(1, min(10, c.get("difficulty_base", 5))),
            "tags": c.get("tags", []),
            "lesson_ids": c.get("lesson_ids", []),
            "prerequisite_concepts": c.get("prerequisite_concepts", []),
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        })
    return docs


async def seed_concepts(db: Any = None) -> None:
    """Idempotently seed `concept_definitions` for the sample courses.

    Skips entirely when the collection already contains any document so a
    deployed database with real concepts is never clobbered.
    """
    db = db or get_db()
    if await db.concept_definitions.count_documents({}) > 0:
        logger.info("Concept definitions already seeded; skipping")
        return

    now = datetime.now(timezone.utc).isoformat()
    docs = []
    for course_id, concepts in CONCEPTS.items():
        docs.extend(_concept_docs(course_id, concepts, now))

    if docs:
        await db.concept_definitions.insert_many(docs, ordered=False)
        logger.info("Seeded %d concept definitions across %d courses", len(docs), len(CONCEPTS))
