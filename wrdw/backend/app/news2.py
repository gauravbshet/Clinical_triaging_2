
from typing import Optional

def validate_range(
    name: str,
    value: Optional[float],
    minimum: float,
    maximum: float,
) -> None:
    """Reject values outside the configured input range."""
    if value is None:
        return

    if not minimum <= value <= maximum:
        raise ValueError(
            f"{name} must be between {minimum} and {maximum}."
        )
def score_respiratory_rate(value: Optional[int]) -> Optional[int]:
    if value is None:
        return None
    validate_range("Respiratory rate", value, 1, 100)
    if value <= 8 or value >= 25:
        return 3
    if 9 <= value <= 11:
        return 1
    if 12 <= value <= 20:
        return 0
    return 2  # 21–24


def score_spo2(value: Optional[float]) -> Optional[int]:
    if value is None:
        return None
    validate_range("SpO2", value, 0, 100)
    if value <= 91:
        return 3
    if value <= 93:
        return 2
    if value <= 95:
        return 1
    return 0


def score_systolic_bp(value: Optional[int]) -> Optional[int]:
    if value is None:
        return None
    validate_range("Systolic BP", value, 1, 300)
    if value <= 90 or value >= 220:
        return 3
    if value <= 100:
        return 2
    if value <= 110:
        return 1
    return 0



def score_heart_rate(value: Optional[int]) -> Optional[int]:
    if value is None:
        return None
    validate_range("Heart rate", value, 1, 300)
    if value <= 40 or value >= 131:
        return 3
    if value <= 50 or 91 <= value <= 110:
        return 1
    if 111 <= value <= 130:
        return 2
    return 0



def score_temperature(value: Optional[float]) -> Optional[int]:
    if value is None:
        return None
    validate_range("Temperature", value, 25, 45)
    if value <= 35.0:
        return 3
    if value <= 36.0:
        return 1
    if value <= 38.0:
        return 0
    if value <= 39.0:
        return 1
    return 2


def score_consciousness(value: Optional[str]) -> Optional[int]:
    if value is None:
        return None

    status = value.strip().lower()

    if status == "alert":
        return 0

    if status in {
        "new_confusion",
        "voice",
        "pain",
        "unresponsive",
    }:
        return 3

    raise ValueError(
        "Use alert, new_confusion, voice, pain, or unresponsive."
    )


def calculate_news2(vitals: dict) -> dict:
    """
    Research prototype using NEWS2 SpO2 Scale 1.
    Missing parameters are reported; they are never scored as zero.
    """

    scores = {
        "respiratory_rate": score_respiratory_rate(
            vitals.get("respiratory_rate")
        ),
        "spo2": score_spo2(vitals.get("spo2")),
        "systolic_bp": score_systolic_bp(
            vitals.get("systolic_bp")
        ),
        "heart_rate": score_heart_rate(
            vitals.get("heart_rate")
        ),
        "temperature": score_temperature(
            vitals.get("temperature")
        ),
        "consciousness": score_consciousness(
            vitals.get("consciousness")
        ),
    }

    oxygen = vitals.get("supplemental_oxygen")
    if oxygen is None:
        scores["supplemental_oxygen"] = None
    elif str(oxygen).strip().lower() in {"yes", "true"}:
        scores["supplemental_oxygen"] = 2
    elif str(oxygen).strip().lower() in {"no", "false"}:
        scores["supplemental_oxygen"] = 0
    else:
        raise ValueError(
            "supplemental_oxygen must be yes or no."
        )

    missing = [
        name for name, score in scores.items()
        if score is None
    ]

    
    return {
        "total_score": (
            None if missing
            else sum(scores.values())
        ),
        "complete": len(missing) == 0,
        "missing_parameters": missing,
        "component_scores": scores,
        "scale": 1,
        "clinical_use": False,
    }

