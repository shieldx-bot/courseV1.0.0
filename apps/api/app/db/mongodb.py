import logging
import os
from datetime import datetime, timezone
from typing import Any
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

logger = logging.getLogger(__name__)


class _DeleteResult:
    """Minimal stand-in for pymongo's DeleteResult (parity for `.deleted_count`)."""

    def __init__(self, deleted_count: int):
        self.deleted_count = deleted_count


class InMemoryCollection:
    def __init__(self):
        self.data: list[dict] = []

    def find(self, query=None):
        query = query or {}
        results = [d for d in self.data if self._match(d, query)]
        return InMemoryCursor(results)

    async def find_one(self, query=None):
        query = query or {}
        for d in self.data:
            if self._match(d, query):
                return d
        return None

    async def count_documents(self, query=None):
        query = query or {}
        return len([d for d in self.data if self._match(d, query)])

    async def distinct(self, key: str, query=None):
        """Return distinct values for ``key`` (dot-path aware), pymongo parity."""
        query = query or {}
        seen: set = set()
        for d in self.data:
            if not self._match(d, query):
                continue
            val = self._resolve(d, key)
            if val is not None:
                if isinstance(val, list):
                    seen.update(v for v in val if v is not None)
                else:
                    seen.add(val)
        return list(seen)

    async def insert_many(self, docs: list[dict], ordered: bool = True):
        self.data.extend(docs)

    async def insert_one(self, doc: dict):
        self.data.append(doc)

    async def update_one(self, query, update, upsert=False):
        for d in self.data:
            if self._match(d, query):
                self._apply_update(d, update)
                return
        if upsert:
            doc = dict(query)
            self._apply_update(doc, update)
            self.data.append(doc)

    async def update_many(self, query, update):
        for d in self.data:
            if self._match(d, query):
                self._apply_update(d, update)

    async def replace_one(self, query, replacement, upsert=False):
        for i, d in enumerate(self.data):
            if self._match(d, query):
                self.data[i] = replacement
                return
        if upsert:
            self.data.append(replacement)

    async def delete_one(self, query=None):
        query = query or {}
        for i, d in enumerate(self.data):
            if self._match(d, query):
                self.data.pop(i)
                return _DeleteResult(1)
        return _DeleteResult(0)

    async def delete_many(self, query=None):
        query = query or {}
        before = len(self.data)
        self.data = [d for d in self.data if not self._match(d, query)]
        return _DeleteResult(before - len(self.data))

    @staticmethod
    def _resolve(doc: dict, key: str):
        """Resolve a possibly dotted path (e.g. ``related_entity.id``).

        Mirrors MongoDB's behaviour of treating ``{"a.b": v}`` as
        ``{"a": {"b": v}}`` for nested documents.
        """
        if "." not in key:
            return doc.get(key)
        node: Any = doc
        for part in key.split("."):
            if isinstance(node, dict):
                node = node.get(part)
            else:
                return None
        return node

    def _match(self, doc: dict, query: dict) -> bool:
        for key, value in query.items():
            if key == "$or":
                if not any(self._match(doc, clause) for clause in value):
                    return False
                continue
            if isinstance(value, dict):
                if "$regex" in value:
                    import re

                    if not re.search(value["$regex"], str(self._resolve(doc, key) or ""), re.I):
                        return False
                if "$in" in value:
                    if self._resolve(doc, key) not in value["$in"]:
                        return False
                continue
            field_value = self._resolve(doc, key)
            # Array containment parity: MongoDB matches a document when the
            # field is an array that *contains* the queried scalar, e.g.
            # ``find({"lesson_ids": "sql-1"})`` matches
            # ``{"lesson_ids": ["sql-1", ...]}``.
            if isinstance(field_value, list):
                if value not in field_value:
                    return False
            elif field_value != value:
                return False
        return True

    @staticmethod
    def _set_path(doc: dict, path: str, value: Any) -> None:
        """Set ``value`` at a (possibly dotted) path, creating parents."""
        node = doc
        parts = path.split(".")
        for part in parts[:-1]:
            nxt = node.get(part)
            if not isinstance(nxt, dict):
                nxt = {}
                node[part] = nxt
            node = nxt
        node[parts[-1]] = value

    @staticmethod
    def _get_path(doc: dict, path: str, default=None):
        node = doc
        for part in path.split("."):
            if isinstance(node, dict) and part in node:
                node = node[part]
            else:
                return default
        return node

    @staticmethod
    def _del_path(doc: dict, path: str) -> None:
        node = doc
        parts = path.split(".")
        for part in parts[:-1]:
            if not isinstance(node, dict):
                return
            node = node.get(part)
            if not isinstance(node, dict):
                return
        if isinstance(node, dict):
            node.pop(parts[-1], None)

    def _apply_update(self, doc: dict, update: dict) -> None:
        """Apply a MongoDB-style update document to ``doc`` in place.

        Supports the operators used across the codebase and tests:
        ``$set``, ``$push``, ``$addToSet``, ``$inc``, ``$unset``,
        ``$setOnInsert``, ``$currentDate``. Dotted paths (e.g.
        ``"stats.attempts"``) are resolved as nested fields, mirroring
        MongoDB. Unsupported operators are silently ignored (mirrors the
        previous permissive behaviour).
        """
        for op, payload in update.items():
            if op == "$set":
                for k, v in payload.items():
                    self._set_path(doc, k, v)
            elif op == "$setOnInsert":
                for k, v in payload.items():
                    if self._get_path(doc, k) is None:
                        self._set_path(doc, k, v)
            elif op == "$unset":
                for k in payload:
                    self._del_path(doc, k)
            elif op == "$inc":
                for k, v in payload.items():
                    cur = self._get_path(doc, k, 0) or 0
                    self._set_path(doc, k, cur + v)
            elif op == "$push":
                for k, v in payload.items():
                    bucket = self._get_path(doc, k)
                    if not isinstance(bucket, list):
                        bucket = []
                        self._set_path(doc, k, bucket)
                    if isinstance(v, dict) and "$each" in v:
                        bucket.extend(v["$each"])
                    else:
                        bucket.append(v)
            elif op == "$addToSet":
                for k, v in payload.items():
                    bucket = self._get_path(doc, k)
                    if not isinstance(bucket, list):
                        bucket = []
                        self._set_path(doc, k, bucket)
                    if isinstance(v, dict) and "$each" in v:
                        for item in v["$each"]:
                            if item not in bucket:
                                bucket.append(item)
                    elif v not in bucket:
                        bucket.append(v)
            elif op == "$currentDate":
                import datetime as _dt

                for k, v in payload.items():
                    if v is True or (isinstance(v, dict) and v.get("$type") == "date"):
                        self._set_path(doc, k, _dt.datetime.now(_dt.timezone.utc))
            # Unknown operators are intentionally ignored to keep the
            # in-memory backend tolerant (matches previous behaviour).


