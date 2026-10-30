
from sqlalchemy import (
    Column, Integer, String, Float, DateTime,
    ForeignKey, func,JSON
)
from sqlalchemy.orm import relationship
from app.database import Base


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    patient_code = Column(String, unique=True, index=True, nullable=False)
    age = Column(Integer, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    vital_readings = relationship(
        "VitalReading",
        back_populates="patient",
        cascade="all, delete-orphan"
    )


class VitalReading(Base):
    __tablename__ = "vital_readings"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(
        Integer, ForeignKey("patients.id"), nullable=False
    )

    heart_rate = Column(Integer, nullable=True)
    spo2 = Column(Float, nullable=True)
    respiratory_rate = Column(Integer, nullable=True)
    systolic_bp = Column(Integer, nullable=True)
    temperature = Column(Float, nullable=True)

    consciousness = Column(String, nullable=True)
    supplemental_oxygen = Column(String, nullable=True)

    recorded_at = Column(DateTime, nullable=False)
    received_at = Column(DateTime, server_default=func.now())
    source = Column(String, default="nurse_entry")
    quality_status = Column(String, default="pending")

    patient = relationship(
        "Patient", back_populates="vital_readings"
    )

class DeteriorationAlert(Base):
    __tablename__ = "deterioration_alerts"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(
        Integer, ForeignKey("patients.id"), nullable=False
    )
    previous_reading_id = Column(
        Integer, ForeignKey("vital_readings.id"), nullable=True
    )
    latest_reading_id = Column(
        Integer, ForeignKey("vital_readings.id"), nullable=True
    )
    status = Column(String, default="open", nullable=False)
    message = Column(String, nullable=False)
    reasons = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime, server_default=func.now())
    acknowledged_at = Column(DateTime, nullable=True)
    acknowledged_by = Column(String, nullable=True)


class AlertAudit(Base):
    __tablename__ = "alert_audit"

    id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(
        Integer, ForeignKey("deterioration_alerts.id"), nullable=False
    )
    action = Column(String, nullable=False)
    actor = Column(String, nullable=False)
    note = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

