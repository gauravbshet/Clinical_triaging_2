
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class PatientCreate(BaseModel):
    patient_code: str = Field(min_length=1, max_length=20)
    age: int = Field(ge=0, le=120)


class PatientResponse(PatientCreate):
    id: int
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)



class VitalCreate(BaseModel):
    heart_rate: int | None = Field(default=None, ge=1, le=300)
    spo2: float | None = Field(
        default=None, ge=0, le=100, allow_inf_nan=False
    )
    respiratory_rate: int | None = Field(default=None, ge=1, le=100)
    systolic_bp: int | None = Field(default=None, ge=1, le=300)
    temperature: float | None = Field(
        default=None, ge=25, le=45, allow_inf_nan=False
    )

    consciousness: str | None = None
    supplemental_oxygen: str | None = None

    recorded_at: datetime
    source: str = "nurse_entry"


class VitalResponse(VitalCreate):
    id: int
    patient_id: int
    received_at: datetime | None = None
    quality_status: str

    model_config = ConfigDict(from_attributes=True)

class ReplayObservation(BaseModel):
    """One synthetic observation for research replay."""

    recorded_at: datetime
    arrival_at: datetime | None = None

    heart_rate: int | None = Field(default=None, ge=1, le=300)
    spo2: float | None = Field(default=None, ge=0, le=100, allow_inf_nan=False)
    respiratory_rate: int | None = Field(default=None, ge=1, le=100)
    systolic_bp: int | None = Field(default=None, ge=1, le=300)
    temperature: float | None = Field(default=None, ge=25, le=45, allow_inf_nan=False)

    consciousness: str | None = None
    supplemental_oxygen: str | None = None

    quality_status: str = "pending"


class ReplayRequest(BaseModel):
    """A batch of synthetic observations for research."""

    observations: list[ReplayObservation] = Field(min_length=1, max_length=500)

