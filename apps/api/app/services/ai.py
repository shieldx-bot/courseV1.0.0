from datetime import datetime, timezone, timedelta
from statistics import mean
from typing import Any
from collections import defaultdict
import numpy as np
from app.core.config import settings
from app.services.llm import call_llm, is_llm_available


def _daily_totals(orders: list[dict]) -> list[float]:
    by_day: dict[str, float] = {}
    for o in orders:
        created = o.get("created_at", "")
        if not created:
            continue
        day = created[:10]
        by_day[day] = by_day.get(day, 0) + o.get("amount", 0)
    return list(by_day.values())


def _build_daily_features(
    orders: list[dict],
    users: list[dict],
    progress: list[dict],
    subscriptions: list[dict],
) -> dict[str, list[float]]:
    revenue: dict[str, float] = defaultdict(float)
    new_users: dict[str, int] = defaultdict(int)
    active_learners: dict[str, set] = defaultdict(set)
    lessons_completed: dict[str, int] = defaultdict(int)
    new_subs: dict[str, int] = defaultdict(int)

    for o in orders:
        day = (o.get("created_at") or "")[:10]
        if day:
            revenue[day] += o.get("amount", 0)

    for u in users:
        day = (u.get("created_at") or u.get("registered_at") or "")[:10]
        if day:
            new_users[day] += 1

    for p in progress:
        day = (p.get("updated_at") or "")[:10]
        if day:
            active_learners[day].add(p.get("user_id"))
            if p.get("completed"):
                lessons_completed[day] += 1

    for s in subscriptions:
        day = (s.get("starts_at") or "")[:10]
        if day:
            new_subs[day] += 1

    all_days = sorted(set(revenue) | set(new_users) | set(active_learners) | set(lessons_completed) | set(new_subs))

    return {
        "dates": all_days,
        "revenue": [revenue[d] for d in all_days],
        "new_users": [new_users[d] for d in all_days],
        "active_learners": [len(active_learners[d]) for d in all_days],
        "lessons_completed": [lessons_completed[d] for d in all_days],
        "new_subscriptions": [new_subs[d] for d in all_days],
    }


def _moving_average(values: list[float], window: int) -> list[float]:
    if not values:
        return []
    n = len(values)
    result = []
    for i in range(1, n + 1):
        start = max(0, i - window)
        result.append(mean(values[start:i]))
    return result


def _naive_forecast(orders: list[dict], horizon_days: int) -> dict[str, Any]:
    values = _daily_totals(orders)
    if len(values) < 2:
        return {"predicted_revenue": 0.0, "confidence": 0.1, "note": "Not enough order history for a reliable forecast."}

    ma = _moving_average(values, 7)
    trend = (values[-1] - values[0]) / (len(values) - 1) if len(values) > 1 else 0
    last_ma = ma[-1] if ma else 0
    total = 0.0
    for i in range(1, horizon_days + 1):
        total += max(0, last_ma + trend * i)

    avg = mean(values)
    std = (sum((v - avg) ** 2 for v in values) / len(values)) ** 0.5
    confidence = max(0.1, min(0.95, 1 - (std / (avg + 1e-6)) * 0.5)) if avg else 0.1
    return {
        "predicted_revenue": round(total, 2),
        "confidence": round(confidence, 2),
        "note": "Fallback moving-average trend forecast due to insufficient data or model unavailability.",
        "model": "fallback",
    }


