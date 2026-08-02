"""Adaptive Learning analytics service.

Aggregates remediation effectiveness from ``quiz_attempts.concept_results``
(mastery_before/after per concept per attempt) within a rolling window.

Exposes one endpoint-ready function ``remediation_effectiveness`` used by
``GET /admin/adaptive/analytics/remediation-effectiveness`` (dashboard
"Remediation Effectiveness" in Grafana).

Note on portability: the in-memory test backend only understands simple
equality (plus ``$in``/``$regex``), so window filtering happens in Python
rather than with ``$gte``. Analytics volumes within a 30-day window are small
enough that this is fine on the real backend too.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from app.db.mongodb import get_read_db

logger = logging.getLogger(__name__)

WEAK_THRESHOLD = 3.0
MAX_CONCEPT_ROWS = 10


def _to_utc(value: Any) -> datetime | None:
    """Parse an ISO-8601 string (or pass through a datetime) as UTC."""
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)
        except ValueError:
            return None
    return None


def _avg(values: list[float]) -> float:
    return round(sum(values) / len(values), 2) if values else 0.0


async def remediation_effectiveness(
    window_days: int = 30,
    course_id: str | None = None,
) -> dict[str, Any]:
    """Remediation effectiveness metrics over ``quiz_attempts.concept_results``.

    Metrics (dashboard contract):
    - ``total_users``: distinct users with at least one practice event in window.
    - ``improved_pct``: % of those users whose average mastery delta is positive.
    - ``avg_mastery_delta``: mean mastery delta across all remediation events.
    - ``avg_gap_resolution_days``: mean days between a concept being weak
      (mastery_before < 3.0) and the first attempt that clears the weak
      threshold (mastery_after >= 3.0). 0 when no gap was resolved in window.
    - ``by_concept``: top weak concepts, sorted by weak-event count desc, with
      average delta (most-likely-needs-attention concepts first).
    - ``window_days`` / ``course_id``: echoed filters for dashboard context.
    """
    db = get_read_db()
    cutoff = datetime.now(timezone.utc) - timedelta(days=window_days)

    query: dict[str, Any] = {}
    if course_id:
        query["course_id"] = course_id
    try:
        attempts = await db.quiz_attempts.find(query).to_list(5000)
    except Exception as exc:
        logger.warning("Failed to read quiz_attempts for analytics: %s", exc)
        attempts = []

    # ── aggregate per-user + per-concept deltas ───────────────────────────────
    user_deltas: dict[str, list[float]] = {}
    concept_rows: dict[str, dict[str, Any]] = {}
    # (user_id, concept_id) → earliest weak attempt timestamp
    weak_at: dict[tuple[str, str], datetime] = {}
    resolution_days: list[float] = []

    for attempt in attempts:
        created = _to_utc(attempt.get("created_at"))
        if created is None or created < cutoff:
            continue
        uid = attempt.get("user_id", "")
        if not uid:
            continue
        for cr in attempt.get("concept_results", []):
            before = cr.get("mastery_before")
            after = cr.get("mastery_after")
            if before is None or after is None:
                continue
            delta = float(after) - float(before)
            user_deltas.setdefault(uid, []).append(delta)

            concept_id = cr.get("concept_id", "")
            if concept_id:
                row = concept_rows.setdefault(concept_id, {
                    "concept_id": concept_id,
                    "concept_name": cr.get("concept_name", concept_id),
                    "deltas": [],
                    "weak_events": 0,
                })
                row["deltas"].append(delta)
                if float(before) < WEAK_THRESHOLD:
                    row["weak_events"] += 1

            # Gap-resolution tracking per (user, concept) over time.
            key = (uid, concept_id)
            was_weak = float(before) < WEAK_THRESHOLD
            is_resolved = float(after) >= WEAK_THRESHOLD
            if key in weak_at and is_resolved:
                days = (created - weak_at[key]).total_seconds() / 86400.0
                resolution_days.append(max(0.0, days))
                del weak_at[key]
                continue
            if was_weak and key not in weak_at:
                weak_at[key] = created

    total_users = len(user_deltas)
    if total_users == 0:
        return {
            "total_users": 0,
            "improved_pct": 0.0,
            "avg_mastery_delta": 0.0,
            "avg_gap_resolution_days": 0.0,
            "by_concept": [],
            "window_days": window_days,
            "course_id": course_id,
        }

    improved_users = sum(1 for deltas in user_deltas.values() if _avg(deltas) > 0)

    all_deltas = [d for deltas in user_deltas.values() for d in deltas]
    avg_delta = round(sum(all_deltas) / len(all_deltas), 2) if all_deltas else 0.0
    avg_gap_days = (
        round(sum(resolution_days) / len(resolution_days), 1) if resolution_days else 0.0
    )

    by_concept = [
        {
            "concept_id": r["concept_id"],
            "concept_name": r["concept_name"],
            "weak_events": r["weak_events"],
            "avg_mastery_delta": _avg(r["deltas"]),
        }
        for r in sorted(
            concept_rows.values(),
            key=lambda r: (r["weak_events"], -sum(r["deltas"]) / len(r["deltas"]))
            if r["deltas"]
            else (r["weak_events"], 0),
            reverse=True,
        )[:MAX_CONCEPT_ROWS]
    ]

    return {
        "total_users": total_users,
        "improved_pct": round(improved_users / total_users * 100, 1),
        "avg_mastery_delta": avg_delta,
        "avg_gap_resolution_days": avg_gap_days,
        "by_concept": by_concept,
        "window_days": window_days,
        "course_id": course_id,
    }
