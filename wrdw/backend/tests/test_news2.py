
import pytest

from app.news2 import (
    calculate_news2,
    score_heart_rate,
    score_respiratory_rate,
    score_spo2,
    score_systolic_bp,
    score_temperature,
    score_consciousness,
)


@pytest.mark.parametrize(
    "value, expected",
    [
        (40, 3), (41, 1), (50, 1), (51, 0),
        (90, 0), (91, 1), (110, 1), (111, 2),
        (130, 2), (131, 3),
    ],
)
def test_heart_rate(value, expected):
    assert score_heart_rate(value) == expected


@pytest.mark.parametrize(
    "value, expected",
    [
        (8, 3), (9, 1), (11, 1), (12, 0),
        (20, 0), (21, 2), (24, 2), (25, 3),
    ],
)
def test_respiratory_rate(value, expected):
    assert score_respiratory_rate(value) == expected


@pytest.mark.parametrize(
    "value, expected",
    [
        (91, 3), (92, 2), (93, 2),
        (94, 1), (95, 1), (96, 0), (100, 0),
    ],
)
def test_spo2(value, expected):
    assert score_spo2(value) == expected


@pytest.mark.parametrize(
    "value, expected",
    [
        (90, 3), (91, 2), (100, 2), (101, 1),
        (110, 1), (111, 0), (219, 0), (220, 3),
    ],
)
def test_systolic_bp(value, expected):
    assert score_systolic_bp(value) == expected


@pytest.mark.parametrize(
    "value, expected",
    [
        (35.0, 3), (35.1, 1), (36.0, 1),
        (36.1, 0), (38.0, 0), (38.1, 1),
        (39.0, 1), (39.1, 2),
    ],
)
def test_temperature(value, expected):
    assert score_temperature(value) == expected


@pytest.mark.parametrize(
    "value, expected",
    [
        ("alert", 0),
        ("new_confusion", 3),
        ("voice", 3),
        ("pain", 3),
        ("unresponsive", 3),
    ],
)
def test_consciousness(value, expected):
    assert score_consciousness(value) == expected


def test_oxygen_changes_total_score():
    base = {
        "heart_rate": 75,
        "spo2": 98,
        "respiratory_rate": 16,
        "systolic_bp": 120,
        "temperature": 37.0,
        "consciousness": "alert",
    }

    no_oxygen = calculate_news2({
        **base,
        "supplemental_oxygen": "no",
    })
    oxygen = calculate_news2({
        **base,
        "supplemental_oxygen": "yes",
    })

    assert no_oxygen["total_score"] == 0
    assert oxygen["total_score"] == 2


def test_missing_reading_has_no_total_score():
    vitals = {
        "heart_rate": 75,
        "spo2": None,
        "respiratory_rate": 16,
        "systolic_bp": 120,
        "temperature": 37.0,
        "consciousness": "alert",
        "supplemental_oxygen": "no",
    }

    result = calculate_news2(vitals)

    assert result["complete"] is False
    assert result["total_score"] is None
    assert "spo2" in result["missing_parameters"]
def test_spo2_above_valid_range_is_rejected():
    with pytest.raises(ValueError):
        score_spo2(150)


def test_spo2_below_valid_range_is_rejected():
    with pytest.raises(ValueError):
        score_spo2(-1)
def test_heart_rate_zero_is_rejected():
    with pytest.raises(ValueError):
        score_heart_rate(0)


def test_heart_rate_negative_is_rejected():
    with pytest.raises(ValueError):
        score_heart_rate(-5)