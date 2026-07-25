from datetime import datetime, timezone
from typing import Any
from app.db.mongodb import get_db

PREDEFINED_PATHS: list[dict[str, Any]] = [
    {
        "_id": "path-data-analyst",
        "title": "Become a Data Analyst in 6 Months",
        "slug": "become-a-data-analyst",
        "short_description": "Master Excel, SQL, Power BI, and Python \u2014 the four pillars of modern data analysis.",
        "description": "Go from spreadsheet beginner to data-driven decision maker. This path takes you through the tools every data analyst uses daily: Excel for reporting, SQL for querying databases, Power BI for visualization, and Python for advanced analytics.",
        "goal": "data_analyst",
        "duration_months": 6,
        "skill_level": "beginner",
        "icon": "database",
        "courses": [
            {"course_id": "course-excel", "order": 1},
            {"course_id": "course-sql", "order": 2},
            {"course_id": "course-powerbi", "order": 3},
            {"course_id": "course-python-data", "order": 4},
        ],
        "outcome": [
            "Build automated Excel reports and dashboards",
            "Query databases with SQL confidently",
            "Create interactive Power BI dashboards",
            "Analyze data with Python Pandas",
        ],
        "related_careers": ["Data Analyst", "Business Intelligence Analyst", "Reporting Analyst"],
    },
    {
        "_id": "path-web-developer",
        "title": "Become a Web Developer in 8 Months",
        "slug": "become-a-web-developer",
        "short_description": "JavaScript \u2192 React \u2192 Git \u2014 build modern web apps from scratch.",
        "description": "Start with JavaScript fundamentals, level up to React and Next.js, and learn professional collaboration with Git. By the end, you\u2019ll be able to build and deploy full-stack web applications.",
        "goal": "web_developer",
        "duration_months": 8,
        "skill_level": "beginner",
        "icon": "code",
        "courses": [
            {"course_id": "course-js", "order": 1},
            {"course_id": "course-react", "order": 2},
            {"course_id": "course-git", "order": 3},
            {"course_id": "course-python", "order": 4},
        ],
        "outcome": [
            "Build interactive web applications with JavaScript",
            "Create React apps with modern hooks and patterns",
            "Collaborate effectively using Git and GitHub",
            "Build and deploy a full-stack application",
        ],
        "related_careers": ["Frontend Developer", "Full-Stack Developer", "JavaScript Engineer"],
    },
    {
        "_id": "path-ai-specialist",
        "title": "AI & Automation Specialist in 5 Months",
        "slug": "ai-and-automation-specialist",
        "short_description": "Master prompt engineering, AI agents, and machine learning fundamentals.",
        "description": "Stay ahead of the curve. Learn how LLMs work, master prompt engineering, build autonomous AI agents, and understand machine learning fundamentals \u2014 no PhD required.",
        "goal": "ai_specialist",
        "duration_months": 5,
        "skill_level": "intermediate",
        "icon": "brain",
        "courses": [
            {"course_id": "course-chatgpt", "order": 1},
            {"course_id": "course-ai-agents", "order": 2},
            {"course_id": "course-ml", "order": 3},
        ],
        "outcome": [
            "Write prompts that produce reliable, production-quality outputs",
            "Build autonomous AI agents that browse and extract data",
            "Train and evaluate machine learning models",
        ],
        "related_careers": ["AI Specialist", "Prompt Engineer", "ML Engineer", "Automation Consultant"],
    },
    {
        "_id": "path-designer",
        "title": "UI/UX & Design Career in 7 Months",
        "slug": "ui-ux-design-career",
        "short_description": "Figma \u2192 Illustrator \u2192 Canva \u2014 design beautiful products and brand assets.",
        "description": "From wireframes to pixel-perfect prototypes. Learn industry-standard design tools, build a design system, create brand identities, and master 3D modeling.",
        "goal": "designer",
        "duration_months": 7,
        "skill_level": "beginner",
        "icon": "palette",
        "courses": [
            {"course_id": "course-figma", "order": 1},
            {"course_id": "course-illustrator", "order": 2},
            {"course_id": "course-canva", "order": 3},
            {"course_id": "course-blender", "order": 4},
        ],
        "outcome": [
            "Design interactive prototypes in Figma",
            "Create professional vector illustrations and branding",
            "Build a consistent visual identity with Canva",
            "Model and render 3D scenes in Blender",
        ],
        "related_careers": ["UI/UX Designer", "Product Designer", "Graphic Designer", "3D Artist"],
    },
    {
        "_id": "path-marketer",
        "title": "Digital Marketing Pro in 6 Months",
        "slug": "digital-marketing-pro",
        "short_description": "SEO, Google Ads, content marketing, and viral video strategies.",
        "description": "Master every channel of modern digital marketing \u2014 from Google search to TikTok trends. Learn to drive organic traffic, run profitable ad campaigns, and create content that converts.",
        "goal": "marketer",
        "duration_months": 6,
        "skill_level": "beginner",
        "icon": "briefcase",
        "courses": [
            {"course_id": "course-seo", "order": 1},
            {"course_id": "course-google-ads", "order": 2},
            {"course_id": "course-content-marketing", "order": 3},
            {"course_id": "course-tiktok", "order": 4},
        ],
        "outcome": [
            "Rank pages in the top 10 of Google search results",
            "Run profitable Google Ads campaigns",
            "Build a content strategy that drives traffic and conversions",
            "Create viral short-form video content",
        ],
        "related_careers": ["Digital Marketing Manager", "SEO Specialist", "Content Strategist", "PPC Manager"],
    },
    {
        "_id": "path-business-leader",
        "title": "Business & Leadership Accelerator in 8 Months",
        "slug": "business-leadership-accelerator",
        "short_description": "Financial literacy, entrepreneurship, project management, and leadership skills.",
        "description": "Develop the business acumen and leadership skills to advance from individual contributor to manager and beyond. Covers finance, entrepreneurship, project management, and people leadership.",
        "goal": "business_leader",
        "duration_months": 8,
        "skill_level": "intermediate",
        "icon": "bar-chart",
        "courses": [
            {"course_id": "course-finance", "order": 1},
            {"course_id": "course-entrepreneurship", "order": 2},
            {"course_id": "course-project-management", "order": 3},
            {"course_id": "course-leadership", "order": 4},
        ],
        "outcome": [
            "Read and interpret financial statements",
            "Validate business ideas and build MVPs",
            "Manage projects using agile and waterfall methodologies",
            "Lead cross-functional teams effectively",
        ],
        "related_careers": ["Team Lead", "Manager", "Entrepreneur", "Project Manager", "Product Manager"],
    },
    {
        "_id": "path-career-accelerator",
        "title": "Career Accelerator in 4 Months",
        "slug": "career-accelerator",
        "short_description": "Land your next role with better resumes, communication, and presentation skills.",
        "description": "Accelerate your career growth by mastering the soft skills that matter most: business communication, public speaking, resume writing, and leadership presence.",
        "goal": "career_growth",
        "duration_months": 4,
        "skill_level": "any",
        "icon": "users",
        "courses": [
            {"course_id": "course-resume", "order": 1},
            {"course_id": "course-communication", "order": 2},
            {"course_id": "course-public-speaking", "order": 3},
            {"course_id": "course-leadership", "order": 4},
        ],
        "outcome": [
            "Write a resume that passes ATS screening and lands interviews",
            "Communicate clearly and persuasively in writing and speech",
            "Deliver presentations that drive decisions",
            "Give feedback and lead with confidence",
        ],
        "related_careers": ["Any professional seeking career growth"],
    },
]


