"""Skill Graph Service — taxonomy + user mastery scoring."""

import logging
import re
from datetime import datetime, timezone
from typing import Any

from app.db.mongodb import get_db, get_read_db

logger = logging.getLogger(__name__)

# ── Skill Taxonomy (seed) ────────────────────────────────────────────────────

SKILL_TAXONOMY: list[dict[str, Any]] = [
    {"id": "skill-linux", "name": "Linux", "slug": "linux", "category": "Cloud",
     "description": "Quản trị Linux: commands, filesystem, processes, networking, shell scripting.",
     "prerequisites": [], "parent_skill": None, "difficulty_base": 3},
    {"id": "skill-shell-scripting", "name": "Shell Scripting", "slug": "shell-scripting", "category": "Cloud",
     "description": "Bash scripts: variables, loops, pipelines, automation.",
     "prerequisites": ["skill-linux"], "parent_skill": "skill-linux", "difficulty_base": 4},
    {"id": "skill-docker", "name": "Docker", "slug": "docker", "category": "Cloud",
     "description": "Containerization: images, containers, volumes, networks, Compose, Dockerfile.",
     "prerequisites": ["skill-linux"], "parent_skill": None, "difficulty_base": 4},
    {"id": "skill-kubernetes", "name": "Kubernetes", "slug": "kubernetes", "category": "Cloud",
     "description": "Orchestration: pods, deployments, services, ingress, configmaps, security.",
     "prerequisites": ["skill-docker"], "parent_skill": None, "difficulty_base": 6},
    {"id": "skill-cni", "name": "Container Network Interface", "slug": "cni", "category": "Cloud",
     "description": "CNI plugins, network policies, service discovery, DNS in K8s.",
     "prerequisites": ["skill-kubernetes"], "parent_skill": "skill-kubernetes", "difficulty_base": 7},
    {"id": "skill-service-discovery", "name": "Service Discovery", "slug": "service-discovery", "category": "Cloud",
     "description": "DNS-based discovery, consul, etcd, load balancing.",
     "prerequisites": ["skill-kubernetes"], "parent_skill": "skill-kubernetes", "difficulty_base": 6},
    {"id": "skill-aws", "name": "AWS", "slug": "aws", "category": "Cloud",
     "description": "Amazon Web Services: EC2, S3, VPC, IAM, Lambda, RDS, route53.",
     "prerequisites": ["skill-linux"], "parent_skill": None, "difficulty_base": 5},
    {"id": "skill-aws-architecture", "name": "AWS Architecture", "slug": "aws-architecture", "category": "Cloud",
     "description": "Thiết kế kiến trúc AWS: HA, scaling, security, cost optimization, serverless.",
     "prerequisites": ["skill-aws"], "parent_skill": "skill-aws", "difficulty_base": 7},
    {"id": "skill-security-basics", "name": "Security Basics", "slug": "security-basics", "category": "Security",
     "description": "OWASP Top 10, authentication, encryption, secure coding.",
     "prerequisites": [], "parent_skill": None, "difficulty_base": 3},
    {"id": "skill-network-security", "name": "Network Security", "slug": "network-security", "category": "Security",
     "description": "Firewalls, IDS/IPS, VPN, ports, hardening.",
     "prerequisites": ["skill-linux"], "parent_skill": None, "difficulty_base": 5},
    {"id": "skill-penetration-testing", "name": "Penetration Testing", "slug": "penetration-testing", "category": "Security",
     "description": "Reconnaissance, exploitation, privilege escalation, Nmap, Metasploit.",
     "prerequisites": ["skill-network-security", "skill-linux"], "parent_skill": None, "difficulty_base": 7},
    {"id": "skill-threat-hunting", "name": "Threat Hunting", "slug": "threat-hunting", "category": "Security",
     "description": "Log analysis, threat intel, IOC, MITRE ATT&CK.",
     "prerequisites": ["skill-security-basics"], "parent_skill": None, "difficulty_base": 6},
    {"id": "skill-python", "name": "Python", "slug": "python", "category": "Programming",
     "description": "Python: syntax, data structures, OOP, async, type hints.",
     "prerequisites": [], "parent_skill": None, "difficulty_base": 3},
    {"id": "skill-algorithms", "name": "Algorithms & Data Structures", "slug": "algorithms", "category": "Programming",
     "description": "Arrays, trees, graphs, sorting, searching, dynamic programming, Big-O.",
     "prerequisites": ["skill-python"], "parent_skill": None, "difficulty_base": 6},
    {"id": "skill-system-design", "name": "System Design", "slug": "system-design", "category": "Programming",
     "description": "Thiết kế hệ thống phân tán: caching, queuing, sharding, load balancing.",
     "prerequisites": ["skill-algorithms"], "parent_skill": None, "difficulty_base": 8},
    {"id": "skill-ci-cd", "name": "CI/CD", "slug": "ci-cd", "category": "DevOps",
     "description": "GitHub Actions, GitLab CI, Jenkins, ArgoCD — build, test, deploy.",
     "prerequisites": ["skill-docker"], "parent_skill": None, "difficulty_base": 5},
    {"id": "skill-monitoring", "name": "Monitoring & Observability", "slug": "monitoring", "category": "DevOps",
     "description": "Prometheus, Grafana, Loki, OpenTelemetry — metrics, logs, traces.",
     "prerequisites": ["skill-kubernetes"], "parent_skill": None, "difficulty_base": 6},
    {"id": "skill-sql", "name": "SQL", "slug": "sql", "category": "Data",
     "description": "SELECT, JOIN, aggregate, window functions, indexing.",
     "prerequisites": [], "parent_skill": None, "difficulty_base": 3},
    {"id": "skill-databases", "name": "Databases", "slug": "databases", "category": "Data",
     "description": "PostgreSQL, MongoDB, Redis — design, indexing, transactions.",
     "prerequisites": ["skill-sql"], "parent_skill": None, "difficulty_base": 5},
]

