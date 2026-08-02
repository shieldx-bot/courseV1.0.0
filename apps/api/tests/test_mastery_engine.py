"""Phase 5 (NV3/NV4) — Mastery Engine service tests.

Covers forgetting-curve decay, historical mastery recalculation, the
recommended-sequence service, and the mastery-decay cron task.
"""

import asyncio
import os
from datetime import datetime, timedelta, timezone

os.environ["MONGODB_URI"] = "memory://test"


def test_apply_decay_after_7_days():
    from app.db.mongodb import get_db
    from app.services.mastery_engine import apply_decay

    async def _run():
        db = get_db()
        old = (datetime.now(timezone.utc) - timedelta(days=8)).isoformat()
        await db.concept_mastery.insert_one({
            "_id": "mast-user-decay-1-conc-decay-a",
            "user_id": "user-decay-1",
            "course_id": "course-decay",
            "concept_id": "conc-decay-a",
            "mastery_score": 8.0,
            "attempts": 3,
            "correct_attempts": 2,
            "last_practiced_at": old,
            "trend": "stable",
            "created_at": old,
            "updated_at": old,
        })
        result = await apply_decay("user-decay-1", "course-decay")
        doc = await db.concept_mastery.find_one({"_id": "mast-user-decay-1-conc-decay-a"})
        return result, doc

    result, doc = asyncio.run(_run())
    assert result["concepts_decayed"] == 1
    assert result["decayed"][0]["mastery_before"] == 8.0
    assert doc["mastery_score"] == 7.6, "8 days idle → 5% decay"
    assert doc["trend"] == "declining"


