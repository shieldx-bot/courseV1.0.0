import os
os.environ["MONGODB_URI"] = "memory://test"

import json
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock
import numpy as np

from app.services import ai


def _make_orders(n_days: int, base_amount: float = 100.0) -> list[dict]:
    now = datetime.now(timezone.utc)
    orders = []
    for i in range(n_days):
        day = (now - timedelta(days=n_days - 1 - i)).strftime("%Y-%m-%d")
        orders.append({"created_at": day + "T10:00:00Z", "amount": base_amount + (i * 2) % 200})
    return orders


def _make_users(n_days: int) -> list[dict]:
    now = datetime.now(timezone.utc)
    users = []
    for i in range(n_days):
        day = (now - timedelta(days=n_days - 1 - i)).strftime("%Y-%m-%d")
        users.append({"_id": f"user-{i}", "created_at": day + "T10:00:00Z"})
    return users


def _make_progress(n_days: int) -> list[dict]:
    now = datetime.now(timezone.utc)
    progress = []
    for i in range(n_days):
        day = (now - timedelta(days=n_days - 1 - i)).strftime("%Y-%m-%d")
        for j in range(3):
            progress.append({
                "user_id": f"user-{i}",
                "completed": True,
                "updated_at": day + "T12:00:00Z",
            })
    return progress


def _make_subscriptions(n_days: int) -> list[dict]:
    now = datetime.now(timezone.utc)
    subs = []
    for i in range(n_days):
        day = (now - timedelta(days=n_days - 1 - i)).strftime("%Y-%m-%d")
        if i % 3 == 0:
            subs.append({
                "user_id": f"user-{i}",
                "status": "active",
                "starts_at": day + "T10:00:00Z",
            })
    return subs


def _make_courses() -> list[dict]:
    return [
        {"category_name": "Data & Analytics", "syllabus": [{"id": "l1"}, {"id": "l2"}]},
        {"category_name": "Marketing", "syllabus": [{"id": "l3"}]},
        {"category_name": "Data & Analytics", "syllabus": [{"id": "l4"}, {"id": "l5"}]},
    ]


# ---------------------------------------------------------------------------
# _daily_totals
# ---------------------------------------------------------------------------

def test_daily_totals_empty():
    assert ai._daily_totals([]) == []


def test_daily_totals_aggregates_by_day():
    orders = [
        {"created_at": "2026-07-01T10:00:00Z", "amount": 100},
        {"created_at": "2026-07-01T12:00:00Z", "amount": 50},
        {"created_at": "2026-07-02T10:00:00Z", "amount": 200},
    ]
    totals = ai._daily_totals(orders)
    assert totals == [150.0, 200.0]


def test_daily_totals_skips_missing_created_at():
    orders = [{"created_at": "", "amount": 100}, {"amount": 50}]
    assert ai._daily_totals(orders) == []


# ---------------------------------------------------------------------------
# _build_daily_features
# ---------------------------------------------------------------------------

def test_build_daily_features_structure():
    orders = _make_orders(10)
    users = _make_users(10)
    progress = _make_progress(10)
    subs = _make_subscriptions(10)

    features = ai._build_daily_features(orders, users, progress, subs)
    assert "dates" in features
    assert "revenue" in features
    assert "new_users" in features
    assert "active_learners" in features
    assert "lessons_completed" in features
    assert "new_subscriptions" in features
    assert len(features["dates"]) == 10
    assert len(features["revenue"]) == 10


def test_build_daily_features_active_learners_are_deduped():
    progress = [
        {"user_id": "u1", "completed": True, "updated_at": "2026-07-01T12:00:00Z"},
        {"user_id": "u1", "completed": False, "updated_at": "2026-07-01T13:00:00Z"},
        {"user_id": "u2", "completed": True, "updated_at": "2026-07-01T14:00:00Z"},
    ]
    orders = [{"created_at": "2026-07-01T10:00:00Z", "amount": 100}]
    users = [{"_id": "u1", "created_at": "2026-07-01T10:00:00Z"}, {"_id": "u2", "created_at": "2026-07-01T10:00:00Z"}]
    subs = []

    features = ai._build_daily_features(orders, users, progress, subs)
    assert features["active_learners"][0] == 2  # u1 and u2, deduped


def test_build_daily_features_empty():
    features = ai._build_daily_features([], [], [], [])
    assert features == {
        "dates": [],
        "revenue": [],
        "new_users": [],
        "active_learners": [],
        "lessons_completed": [],
        "new_subscriptions": [],
    }


