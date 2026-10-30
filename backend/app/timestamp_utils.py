
from datetime import datetime, timedelta


# Research-prototype configuration.
# These are data-quality settings, not clinical thresholds.
FUTURE_CLOCK_SKEW_MINUTES = 2
STALE_READING_MINUTES = 60


def normalize_datetime(value: datetime) -> datetime:
    """
    Normalize a datetime to a timezone-naive local datetime.

    Existing SQLite records use naive local datetimes. Preserve that
    convention for database compatibility.

    Incoming timezone-aware datetimes are converted to the server's
    local timezone before removing timezone information.
    """
    if value.tzinfo is not None:
        return value.astimezone().replace(tzinfo=None)

    return value


def timestamp_status(
    recorded_at: datetime,
    now: datetime | None = None,
) -> dict:
    """
    Classify a reading timestamp as recent, stale, or future-dated.

    Naive timestamps are interpreted using the existing local-time
    convention of this project.
    """
    recorded = normalize_datetime(recorded_at)
    current = normalize_datetime(now or datetime.now())

    age_minutes = (current - recorded).total_seconds() / 60

    if age_minutes < -FUTURE_CLOCK_SKEW_MINUTES:
        status = "invalid_future_timestamp"
    elif age_minutes > STALE_READING_MINUTES:
        status = "stale"
    else:
        status = "recent"

    return {
        "freshness_status": status,
        "reading_age_minutes": round(age_minutes, 1),
        "recorded_at_normalized": recorded,
    }


def validate_ingestion_timestamp(
    recorded_at: datetime,
    now: datetime | None = None,
) -> datetime:
    """
    Reject implausibly future-dated observations.

    Returns the normalized timestamp for database storage.
    Does not reject old observations: historical data may be useful
    for research, but must be classified as stale during assessment.
    """
    recorded = normalize_datetime(recorded_at)
    current = normalize_datetime(now or datetime.now())

    latest_allowed = current + timedelta(
        minutes=FUTURE_CLOCK_SKEW_MINUTES
    )

    if recorded > latest_allowed:
        raise ValueError(
            "Observation timestamp is too far in the future. "
            "Check the device clock and recorded time."
        )

    return recorded
