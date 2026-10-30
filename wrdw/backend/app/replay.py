
from datetime import datetime
from types import SimpleNamespace
from typing import Any

from app.news2 import calculate_news2
from app.trends import detect_trends
from app.timestamp_utils import normalize_datetime


VITAL_FIELDS = [
    "heart_rate",
    "spo2",
    "respiratory_rate",
    "systolic_bp",
    "temperature",
    "consciousness",
    "supplemental_oxygen",
]


def reading_to_dict(reading: Any) -> dict:
    if isinstance(reading, dict):
        return {field: reading.get(field) for field in VITAL_FIELDS}
    return {
        field: getattr(reading, field, None)
        for field in VITAL_FIELDS
    }


def parse_timestamp(value, field_name, number):
    try:
        if isinstance(value, str):
            value = datetime.fromisoformat(value)
        if not isinstance(value, datetime):
            raise ValueError("Invalid timestamp type.")
        return normalize_datetime(value)
    except (TypeError, ValueError, AttributeError) as exc:
        raise ValueError(
            f"Observation {number} has an invalid {field_name}."
        ) from exc


def replay_observations(observations: list[dict]) -> dict:
    """Replay observations in arrival order, without database writes."""
    if not observations:
        raise ValueError("Provide at least one observation to replay.")

    prepared = []

    for index, observation in enumerate(observations):
        number = index + 1

        if not isinstance(observation, dict):
            raise ValueError(f"Observation {number} must be an object.")

        if "recorded_at" not in observation:
            raise ValueError(f"Observation {number} is missing recorded_at.")

        recorded_at = parse_timestamp(
            observation["recorded_at"], "recorded_at", number
        )

        arrival_value = observation.get("arrival_at")
        arrival_at = (
            parse_timestamp(arrival_value, "arrival_at", number)
            if arrival_value is not None
            else recorded_at
        )

        prepared.append({
            "recorded_at": recorded_at,
            "arrival_at": arrival_at,
            "vitals": reading_to_dict(observation),
            "quality_status": str(
                observation.get("quality_status", "pending")
            ).strip().lower(),
            "original_index": index,
        })

    # Arrival order is the order supplied to the replay.
    prepared.sort(
        key=lambda item: (item["arrival_at"], item["original_index"])
    )

    results = []
    previous = None

    for item in prepared:
        vitals = item["vitals"]

        try:
            news2 = calculate_news2(vitals)
        except (ValueError, TypeError) as exc:
            news2 = {
                "total_score": None,
                "complete": False,
                "missing_parameters": [],
                "error": str(exc),
                "clinical_use": False,
            }

        trend_result = None

        if previous is not None:
            previous_reading = SimpleNamespace(
                **previous["vitals"],
                recorded_at=previous["recorded_at"],
                quality_status=previous["quality_status"],
                id=None,
            )
            latest_reading = SimpleNamespace(
                **vitals,
                recorded_at=item["recorded_at"],
                quality_status=item["quality_status"],
                id=None,
            )
            trend_result = detect_trends(
                previous_reading, latest_reading
            )

        results.append({
            "observation_number": item["original_index"] + 1,
            "recorded_at": item["recorded_at"].isoformat(),
            "arrival_at": item["arrival_at"].isoformat(),
            "quality_status": item["quality_status"],
            "news2": news2,
            "trend": trend_result,
            "data_label": "SYNTHETIC - NOT FOR CLINICAL USE",
        })

        previous = item

    return {
        "observations_processed": len(results),
        "processing_order": "arrival_at",
        "results": results,
        "clinical_use": False,
        "database_modified": False,
    }