DEFAULT_MASTERY = 0.0
LEVEL_THRESHOLDS = {"beginner": 0.0, "intermediate": 40.0, "advanced": 70.0, "expert": 85.0}
_ALPHA_BASE = 0.30


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_level(score: float) -> str:
    if score >= LEVEL_THRESHOLDS["expert"]:
        return "expert"
    if score >= LEVEL_THRESHOLDS["advanced"]:
        return "advanced"
    if score >= LEVEL_THRESHOLDS["intermediate"]:
        return "intermediate"
    return "beginner"


# ── Seed & Lookup ─────────────────────────────────────────────────────────────

async def seed_skills() -> None:
    db = get_db()
    if await db.skills.count_documents({}) > 0:
        return
    await db.skills.insert_many([
        {**s, "_id": s["id"], "created_at": _now()} for s in SKILL_TAXONOMY
    ])
    logger.info("Seeded %d skills", len(SKILL_TAXONOMY))


async def get_all_skills() -> list[dict[str, Any]]:
    return await get_read_db().skills.find({}).to_list(length=200)


async def get_skill(skill_id: str) -> dict[str, Any] | None:
    return await get_read_db().skills.find_one({"_id": skill_id})


async def resolve_skill_ids(skill_names: list[str]) -> list[str]:
    if not skill_names:
        return []
    ids: list[str] = []
    for name in skill_names:
        slug = name.strip().lower().replace(" ", "-")
        skill = await get_skill(f"skill-{slug}")
        if skill:
            ids.append(skill["_id"])
            continue
        doc = await get_read_db().skills.find_one({
            "$or": [
                {"name": {"$regex": f"^{re.escape(name.strip())}$", "$options": "i"}},
                {"slug": slug},
            ]
        })
        if doc:
            ids.append(doc["_id"])
    return list(dict.fromkeys(ids))