def _build_multivariate_lstm(features: dict[str, list[float]], horizon_days: int) -> dict[str, Any] | None:
    try:
        import tensorflow as tf
    except Exception:
        return None

    values = features["revenue"]
    if len(values) < 14:
        return None

    feature_names = ["revenue", "new_users", "active_learners", "lessons_completed", "new_subscriptions"]
    feature_arrays = []
    raw_min_max = {}
    for name in feature_names:
        arr = np.array(features.get(name, [0.0] * len(values)), dtype=np.float32).reshape(-1, 1)
        min_v = float(arr.min())
        max_v = float(arr.max())
        raw_min_max[name] = (min_v, max_v)
        if max_v - min_v == 0:
            norm = np.zeros_like(arr)
        else:
            norm = (arr - min_v) / (max_v - min_v)
        feature_arrays.append(norm)

    data = np.column_stack(feature_arrays)
    num_features = data.shape[1]

    seq_len = 7
    X, y = [], []
    for i in range(seq_len, len(data)):
        X.append(data[i - seq_len:i])
        y.append(data[i, 0:1])
    X = np.array(X)
    y = np.array(y)

    if len(X) < 5:
        return None

    tf.random.set_seed(42)
    model = tf.keras.Sequential([
        tf.keras.layers.LSTM(32, input_shape=(seq_len, num_features)),
        tf.keras.layers.Dense(1),
    ])
    model.compile(optimizer="adam", loss="mse")
    model.fit(X, y, epochs=50, verbose=0, batch_size=4)

    last_seq = data[-seq_len:].reshape(1, seq_len, num_features)
    preds = []
    for _ in range(horizon_days):
        nxt = model.predict(last_seq, verbose=0)[0, 0]
        preds.append(nxt)
        new_row = np.array([[nxt, *data[-1, 1:].tolist()]])
        last_seq = np.append(last_seq[:, 1:, :], new_row.reshape(1, 1, num_features), axis=1)

    rev_min, rev_max = raw_min_max["revenue"]
    predictions = np.array(preds) * (rev_max - rev_min) + rev_min
    total = float(np.sum(predictions))
    std = float(np.std(predictions)) if len(predictions) > 1 else 0.0
    avg = total / horizon_days
    confidence = max(0.1, min(0.95, 1 - (std / (avg + 1e-6)) * 0.5)) if avg else 0.1
    return {
        "predicted_revenue": round(total, 2),
        "confidence": round(confidence, 2),
        "note": "Multi-variate LSTM trained on daily revenue + user behavior signals (new users, active learners, lessons completed, new subscriptions).",
        "model": "lstm_multivariate",
    }


def _build_univariate_lstm(values: list[float], horizon_days: int) -> dict[str, Any] | None:
    try:
        import tensorflow as tf
    except Exception:
        return None

    if len(values) < 14:
        return None

    arr = np.array(values, dtype=np.float32).reshape(-1, 1)
    min_v = arr.min()
    max_v = arr.max()
    if max_v - min_v == 0:
        return None
    norm = (arr - min_v) / (max_v - min_v)

    seq_len = 7
    X, y = [], []
    for i in range(seq_len, len(norm)):
        X.append(norm[i - seq_len:i])
        y.append(norm[i])
    X = np.array(X)
    y = np.array(y)

    if len(X) < 5:
        return None

    tf.random.set_seed(42)
    model = tf.keras.Sequential([
        tf.keras.layers.LSTM(32, input_shape=(seq_len, 1)),
        tf.keras.layers.Dense(1),
    ])
    model.compile(optimizer="adam", loss="mse")
    model.fit(X, y, epochs=50, verbose=0, batch_size=4)

    last_seq = norm[-seq_len:].reshape(1, seq_len, 1)
    preds = []
    for _ in range(horizon_days):
        nxt = model.predict(last_seq, verbose=0)[0, 0]
        preds.append(nxt)
        last_seq = np.append(last_seq[:, 1:, :], [[[nxt]]], axis=1)

    predictions = np.array(preds) * (max_v - min_v) + min_v
    total = float(np.sum(predictions))
    std = float(np.std(predictions)) if len(predictions) > 1 else 0.0
    avg = total / horizon_days
    confidence = max(0.1, min(0.95, 1 - (std / (avg + 1e-6)) * 0.5)) if avg else 0.1
    return {
        "predicted_revenue": round(total, 2),
        "confidence": round(confidence, 2),
        "note": "Univariate LSTM model trained on daily revenue totals to forecast the next 30 days.",
        "model": "lstm",
    }