# ---------------------------------------------------------------------------
# _moving_average
# ---------------------------------------------------------------------------

def test_moving_average_empty():
    assert ai._moving_average([], 3) == []


def test_moving_average_basic():
    result = ai._moving_average([1, 2, 3, 4, 5], 3)
    assert len(result) == 5
    assert result[0] == 1.0
    assert result[4] == 4.0


# ---------------------------------------------------------------------------
# _naive_forecast
# ---------------------------------------------------------------------------

def test_naive_forecast_insufficient_data():
    result = ai._naive_forecast([{"created_at": "2026-07-01T10:00:00Z", "amount": 100}], 30)
    assert result["predicted_revenue"] == 0.0
    assert result["confidence"] == 0.1


def test_naive_forecast_with_data():
    orders = _make_orders(30)
    result = ai._naive_forecast(orders, 10)
    assert result["predicted_revenue"] > 0
    assert 0.1 <= result["confidence"] <= 0.95
    assert result["model"] == "fallback"


# ---------------------------------------------------------------------------
# _build_multivariate_lstm  (TF mocked)
# ---------------------------------------------------------------------------

@patch.dict("sys.modules", {"tensorflow": None})
def test_multivariate_lstm_returns_none_when_tf_missing():
    features = {"revenue": [100.0, 200.0, 300.0]}
    assert ai._build_multivariate_lstm(features, 30) is None


def test_multivariate_lstm_returns_none_when_short_data():
    features = {"revenue": [100.0] * 10, "new_users": [1] * 10, "active_learners": [1] * 10,
                "lessons_completed": [3] * 10, "new_subscriptions": [0] * 10}
    assert ai._build_multivariate_lstm(features, 30) is None


def test_multivariate_lstm_trains_and_predicts():
    import sys
    mock_tf = MagicMock()
    mock_model = MagicMock()
    mock_model.predict.return_value = np.array([[0.5]])
    mock_tf.keras.Sequential.return_value = mock_model
    mock_tf.random.set_seed = MagicMock()
    sys.modules["tensorflow"] = mock_tf

    try:
        features = {"revenue": list(range(100, 200)), "new_users": [1] * 100, "active_learners": [5] * 100,
                    "lessons_completed": [10] * 100, "new_subscriptions": [2] * 100}

        result = ai._build_multivariate_lstm(features, 30)
        assert result is not None
        assert result["model"] == "lstm_multivariate"
        assert result["predicted_revenue"] > 0
        assert "confidence" in result
        assert "user behavior" in result["note"].lower()
    finally:
        sys.modules.pop("tensorflow", None)


# ---------------------------------------------------------------------------
# _build_univariate_lstm  (TF mocked)
# ---------------------------------------------------------------------------

@patch.dict("sys.modules", {"tensorflow": None})
def test_univariate_lstm_returns_none_when_tf_missing():
    assert ai._build_univariate_lstm([100.0, 200.0], 30) is None


def test_univariate_lstm_returns_none_when_short_data():
    assert ai._build_univariate_lstm([100.0] * 5, 30) is None


def test_univariate_lstm_returns_none_on_flat_data():
    import sys
    mock_tf = MagicMock()
    mock_tf.random.set_seed = MagicMock()
    sys.modules["tensorflow"] = mock_tf

    try:
        assert ai._build_univariate_lstm([100.0] * 20, 30) is None
    finally:
        sys.modules.pop("tensorflow", None)


# ---------------------------------------------------------------------------
# forecast_revenue
# ---------------------------------------------------------------------------

def test_forecast_revenue_insufficient():
    result = ai.forecast_revenue([{"created_at": "2026-07-01T10:00:00Z", "amount": 100}])
    assert result["predicted_revenue"] == 0.0
    assert result["model"] == "none"


@patch("app.services.ai._build_multivariate_lstm")
@patch("app.services.ai._build_univariate_lstm")
def test_forecast_revenue_prefers_multivariate(mock_uni, mock_multi):
    mock_multi.return_value = {"predicted_revenue": 5000, "confidence": 0.9, "note": "multi", "model": "lstm_multivariate"}
    orders = _make_orders(30)
    users = _make_users(30)
    progress = _make_progress(30)
    subs = _make_subscriptions(30)

    result = ai.forecast_revenue(orders, users, progress, subs, 10)
    assert result["model"] == "lstm_multivariate"
    mock_multi.assert_called_once()
    mock_uni.assert_not_called()