# ── User Skill Mastery ───────────────────────────────────────────────────────

async def get_user_skills(user_id: str) -> list[dict[str, Any]]:
    db = get_read_db()
    user_skills = await db.user_skills.find({"user_id": user_id}).to_list(length=200)
    result = []
    for us in user_skills:
        skill = await get_skill(us["skill_id"])
        if not skill:
            continue
        result.append({
            "skill_id": us["skill_id"],
            "name": skill.get("name", us["skill_id"]),
            "slug": skill.get("slug", ""),
            "category": skill.get("category", ""),
            "description": skill.get("description", ""),
            "prerequisites": skill.get("prerequisites", []),
            "parent_skill": skill.get("parent_skill"),
            "mastery_score": round(us.get("mastery_score", 0.0), 1),
            "level": us.get("level", "beginner"),
            "attempts": us.get("attempts", 0),
            "correct_count": us.get("correct_count", 0),
            "avg_time_seconds": us.get("avg_time_seconds"),
            "consistency_score": us.get("consistency_score", 0.0),
            "last_updated": us.get("last_updated"),
            "recent_history": us.get("history", [])[-10:],
        })
    result.sort(key=lambda s: s["mastery_score"], reverse=True)
    return result


async def get_user_skill(user_id: str, skill_id: str) -> dict[str, Any] | None:
    db = get_read_db()
    doc = await db.user_skills.find_one({"_id": f"usk-{user_id}-{skill_id}"})
    if not doc:
        return None
    skill = await get_skill(skill_id)
    return {
        "skill_id": skill_id,
        "name": skill.get("name", skill_id) if skill else skill_id,
        "mastery_score": round(doc.get("mastery_score", 0.0), 1),
        "level": doc.get("level", "beginner"),
        "attempts": doc.get("attempts", 0),
        "consistency_score": doc.get("consistency_score", 0.0),
    }


async def update_user_skill(
    user_id: str, skill_id: str, *, correct: bool,
    difficulty_score: int = 5, time_seconds: float | None = None,
) -> dict[str, Any]:
    """Cập nhật mastery sau 1 attempt. ALPHA giảm dần theo số attempt."""
    db = get_db()
    doc_id = f"usk-{user_id}-{skill_id}"
    existing = await db.user_skills.find_one({"_id": doc_id})

    prev_score = existing.get("mastery_score", DEFAULT_MASTERY) if existing else DEFAULT_MASTERY
    prev_attempts = existing.get("attempts", 0) if existing else 0
    prev_correct = existing.get("correct_count", 0) if existing else 0
    prev_avg_time = existing.get("avg_time_seconds") if existing else None
    prev_times = existing.get("time_history", []) if existing else []

    alpha = max(_ALPHA_BASE * (0.85 ** prev_attempts), 0.05)
    diff_factor = difficulty_score / 10.0
    delta = (alpha * diff_factor * (1.0 - prev_score / 100.0)) if correct else \
        -(alpha * diff_factor * (0.5 + prev_score / 200.0))
    new_score = max(0.0, min(100.0, prev_score + delta * 100.0))

    if time_seconds is not None:
        prev_times = (prev_times + [time_seconds])[-20:]
        avg_time = sum(prev_times) / len(prev_times)
    else:
        avg_time = prev_avg_time

    new_attempts = prev_attempts + 1
    new_correct = prev_correct + (1 if correct else 0)
    accuracy = new_correct / new_attempts
    consistency = accuracy
    if len(prev_times) >= 3:
        mean_t = sum(prev_times) / len(prev_times)
        std = (sum((t - mean_t) ** 2 for t in prev_times) / len(prev_times)) ** 0.5
        time_consistency = max(0.0, 1.0 - std / max(mean_t, 1.0))
        consistency = accuracy * 0.6 + time_consistency * 0.4

    history = (existing.get("history", []) if existing else []) + [{
        "date": _now(), "score": round(new_score, 1),
        "delta": round(new_score - prev_score, 1), "correct": correct,
    }]
    history = history[-50:]
    level = get_level(new_score)

    doc = {
        "_id": doc_id, "user_id": user_id, "skill_id": skill_id,
        "mastery_score": new_score, "level": level,
        "attempts": new_attempts, "correct_count": new_correct,
        "avg_time_seconds": round(avg_time, 1) if avg_time else None,
        "time_history": prev_times, "consistency_score": round(consistency, 2),
        "history": history, "last_updated": _now(),
        "created_at": existing.get("created_at", _now()) if existing else _now(),
    }
    await db.user_skills.replace_one({"_id": doc_id}, doc, upsert=True)

    return {
        "skill_id": skill_id,
        "mastery_before": round(prev_score, 1),
        "mastery_after": round(new_score, 1),
        "delta": round(new_score - prev_score, 1),
        "level": level,
        "attempts": new_attempts,
        "reached_milestone": get_level(prev_score) != level,
    }