async def seed_learning_paths():
    db = get_db()
    existing = await db.learning_paths.count_documents({})
    if existing == 0:
        await db.learning_paths.insert_many(PREDEFINED_PATHS)


async def get_all_paths(limit: int = 20) -> list[dict]:
    db = get_db()
    paths = await db.learning_paths.find().to_list(limit)
    return [_format_path(p) for p in paths]


async def get_path_by_slug(slug: str) -> dict | None:
    db = get_db()
    path = await db.learning_paths.find_one({"slug": slug})
    if not path:
        return None
    return await _enrich_path_with_courses(path)


async def get_path_by_id(path_id: str) -> dict | None:
    db = get_db()
    path = await db.learning_paths.find_one({"_id": path_id})
    if not path:
        return None
    return await _enrich_path_with_courses(path)


async def get_paths_by_goal(goal: str, limit: int = 5) -> list[dict]:
    db = get_db()
    paths = await db.learning_paths.find({"goal": goal}).to_list(limit)
    return [_format_path(p) for p in paths]


async def _enrich_path_with_courses(path: dict) -> dict:
    db = get_db()
    course_ids = [c["course_id"] for c in path.get("courses", [])]
    courses_in_path = {}
    if course_ids:
        for c in await db.courses.find({"_id": {"$in": course_ids}}).to_list(100):
            courses_in_path[c["_id"]] = {
                "id": c["_id"],
                "title": c.get("title", ""),
                "slug": c.get("slug", ""),
                "description": c.get("description", ""),
                "image_url": c.get("image_url", ""),
                "category_slug": c.get("category_slug", ""),
                "lesson_count": c.get("lesson_count", 0),
                "instructor_name": c.get("instructor", {}).get("name", ""),
            }

    enriched_courses = []
    for entry in path.get("courses", []):
        cid = entry["course_id"]
        course_data = courses_in_path.get(cid, {"id": cid})
        course_data["order"] = entry["order"]
        enriched_courses.append(course_data)

    enriched_courses.sort(key=lambda c: c["order"])

    result = _format_path(path)
    result["courses"] = enriched_courses
    total_lessons = sum(c.get("lesson_count", 0) for c in enriched_courses)
    result["total_lessons"] = total_lessons
    return result