def forecast_revenue(
    orders: list[dict],
    users: list[dict] | None = None,
    progress: list[dict] | None = None,
    subscriptions: list[dict] | None = None,
    horizon_days: int = 30,
) -> dict[str, Any]:
    values = _daily_totals(orders)
    if len(values) < 2:
        return {"predicted_revenue": 0.0, "confidence": 0.1, "note": "Not enough order history for a reliable forecast.", "model": "none"}

    if users and progress and subscriptions:
        features = _build_daily_features(orders, users, progress, subscriptions)
        result = _build_multivariate_lstm(features, horizon_days)
        if result:
            return result

    result = _build_univariate_lstm(values, horizon_days)
    if result:
        return result
    return _naive_forecast(orders, horizon_days)


def forecast_new_subscriptions(orders: list[dict], avg_order_value: float = 50.0, horizon_days: int = 30) -> dict[str, Any]:
    revenue_forecast = forecast_revenue(orders, horizon_days=horizon_days)
    predicted = int(revenue_forecast["predicted_revenue"] / max(avg_order_value, 1))
    return {"predicted_new_subscriptions": max(0, predicted), "avg_order_value": avg_order_value}


def _compute_user_features(progress: list[dict], subscriptions: list[dict], users: list[dict]) -> list[dict[str, Any]]:
    now = datetime.now(timezone.utc)
    user_lessons: dict[str, list[dict]] = defaultdict(list)
    user_completions: dict[str, int] = defaultdict(int)
    user_last_active: dict[str, str] = {}

    for p in progress:
        uid = p.get("user_id")
        if not uid:
            continue
        user_lessons[uid].append(p)
        if p.get("completed"):
            user_completions[uid] += 1
        updated = p.get("updated_at", "")
        if updated and (uid not in user_last_active or updated > user_last_active[uid]):
            user_last_active[uid] = updated

    active_subs: dict[str, dict] = {}
    for s in subscriptions:
        uid = s.get("user_id")
        if s.get("status") == "active":
            active_subs[uid] = s

    seven_days_ago = (now - timedelta(days=7)).isoformat()
    user_features = []
    for u in users:
        uid = u.get("_id")
        if not uid:
            continue
        sub = active_subs.get(uid)
        last_active_str = user_last_active.get(uid)
        last_active = datetime.fromisoformat(last_active_str) if last_active_str else None
        days_since = (now - last_active).days if last_active else 999

        total_lessons = user_completions.get(uid, 0)
        recent_lessons = sum(
            1 for p in user_lessons.get(uid, [])
            if p.get("completed") and (p.get("updated_at") or "") >= seven_days_ago
        )

        sub_duration = 0
        if sub:
            starts = sub.get("starts_at", "")
            if starts:
                try:
                    start_dt = datetime.fromisoformat(starts)
                    sub_duration = (now - start_dt).days
                except Exception:
                    pass

        features = {
            "user_id": uid,
            "days_since_last_activity": days_since,
            "total_lessons_completed": total_lessons,
            "lessons_completed_7d": recent_lessons,
            "has_active_subscription": 1 if sub else 0,
            "subscription_duration_days": sub_duration,
        }
        user_features.append(features)

    return user_features


def _build_churn_nn(user_features: list[dict[str, Any]]) -> dict[str, Any]:
    try:
        import tensorflow as tf
    except Exception:
        return None

    if len(user_features) < 10:
        return None

    feature_keys = ["days_since_last_activity", "total_lessons_completed", "lessons_completed_7d", "has_active_subscription", "subscription_duration_days"]
    X = []
    labels = []
    for f in user_features:
        X.append([f[k] for k in feature_keys])
        label = 1 if f["has_active_subscription"] == 0 and f["days_since_last_activity"] > 14 else 0
        labels.append(label)

    X = np.array(X, dtype=np.float32)
    labels = np.array(labels, dtype=np.float32)

    means = X.mean(axis=0)
    stds = X.std(axis=0) + 1e-8
    X_norm = (X - means) / stds

    tf.random.set_seed(42)
    model = tf.keras.Sequential([
        tf.keras.layers.Dense(16, activation="relu", input_shape=(len(feature_keys),)),
        tf.keras.layers.Dropout(0.2),
        tf.keras.layers.Dense(8, activation="relu"),
        tf.keras.layers.Dense(1, activation="sigmoid"),
    ])
    model.compile(optimizer="adam", loss="binary_crossentropy", metrics=["accuracy"])
    model.fit(X_norm, labels, epochs=30, verbose=0, batch_size=16)

    probs = model.predict(X_norm, verbose=0).flatten().tolist()

    results = []
    for i, f in enumerate(user_features):
        results.append({**f, "churn_probability": round(probs[i], 4)})

    avg_prob = float(np.mean(probs))
    high_risk = sum(1 for p in probs if p > 0.5)

    return {
        "predicted_churn_rate": round(avg_prob, 3),
        "churn_risk_users": high_risk,
        "total_users_analyzed": len(user_features),
        "user_risk_scores": results,
        "model": "neural_network",
    }


