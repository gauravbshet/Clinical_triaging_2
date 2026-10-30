
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from app.timestamp_utils import validate_ingestion_timestamp
from app.timestamp_utils import timestamp_status
from app.schemas import ReplayRequest
from app.replay import compare_detection
from app.replay import replay_observations
from app.replay import evaluate_research_scenarios
from datetime import datetime,timedelta
from app.models import DeteriorationAlert, AlertAudit
from app.trends import detect_trends
from datetime import datetime, timezone
from app.news2 import calculate_news2
from app.database import Base, engine, get_db
from app.models import Patient, VitalReading
from app.schemas import (
    PatientCreate, PatientResponse,
    VitalCreate, VitalResponse
)

Base.metadata.create_all(bind=engine)

class AlertAckPayload(BaseModel):
    actor: str = "nurse"
    note: str | None = None


app = FastAPI(
    title="Waiting-Room Deterioration Watch",
    description="Research prototype for monitoring patient vital-sign trends.",
    version="0.1.0"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/research/replay")
def run_research_replay(data: ReplayRequest):
    try:
        return replay_observations(
            [observation.model_dump() for observation in data.observations]
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
@app.get("/health")
def health():
    return {"status": "ok", "project": "WRDW"}


@app.post("/patients", response_model=PatientResponse, status_code=201)
def create_patient(data: PatientCreate, db: Session = Depends(get_db)):
    existing = db.query(Patient).filter(
        Patient.patient_code == data.patient_code
    ).first()

    if existing:
        raise HTTPException(status_code=409, detail="Patient code already exists")

    patient = Patient(**data.model_dump())
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient


@app.get("/patients", response_model=list[PatientResponse])
def list_patients(db: Session = Depends(get_db)):
    return db.query(Patient).order_by(Patient.id.desc()).all()


@app.get("/patients/{patient_id}", response_model=PatientResponse)
def get_patient(patient_id: int, db: Session = Depends(get_db)):
    patient = db.get(Patient, patient_id)

    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    return patient



@app.post(
    "/patients/{patient_id}/vitals",
    response_model=VitalResponse,
    status_code=201,
)
def add_vitals(
    patient_id: int,
    data: VitalCreate,
    db: Session = Depends(get_db),
):
    patient = db.get(Patient, patient_id)

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient not found",
        )

    try:
        recorded_at = validate_ingestion_timestamp(
            data.recorded_at
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    payload = data.model_dump()
    payload["recorded_at"] = recorded_at

    reading = VitalReading(
        patient_id=patient_id,
        **payload,
        quality_status="pending",
    )

    try:
        db.add(reading)
        db.commit()
        db.refresh(reading)
    except Exception:
        db.rollback()
        raise

    return reading


@app.get(
    "/patients/{patient_id}/vitals",
    response_model=list[VitalResponse]
)
def list_vitals(patient_id: int, db: Session = Depends(get_db)):
    patient = db.get(Patient, patient_id)

    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    return (
        db.query(VitalReading)
        .filter(VitalReading.patient_id == patient_id)
        .order_by(VitalReading.recorded_at.desc())
        .all()
    )



@app.get("/patients/{patient_id}/news2")
def get_patient_news2(
    patient_id: int,
    db: Session = Depends(get_db),
):
    patient = (
        db.query(Patient)
        .filter(Patient.id == patient_id)
        .first()
    )

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient not found",
        )

    latest = (
        db.query(VitalReading)
        .filter(VitalReading.patient_id == patient_id)
        .order_by(VitalReading.recorded_at.desc())
        .first()
    )

    if latest is None:
        return {
            "patient_id": patient_id,
            "total_score": None,
            "complete": False,
            "score_status": "unavailable",
            "quality_status": "no_readings",
            "freshness_status": "unknown",
            "message": "No vital readings available",
        }

    vitals = {
        "heart_rate": latest.heart_rate,
        "spo2": latest.spo2,
        "respiratory_rate": latest.respiratory_rate,
        "systolic_bp": latest.systolic_bp,
        "temperature": latest.temperature,
        "consciousness": latest.consciousness,
        "supplemental_oxygen": latest.supplemental_oxygen,
    }

    result = calculate_news2(vitals)

    # Prototype freshness window: 60 minutes.
    # This is configurable demo logic, not an official NEWS2 rule.
    timestamp_info = timestamp_status(latest.recorded_at)

    freshness_status = timestamp_info["freshness_status"]
    age_minutes = timestamp_info["reading_age_minutes"]
    recorded_at = timestamp_info["recorded_at_normalized"]

    quality_status = latest.quality_status or "pending"

    if not result["complete"]:
        assessment_status = "incomplete"

    elif freshness_status == "invalid_future_timestamp":
        assessment_status = "invalid_timestamp"

    elif freshness_status == "stale":
        assessment_status = "stale"

    elif quality_status.lower() != "validated":
        assessment_status = "quality_pending"

    else:
        assessment_status = "provisional"
    calculated_total_score = result["total_score"]
    if assessment_status == "provisional":
        assessment_total_score = calculated_total_score
    else:
        assessment_total_score = None


    return {
        "patient_id": patient_id,
        "vital_reading_id": latest.id,
        "recorded_at": recorded_at,
        **result,
        "total_score": assessment_total_score,
        "calculated_total_score": calculated_total_score,

        "quality_status": quality_status,
        "freshness_status": freshness_status,
        "reading_age_minutes": round(age_minutes, 1),
        "assessment_status": assessment_status,
        "score_status": (
    "provisional"
    if assessment_status == "provisional"
    else "calculated_not_eligible"
),        "clinical_use": False,
    }

@app.get("/patients/{patient_id}/trends")
def get_patient_trends(
    patient_id: int,
    db: Session = Depends(get_db),
):
    patient = db.get(Patient, patient_id)

    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    readings = (
        db.query(VitalReading)
        .filter(VitalReading.patient_id == patient_id)
        .order_by(
            VitalReading.recorded_at.desc(),
            VitalReading.id.desc(),
        )
        .limit(2)
        .all()
    )

    if len(readings) < 2:
        return {
            "patient_id": patient_id,
            "status": "insufficient_history",
            "trend_detected": False,
            "reasons": [],
            "message": "At least two readings are needed.",
            "clinical_use": False,
        }

    latest, previous = readings[0], readings[1]

    timestamp_info = timestamp_status(latest.recorded_at)

    if timestamp_info["freshness_status"] == "invalid_future_timestamp":
        return {
            "patient_id": patient_id,
            "status": "invalid_timestamp",
            "trend_detected": False,
            "reasons": [],
            "message": "The latest reading has a future timestamp.",
            "clinical_use": False,
        }

    if timestamp_info["freshness_status"] == "stale":
        return {
            "patient_id": patient_id,
            "status": "stale",
            "trend_detected": False,
            "reasons": [],
            "message": "The latest reading is over 60 minutes old.",
            "reading_age_minutes": timestamp_info["reading_age_minutes"],
            "clinical_use": False,
        }

    result = detect_trends(previous, latest)

    return {
        "patient_id": patient_id,
        **result,
        "reading_age_minutes": timestamp_info["reading_age_minutes"],
        "clinical_use": False,
    }
@app.post("/patients/{patient_id}/trends/evaluate")
def evaluate_patient_trend(
    patient_id: int,
    db: Session = Depends(get_db),
):
    patient = db.get(Patient, patient_id)

    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    readings = (
        db.query(VitalReading)
        .filter(VitalReading.patient_id == patient_id)
        .order_by(
            VitalReading.recorded_at.desc(),
            VitalReading.id.desc(),
        )
        .limit(2)
        .all()
    )

    if len(readings) < 2:
        return {
            "patient_id": patient_id,
            "status": "insufficient_history",
            "trend_detected": False,
            "reasons": [],
            "message": "At least two readings are needed.",
            "clinical_use": False,
        }

    latest, previous = readings[0], readings[1]

    timestamp_info = timestamp_status(latest.recorded_at)

    if timestamp_info["freshness_status"] == "invalid_future_timestamp":
        return {
            "patient_id": patient_id,
            "status": "invalid_timestamp",
            "trend_detected": False,
            "reasons": [],
            "message": "The latest reading has a future timestamp.",
            "clinical_use": False,
        }

    if timestamp_info["freshness_status"] == "stale":
        return {
            "patient_id": patient_id,
            "status": "stale",
            "trend_detected": False,
            "reasons": [],
            "message": "The latest reading is over 60 minutes old.",
            "reading_age_minutes": timestamp_info["reading_age_minutes"],
            "clinical_use": False,
        }

    result = detect_trends(previous, latest)

    if not result["trend_detected"]:
        return {
            "patient_id": patient_id,
            **result,
            "reading_age_minutes": timestamp_info["reading_age_minutes"],
            "clinical_use": False,
        }

    # Avoid duplicate open alerts for the same latest reading.
    alert = (
        db.query(DeteriorationAlert)
        .filter(
            DeteriorationAlert.patient_id == patient_id,
            DeteriorationAlert.latest_reading_id == latest.id,
            DeteriorationAlert.status == "open",
        )
        .first()
    )

    if alert is None:
        alert = DeteriorationAlert(
            patient_id=patient_id,
            previous_reading_id=previous.id,
            latest_reading_id=latest.id,
            status="open",
            message=result["message"],
            reasons=result["reasons"],
        )

        db.add(alert)
        db.flush()

        db.add(
            AlertAudit(
                alert_id=alert.id,
                action="created",
                actor="system",
                note=result["message"],
            )
        )

        db.commit()
        db.refresh(alert)

    return {
        "patient_id": patient_id,
        **result,
        "alert_id": alert.id,
        "alert_status": alert.status,
        "reading_age_minutes": timestamp_info["reading_age_minutes"],
        "clinical_use": False,
    }

@app.get("/alerts")
def list_alerts(db: Session = Depends(get_db)):
    alerts = (
        db.query(DeteriorationAlert)
        .order_by(DeteriorationAlert.id.desc())
        .limit(100)
        .all()
    )

    results = []

    for alert in alerts:
        previous = (
            db.get(VitalReading, alert.previous_reading_id)
            if alert.previous_reading_id
            else None
        )

        latest = (
            db.get(VitalReading, alert.latest_reading_id)
            if alert.latest_reading_id
            else None
        )

        def reading_details(reading):
            if reading is None:
                return None

            return {
                "id": reading.id,
                "heart_rate": reading.heart_rate,
                "spo2": reading.spo2,
                "respiratory_rate": reading.respiratory_rate,
                "systolic_bp": reading.systolic_bp,
                "temperature": reading.temperature,
                "recorded_at": reading.recorded_at,
            }

        results.append({
            "id": alert.id,
            "patient_id": alert.patient_id,
            "previous_reading_id": alert.previous_reading_id,
            "latest_reading_id": alert.latest_reading_id,
            "previous_reading": reading_details(previous),
            "latest_reading": reading_details(latest),
            "status": alert.status,
            "message": alert.message,
            "reasons": alert.reasons,
            "created_at": alert.created_at,
            "acknowledged_at": alert.acknowledged_at,
            "acknowledged_by": alert.acknowledged_by,
        })

    return results

@app.post("/alerts/{alert_id}/acknowledge")
def acknowledge_alert(
    alert_id: int,
    payload: AlertAckPayload,
    db: Session = Depends(get_db),
):
    alert = db.get(DeteriorationAlert, alert_id)

    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")

    if alert.status != "open":
        raise HTTPException(
            status_code=409,
            detail="Alert is not open and cannot be acknowledged again.",
        )

    actor = payload.actor.strip()
    if not actor:
        raise HTTPException(
            status_code=422,
            detail="Actor must not be empty.",
        )

    alert.status = "acknowledged"
    alert.acknowledged_at = datetime.now()
    alert.acknowledged_by = actor

    db.add(
        AlertAudit(
            alert_id=alert.id,
            action="acknowledged",
            actor=actor,
            note=payload.note,
        )
    )

    db.commit()
    db.refresh(alert)

    return {
        "message": "Alert acknowledged.",
        "alert_id": alert.id,
        "status": alert.status,
        "acknowledged_by": alert.acknowledged_by,
        "acknowledged_at": alert.acknowledged_at,
    }

@app.get("/alerts/{alert_id}/audit")
def get_alert_audit(
    alert_id: int,
    db: Session = Depends(get_db),
):
    alert = db.get(DeteriorationAlert, alert_id)

    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")

    events = (
        db.query(AlertAudit)
        .filter(AlertAudit.alert_id == alert_id)
        .order_by(AlertAudit.id.asc())
        .all()
    )

    return [
        {
            "id": event.id,
            "alert_id": event.alert_id,
            "action": event.action,
            "actor": event.actor,
            "note": event.note,
            "created_at": event.created_at,
        }
        for event in events
    ]

@app.post("/test/readings/{reading_id}/validate-synthetic")
def validate_synthetic_reading(
    reading_id: int,
    db: Session = Depends(get_db),
):
    reading = db.get(VitalReading, reading_id)

    if reading is None:
        raise HTTPException(
            status_code=404,
            detail="Reading not found",
        )

    source = (reading.source or "").strip().lower()

    if not source.startswith("synthetic"):
        raise HTTPException(
            status_code=400,
            detail="Only explicitly labelled synthetic readings can use this endpoint.",
        )

    # Check timestamp freshness and validity.
    timestamp_info = timestamp_status(reading.recorded_at)

    if timestamp_info["freshness_status"] == "invalid_future_timestamp":
        raise HTTPException(
            status_code=422,
            detail="Synthetic reading has an invalid future timestamp.",
        )

    if timestamp_info["freshness_status"] == "stale":
        raise HTTPException(
            status_code=422,
            detail="Synthetic reading is over 60 minutes old and cannot be validated.",
        )

    # Validate vital-sign ranges using the existing NEWS2 validation logic.
    try:
        result = calculate_news2({
        "heart_rate": reading.heart_rate,
        "spo2": reading.spo2,
        "respiratory_rate": reading.respiratory_rate,
        "systolic_bp": reading.systolic_bp,
        "temperature": reading.temperature,
        "consciousness": reading.consciousness,
        "supplemental_oxygen": reading.supplemental_oxygen,
    })
    except (ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Reading contains invalid vital-sign data: {exc}",
        ) from exc

    if result.get("missing"):
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Reading is incomplete and cannot be validated.",
                "missing_parameters": result["missing"],
            },
        )

    # Validate categorical fields explicitly.
    allowed_consciousness = {
        "alert",
        "new_confusion",
        "voice",
        "pain",
        "unresponsive",
    }

    consciousness = (
        (reading.consciousness or "").strip().lower()
    )

    if consciousness not in allowed_consciousness:
        raise HTTPException(
            status_code=422,
            detail="Invalid or missing consciousness value.",
        )

    oxygen = (
        (reading.supplemental_oxygen or "").strip().lower()
    )

    if oxygen not in {"yes", "no", "true", "false"}:
        raise HTTPException(
            status_code=422,
            detail="Invalid or missing supplemental oxygen value.",
        )

    reading.quality_status = "validated"

    try:
        db.commit()
        db.refresh(reading)
    except Exception:
        db.rollback()
        raise

    return {
        "message": "Synthetic test reading marked validated.",
        "reading_id": reading.id,
        "source": reading.source,
        "quality_status": reading.quality_status,
        "freshness_status": timestamp_info["freshness_status"],
        "clinical_use": False,
    }