@patch("app.services.ai._build_multivariate_lstm")
@patch("app.services.ai._build_univariate_lstm")
def test_forecast_revenue_fallsback_to_univariate(mock_uni, mock_multi):
    mock_multi.return_value = None
    mock_uni.return_value = {"predicted_revenue": 3000, "confidence": 0.8, "note": "uni", "model": "lstm"}
    orders = _make_orders(30)

    result = ai.forecast_revenue(orders, None, None, None, 10)
    assert result["model"] == "lstm"
    mock_uni.assert_called_once()


@patch("app.services.ai._build_multivariate_lstm")
@patch("app.services.ai._build_univariate_lstm")
def test_forecast_revenue_fallsback_to_naive(mock_uni, mock_multi):
    mock_multi.return_value = None
    mock_uni.return_value = None
    orders = _make_orders(30)

    result = ai.forecast_revenue(orders, None, None, None, 10)
    assert result["model"] == "fallback"


# ---------------------------------------------------------------------------
# forecast_new_subscriptions
# ---------------------------------------------------------------------------

@patch("app.services.ai.forecast_revenue")
def test_forecast_new_subscriptions_from_revenue(mock_rev):
    mock_rev.return_value = {"predicted_revenue": 5000}
    result = ai.forecast_new_subscriptions([], 50.0, 30)
    assert result["predicted_new_subscriptions"] == 100


@patch("app.services.ai.forecast_revenue")
def test_forecast_new_subscriptions_min_zero(mock_rev):
    mock_rev.return_value = {"predicted_revenue": 0}
    result = ai.forecast_new_subscriptions([], 50.0, 30)
    assert result["predicted_new_subscriptions"] == 0


# ---------------------------------------------------------------------------
# _compute_user_features
# ---------------------------------------------------------------------------

def test_compute_user_features_structure():
    now = datetime.now(timezone.utc)
    progress = [
        {"user_id": "u1", "completed": True, "updated_at": (now - timedelta(days=1)).isoformat()},
        {"user_id": "u1", "completed": True, "updated_at": (now - timedelta(days=5)).isoformat()},
        {"user_id": "u2", "completed": False, "updated_at": (now - timedelta(days=30)).isoformat()},
    ]
    subs = [{"user_id": "u1", "status": "active", "starts_at": (now - timedelta(days=30)).isoformat()}]
    users = [{"_id": "u1"}, {"_id": "u2"}, {"_id": "u3"}]

    features = ai._compute_user_features(progress, subs, users)
    assert len(features) == 3

    u1 = next(f for f in features if f["user_id"] == "u1")
    assert u1["has_active_subscription"] == 1
    assert u1["total_lessons_completed"] == 2
    assert u1["lessons_completed_7d"] == 2

    u2 = next(f for f in features if f["user_id"] == "u2")
    assert u2["has_active_subscription"] == 0
    assert u2["days_since_last_activity"] >= 29

    u3 = next(f for f in features if f["user_id"] == "u3")
    assert u3["days_since_last_activity"] == 999


def test_compute_user_features_empty():
    assert ai._compute_user_features([], [], []) == []


# ---------------------------------------------------------------------------
# _build_churn_nn  (TF mocked)
# ---------------------------------------------------------------------------

@patch.dict("sys.modules", {"tensorflow": None})
def test_churn_nn_returns_none_when_tf_missing():
    features = ai._compute_user_features([], [], [{"_id": "u1"}])
    assert ai._build_churn_nn(features) is None


def test_churn_nn_returns_none_when_few_users():
    features = [{"user_id": f"u{i}", "days_since_last_activity": i, "total_lessons_completed": 0,
                 "lessons_completed_7d": 0, "has_active_subscription": 0, "subscription_duration_days": 0}
                for i in range(5)]
    assert ai._build_churn_nn(features) is None


def test_churn_nn_trains_and_predicts():
    import sys
    mock_tf = MagicMock()
    mock_model = MagicMock()
    mock_model.predict.return_value = np.array([[0.2], [0.8], [0.3], [0.9], [0.1], [0.6], [0.4], [0.7], [0.3], [0.5]])
    mock_tf.keras.Sequential.return_value = mock_model
    mock_tf.random.set_seed = MagicMock()
    sys.modules["tensorflow"] = mock_tf

    try:
        features = [
            {"user_id": f"u{i}", "days_since_last_activity": i * 5, "total_lessons_completed": max(0, 10 - i),
             "lessons_completed_7d": max(0, 5 - i), "has_active_subscription": 1 if i < 5 else 0,
             "subscription_duration_days": 30 - i}
            for i in range(10)
        ]

        result = ai._build_churn_nn(features)
        assert result is not None
        assert result["model"] == "neural_network"
        assert result["total_users_analyzed"] == 10
        assert "predicted_churn_rate" in result
        assert "churn_risk_users" in result
        assert len(result["user_risk_scores"]) == 10
        assert "churn_probability" in result["user_risk_scores"][0]
    finally:
        sys.modules.pop("tensorflow", None)