def _rule_churn(progress: list[dict], subscriptions: list[dict]) -> dict[str, Any]:
    active_ids = {s.get("user_id") for s in subscriptions if s.get("status") == "active"}
    learner_ids = {p.get("user_id") for p in progress}
    inactive_learners = learner_ids - active_ids
    total_learners = len(learner_ids)
    churn_rate = round(len(inactive_learners) / total_learners, 3) if total_learners else 0.0
    return {
        "predicted_churn_rate": churn_rate,
        "churn_risk_users": len(inactive_learners),
        "model": "rule-based",
    }


def forecast_churn(progress: list[dict], subscriptions: list[dict], users: list[dict] | None = None) -> dict[str, Any]:
    if users:
        features = _compute_user_features(progress, subscriptions, users)
        nn_result = _build_churn_nn(features)
        if nn_result:
            return nn_result
    return _rule_churn(progress, subscriptions)


def _rule_based_summary(metrics: dict[str, Any]) -> str:
    segment = metrics.get("segment", "general")
    churn = metrics.get("churn_risk_users", 0)
    active = metrics.get("active_subscriptions", 0)
    top = metrics.get("top_category", "N/A")
    return (
        f"The current user base is best described as '{segment}'. "
        f"There are {churn} learners showing churn signals versus {active} active subscriptions. "
        f"Top content category is {top}. "
        f"Recommendation: re-engage at-risk learners with a short extension or personalized course suggestions."
    )


async def summarize_with_llm(metrics: dict[str, Any]) -> dict[str, Any]:
    if is_llm_available():
        try:
            prompt = (
                "You are an expert ed-tech growth analyst. Based on these metrics, write a 2-3 sentence "
                "executive summary and one actionable recommendation.\n\nMetrics:\n"
                f"{metrics}"
            )
            text = await call_llm(
                messages=[{"role": "user", "content": prompt}],
                max_tokens=200,
                temperature=0.7,
            )
            return {"summary": text.strip(), "model": settings.openai_model, "source": "llm"}
        except Exception as e:
            return {"summary": _rule_based_summary(metrics), "model": settings.openai_model, "source": "rule-based-fallback", "error": str(e)}
    return {"summary": _rule_based_summary(metrics), "model": settings.openai_model, "source": "rule-based"}


def build_metrics(users: list[dict], progress: list[dict], subscriptions: list[dict], courses: list[dict], orders: list[dict]) -> dict[str, Any]:
    active = [s for s in subscriptions if s.get("status") == "active"]
    learners = {p.get("user_id") for p in progress}
    active_ids = {s.get("user_id") for s in active}
    churn_risk = len(learners - active_ids)

    category_counts: dict[str, int] = {}
    for c in courses:
        category_counts[c.get("category_name", "Unknown")] = category_counts.get(c.get("category_name", "Unknown"), 0) + 1
    top_category = max(category_counts, key=category_counts.get) if category_counts else "N/A"

    daily = _daily_totals(orders)
    recent_revenue = sum(daily[-30:]) if daily else 0

    return {
        "segment": "high-engagement office workers",
        "total_users": len(users),
        "active_subscriptions": len(active),
        "churn_risk_users": churn_risk,
        "top_category": top_category,
        "top_category_count": category_counts.get(top_category, 0),
        "total_revenue": round(sum(o.get("amount", 0) for o in orders), 2),
        "recent_30_day_revenue": round(recent_revenue, 2),
        "course_count": len(courses),
        "lesson_count": sum(len(c.get("syllabus", [])) for c in courses),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