class InMemoryCursor:
    def __init__(self, data: list[dict]):
        self.data = data

    async def to_list(self, length=None):
        return self.data

    async def __aiter__(self):
        for item in self.data:
            yield item

    def sort(self, *args, **kwargs):
        return self

    def skip(self, n: int):
        self.data = self.data[n:]
        return self

    def limit(self, n: int):
        self.data = self.data[:n]
        return self


class InMemoryDB:
    def __init__(self):
        self._collections: dict[str, InMemoryCollection] = {}

    def __getitem__(self, name: str):
        if name not in self._collections:
            self._collections[name] = InMemoryCollection()
        return self._collections[name]

    def __getattr__(self, name: str):
        return self[name]


client: AsyncIOMotorClient | None = None
secondary_client: AsyncIOMotorClient | None = None
memory_db: InMemoryDB | None = None


def get_db():
    global memory_db
    if settings.mongodb_uri.startswith("memory:"):
        if memory_db is None:
            memory_db = InMemoryDB()
        return memory_db

    global client
    if client is None:
        client = AsyncIOMotorClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000)
    return client["ascendly"]


def get_read_db():
    """Get database connection for read-heavy operations."""
    global memory_db
    if settings.mongodb_uri.startswith("memory:"):
        if memory_db is None:
            memory_db = InMemoryDB()
        return memory_db

    global secondary_client
    if secondary_client is None:
        secondary_client = AsyncIOMotorClient(
            settings.mongodb_uri,
            serverSelectionTimeoutMS=5000,
        )
    return secondary_client["ascendly"]


def get_redis():
    try:
        import redis as _redis

        return _redis.from_url(settings.redis_url)
    except Exception:
        return None