@app.post("/test/simulate-waiting-room")
def simulate_waiting_room(db: Session = Depends(get_db)):
    now = datetime.now()
    timestamp_tag = now.strftime("%y%m%d%H%M%S")

    scenarios = [
        {
            "label": "stable",
            "age": 35,
            "first": {
                "heart_rate": 82, "spo2": 98,
                "respiratory_rate": 16, "systolic_bp": 120,
                "temperature": 36.8,
            },
            "latest": {
                "heart_rate": 84, "spo2": 98,
                "respiratory_rate": 16, "systolic_bp": 120,
                "temperature": 36.8,
            },
        },
        {
            "label": "worsening",
            "age": 58,
            "first": {
                "heart_rate": 85, "spo2": 98,
                "respiratory_rate": 18, "systolic_bp": 122,
                "temperature": 37.0,
            },
            "latest": {
                "heart_rate": 110, "spo2": 94,
                "respiratory_rate": 24, "systolic_bp": 100,
                "temperature": 38.2,
            },
        },
        {
            "label": "incomplete",
            "age": 44,
            "first": {
                "heart_rate": None, "spo2": None,
                "respiratory_rate": None, "systolic_bp": None,
                "temperature": None,
            },
            "latest": {
                "heart_rate": None, "spo2": None,
                "respiratory_rate": None, "systolic_bp": None,
                "temperature": None,
            },
        },
    ]

    results = []

    try:
        for index, scenario in enumerate(scenarios, start=1):
            patient = Patient(
                patient_code=f"SYN-{timestamp_tag}-{index}",
                age=scenario["age"],
            )
            db.add(patient)
            db.flush()

            readings = []

            for offset, values in [
                (10, scenario["first"]),
                (2, scenario["latest"]),
            ]:
                reading = VitalReading(
                    patient_id=patient.id,
                    **values,
                    consciousness="alert",
                    supplemental_oxygen="no",
                    recorded_at=now - timedelta(minutes=offset),
                    source="synthetic_demo",
                    quality_status="validated",
                )
                db.add(reading)
                readings.append(reading)

            db.flush()

            previous, latest = readings
            trend = detect_trends(previous, latest)
            alert_id = None

            if trend["trend_detected"]:
                alert = DeteriorationAlert(
                    patient_id=patient.id,
                    previous_reading_id=previous.id,
                    latest_reading_id=latest.id,
                    status="open",
                    message=trend["message"],
                    reasons=trend["reasons"],
                )
                db.add(alert)
                db.flush()

                db.add(
                    AlertAudit(
                        alert_id=alert.id,
                        action="created",
                        actor="synthetic_simulator",
                        note=(
                            "Generated by the synthetic "
                            "waiting-room simulator."
                        ),
                    )
                )
                alert_id = alert.id

            results.append({
                "scenario": scenario["label"],
                "patient_id": patient.id,
                "patient_code": patient.patient_code,
                "reading_ids": [r.id for r in readings],
                "trend_detected": trend["trend_detected"],
                "reasons": trend["reasons"],
                "alert_id": alert_id,
                "data_label": "SYNTHETIC - NOT FOR CLINICAL USE",
            })

        db.commit()

        return {
            "message": "Synthetic waiting-room simulation completed.",
            "patients_created": len(results),
            "results": results,
            "clinical_use": False,
        }

    except Exception:
        db.rollback()
        raise