def compare_detection(
    observations: list[dict],
    news2_threshold: int = 5,
    deterioration_onset_at: str | None = None,
    scenario_label: str = "deteriorating",
) -> dict:
    """Compare NEWS2-only with NEWS2 plus trend detection in memory."""
    if not 0 <= news2_threshold <= 20:
        raise ValueError("NEWS2 threshold must be between 0 and 20.")

    if scenario_label not in {"deteriorating", "stable"}:
        raise ValueError(
            "scenario_label must be 'deteriorating' or 'stable'."
        )

    replay = replay_observations(observations)
    news2_detection = None
    combined_detection = None

    for result in replay["results"]:
        arrival_time = result["arrival_at"]
        news2 = result["news2"]
        trend = result["trend"]

        if (
            news2_detection is None
            and news2.get("complete") is True
            and news2.get("total_score") is not None
            and news2["total_score"] >= news2_threshold
        ):
            news2_detection = arrival_time

        trend_triggered = (
            isinstance(trend, dict)
            and trend.get("trend_detected") is True
        )
        news2_triggered = (
            news2.get("complete") is True
            and news2.get("total_score") is not None
            and news2["total_score"] >= news2_threshold
        )

        if combined_detection is None and (
            news2_triggered or trend_triggered
        ):
            combined_detection = arrival_time

    onset = None
    if deterioration_onset_at is not None:
        onset = parse_timestamp(
            deterioration_onset_at, "deterioration_onset_at", 1
        )

    def summarize(detection_time):
        if detection_time is None:
            return {
                "detected": False,
                "first_detection_at": None,
                "delay_minutes": None,
            }

        detected_at = parse_timestamp(
            detection_time, "detection_time", 1
        )
        delay = None
        if onset is not None:
            delay = round(
                (detected_at - onset).total_seconds() / 60, 2
            )

        return {
            "detected": True,
            "first_detection_at": detected_at.isoformat(),
            "delay_minutes": delay,
        }

    baseline = summarize(news2_detection)
    combined = summarize(combined_detection)

    return {
        "scenario_label": scenario_label,
        "news2_threshold": news2_threshold,
        "deterioration_onset_at": (
            onset.isoformat() if onset else None
        ),
        "news2_only": baseline,
        "news2_plus_trends": combined,
        "comparison": {
            "same_detection_outcome": (
                baseline["detected"] == combined["detected"]
            ),
            "combined_detected_earlier": (
                baseline["detected"]
                and combined["detected"]
                and combined["delay_minutes"] is not None
                and baseline["delay_minutes"] is not None
                and combined["delay_minutes"]
                < baseline["delay_minutes"]
            ),
            "false_alert_news2_only": (
                scenario_label == "stable" and baseline["detected"]
            ),
            "false_alert_combined": (
                scenario_label == "stable" and combined["detected"]
            ),
        },
        "observations_processed": replay["observations_processed"],
        "clinical_use": False,
        "database_modified": False,
        "research_note": (
            "Experimental comparison on supplied observations only; "
            "not clinically validated."
        ),
    }

def evaluate_research_scenarios(news2_threshold: int = 5) -> dict:
    """Run predefined synthetic scenarios without database writes."""
    from datetime import datetime, timedelta

    def observation(minute, hr, spo2, rr, sbp, temp):
        recorded = datetime(2026, 10, 20, 10, 0) + timedelta(
            minutes=minute
        )
        return {
            "recorded_at": recorded.isoformat(),
            "arrival_at": recorded.isoformat(),
            "heart_rate": hr,
            "spo2": spo2,
            "respiratory_rate": rr,
            "systolic_bp": sbp,
            "temperature": temp,
            "consciousness": "alert",
            "supplemental_oxygen": "no",
            "quality_status": "validated",
        }

    scenarios = [
        {
            "name": "stable",
            "label": "stable",
            "onset": None,
            "observations": [
                observation(0, 82, 98, 17, 120, 36.8),
                observation(10, 84, 98, 18, 118, 36.9),
            ],
        },
        {
            "name": "gradual_worsening",
            "label": "deteriorating",
            "onset": "2026-10-20T10:05:00",
            "observations": [
                observation(0, 82, 98, 17, 120, 36.8),
                observation(5, 95, 97, 19, 115, 37.2),
                observation(10, 105, 95, 22, 108, 37.8),
                observation(15, 112, 94, 24, 100, 38.0),
            ],
        },
        {
            "name": "trend_sensitive_worsening",
            "label": "deteriorating",
            "onset": "2026-10-20T10:05:00",
            "observations": [
                observation(0, 80, 98, 16, 120, 37.0),
                observation(10, 101, 96, 21, 110, 37.8),
            ],
        },
        {
            "name": "rapid_worsening",
            "label": "deteriorating",
            "onset": "2026-10-20T10:05:00",
            "observations": [
                observation(0, 80, 98, 16, 120, 37.0),
                observation(10, 130, 90, 30, 88, 39.0),
            ],
        },
    ]

    results = []

    for scenario in scenarios:
        result = compare_detection(
            observations=scenario["observations"],
            news2_threshold=news2_threshold,
            deterioration_onset_at=scenario["onset"],
            scenario_label=scenario["label"],
        )
        result["scenario_name"] = scenario["name"]
        results.append(result)

    stable_results = [
        result for result in results
        if result["scenario_label"] == "stable"
    ]

    return {
        "scenarios_evaluated": len(results),
        "news2_threshold": news2_threshold,
        "summary": {
            "news2_detections": sum(
                r["news2_only"]["detected"] for r in results
            ),
            "combined_detections": sum(
                r["news2_plus_trends"]["detected"] for r in results
            ),
            "combined_additional_detections": sum(
                r["news2_plus_trends"]["detected"]
                and not r["news2_only"]["detected"]
                for r in results
            ),
            "combined_detected_earlier": sum(
                r["comparison"]["combined_detected_earlier"]
                for r in results
            ),
            "stable_false_alerts_news2": sum(
                r["comparison"]["false_alert_news2_only"]
                for r in stable_results
            ),
            "stable_false_alerts_combined": sum(
                r["comparison"]["false_alert_combined"]
                for r in stable_results
            ),
        },
        "results": results,
        "clinical_use": False,
        "database_modified": False,
        "research_note": (
            "Predefined synthetic scenarios only. Results are not "
            "clinical validation or estimates of real-world performance."
        ),
    }