async def seed_db():
    db = get_db()
    if await db.users.count_documents({}) == 0:
        await db.users.insert_one({
            "_id": "user-admin@ascendly.io",
            "email": "admin@ascendly.io",
            "password_hash": "$2b$12$3vIAp6VEfE8CD4zAirV2KOYJob2Aci6jW43MrhdFuZ2Mwnb9swCF6",  # password: password
            "phone": None,
            "phone_verified": False,
            "role": "admin",
        })

    if await db.categories.count_documents({}) == 0:
        categories = [
            {"_id": "cat-marketing", "name": "Marketing & Advertising", "slug": "marketing", "icon": "briefcase", "course_count": 240},
            {"_id": "cat-ai", "name": "AI & New Technology", "slug": "ai", "icon": "brain", "course_count": 180},
            {"_id": "cat-programming", "name": "Programming & Software", "slug": "programming", "icon": "code", "course_count": 420},
            {"_id": "cat-design", "name": "Design & Creative", "slug": "design", "icon": "palette", "course_count": 310},
            {"_id": "cat-data", "name": "Data & Analytics", "slug": "data", "icon": "database", "course_count": 260},
            {"_id": "cat-business", "name": "Business & Investment", "slug": "business", "icon": "bar-chart", "course_count": 330},
            {"_id": "cat-career", "name": "Career & Professional Skills", "slug": "career", "icon": "users", "course_count": 190},
        ]
        await db.categories.insert_many(categories)

    if await db.courses.count_documents({}) == 0:
        courses = [
            # ── Data & Analytics ──
            {
                "_id": "course-excel",
                "category_id": "cat-data", "category_slug": "data", "category_name": "Data & Analytics",
                "title": "Excel for Busy Professionals",
                "slug": "excel-for-busy-professionals",
                "description": "Learn Excel well enough to run your team's reporting — from core formulas to pivot tables and dashboards.",
                "image_url": "", "lesson_count": 12,
                "instructor": {"name": "David Chen", "bio": "Data analyst with 10+ years at Fortune 500 companies."},
                "syllabus": [
                    {"id": "lesson-1", "title": "Course introduction", "order": 1, "duration_seconds": 300},
                    {"id": "lesson-2", "title": "Setting up your workspace", "order": 2, "duration_seconds": 420},
                    {"id": "lesson-3", "title": "Core formulas", "order": 3, "duration_seconds": 540},
                    {"id": "lesson-4", "title": "Pivot tables", "order": 4, "duration_seconds": 600},
                    {"id": "lesson-5", "title": "Charts and dashboards", "order": 5, "duration_seconds": 780},
                ],
                "outcome": [
                    "Build a rolling 12-month forecast in Excel",
                    "Create pivot tables that update automatically",
                    "Design dashboards your manager can read",
                    "Use lookups without memorizing every formula",
                ],
            },
            {
                "_id": "course-powerbi",
                "category_id": "cat-data", "category_slug": "data", "category_name": "Data & Analytics",
                "title": "Power BI Fundamentals",
                "slug": "power-bi-fundamentals",
                "description": "Go from first dataset to team report. Model, visualize, and share insights with Power BI.",
                "image_url": "", "lesson_count": 14,
                "instructor": {"name": "Sarah Lin", "bio": "BI consultant who has deployed dashboards for 50+ organizations."},
                "syllabus": [
                    {"id": "pb-1", "title": "Power BI overview", "order": 1, "duration_seconds": 360},
                    {"id": "pb-2", "title": "Data modeling", "order": 2, "duration_seconds": 480},
                    {"id": "pb-3", "title": "DAX essentials", "order": 3, "duration_seconds": 540},
                ],
                "outcome": [
                    "Model a star schema from messy source data",
                    "Write DAX measures that answer business questions",
                    "Publish dashboards to Power BI Service",
                ],
            },
            {
                "_id": "course-sql",
                "category_id": "cat-data", "category_slug": "data", "category_name": "Data & Analytics",
                "title": "SQL for Data Analysis",
                "slug": "sql-for-data-analysis",
                "description": "Extract, filter, and aggregate data like a pro. No prior coding experience needed.",
                "image_url": "", "lesson_count": 10,
                "instructor": {"name": "James Okafor", "bio": "Data engineer who has trained 5000+ analysts in SQL."},
                "syllabus": [
                    {"id": "sql-1", "title": "SELECT & FROM", "order": 1, "duration_seconds": 360},
                    {"id": "sql-2", "title": "WHERE & filtering", "order": 2, "duration_seconds": 420},
                    {"id": "sql-3", "title": "JOINs", "order": 3, "duration_seconds": 540},
                ],
                "outcome": [
                    "Write queries that answer real business questions",
                    "Join multiple tables without losing data",
                    "Use window functions for advanced analytics",
                ],
            },
            {
                "_id": "course-python-data",
                "category_id": "cat-data", "category_slug": "data", "category_name": "Data & Analytics",
                "title": "Python for Data Analytics",
                "slug": "python-for-data-analytics",
                "description": "Pandas, NumPy, and visualization libraries to turn raw data into actionable insights.",
                "image_url": "", "lesson_count": 16,
                "instructor": {"name": "Aisha Patel", "bio": "Data scientist at a FAANG company."},
                "syllabus": [
                    {"id": "pyd-1", "title": "Jupyter notebooks setup", "order": 1, "duration_seconds": 300},
                    {"id": "pyd-2", "title": "Pandas DataFrames", "order": 2, "duration_seconds": 600},
                    {"id": "pyd-3", "title": "Data cleaning", "order": 3, "duration_seconds": 540},
                ],
                "outcome": [
                    "Clean and transform messy datasets with Pandas",
                    "Create publication-ready plots with Matplotlib",
                    "Automate recurring analysis tasks",
                ],
            },

            # ── Programming & Software ──
            {
                "_id": "course-js",
                "category_id": "cat-programming", "category_slug": "programming", "category_name": "Programming & Software",
                "title": "JavaScript Fundamentals",
                "slug": "javascript-fundamentals",
                "description": "Master the language that powers the web — from variables to async programming.",
                "image_url": "", "lesson_count": 18,
                "instructor": {"name": "Alex Kim", "bio": "Full-stack developer and author of two JS textbooks."},
                "syllabus": [
                    {"id": "js-1", "title": "Variables & types", "order": 1, "duration_seconds": 360},
                    {"id": "js-2", "title": "Functions & scope", "order": 2, "duration_seconds": 480},
                    {"id": "js-3", "title": "Promises & async/await", "order": 3, "duration_seconds": 600},
                ],
                "outcome": [
                    "Build interactive web pages from scratch",
                    "Debug JavaScript code efficiently",
                    "Use modern ES6+ syntax confidently",
                ],
            },
            {
                "_id": "course-react",
                "category_id": "cat-programming", "category_slug": "programming", "category_name": "Programming & Software",
                "title": "React for Modern Web Apps",
                "slug": "react-for-modern-web-apps",
                "description": "Build fast, scalable user interfaces with React hooks, context, and Next.js.",
                "image_url": "", "lesson_count": 20,
                "instructor": {"name": "Emma Wilson", "bio": "Senior front-end engineer at a top SaaS company."},
                "syllabus": [
                    {"id": "react-1", "title": "Components & JSX", "order": 1, "duration_seconds": 420},
                    {"id": "react-2", "title": "State & effects", "order": 2, "duration_seconds": 540},
                    {"id": "react-3", "title": "Routing with Next.js", "order": 3, "duration_seconds": 600},
                ],
                "outcome": [
                    "Build single-page applications with React",
                    "Manage global state without Redux",
                    "Deploy a full-stack Next.js app",
                ],
            },
            {
                "_id": "course-python",
                "category_id": "cat-programming", "category_slug": "programming", "category_name": "Programming & Software",
                "title": "Python 3: From Zero to Job-Ready",
                "slug": "python-3-from-zero-to-job-ready",
                "description": "The most practical Python course — build CLI tools, APIs, and automation scripts.",
                "image_url": "", "lesson_count": 22,
                "instructor": {"name": "Nina Reddy", "bio": "Backend architect with 8 years of Python experience."},
                "syllabus": [
                    {"id": "py-1", "title": "Data types & control flow", "order": 1, "duration_seconds": 360},
                    {"id": "py-2", "title": "Functions & modules", "order": 2, "duration_seconds": 420},
                    {"id": "py-3", "title": "File I/O & error handling", "order": 3, "duration_seconds": 480},
                ],
                "outcome": [
                    "Write production-ready Python scripts",
                    "Build REST APIs with FastAPI",
                    "Automate repetitive tasks with Python",
                ],
            },
            {
                "_id": "course-git",
                "category_id": "cat-programming", "category_slug": "programming", "category_name": "Programming & Software",
                "title": "Git & GitHub: Version Control for Teams",
                "slug": "git-and-github-version-control-for-teams",
                "description": "Collaborate confidently — branching, rebasing, code reviews, and CI/CD workflows.",
                "image_url": "", "lesson_count": 8,
                "instructor": {"name": "Tom Mueller", "bio": "DevOps lead who migrated 200-person org to trunk-based development."},
                "syllabus": [
                    {"id": "git-1", "title": "Why version control", "order": 1, "duration_seconds": 240},
                    {"id": "git-2", "title": "Branching strategies", "order": 2, "duration_seconds": 480},
                    {"id": "git-3", "title": "Pull requests & reviews", "order": 3, "duration_seconds": 360},
                ],
                "outcome": [
                    "Resolve merge conflicts without fear",
                    "Implement a clean Git workflow for your team",
                    "Automate testing with GitHub Actions",
                ],
            },

            # ── Design & Creative ──
            {
                "_id": "course-figma",
                "category_id": "cat-design", "category_slug": "design", "category_name": "Design & Creative",
                "title": "Figma for UI/UX Design",
                "slug": "figma-for-ui-ux-design",
                "description": "Design beautiful interfaces and interactive prototypes — from wireframe to handoff.",
                "image_url": "", "lesson_count": 14,
                "instructor": {"name": "Lisa Chang", "bio": "Product designer who has shipped apps used by millions."},
                "syllabus": [
                    {"id": "fig-1", "title": "Figma basics", "order": 1, "duration_seconds": 360},
                    {"id": "fig-2", "title": "Design systems", "order": 2, "duration_seconds": 540},
                    {"id": "fig-3", "title": "Interactive prototypes", "order": 3, "duration_seconds": 480},
                ],
                "outcome": [
                    "Create a design system from scratch",
                    "Build clickable prototypes for user testing",
                    "Hand off designs that developers love",
                ],
            },
            {
                "_id": "course-illustrator",
                "category_id": "cat-design", "category_slug": "design", "category_name": "Design & Creative",
                "title": "Adobe Illustrator Masterclass",
                "slug": "adobe-illustrator-masterclass",
                "description": "Vector graphics for branding, illustration, and print — no prior art degree required.",
                "image_url": "", "lesson_count": 16,
                "instructor": {"name": "Carlos Mendez", "bio": "Award-winning graphic designer with 15 years of experience."},
                "syllabus": [
                    {"id": "ai-1", "title": "Pen tool & shapes", "order": 1, "duration_seconds": 480},
                    {"id": "ai-2", "title": "Typography", "order": 2, "duration_seconds": 420},
                    {"id": "ai-3", "title": "Logo design project", "order": 3, "duration_seconds": 600},
                ],
                "outcome": [
                    "Create professional vector illustrations",
                    "Design logos and brand assets",
                    "Prepare print-ready files",
                ],
            },
            {
                "_id": "course-canva",
                "category_id": "cat-design", "category_slug": "design", "category_name": "Design & Creative",
                "title": "Canva for Social Media & Branding",
                "slug": "canva-for-social-media-and-branding",
                "description": "Design scroll-stopping social graphics, presentations, and marketing materials fast.",
                "image_url": "", "lesson_count": 8,
                "instructor": {"name": "Rachel Green", "bio": "Social media manager with 500k+ followers across platforms."},
                "syllabus": [
                    {"id": "can-1", "title": "Canva interface", "order": 1, "duration_seconds": 240},
                    {"id": "can-2", "title": "Templates & brand kits", "order": 2, "duration_seconds": 360},
                    {"id": "can-3", "title": "Video & animation", "order": 3, "duration_seconds": 420},
                ],
                "outcome": [
                    "Design on-brand social media content in minutes",
                    "Create engaging video stories and reels",
                    "Build a consistent visual brand identity",
                ],
            },
            {
                "_id": "course-blender",
                "category_id": "cat-design", "category_slug": "design", "category_name": "Design & Creative",
                "title": "Blender 3D for Beginners",
                "slug": "blender-3d-for-beginners",
                "description": "Model, texture, and render 3D scenes with Blender — the free open-source 3D suite.",
                "image_url": "", "lesson_count": 18,
                "instructor": {"name": "Yuki Tanaka", "bio": "3D artist who has worked on indie games and commercials."},
                "syllabus": [
                    {"id": "bl-1", "title": "Navigation & viewport", "order": 1, "duration_seconds": 360},
                    {"id": "bl-2", "title": "Modeling basics", "order": 2, "duration_seconds": 600},
                    {"id": "bl-3", "title": "Materials & lighting", "order": 3, "duration_seconds": 540},
                ],
                "outcome": [
                    "Model 3D objects from reference images",
                    "Apply realistic materials and lighting",
                    "Render portfolio-ready scenes",
                ],
            },

            # ── Marketing & Advertising ──
            {
                "_id": "course-seo",
                "category_id": "cat-marketing", "category_slug": "marketing", "category_name": "Marketing & Advertising",
                "title": "SEO That Actually Works in 2026",
                "slug": "seo-that-actually-works-in-2026",
                "description": "Rank higher on Google with modern SEO — AI content, EEAT, technical audits, and link building.",
                "image_url": "", "lesson_count": 12,
                "instructor": {"name": "Brian Foster", "bio": "SEO lead who grew organic traffic from 0 to 2M monthly visitors."},
                "syllabus": [
                    {"id": "seo-1", "title": "How search engines work", "order": 1, "duration_seconds": 360},
                    {"id": "seo-2", "title": "Keyword research", "order": 2, "duration_seconds": 480},
                    {"id": "seo-3", "title": "Technical SEO audit", "order": 3, "duration_seconds": 600},
                ],
                "outcome": [
                    "Rank pages in the top 10 of Google",
                    "Conduct a technical SEO audit",
                    "Build a content strategy that earns backlinks",
                ],
            },
            {
                "_id": "course-google-ads",
                "category_id": "cat-marketing", "category_slug": "marketing", "category_name": "Marketing & Advertising",
                "title": "Google Ads & PPC Management",
                "slug": "google-ads-and-ppc-management",
                "description": "Run profitable ad campaigns on Google — search, shopping, display, and performance max.",
                "image_url": "", "lesson_count": 14,
                "instructor": {"name": "Danielle Park", "bio": "PPC specialist managing $5M+ annual ad spend."},
                "syllabus": [
                    {"id": "ads-1", "title": "Campaign structure", "order": 1, "duration_seconds": 360},
                    {"id": "ads-2", "title": "Keyword & match types", "order": 2, "duration_seconds": 480},
                    {"id": "ads-3", "title": "Bid strategies", "order": 3, "duration_seconds": 420},
                ],
                "outcome": [
                    "Set up and optimize Google Ads campaigns",
                    "Reduce CPA while scaling spend",
                    "Analyze and report on campaign performance",
                ],
            },
            {
                "_id": "course-content-marketing",
                "category_id": "cat-marketing", "category_slug": "marketing", "category_name": "Marketing & Advertising",
                "title": "Content Marketing Playbook",
                "slug": "content-marketing-playbook",
                "description": "Attract, engage, and convert audiences with blogs, videos, newsletters, and lead magnets.",
                "image_url": "", "lesson_count": 10,
                "instructor": {"name": "Sophia Adams", "bio": "Content strategist for B2B SaaS brands."},
                "syllabus": [
                    {"id": "cm-1", "title": "Content strategy framework", "order": 1, "duration_seconds": 360},
                    {"id": "cm-2", "title": "Writing that converts", "order": 2, "duration_seconds": 480},
                    {"id": "cm-3", "title": "Distribution & promotion", "order": 3, "duration_seconds": 360},
                ],
                "outcome": [
                    "Build a content calendar that drives traffic",
                    "Write copy that converts readers into customers",
                    "Grow an email newsletter from zero",
                ],
            },
            {
                "_id": "course-tiktok",
                "category_id": "cat-marketing", "category_slug": "marketing", "category_name": "Marketing & Advertising",
                "title": "TikTok & Short-Form Video Marketing",
                "slug": "tiktok-and-short-form-video-marketing",
                "description": "Go viral (or at least get views) — script, shoot, edit, and optimize short-form videos.",
                "image_url": "", "lesson_count": 8,
                "instructor": {"name": "Jake Thompson", "bio": "Creator with 3M+ followers across TikTok and Instagram."},
                "syllabus": [
                    {"id": "tt-1", "title": "Algorithm explained", "order": 1, "duration_seconds": 240},
                    {"id": "tt-2", "title": "Scripting for retention", "order": 2, "duration_seconds": 360},
                    {"id": "tt-3", "title": "Editing on mobile", "order": 3, "duration_seconds": 480},
                ],
                "outcome": [
                    "Script videos that hook viewers in 3 seconds",
                    "Edit short-form videos on your phone",
                    "Grow a following from zero",
                ],
            },

            # ── AI & New Technology ──
            {
                "_id": "course-chatgpt",
                "category_id": "cat-ai", "category_slug": "ai", "category_name": "AI & New Technology",
                "title": "ChatGPT & Prompt Engineering",
                "slug": "chatgpt-and-prompt-engineering",
                "description": "Stop treating AI like a magic box. Learn to craft prompts that deliver consistent, useful results.",
                "image_url": "", "lesson_count": 10,
                "instructor": {"name": "Dr. Anika Sharma", "bio": "AI researcher and author of 'Prompting for Professionals'."},
                "syllabus": [
                    {"id": "gpt-1", "title": "How LLMs work", "order": 1, "duration_seconds": 360},
                    {"id": "gpt-2", "title": "Prompt patterns", "order": 2, "duration_seconds": 540},
                    {"id": "gpt-3", "title": "Chain-of-thought", "order": 3, "duration_seconds": 480},
                ],
                "outcome": [
                    "Write prompts that produce reliable outputs",
                    "Use AI to automate writing, coding, and analysis",
                    "Build custom GPTs for your workflow",
                ],
            },
            {
                "_id": "course-ml",
                "category_id": "cat-ai", "category_slug": "ai", "category_name": "AI & New Technology",
                "title": "Machine Learning with scikit-learn",
                "slug": "machine-learning-with-scikit-learn",
                "description": "Build, evaluate, and deploy ML models — no PhD required.",
                "image_url": "", "lesson_count": 16,
                "instructor": {"name": "Michael Torres", "bio": "ML engineer who built production models at two unicorns."},
                "syllabus": [
                    {"id": "ml-1", "title": "Supervised learning", "order": 1, "duration_seconds": 480},
                    {"id": "ml-2", "title": "Model evaluation", "order": 2, "duration_seconds": 420},
                    {"id": "ml-3", "title": "Feature engineering", "order": 3, "duration_seconds": 600},
                ],
                "outcome": [
                    "Train classification and regression models",
                    "Avoid overfitting with cross-validation",
                    "Deploy a model as a REST API",
                ],
            },
            {
                "_id": "course-ai-agents",
                "category_id": "cat-ai", "category_slug": "ai", "category_name": "AI & New Technology",
                "title": "AI Agents & Automation",
                "slug": "ai-agents-and-automation",
                "description": "Build autonomous AI agents that browse the web, use tools, and complete tasks for you.",
                "image_url": "", "lesson_count": 12,
                "instructor": {"name": "Ryan O'Brien", "bio": "Founder of a YC-backed AI automation startup."},
                "syllabus": [
                    {"id": "ag-1", "title": "What are AI agents", "order": 1, "duration_seconds": 360},
                    {"id": "ag-2", "title": "Tool use & function calling", "order": 2, "duration_seconds": 540},
                    {"id": "ag-3", "title": "Building a research agent", "order": 3, "duration_seconds": 720},
                ],
                "outcome": [
                    "Build AI agents that browse and extract web data",
                    "Automate multi-step workflows with AI",
                    "Deploy agents that run on schedules",
                ],
            },
            {
                "_id": "course-blockchain",
                "category_id": "cat-ai", "category_slug": "ai", "category_name": "AI & New Technology",
                "title": "Blockchain & Web3 Fundamentals",
                "slug": "blockchain-and-web3-fundamentals",
                "description": "Understand blockchain, smart contracts, and decentralized apps — beyond the hype.",
                "image_url": "", "lesson_count": 10,
                "instructor": {"name": "Viktor Petrov", "bio": "Blockchain engineer who contributed to Ethereum core."},
                "syllabus": [
                    {"id": "bc-1", "title": "How blockchain works", "order": 1, "duration_seconds": 360},
                    {"id": "bc-2", "title": "Smart contracts", "order": 2, "duration_seconds": 540},
                    {"id": "bc-3", "title": "DeFi & NFTs", "order": 3, "duration_seconds": 480},
                ],
                "outcome": [
                    "Explain blockchain concepts with confidence",
                    "Read and audit simple smart contracts",
                    "Evaluate Web3 investment opportunities",
                ],
            },

            # ── Business & Investment ──
            {
                "_id": "course-finance",
                "category_id": "cat-business", "category_slug": "business", "category_name": "Business & Investment",
                "title": "Financial Literacy for Professionals",
                "slug": "financial-literacy-for-professionals",
                "description": "Read P&Ls, build budgets, and make data-driven business cases your CFO will approve.",
                "image_url": "", "lesson_count": 10,
                "instructor": {"name": "Jennifer Wu", "bio": "Ex-McKinsey finance consultant turned startup CFO."},
                "syllabus": [
                    {"id": "fin-1", "title": "Reading financial statements", "order": 1, "duration_seconds": 420},
                    {"id": "fin-2", "title": "Budgeting & forecasting", "order": 2, "duration_seconds": 480},
                    {"id": "fin-3", "title": "Unit economics", "order": 3, "duration_seconds": 540},
                ],
                "outcome": [
                    "Read and interpret income statements and balance sheets",
                    "Build a departmental budget from scratch",
                    "Calculate unit economics for your business",
                ],
            },
            {
                "_id": "course-investing",
                "category_id": "cat-business", "category_slug": "business", "category_name": "Business & Investment",
                "title": "Stock Market & Investing 101",
                "slug": "stock-market-and-investing-101",
                "description": "Build wealth over time — ETFs, index funds, dividends, and portfolio allocation.",
                "image_url": "", "lesson_count": 12,
                "instructor": {"name": "Mark Reynolds", "bio": "Portfolio manager with 20 years of market experience."},
                "syllabus": [
                    {"id": "inv-1", "title": "Stocks, bonds, ETFs", "order": 1, "duration_seconds": 360},
                    {"id": "inv-2", "title": "Risk & diversification", "order": 2, "duration_seconds": 480},
                    {"id": "inv-3", "title": "Portfolio rebalancing", "order": 3, "duration_seconds": 420},
                ],
                "outcome": [
                    "Build a diversified investment portfolio",
                    "Understand risk-adjusted returns",
                    "Invest consistently without emotional decisions",
                ],
            },
            {
                "_id": "course-entrepreneurship",
                "category_id": "cat-business", "category_slug": "business", "category_name": "Business & Investment",
                "title": "Lean Startup: Launch Your MVP in 30 Days",
                "slug": "lean-startup-launch-your-mvp-in-30-days",
                "description": "Validate an idea, build a minimum viable product, and find your first customers — fast.",
                "image_url": "", "lesson_count": 14,
                "instructor": {"name": "Hannah Bell", "bio": "Serial entrepreneur with 3 exits."},
                "syllabus": [
                    {"id": "ent-1", "title": "Problem validation", "order": 1, "duration_seconds": 360},
                    {"id": "ent-2", "title": "Building an MVP", "order": 2, "duration_seconds": 600},
                    {"id": "ent-3", "title": "Customer discovery", "order": 3, "duration_seconds": 480},
                ],
                "outcome": [
                    "Validate a business idea in one week",
                    "Build a no-code MVP",
                    "Get your first 10 paying customers",
                ],
            },
            {
                "_id": "course-project-management",
                "category_id": "cat-business", "category_slug": "business", "category_name": "Business & Investment",
                "title": "Project Management Professional (PMP) Prep",
                "slug": "project-management-professional-pmp-prep",
                "description": "Pass the PMP exam on your first try — agile, predictive, and hybrid approaches covered.",
                "image_url": "", "lesson_count": 20,
                "instructor": {"name": "Angela Davis", "bio": "PMP-certified trainer who has coached 2000+ candidates."},
                "syllabus": [
                    {"id": "pmp-1", "title": "PMP exam overview", "order": 1, "duration_seconds": 360},
                    {"id": "pmp-2", "title": "Agile methodologies", "order": 2, "duration_seconds": 540},
                    {"id": "pmp-3", "title": "Risk management", "order": 3, "duration_seconds": 480},
                ],
                "outcome": [
                    "Pass the PMP certification exam",
                    "Manage projects using agile and waterfall",
                    "Lead cross-functional teams effectively",
                ],
            },

            # ── Career & Professional Skills ──
            {
                "_id": "course-leadership",
                "category_id": "cat-career", "category_slug": "career", "category_name": "Career & Professional Skills",
                "title": "Leadership for New Managers",
                "slug": "leadership-for-new-managers",
                "description": "The practical management skills nobody teaches you when you first get promoted.",
                "image_url": "", "lesson_count": 10,
                "instructor": {"name": "Maria Torres", "bio": "Former VP of Engineering who has mentored 100+ new managers."},
                "syllabus": [
                    {"id": "lm-1", "title": "From peer to manager", "order": 1, "duration_seconds": 300},
                    {"id": "lm-2", "title": "One-on-ones that work", "order": 2, "duration_seconds": 420},
                ],
                "outcome": [
                    "Run effective one-on-ones",
                    "Delegate without micromanaging",
                    "Give feedback people actually act on",
                ],
            },
            {
                "_id": "course-communication",
                "category_id": "cat-career", "category_slug": "career", "category_name": "Career & Professional Skills",
                "title": "Business Communication & Presentation Skills",
                "slug": "business-communication-and-presentation-skills",
                "description": "Write clearly, speak confidently, and present ideas that get buy-in from stakeholders.",
                "image_url": "", "lesson_count": 10,
                "instructor": {"name": "Chris Bennett", "bio": "Former TEDx speaker coach."},
                "syllabus": [
                    {"id": "comm-1", "title": "Writing for impact", "order": 1, "duration_seconds": 360},
                    {"id": "comm-2", "title": "Presentation design", "order": 2, "duration_seconds": 480},
                    {"id": "comm-3", "title": "Handling Q&A", "order": 3, "duration_seconds": 360},
                ],
                "outcome": [
                    "Write concise emails and reports that get read",
                    "Deliver presentations that drive decisions",
                    "Handle tough questions with confidence",
                ],
            },
            {
                "_id": "course-resume",
                "category_id": "cat-career", "category_slug": "career", "category_name": "Career & Professional Skills",
                "title": "Resume Writing & Job Search Strategy",
                "slug": "resume-writing-and-job-search-strategy",
                "description": "Land more interviews with a compelling resume, LinkedIn profile, and networking approach.",
                "image_url": "", "lesson_count": 8,
                "instructor": {"name": "Emily Hart", "bio": "Career coach who has placed 500+ candidates at top companies."},
                "syllabus": [
                    {"id": "res-1", "title": "Resume formats", "order": 1, "duration_seconds": 360},
                    {"id": "res-2", "title": "LinkedIn optimization", "order": 2, "duration_seconds": 420},
                    {"id": "res-3", "title": "Interview preparation", "order": 3, "duration_seconds": 480},
                ],
                "outcome": [
                    "Write a resume that passes ATS screening",
                    "Build a LinkedIn profile recruiters notice",
                    "Negotiate your job offer confidently",
                ],
            },
            {
                "_id": "course-public-speaking",
                "category_id": "cat-career", "category_slug": "career", "category_name": "Career & Professional Skills",
                "title": "Public Speaking & Storytelling",
                "slug": "public-speaking-and-storytelling",
                "description": "Overcome stage fright and deliver talks that inspire, persuade, and get remembered.",
                "image_url": "", "lesson_count": 10,
                "instructor": {"name": "Diana Price", "bio": "Professional speaker with 3 TEDx talks."},
                "syllabus": [
                    {"id": "ps-1", "title": "Finding your story", "order": 1, "duration_seconds": 360},
                    {"id": "ps-2", "title": "Vocal variety", "order": 2, "duration_seconds": 420},
                    {"id": "ps-3", "title": "Stage presence", "order": 3, "duration_seconds": 480},
                ],
                "outcome": [
                    "Deliver a 5-minute talk without notes",
                    "Use storytelling to make any topic engaging",
                    "Handle Q&A and unexpected moments",
                ],
            },
        ]
        await db.courses.insert_many(courses)

    if await db.reviews.count_documents({}) == 0:
        reviews = [
            {"_id": "rev-1", "name": "Sarah Lin", "role": "Operations Analyst", "rating": 5, "outcome": "I finally understood Power BI well enough to run our team's weekly report.", "quote": "The course is structured exactly how I learn."},
            {"_id": "rev-2", "name": "Marcus Rivera", "role": "Marketing Coordinator", "rating": 5, "outcome": "Excel skills that got me noticed for the promotion I wanted.", "quote": "I use what I learned every single day."},
            {"_id": "rev-3", "name": "Priya Shah", "role": "Junior UX Designer", "rating": 4, "outcome": "Went from admin work to my first design role in 9 months.", "quote": "The career change path made the difference."},
        ]
        await db.reviews.insert_many(reviews)

    if await db.blog.count_documents({}) == 0:
        posts = [
            {
                "_id": "post-how-we-built-ascendly",
                "slug": "how-we-built-ascendly",
                "title": "How we built Ascendly",
                "excerpt": "A behind-the-scenes look at the engineering and design choices behind the platform.",
                "content": "Ascendly was built with a single goal: make premium, structured learning accessible. We chose FastAPI for the backend and Next.js for the frontend to keep the experience fast and SEO-friendly. Every course is organized as a path, not a playlist, so learners can see progress and stay motivated.",
                "author": "Ascendly Team",
                "published_at": "2026-07-15T00:00:00+00:00",
            },
            {
                "_id": "post-top-skills-2026",
                "slug": "top-skills-2026",
                "title": "Top skills to learn in 2026",
                "excerpt": "Data fluency, AI literacy, and structured problem solving are more valuable than ever.",
                "content": "Employers now expect team members to work with data, write clear documentation, and use AI tools responsibly. Our curated paths cover data analytics, business communication, and AI fundamentals so members stay ahead.",
                "author": "Ascendly Team",
                "published_at": "2026-07-10T00:00:00+00:00",
            },
        ]
        await db.blog.insert_many(posts)

    if await db.coupons.count_documents({}) == 0:
        await db.coupons.insert_one({
            "_id": "coupon-launch20",
            "code": "LAUNCH20",
            "discount_type": "percent",
            "discount_value": 20,
            "max_uses": 500,
            "used_count": 0,
            "expires_at": datetime(2026, 12, 31, 23, 59, 59, tzinfo=timezone.utc).isoformat(),
        })

    if await db.tiers.count_documents({}) == 0:
        tiers = [
            {"_id": "tier-1mo", "id": "1mo", "label": "Try it out", "price_per_month": 49, "duration_months": 1},
            {"_id": "tier-3mo", "id": "3mo", "label": "For one focused skill", "price_per_month": 39, "duration_months": 3},
            {"_id": "tier-6mo", "id": "6mo", "label": "For a career pivot", "price_per_month": 35, "duration_months": 6},
            {"_id": "tier-12mo", "id": "12mo", "label": "For serious learners", "price_per_month": 29, "duration_months": 12, "recommended": True},
            {"_id": "tier-lifetime", "id": "lifetime", "label": "Pay once, learn forever", "price_per_month": 999, "duration_months": 999, "badge": "Limited seats"},
        ]
        await db.tiers.insert_many(tiers)

    if await db.learning_paths.count_documents({}) == 0:
        from app.services.learning_paths import PREDEFINED_PATHS
        await db.learning_paths.insert_many(PREDEFINED_PATHS)

    if await db.help_articles.count_documents({}) == 0:
        help_articles = [
            {
                "_id": "article-how-to-cancel-subscription",
                "slug": "how-to-cancel-subscription",
                "title": "How to Cancel Your Subscription",
                "category": "billing",
                "content": "To cancel your subscription:\n\n1. Go to Settings → Billing\n2. Click \"Manage Subscription\"\n3. Select \"Cancel Subscription\"\n4. Follow the confirmation steps\n\nYour access will continue until the end of your current billing period. You can resubscribe anytime.",
                "summary": "Step-by-step guide to cancel your Ascendly subscription in Settings → Billing. Access continues until the end of the billing period.",
                "tags": ["cancel", "subscription", "billing", "membership"],
                "is_published": True,
                "views": 0,
                "helpful_count": 0,
                "not_helpful_count": 0,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            {
                "_id": "article-refund-policy",
                "slug": "refund-policy",
                "title": "Refund Policy",
                "category": "billing",
                "content": "We offer a 30-day money-back guarantee for all new subscriptions. If you're not satisfied within the first 30 days, contact us for a full refund.\n\nAfter 30 days, refunds are evaluated case by case. Contact support with your order ID and reason for a refund request.",
                "summary": "30-day money-back guarantee for all new subscriptions. Contact support with order ID for refunds after 30 days.",
                "tags": ["refund", "money-back", "billing", "guarantee"],
                "is_published": True,
                "views": 0,
                "helpful_count": 0,
                "not_helpful_count": 0,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            {
                "_id": "article-video-not-playing",
                "slug": "video-not-playing",
                "title": "Video Not Playing or Buffering",
                "category": "technical",
                "content": "If your video isn't playing:\n\n1. Check your internet connection\n2. Try refreshing the page\n3. Clear browser cache (Ctrl+Shift+R)\n4. Try a different browser (Chrome recommended)\n5. Disable VPN if you're using one\n\nIf the issue persists, contact support with the course and lesson name.",
                "summary": "Troubleshooting steps for video playback issues: check internet, refresh, clear cache, try another browser, disable VPN.",
                "tags": ["video", "playback", "buffering", "technical", "error"],
                "is_published": True,
                "views": 0,
                "helpful_count": 0,
                "not_helpful_count": 0,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            {
                "_id": "article-how-to-change-email",
                "slug": "how-to-change-email",
                "title": "How to Change Your Account Email",
                "category": "account",
                "content": "To change your email address:\n\n1. Go to Settings → Account\n2. Click \"Edit\" next to your email\n3. Enter your new email address\n4. Verify the new email via the confirmation link\n\nYou'll need to log in with the new email after verification.",
                "summary": "Change your email in Settings → Account. Verify the new address via confirmation link before logging in with it.",
                "tags": ["email", "account", "change", "settings"],
                "is_published": True,
                "views": 0,
                "helpful_count": 0,
                "not_helpful_count": 0,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            {
                "_id": "article-getting-started",
                "slug": "getting-started",
                "title": "Getting Started with Ascendly",
                "category": "general",
                "content": "Welcome to Ascendly! Here's how to get started:\n\n1. **Browse courses** — Explore our catalog by category\n2. **Enroll** — Click on a course and start learning\n3. **Track progress** — Your progress is saved automatically\n4. **Use AI Tutor** — Ask questions about any lesson\n5. **Join discussions** — Connect with other learners\n6. **Download lessons** — Go offline with downloaded content (PWA)\n\nNeed help? Use the chat widget or visit our Help Center.",
                "summary": "Quick start guide: browse courses, enroll, track progress, use AI Tutor, join discussions, and download for offline learning.",
                "tags": ["getting-started", "beginner", "guide", "tutorial"],
                "is_published": True,
                "views": 0,
                "helpful_count": 0,
                "not_helpful_count": 0,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
        ]
        await db.help_articles.insert_many(help_articles)

    # Adaptive Learning sample concepts (idempotent — no-op if already seeded).
    try:
        from app.db.seed_concepts import seed_concepts
        await seed_concepts(db)
    except Exception as exc:
        logger.warning("Concept seeding skipped: %s", exc)