def test_apply_decay_14_days_extra_five_percent():
    from app.db.mongodb import get_db
    from app.services.mastery_engine import apply_decay

    async def _run():
        db = get_db()
        old = (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()
        await db.concept_mastery.insert_one({
            "_id": "mast-user-decay-2-conc-decay-b",
            "user_id": "user-decay-2",
            "course_id": "course-decay",
            "concept_id": "conc-decay-b",
            "mastery_score": 10.0,
            "attempts": 2,
            "correct_attempts": 2,
            "last_practiced_at": old,
            "trend": "stable",
            "created_at": old,
            "updated_at": old,
        })
        await apply_decay("user-decay-2", "course-decay")
        return await db.concept_mastery.find_one({"_id": "mast-user-decay-2-conc-decay-b"})

    doc = asyncio.run(_run())
    assert doc["mastery_score"] == 9.0, "14 days idle → 10% decay"


def test_apply_decay_respects_floor():
    from app.db.mongodb import get_db
    from app.services.mastery_engine import apply_decay

    async def _run():
        db = get_db()
        old = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        await db.concept_mastery.insert_one({
            "_id": "mast-user-decay-3-conc-decay-c",
            "user_id": "user-decay-3",
            "course_id": "course-decay",
            "concept_id": "conc-decay-c",
            "mastery_score": 1.0,
            "attempts": 1,
            "correct_attempts": 0,
            "last_practiced_at": old,
            "trend": "stable",
            "created_at": old,
            "updated_at": old,
        })
        result = await apply_decay("user-decay-3", "course-decay")
        doc = await db.concept_mastery.find_one({"_id": "mast-user-decay-3-conc-decay-c"})
        return result, doc

    result, doc = asyncio.run(_run())
    assert result["concepts_decayed"] == 0, "already at floor → no decay recorded"
    assert doc["mastery_score"] == 1.0


def test_apply_decay_skips_fresh_practice():
    from app.db.mongodb import get_db
    from app.services.mastery_engine import apply_decay

    async def _run():
        db = get_db()
        recent = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
        await db.concept_mastery.insert_one({
            "_id": "mast-user-decay-4-conc-decay-d",
            "user_id": "user-decay-4",
            "course_id": "course-decay",
            "concept_id": "conc-decay-d",
            "mastery_score": 7.0,
            "attempts": 2,
            "correct_attempts": 2,
            "last_practiced_at": recent,
            "trend": "stable",
            "created_at": recent,
            "updated_at": recent,
        })
        result = await apply_decay("user-decay-4", "course-decay")
        return result

    result = asyncio.run(_run())
    assert result["concepts_decayed"] == 0, "practiced within 7 days → no decay"


def test_recalculate_mastery_replays_attempts():
    from app.db.mongodb import get_db
    from app.services.mastery_engine import recalculate_mastery

    async def _run():
        db = get_db()
        uid, cid, conc = "user-recalc-1", "course-recalc", "conc-recalc-a"
        await db.quiz_attempts.insert_many([
            {
                "_id": "qa-recalc-1", "user_id": uid, "course_id": cid, "mode": "lesson",
                "questions": [{"concept_id": conc, "difficulty": 5, "correct": True}],
                "score": 1, "total_questions": 1, "score_pct": 100.0, "passed": True,
                "concept_results": [], "created_at": "2026-01-01T00:00:00+00:00",
            },
            {
                "_id": "qa-recalc-2", "user_id": uid, "course_id": cid, "mode": "lesson",
                "questions": [{"concept_id": conc, "difficulty": 5, "correct": False}],
                "score": 0, "total_questions": 1, "score_pct": 0.0, "passed": False,
                "concept_results": [], "created_at": "2026-01-02T00:00:00+00:00",
            },
        ])
        result = await recalculate_mastery(uid, cid, conc)
        doc = await db.concept_mastery.find_one({"_id": f"mast-{uid}-{conc}"})
        return result, doc

    result, doc = asyncio.run(_run())
    assert result["attempts"] == 2
    assert result["correct_attempts"] == 1
    assert 0.0 <= result["mastery_score"] <= 10.0
    assert doc["mastery_score"] == result["mastery_score"]
    assert doc["correct_attempts"] == 1


def test_recommended_sequence_service_statuses():
    from app.db.mongodb import seed_db
    from app.services.concept_mastery import update_mastery
    from app.services.mastery_engine import get_recommended_sequence

    async def _run():
        await seed_db()
        uid = "user-seq-1"

        # Master SELECT (sql-1) and weaken WHERE (sql-2) via Elo.
        await update_mastery(uid, "course-sql", "conc-course-sql-select-from", correct=True, difficulty=10)
        await update_mastery(uid, "course-sql", "conc-course-sql-where-filtering", correct=False, difficulty=1)

        return await get_recommended_sequence(uid, "course-sql")

    seq = asyncio.run(_run())
    assert seq["course_id"] == "course-sql"
    entries = seq["sequence"]
    by_lesson = {e["lesson_id"]: e for e in entries}

    assert by_lesson["sql-1"]["status"] == "ready-to-skip"
    assert by_lesson["sql-2"]["status"] == "remedial"

    # JOINs (sql-3) has weak prereq WHERE → synthetic remedial inserted before.
    assert "remedial-sql-3" in by_lesson
    assert by_lesson["remedial-sql-3"]["is_synthetic"] is True
    assert "WHERE & Filtering" in by_lesson["remedial-sql-3"]["weak_concepts"]
    assert by_lesson["sql-3"]["status"] == "normal"

    # Remedial items must precede their target lesson in the sequence.
    lessons = [e["lesson_id"] for e in entries]
    assert lessons.index("remedial-sql-3") < lessons.index("sql-3")


def test_mastery_decay_cron_task():
    from app.core.tasks import run_mastery_decay
    from app.db.mongodb import get_db
    from app.services.concept_mastery import update_mastery
    from datetime import datetime, timedelta, timezone

    async def _run():
        db = get_db()
        await seed_db_if_needed(db)
        uid = "user-cron-1"
        await update_mastery(uid, "course-cron", "conc-cron-a", correct=True, difficulty=7)
        # Backdate last_practiced_at to trigger decay.
        old = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()
        await db.concept_mastery.update_one(
            {"_id": f"mast-{uid}-conc-cron-a"},
            {"$set": {"last_practiced_at": old}},
        )
        await db.users.update_one(
            {"_id": uid},
            {"$set": {"last_active_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )
        result = await run_mastery_decay({}, batch_size=1000)
        return result

    result = asyncio.run(_run())
    assert "users" in result
    assert "courses_processed" in result
    assert isinstance(result["by_user"], dict)


async def seed_db_if_needed(db):
    if await db.courses.count_documents({}) > 0:
        return
    from app.db.mongodb import seed_db
    await seed_db()