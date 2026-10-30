export interface Patient {
  id: number;
  patient_code: string;
  age: number;
  created_at?: string;
}

export interface Vital {
  id: number;
  patient_id: number;
  heart_rate: number | null;
  spo2: number | null;
  respiratory_rate: number | null;
  systolic_bp: number | null;
  temperature: number | null;
  consciousness?: string | null;
  supplemental_oxygen?: string | null;
  recorded_at: string;
  received_at?: string | null;
  source?: string;
  quality_status: string;
}

export interface News2Assessment {
  patient_id: number;
  vital_reading_id?: number;
  recorded_at?: string;
  total_score: number | null;
  calculated_total_score?: number | null;
  complete: boolean;
  missing_parameters?: string[];
  component_scores?: Record<string, number | null>;
  quality_status: string;
  freshness_status: string;
  reading_age_minutes?: number;
  assessment_status?: string;
  score_status: string;
  clinical_use: false;
  message?: string;
}

export interface AlertReason {
  parameter: string;
  previous: number;
  latest: number;
  change: number;
  reason: string;
}
export interface AlertReading {
  id: number;
  heart_rate: number | null;
  spo2: number | null;
  respiratory_rate: number | null;
  systolic_bp: number | null;
  temperature: number | null;
  recorded_at: string;
}

export interface DeteriorationAlert {
  id: number;
  patient_id: number;
  previous_reading_id: number | null;
  latest_reading_id: number | null;
  status: string;
  message: string;
  reasons: AlertReason[];
  created_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  previous_reading: AlertReading | null;
latest_reading: AlertReading | null;
}
export interface QualityIssue {
  type: string;
  message: string;
  parameters?: string[];
}

export interface QualityPatient {
  patient_id: number;
  patient_code: string;
  latest_reading_at: string | null;
  reading_age_minutes: number | null;
  freshness_status: string;
  quality_status: string;
  missing_parameters: string[];
  issues: QualityIssue[];
}

export interface QualityWatchdogResponse {
  total_patients: number;
  patients_with_issues: number;
  patients: QualityPatient[];
}