def _format_path(path: dict) -> dict:
    return {
        "id": path["_id"],
        "title": path.get("title", ""),
        "slug": path.get("slug", ""),
        "short_description": path.get("short_description", ""),
        "description": path.get("description", ""),
        "goal": path.get("goal", ""),
        "duration_months": path.get("duration_months", 0),
        "skill_level": path.get("skill_level", "beginner"),
        "icon": path.get("icon", ""),
        "course_count": len(path.get("courses", [])),
        "outcome": path.get("outcome", []),
        "related_careers": path.get("related_careers", []),
    }


async def enroll_user_in_path(user_id: str, path_id: str) -> dict:
    db = get_db()
    path = await db.learning_paths.find_one({"_id": path_id})
    if not path:
        raise ValueError("Learning path not found")

    existing = await db.user_learning_paths.find_one({
        "user_id": user_id,
        "path_id": path_id,
    })
    if existing:
        return {"enrolled": True, "enrollment_id": existing["_id"], "already_enrolled": True}

    enrollment = {
        "_id": f"enroll-{user_id}-{path_id}",
        "user_id": user_id,
        "path_id": path_id,
        "enrolled_at": datetime.now(timezone.utc).isoformat(),
        "completed_course_ids": [],
        "status": "active",
    }
    await db.user_learning_paths.insert_one(enrollment)
    return {"enrolled": True, "enrollment_id": enrollment["_id"], "already_enrolled": False}


async def get_user_enrollments(user_id: str, limit: int = 10) -> list[dict]:
    db = get_db()
    enrollments = await db.user_learning_paths.find(
        {"user_id": user_id, "status": "active"}
    ).to_list(limit)

    results = []
    for e in enrollments:
        path = await get_path_by_id(e["path_id"])
        if path:
            completed_ids = set(e.get("completed_course_ids", []))
            total = len(path.get("courses", []))
            done = sum(1 for c in path.get("courses", []) if c.get("id") in completed_ids)
            path["progress"] = {
                "completed_courses": done,
                "total_courses": total,
                "percent": round(done / total * 100, 0) if total > 0 else 0,
                "status": e.get("status", "active"),
                "enrolled_at": e.get("enrolled_at", ""),
            }
            results.append(path)

    return results


async def get_user_enrollment_for_path(user_id: str, path_id: str) -> dict | None:
    """Get user's enrollment for a specific path with progress."""
    db = get_db()
    enrollment = await db.user_learning_paths.find_one({
        "user_id": user_id,
        "path_id": path_id,
        "status": "active"
    })
    if not enrollment:
        return None

    path = await get_path_by_id(path_id)
    if not path:
        return None

    completed_ids = set(enrollment.get("completed_course_ids", []))
    total = len(path.get("courses", []))
    done = sum(1 for c in path.get("courses", []) if c.get("id") in completed_ids)

    return {
        "enrollment_id": enrollment["_id"],
        "enrolled_at": enrollment.get("enrolled_at", ""),
        "status": enrollment.get("status", "active"),
        "progress": {
            "completed_courses": done,
            "total_courses": total,
            "percent": round(done / total * 100, 0) if total > 0 else 0,
            "status": enrollment.get("status", "active"),
            "enrolled_at": enrollment.get("enrolled_at", ""),
        }
    }


async def get_user_enrollment_for_path(user_id: str, path_id: str) -> dict | None:
    """Get user's enrollment for a specific path with progress."""
    db = get_db()
    enrollment = await db.user_learning_paths.find_one({
        "user_id": user_id,
        "path_id": path_id,
        "status": "active"
    })
    if not enrollment:
        return None

    path = await get_path_by_id(path_id)
    if not path:
        return None

    completed_ids = set(enrollment.get("completed_course_ids", []))
    total = len(path.get("courses", []))
    done = sum(1 for c in path.get("courses", []) if c.get("id") in completed_ids)

    return {
        "enrollment_id": enrollment["_id"],
        "enrolled_at": enrollment.get("enrolled_at", ""),
        "status": enrollment.get("status", "active"),
        "progress": {
            "completed_courses": done,
            "total_courses": total,
            "percent": round(done / total * 100, 0) if total > 0 else 0,
            "status": enrollment.get("status", "active"),
            "enrolled_at": enrollment.get("enrolled_at", ""),
        }
    }
