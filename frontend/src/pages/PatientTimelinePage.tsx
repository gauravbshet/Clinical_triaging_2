import { useEffect, useState } from "react";
import { patientService, alertService } from "../services/api";
import PatientVitalCharts from "../components/PatientVitalCharts";
import type { Patient, Vital, DeteriorationAlert } from "../types";

export default function PatientTimelinePage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState("");
  const [vitals, setVitals] = useState<Vital[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [alerts, setAlerts] = useState<DeteriorationAlert[]>([]);
  const patientAlerts = alerts.filter(
  (alert) => alert.patient_id === Number(patientId)
);
console.log(patientAlerts);
  useEffect(() => {
  const loadPatients = async () => {
    try {
      const data = await patientService.list();
      setPatients(data); // ADD THIS LINE
    } catch {
      setError("Unable to load patients.");
    }
  };

  loadPatients();
}, []);

  useEffect(() => {
  const loadAlerts = async () => {
    try {
      const data = await alertService.list();
      setAlerts(data);
    } catch {
      setError("Unable to load alerts.");
    }
  };

  loadAlerts();
}, []);

  useEffect(() => {
    if (!patientId) {
      setVitals([]);
      return;
    }

    const loadVitals = async () => {
      setLoading(true);
      setError("");

      try {
        const data = await patientService.vitals(Number(patientId));
        setVitals(data);
      } catch {
        setError("Unable to load patient observations.");
        setVitals([]);
      } finally {
        setLoading(false);
      }
    };

    loadVitals();
  }, [patientId]);

  return (
    <div className="observations-page">
      <div className="section-heading">
        <div>
          <h1>Patient Deterioration Timeline</h1>
          <p>Visualise changes in patient vital signs over time.</p>
        </div>
      </div>

      <section className="panel">
        <label htmlFor="timeline-patient">Select Patient</label>

        <select
          id="timeline-patient"
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
        >
          <option value="">Select a patient</option>
          {patients.map((patient) => (
            <option key={patient.id} value={patient.id}>
              {patient.patient_code} — Patient #{patient.id}
            </option>
          ))}
        </select>
      </section>

      {error && <div className="error-message">{error}</div>}

      {loading && <p>Loading patient observations...</p>}

      {!patientId && (
        <div className="panel empty-state">
          Select a patient to view their vital-sign timeline.
        </div>
      )}

      {patientId && !loading && vitals.length === 0 && !error && (
        <div className="panel empty-state">
          No observations recorded for this patient yet.
        </div>
      )}
      {patientId && vitals.length > 0 && (
        <PatientVitalCharts vitals={vitals} alerts={patientAlerts} />
      )}
      {patientId && (
  <section className="panel">
    <div className="section-heading">
      <div>
        <h2>Deterioration Alerts</h2>
        <p>Alerts recorded for this patient.</p>
      </div>
      <span className="count-pill">
        {patientAlerts.length} alerts
      </span>
    </div>

    {patientAlerts.length === 0 ? (
      <div className="empty-state">
        No deterioration alerts recorded for this patient.
      </div>
    ) : (
      patientAlerts.map((alert) => (
        <div key={alert.id} className="alert-centre-card">
          <h3>Alert #{alert.id}</h3>
          <p>{alert.message}</p>
          <p>
            Detected: {new Date(alert.created_at).toLocaleString()}
          </p>
          <p>Status: {alert.status}</p>

          <ul>
            {alert.reasons.map((reason, index) => (
              <li key={index}>{reason.reason}</li>
            ))}
          </ul>
        </div>
      ))
    )}
  </section>
)}
    </div>
  );
}