@app.post("/research/compare")
def run_research_comparison(
    data: ReplayRequest,
    news2_threshold: int = 5,
    deterioration_onset_at: datetime | None = None,
    scenario_label: str = "deteriorating",
):
    try:
        return compare_detection(
            observations=[
                observation.model_dump()
                for observation in data.observations
            ],
            news2_threshold=news2_threshold,
            deterioration_onset_at=(
                deterioration_onset_at.isoformat()
                if deterioration_onset_at else None
            ),
            scenario_label=scenario_label,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=422, detail=str(exc)
        ) from exc

@app.post("/research/evaluate")
def run_research_evaluation(news2_threshold: int = 5):
    try:
        return evaluate_research_scenarios(
            news2_threshold=news2_threshold
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=422, detail=str(exc)
        ) from exc

@app.get("/quality/watchdog")
def quality_watchdog(db: Session = Depends(get_db)):
    patients = db.query(Patient).order_by(Patient.id).all()

    results = []

    for patient in patients:
        issues = []

        latest = (
            db.query(VitalReading)
            .filter(VitalReading.patient_id == patient.id)
            .order_by(
                VitalReading.recorded_at.desc(),
                VitalReading.id.desc(),
            )
            .first()
        )

        # Include patients who have no vital readings.
        if latest is None:
            results.append({
                "patient_id": patient.id,
                "patient_code": patient.patient_code,
                "latest_reading_at": None,
                "reading_age_minutes": None,
                "freshness_status": "unknown",
                "quality_status": "no_readings",
                "missing_parameters": [],
                "issues": [
                    {
                        "type": "no_readings",
                        "message": "No vital-sign readings have been recorded.",
                    }
                ],
            })
            continue

        # Check whether the latest reading is recent or stale.
        timestamp_info = timestamp_status(latest.recorded_at)

        if timestamp_info["freshness_status"] == "stale":
            issues.append({
                "type": "stale_reading",
                "message": (
                    "The latest reading is older than the "
                    "configured 60-minute freshness limit."
                ),
            })

        elif timestamp_info["freshness_status"] == "invalid_future_timestamp":
            issues.append({
                "type": "invalid_timestamp",
                "message": (
                    "The latest reading is timestamped too far "
                    "in the future."
                ),
            })

        # Reuse the existing NEWS2 validation logic.
        vitals = {
            "heart_rate": latest.heart_rate,
            "spo2": latest.spo2,
            "respiratory_rate": latest.respiratory_rate,
            "systolic_bp": latest.systolic_bp,
            "temperature": latest.temperature,
            "consciousness": latest.consciousness,
            "supplemental_oxygen": latest.supplemental_oxygen,
        }

        missing_parameters = []

        try:
            assessment = calculate_news2(vitals)
            missing_parameters = assessment["missing_parameters"]

            if missing_parameters:
                issues.append({
                    "type": "incomplete_observations",
                    "message": "Some required observations are missing.",
                    "parameters": missing_parameters,
                })

        except (ValueError, TypeError) as exc:
            issues.append({
                "type": "invalid_observation_data",
                "message": str(exc),
            })

        # Flag readings that have not completed quality validation.
        if latest.quality_status == "pending":
            issues.append({
                "type": "validation_pending",
                "message": "This reading has not completed quality validation.",
            })

        results.append({
            "patient_id": patient.id,
            "patient_code": patient.patient_code,
            "latest_reading_at": latest.recorded_at,
            "reading_age_minutes": timestamp_info["reading_age_minutes"],
            "freshness_status": timestamp_info["freshness_status"],
            "quality_status": latest.quality_status,
            "missing_parameters": missing_parameters,
            "issues": issues,
        })

    return {
        "total_patients": len(results),
        "patients_with_issues": sum(
            1 for patient in results if patient["issues"]
        ),
        "patients": results,
    }




