import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  patientService,
} from "../services/api";
import type {
  Patient,
  Vital,
  News2Assessment,
} from "../types";

export default function PatientDetailsPage() {
  const { id } = useParams<{ id: string }>();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [vitals, setVitals] = useState<Vital[]>([]);
  const [assessment, setAssessment] =
    useState<News2Assessment | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadPatient() {
      if (!id || !Number.isInteger(Number(id)) || Number(id) <= 0) {
        setError("Invalid patient ID.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const patientId = Number(id);

        const [patientData, vitalData, news2Data] =
          await Promise.allSettled([
            patientService.get(patientId),
            patientService.vitals(patientId),
            patientService.news2(patientId),
          ]);

        if (!active) return;

        if (patientData.status === "rejected") {
          throw new Error("Could not load this patient.");
        }

        setPatient(patientData.value);

        setVitals(
          vitalData.status === "fulfilled"
            ? [...vitalData.value].sort(
                (a, b) =>
                  new Date(b.recorded_at).getTime() -
                  new Date(a.recorded_at).getTime()
              )
            : []
        );

        setAssessment(
          news2Data.status === "fulfilled"
            ? news2Data.value
            : null
        );
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load patient details."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPatient();

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return <section className="panel">Loading patient details…</section>;
  }

  if (error || !patient) {
    return (
      <section className="panel">
        <h2>Patient unavailable</h2>
        <p>{error || "No patient record was returned."}</p>
        <Link to="/patients" className="text-link">
          ← Back to Patient Queue
        </Link>
      </section>
    );
  }

  const latest = vitals[0];

  const metrics = [
    { label: "Heart Rate", value: latest?.heart_rate, unit: "bpm" },
    { label: "SpO₂", value: latest?.spo2, unit: "%" },
    {
      label: "Respiratory Rate",
      value: latest?.respiratory_rate,
      unit: "/min",
    },
    {
      label: "Systolic BP",
      value: latest?.systolic_bp,
      unit: "mmHg",
    },
    {
      label: "Temperature",
      value: latest?.temperature,
      unit: "°C",
    },
  ];

  const score =
    assessment?.total_score ??
    assessment?.calculated_total_score ??
    null;

  return (
    <div className="patient-details-page">
      <Link to="/patients" className="text-link">
        ← Back to Patient Queue
      </Link>

      <section className="panel patient-profile">
        <div className="patient-avatar patient-avatar-large">
          {String(patient.id).padStart(2, "0")}
        </div>

        <div>
          <span className="eyebrow patient-eyebrow">
            PATIENT RECORD
          </span>
          <h2>{patient.patient_code}</h2>
          <p>Patient ID: {patient.id} · Age: {patient.age}</p>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Latest Vital Observations</h2>
            <p>
              {latest
                ? `Recorded ${new Date(
                    latest.recorded_at
                  ).toLocaleString()}`
                : "No vital readings are available."}
            </p>
          </div>
        </div>

        {!latest ? (
          <div className="empty-state">
            <h3>No observations recorded</h3>
            <p>
              Missing observations cannot be interpreted as normal
              or stable readings.
            </p>
            <Link to="/observations" className="text-link">
              Open Vital Observations →
            </Link>
          </div>
        ) : (
          <div className="vitals-grid">
            {metrics.map((metric) => (
              <article className="vital-card" key={metric.label}>
                <span>{metric.label}</span>
                <strong>
                  {metric.value == null ? "Missing" : metric.value}
                </strong>
                <small>
                  {metric.value == null ? "No value recorded" : metric.unit}
                </small>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>NEWS2 Assessment</h2>
            <p>Backend-generated assessment details</p>
          </div>
        </div>

        {!assessment ? (
          <p>
            Assessment unavailable. Check the patient NEWS2 endpoint.
          </p>
        ) : (
          <>
            <div className="assessment-summary">
              <div>
                <span className="assessment-label">Total score</span>
                <strong className="assessment-score">
                  {score == null ? "—" : score}
                </strong>
              </div>

              <div>
                <span className="assessment-label">Completeness</span>
                <strong>
                  {assessment.complete ? "Complete" : "Incomplete"}
                </strong>
              </div>

              <div>
                <span className="assessment-label">Freshness</span>
                <strong>
                  {assessment.freshness_status || "Unknown"}
                </strong>
              </div>
            </div>

            {assessment.missing_parameters &&
              assessment.missing_parameters.length > 0 && (
                <div className="data-warning">
                  <strong>Missing parameters</strong>
                  <p>
                    {assessment.missing_parameters.join(", ")}
                  </p>
                </div>
              )}

            {assessment.message && <p>{assessment.message}</p>}

            <p className="research-disclaimer">
              Score display is for research review only and is not
              a clinical decision or treatment recommendation.
            </p>
          </>
        )}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Observation History</h2>
            <p>{vitals.length} recorded reading(s)</p>
          </div>
        </div>

        {vitals.length === 0 ? (
          <p>No vital-reading history is available.</p>
        ) : (
          <div className="table-scroll">
            <table className="patient-table">
              <thead>
                <tr>
                  <th>Recorded At</th>
                  <th>HR</th>
                  <th>SpO₂</th>
                  <th>RR</th>
                  <th>Systolic BP</th>
                  <th>Temperature</th>
                  <th>Data Quality</th>
                </tr>
              </thead>
              <tbody>
                {vitals.map((vital) => (
                  <tr key={vital.id}>
                    <td>
                      {new Date(vital.recorded_at).toLocaleString()}
                    </td>
                    <td>{vital.heart_rate ?? "Missing"}</td>
                    <td>
                      {vital.spo2 == null ? "Missing" : `${vital.spo2}%`}
                    </td>
                    <td>{vital.respiratory_rate ?? "Missing"}</td>
                    <td>{vital.systolic_bp ?? "Missing"}</td>
                    <td>
                      {vital.temperature == null
                        ? "Missing"
                        : `${vital.temperature}°C`}
                    </td>
                    <td>{vital.quality_status || "Unknown"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}