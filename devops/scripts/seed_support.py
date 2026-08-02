#!/usr/bin/env python3
"""Seed developer support data (idempotent).

Keyed by fixed _id (article-<slug> / tkt-seed-N / tmsg-seed-N); re-runs skip
existing docs so data is never duplicated.
"""
import asyncio
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "apps", "api"))

from app.db.mongodb import get_db  # noqa: E402

NOW = datetime.now(timezone.utc).isoformat()


def article(_id, slug, title, category, content, summary, tags):
    return {
        "_id": _id, "slug": slug, "title": title, "category": category,
        "content": content, "summary": summary, "tags": tags,
        "is_published": True, "views": 0, "helpful_count": 0, "not_helpful_count": 0,
        "created_at": NOW, "updated_at": NOW,
    }


HELP_ARTICLES = [
    article("article-refund-policy", "refund-policy", "Refund Policy", "billing",
            "30-day money-back guarantee for new subscriptions. Contact support with your order ID.",
            "30-day money-back guarantee for new subscriptions.",
            ["refund", "billing", "money-back"]),
    article("article-billing-faq", "billing-faq", "Billing FAQ", "billing",
            "Billing occurs the same day each month. Manage or cancel your subscription from Settings > Billing.",
            "Common billing questions and how to manage your subscription.",
            ["billing", "subscription", "invoice"]),
    article("article-video-not-playing", "video-not-playing", "Video Not Playing or Buffering", "technical",
            "Check internet, refresh, clear cache, try another browser, disable VPN.",
            "Troubleshooting video playback issues.",
            ["video", "playback", "buffering", "technical"]),
    article("article-change-email", "change-email", "How to Change Your Account Email", "account",
            "Settings > Account > Edit email, then verify via the confirmation link.",
            "Change your account email in Settings > Account.",
            ["email", "account", "settings"]),
    article("article-course-qa", "course-questions", "Questions About Courses", "content",
            "Use AI Tutor on any lesson, or join course discussions.",
            "Where to ask course-related questions.",
            ["courses", "ai-tutor", "discussions", "content"]),
]


def ticket(_id, status, category, priority, subject, ai_summary, rating=None):
    return {
        "_id": _id, "user_id": f"{_id}@ascendly.io", "user_email": f"{_id}@ascendly.io",
        "user_name": "Demo Learner", "category": category, "priority": priority,
        "subject": subject, "status": status, "ai_summary": ai_summary,
        "created_at": NOW, "updated_at": NOW,
        "resolved_at": NOW if status in ("resolved", "closed") else None,
        "assigned_to": "admin" if status != "open" else None,
        "satisfaction_rating": rating,
    }


SUPPORT_TICKETS = [
    ticket("tkt-seed-1", "open", "billing", "P2", "Invoice for last month looks wrong", "Incorrect charge reported."),
    ticket("tkt-seed-2", "in_progress", "technical", "P1", "Video player crashes on Safari", "Safari crash report."),
    ticket("tkt-seed-3", "resolved", "account", "P3", "How do I reset my password?", "Password reset provided.", rating=5),
    ticket("tkt-seed-4", "closed", "other", "P3", "Suggestion: add dark mode toggle", "Feature request logged."),
]

TICKET_MESSAGES = [
    {"_id": "tmsg-seed-1-1", "ticket_id": "tkt-seed-1", "sender_type": "user", "sender_id": "tkt-seed-1@ascendly.io",
     "sender_name": "Demo Learner", "content": "Hi, my last invoice shows an extra charge of $49.", "created_at": NOW},
    {"_id": "tmsg-seed-2-1", "ticket_id": "tkt-seed-2", "sender_type": "user", "sender_id": "tkt-seed-2@ascendly.io",
     "sender_name": "Demo Learner", "content": "Player crashes on Safari as soon as I click play.", "created_at": NOW},
    {"_id": "tmsg-seed-2-2", "ticket_id": "tkt-seed-2", "sender_type": "admin", "sender_id": "admin",
     "sender_name": "Admin", "content": "Thanks — we are investigating the Safari playback issue.", "created_at": NOW},
    {"_id": "tmsg-seed-3-1", "ticket_id": "tkt-seed-3", "sender_type": "user", "sender_id": "tkt-seed-3@ascendly.io",
     "sender_name": "Demo Learner", "content": "I forgot my password, can you help me reset it?", "created_at": NOW},
    {"_id": "tmsg-seed-4-1", "ticket_id": "tkt-seed-4", "sender_type": "user", "sender_id": "tkt-seed-4@ascendly.io",
     "sender_name": "Demo Learner", "content": "Would love a dark mode option in the player.", "created_at": NOW},
]


async def _seed_collection(db, collection, docs):
    inserted = 0
    for doc in docs:
        if await db[collection].find_one({"_id": doc["_id"]}):
            continue
        await db[collection].insert_one(doc)
        inserted += 1
    return inserted


async def main():
    db = get_db()
    uri = os.environ.get("MONGODB_URI", "default")
    print(f"Seeding support data… (MONGODB_URI={uri})")
    for collection, docs in (
        ("help_articles", HELP_ARTICLES),
        ("support_tickets", SUPPORT_TICKETS),
        ("ticket_messages", TICKET_MESSAGES),
    ):
        n = await _seed_collection(db, collection, docs)
        print(f"  {collection}: inserted {n}/{len(docs)} (skipped existing)")
    print("✅ Support seed complete (idempotent — re-run safe).")


if __name__ == "__main__":
    asyncio.run(main())