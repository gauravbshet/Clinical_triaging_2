
from datetime import datetime, timedelta

from app.replay import replay_observations


def make_observation(minutes, heart_rate, spo2=98, rr=18,
                     systolic_bp=122, temperature=37.0):
    return {
        "recorded_at": (
            datetime(2026, 1, 1, 10, 0)
            + timedelta(minutes=minutes)
        ).isoformat(),
        "heart_rate": heart_rate,
        "spo2": spo2,
        "respiratory_rate": rr,
        "systolic_bp": systolic_bp,
        "temperature": temperature,
        "consciousness": "alert",
        "supplemental_oxygen": "no",
        "quality_status": "validated",
    }


def test_replay_processes_observations():
    observations = [
        make_observation(0, 85),
        make_observation(8, 110, 94, 24, 100, 38.2),
    ]

    result = replay_observations(observations)

    assert result["observations_processed"] == 2
    assert result["clinical_use"] is False
    assert result["database_modified"] is False


def test_replay_detects_worsening_trend():
    observations = [
        make_observation(0, 85),
        make_observation(8, 110, 94, 24, 100, 38.2),
    ]

    result = replay_observations(observations)

    trend = result["results"][1]["trend"]

    assert trend["trend_detected"] is True
    assert len(trend["reasons"]) == 5


def test_replay_reports_missing_news2_parameters():
    observation = {
        "recorded_at": "2026-01-01T10:00:00",
        "heart_rate": 85,
        "quality_status": "validated",
    }

    result = replay_observations([observation])
    news2 = result["results"][0]["news2"]

    assert news2["complete"] is False
    assert news2["total_score"] is None
    assert "spo2" in news2["missing_parameters"]


def test_replay_sorts_observations_chronologically():
    observations = [
        make_observation(8, 110, 94, 24, 100, 38.2),
        make_observation(0, 85),
    ]

    result = replay_observations(observations)

    timestamps = [
        item["recorded_at"] for item in result["results"]
    ]

    assert timestamps == sorted(timestamps)
    assert result["results"][0]["observation_number"] == 2
