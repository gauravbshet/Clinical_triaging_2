import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StatCard from "../components/dashboard/StatCard";
import RecentAlerts from "../components/dashboard/RecentAlerts";
import { patientService, alertService } from "../services/api";
import type { Patient, DeteriorationAlert } from "../types";

export default function DashboardPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [alerts, setAlerts] = useState<DeteriorationAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        const [patientData, alertData] = await Promise.all([
          patientService.list(),
          alertService.list(),
        ]);

        if (!active) return;

        setPatients(patientData);
        setAlerts(alertData);
      } catch {
        if (!active) return;

        setError(
          "Could not load dashboard data. Check that the FastAPI backend is running and its endpoints are responding."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  const openAlerts = alerts.filter(
    (alert) => alert.status.toLowerCase() === "open"
  ).length;

  const acknowledgedAlerts = alerts.filter(
    (alert) => alert.status.toLowerCase() === "acknowledged"
  ).length;

  return (
    <div className="dashboard-page">
      <section className="welcome-banner">
        <div>
          <span className="eyebrow">WAITING-ROOM DETERIORATION WATCH</span>
          <h2>Monitoring overview</h2>
          <p>
            A research dashboard for reviewing patient observations
            and recorded deterioration trends.
          </p>
        </div>

        <Link to="/patients" className="primary-link">
          View patients →
        </Link>
      </section>

      {error && (
        <div className="error-banner" role="alert">
          <strong>Dashboard unavailable</strong>
          <p>{error}</p>
          <button
            className="secondary-button"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      )}

      <div className="section-heading dashboard-section-heading">
        <div>
          <h2>System Snapshot</h2>
          <p>Counts from the data returned by the backend</p>
        </div>
        {loading && <span className="loading-label">Loading data…</span>}
      </div>

      <div className="stats-grid">
        <StatCard
          label="Registered Patients"
          value={loading || error ? "—" : patients.length}
          detail="Patients in the database"
          icon="♙"
        />

        <StatCard
          label="Open Alerts"
          value={loading || error ? "—" : openAlerts}
          detail="Awaiting acknowledgement"
          icon="!"
          accent="#dc6b61"
        />

        <StatCard
          label="Acknowledged Alerts"
          value={loading || error ? "—" : acknowledgedAlerts}
          detail="Marked as acknowledged"
          icon="✓"
          accent="#4b8fd8"
        />

        <StatCard
          label="Recorded Alerts"
          value={loading || error ? "—" : alerts.length}
          detail="All alerts returned by the API"
          icon="◷"
          accent="#a17bd4"
        />
      </div>

      <div className="dashboard-lower-grid">
        <RecentAlerts alerts={loading || error ? [] : alerts} />

        <section className="panel quick-actions-panel">
          <div className="section-heading">
            <div>
              <h2>Quick Actions</h2>
              <p>Navigate to a workspace</p>
            </div>
          </div>

          <Link to="/patients" className="quick-action">
            <span className="quick-action-icon">♙</span>
            <span>
              <strong>Patient Queue</strong>
              <small>Browse registered patients</small>
            </span>
            <span className="quick-action-arrow">→</span>
          </Link>

          <Link to="/observations" className="quick-action">
            <span className="quick-action-icon">♡</span>
            <span>
              <strong>Vital Observations</strong>
              <small>Review readings and data quality</small>
            </span>
            <span className="quick-action-arrow">→</span>
          </Link>

          <Link to="/alerts" className="quick-action">
            <span className="quick-action-icon">⚠</span>
            <span>
              <strong>Alert Centre</strong>
              <small>Review alerts and audit history</small>
            </span>
            <span className="quick-action-arrow">→</span>
          </Link>

          <Link to="/simulation" className="quick-action">
            <span className="quick-action-icon">⌁</span>
            <span>
              <strong>Research Simulation</strong>
              <small>Test synthetic scenarios</small>
            </span>
            <span className="quick-action-arrow">→</span>
          </Link>
        </section>
      </div>

      <p className="research-disclaimer">
        Research prototype only · Not clinically validated · Not for clinical
        decision-making
      </p>
    </div>
  );
}