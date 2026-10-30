
from typing import Any

from app.timestamp_utils import normalize_datetime


# Research-prototype thresholds only.
# These are not clinically validated escalation rules.
TREND_THRESHOLDS = {
    "heart_rate_increase": 20,
    "spo2_drop": 3,
    "respiratory_rate_increase": 5,
    "systolic_bp_drop": 20,
    "temperature_increase": 1.0,
}


def detect_trends(previous: Any, latest: Any) -> dict:
    """Compare two readings and explain significant changes."""

    reasons = []

    # Do not compare observations that have not passed
    # the project's data-quality gate.
    if (
        (previous.quality_status or "").lower() != "validated"
        or (latest.quality_status or "").lower() != "validated"
    ):
        return {
            "status": "quality_pending",
            "trend_detected": False,
            "reasons": [],
            "message": "Both readings must be validated.",
            "clinical_use": False,
        }

    try:
      previous_time = normalize_datetime(previous.recorded_at)
      latest_time = normalize_datetime(latest.recorded_at)
    except (TypeError, ValueError, AttributeError):
       return {
        "status": "invalid_timestamp",
        "trend_detected": False,
        "reasons": [],
        "message": "A reading has an invalid timestamp.",
        "clinical_use": False,
    }

    if latest_time <= previous_time:
       return {
        "status": "invalid_sequence",
        "trend_detected": False,
        "reasons": [],
        "message": "Readings must be in chronological order.",
        "clinical_use": False,
    }

    # Heart rate increase
    if (
        previous.heart_rate is not None
        and latest.heart_rate is not None
        and latest.heart_rate - previous.heart_rate
        >= TREND_THRESHOLDS["heart_rate_increase"]
    ):
        reasons.append({
            "parameter": "heart_rate",
            "previous": previous.heart_rate,
            "latest": latest.heart_rate,
            "change": latest.heart_rate - previous.heart_rate,
            "reason": "Heart rate increased by at least 20 bpm.",
        })

    # Oxygen saturation decrease
    if (
        previous.spo2 is not None
        and latest.spo2 is not None
        and previous.spo2 - latest.spo2
        >= TREND_THRESHOLDS["spo2_drop"]
    ):
        reasons.append({
            "parameter": "spo2",
            "previous": previous.spo2,
            "latest": latest.spo2,
            "change": latest.spo2 - previous.spo2,
            "reason": "SpO2 decreased by at least 3 percentage points.",
        })

    # Respiratory rate increase
    if (
        previous.respiratory_rate is not None
        and latest.respiratory_rate is not None
        and latest.respiratory_rate - previous.respiratory_rate
        >= TREND_THRESHOLDS["respiratory_rate_increase"]
    ):
        reasons.append({
            "parameter": "respiratory_rate",
            "previous": previous.respiratory_rate,
            "latest": latest.respiratory_rate,
            "change": latest.respiratory_rate - previous.respiratory_rate,
            "reason": "Respiratory rate increased by at least 5 breaths/min.",
        })

    # Systolic blood pressure decrease
    if (
        previous.systolic_bp is not None
        and latest.systolic_bp is not None
        and previous.systolic_bp - latest.systolic_bp
        >= TREND_THRESHOLDS["systolic_bp_drop"]
    ):
        reasons.append({
            "parameter": "systolic_bp",
            "previous": previous.systolic_bp,
            "latest": latest.systolic_bp,
            "change": latest.systolic_bp - previous.systolic_bp,
            "reason": "Systolic blood pressure decreased by at least 20 mmHg.",
        })

    # Temperature increase
    if (
        previous.temperature is not None
        and latest.temperature is not None
        and latest.temperature - previous.temperature
        >= TREND_THRESHOLDS["temperature_increase"]
    ):
        reasons.append({
            "parameter": "temperature",
            "previous": previous.temperature,
            "latest": latest.temperature,
            "change": round(
                latest.temperature - previous.temperature, 2
            ),
            "reason": "Temperature increased by at least 1 degree Celsius.",
        })

    return {
        "status": "evaluated",
        "trend_detected": bool(reasons),
        "previous_reading_id": previous.id,
        "latest_reading_id": latest.id,
        "previous_recorded_at": previous.recorded_at,
        "latest_recorded_at": latest.recorded_at,
        "reasons": reasons,
        "message": (
            "Potential worsening trend detected."
            if reasons
            else "No configured worsening trend detected."
        ),
        "clinical_use": False,
    }