# ---------------------------------------------------------------------------
# _rule_churn
# ---------------------------------------------------------------------------

def test_rule_churn_no_learners():
    result = ai._rule_churn([], [])
    assert result["predicted_churn_rate"] == 0.0
    assert result["churn_risk_users"] == 0


def test_rule_churn_some_at_risk():
    subs = [{"user_id": "u1", "status": "active"}, {"user_id": "u2", "status": "active"}]
    progress = [{"user_id": "u1"}, {"user_id": "u2"}, {"user_id": "u3"}]
    result = ai._rule_churn(progress, subs)
    assert result["churn_risk_users"] == 1


# ---------------------------------------------------------------------------
# forecast_churn
# ---------------------------------------------------------------------------

@patch("app.services.ai._build_churn_nn")
def test_forecast_churn_prefers_nn(mock_nn):
    mock_nn.return_value = {"predicted_churn_rate": 0.35, "churn_risk_users": 7, "model": "neural_network"}
    result = ai.forecast_churn([], [], [{"_id": "u1"}])
    assert result["model"] == "neural_network"


@patch("app.services.ai._build_churn_nn")
def test_forecast_churn_fallsback_to_rule(mock_nn):
    mock_nn.return_value = None
    subs = [{"user_id": "u1", "status": "active"}]
    progress = [{"user_id": "u1"}, {"user_id": "u2"}]
    result = ai.forecast_churn(progress, subs, [{"_id": "u1"}, {"_id": "u2"}])
    assert result["model"] == "rule-based"


def test_forecast_churn_no_users_fallsback():
    subs = [{"user_id": "u1", "status": "active"}]
    progress = [{"user_id": "u1"}, {"user_id": "u2"}]
    result = ai.forecast_churn(progress, subs, None)
    assert result["model"] == "rule-based"


# ---------------------------------------------------------------------------
# _rule_based_summary
# ---------------------------------------------------------------------------

def test_rule_based_summary():
    metrics = {"segment": "test", "churn_risk_users": 5, "active_subscriptions": 20, "top_category": "Data"}
    text = ai._rule_based_summary(metrics)
    assert "test" in text
    assert "5" in text
    assert "Data" in text


# ---------------------------------------------------------------------------
# build_metrics
# ---------------------------------------------------------------------------

def test_build_metrics_empty():
    metrics = ai.build_metrics([], [], [], [], [])
    assert metrics["total_users"] == 0
    assert metrics["total_revenue"] == 0
    assert metrics["top_category"] == "N/A"


def test_build_metrics_with_data():
    users = _make_users(10)
    progress = _make_progress(10)
    subs = _make_subscriptions(10)
    courses = _make_courses()
    orders = _make_orders(10)

    metrics = ai.build_metrics(users, progress, subs, courses, orders)
    assert metrics["total_users"] == 10
    assert metrics["total_revenue"] > 0
    assert metrics["top_category"] == "Data & Analytics"
    assert metrics["course_count"] == 3
    assert metrics["lesson_count"] == 5
    assert "timestamp" in metrics


# ---------------------------------------------------------------------------
# Integration: forecast endpoint pipeline (all mocked)
# ---------------------------------------------------------------------------

@patch("app.services.ai._build_multivariate_lstm")
@patch("app.services.ai._build_churn_nn")
def test_full_forecast_pipeline(mock_churn, mock_multi):
    mock_multi.return_value = {"predicted_revenue": 5000.0, "confidence": 0.85, "note": "multi", "model": "lstm_multivariate"}
    mock_churn.return_value = {"predicted_churn_rate": 0.3, "churn_risk_users": 5, "model": "neural_network"}

    orders = _make_orders(30)
    users = _make_users(30)
    progress = _make_progress(30)
    subs = _make_subscriptions(30)

    revenue = ai.forecast_revenue(orders, users, progress, subs, 30)
    assert revenue["model"] == "lstm_multivariate"

    new_subs = ai.forecast_new_subscriptions(orders, 50.0, 30)
    assert new_subs["predicted_new_subscriptions"] > 0

    churn = ai.forecast_churn(progress, subs, users)
    assert churn["model"] == "neural_network"