async def get_weak_skills(user_id: str, limit: int = 5) -> list[dict[str, Any]]:
    skills = await get_user_skills(user_id)
    skills.sort(key=lambda s: (s["mastery_score"], -s["attempts"]))
    return skills[:limit]


async def get_strong_skills(user_id: str, limit: int = 5) -> list[dict[str, Any]]:
    skills = await get_user_skills(user_id)
    skills.sort(key=lambda s: s["mastery_score"], reverse=True)
    return skills[:limit]


async def get_recommended_challenges_for_user(
    user_id: str, limit: int = 10,
    exclude_challenge_ids: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Đề xuất challenge: ưu tiên skill yếu + độ khó phù hợp mastery."""
    db = get_read_db()
    weak_skills = await get_weak_skills(user_id, limit=5)
    exclude = exclude_challenge_ids or []
    challenges = await db.challenges.find({"status": "published"}).to_list(length=100)
    challenges = [c for c in challenges if c["_id"] not in exclude]
    if not challenges:
        return []

    scored: list[tuple[float, dict]] = []
    for ch in challenges:
        score = 0.0
        ch_skills = ch.get("skills", [])
        diff = ch.get("difficulty_score", 5)
        for ws in weak_skills:
            if ws["skill_id"] in ch_skills:
                score += (100.0 - ws["mastery_score"]) / 100.0 * 2.0
        for skill_id in ch_skills:
            if not await get_user_skill(user_id, skill_id):
                score += 0.5
        avg_mastery = sum(w["mastery_score"] for w in weak_skills) / max(len(weak_skills), 1) if weak_skills else 50.0
        difficulty_fit = 1.0 - abs(diff * 10.0 - avg_mastery) / 100.0
        score += max(0.0, min(1.0, difficulty_fit))
        score += ch.get("quality_score", 0.5) * 0.5
        score += ch.get("stats", {}).get("avg_rating", 0.0) / 5.0 * 0.3
        scored.append((score, ch))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [c for _, c in scored[:limit]]


async def get_next_challenges_for_skill(
    user_id: str, skill_id: str, limit: int = 5,
    exclude_challenge_ids: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Gợi ý challenge cho 1 skill, sắp theo độ khó phù hợp mastery."""
    db = get_read_db()
    us = await get_user_skill(user_id, skill_id)
    mastery = us["mastery_score"] if us else 0.0
    exclude = exclude_challenge_ids or []
    challenges = await db.challenges.find({
        "status": "published", "skills": skill_id,
    }).to_list(length=100)
    challenges = [c for c in challenges if c["_id"] not in exclude]
    challenges.sort(key=lambda ch: -abs(ch.get("difficulty_score", 5) * 10.0 - mastery) + ch.get("quality_score", 0.5) * 3.0, reverse=True)
    return challenges[:limit]