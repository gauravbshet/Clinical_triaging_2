
import { useState } from "react";
import { simulationService, patientService, alertService } from "../services/api";
import type { Patient, DeteriorationAlert } from "../types";

type ScenarioResult = Record<string, any>;

function findScenarios(data: any): ScenarioResult[] {
  if (Array.isArray(data)) return data;

  for (const key of ["scenarios", "results", "cases", "simulation_results"]) {
    if (Array.isArray(data?.[key])) return data[key];
  }

  if (data && typeof data === "object") {
    const named = ["stable", "worsening", "incomplete"]
      .filter((key) => data[key] && typeof data[key] === "object")
      .map((key) => ({
        scenario: key,
        ...data[key],
      }));

    if (named.length) return named;
  }

  return [];
}

function scenarioName(item: ScenarioResult, index: number) {
  const name = String(
    item.scenario ?? item.name ?? item.case ?? item.label ?? `Scenario ${index + 1}`
  ).toLowerCase();

  if (name.includes("incomplete") || name.includes("missing")) return "Incomplete data";
  if (name.includes("worsen") || name.includes("deteriorat")) return "Worsening";
  if (name.includes("stable")) return "Stable";
  return name.replace(/[_-]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
}

function isIncomplete(item: ScenarioResult, label: string) {
  const text = JSON.stringify(item).toLowerCase();
  return (
    label.toLowerCase().includes("incomplete") ||
    label.toLowerCase().includes("missing") ||
    text.includes("incomplete")
  );
}

function readValue(item: ScenarioResult, keys: string[]) {
  for (const key of keys) {
    if (item[key] !== undefined && item[key] !== null) return item[key];
  }
  return null;
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function SimulationPage() {
  const [result, setResult] = useState<any>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [alerts, setAlerts] = useState<DeteriorationAlert[]>([]);
  const [running, setRunning] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState("");
  const [completedAt, setCompletedAt] = useState("");

  async function runSimulation() {
    setRunning(true);
    setError("");
    setResult(null);

    try {
      const response = await simulationService.run();
      setResult(response);

      // Refresh dashboard-related records after the simulation.
      setLoadingSummary(true);
      const [patientResult, alertResult] = await Promise.allSettled([
        patientService.list(),
        alertService.list(),
      ]);

      if (patientResult.status === "fulfilled") setPatients(patientResult.value);
      if (alertResult.status === "fulfilled") setAlerts(alertResult.value);

      setCompletedAt(new Date().toLocaleString());
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : "The simulation could not run. Check that the backend is running and try again."
      );
    } finally {
      setRunning(false);
      setLoadingSummary(false);
    }
  }

  const scenarios = findScenarios(result);

  return (
    <div className="simulation-page">
      <section className="simulation-hero">
        <div>
          <span className="simulation-eyebrow">WRDW · RESEARCH WORKSPACE</span>
          <h2>Waiting-room simulation</h2>
          <p>
            Run predefined demonstration scenarios to inspect trend detection,
            missing-data handling, and alert creation.
          </p>
        </div>

        <button
          type="button"
          className="simulation-run-button"
          onClick={() => void runSimulation()}
          disabled={running}
        >
          {running ? "Running simulation…" : "▶ Run simulation"}
        </button>
      </section>

      <div className="simulation-notice">
        <strong>Research mode only</strong>
        <p>
          These are demonstration scenarios, not clinical predictions.
          Results are not clinically validated and must not be used for actual
          patient-care decisions. Running the simulation may create new
          patients, readings, and alerts in your local database.
        </p>
      </div>

      {error && <div className="form-error">{error}</div>}

      {result && (
        <>
          <section className="simulation-results-heading">
            <div>
              <h2>Latest run results</h2>
              <p>{completedAt ? `Completed: ${completedAt}` : "Simulation completed."}</p>
            </div>
            <span className="simulation-complete-label">Response received</span>
          </section>

          {scenarios.length > 0 ? (
            <div className="scenario-grid">
              {scenarios.map((item, index) => {
                const label = scenarioName(item, index);
                const incomplete = isIncomplete(item, label);
                const trend = readValue(item, [
                  "trend_detected",
                  "trendDetected",
                  "detected",
                ]);
                const alertId = readValue(item, ["alert_id", "alertId"]);
                const patientId = readValue(item, ["patient_id", "patientId"]);
                const readingIds = readValue(item, [
                  "reading_ids",
                  "vital_reading_ids",
                  "readingIds",
                ]);
                const reasons = readValue(item, ["reasons", "trend_reasons"]);

                let status = "Result returned";
                if (incomplete) status = "Incomplete data";
                else if (trend === true) status = "Trend detected";
                else if (trend === false) status = "No trend detected";

                return (
                  <article className="scenario-card" key={`${label}-${index}`}>
                    <div className="scenario-card-top">
                      <span className="scenario-index">CASE {index + 1}</span>
                      <span
                        className={`scenario-status ${
                          incomplete
                            ? "scenario-status-incomplete"
                            : trend === true
                              ? "scenario-status-detected"
                              : "scenario-status-neutral"
                        }`}
                      >
                        {status}
                      </span>
                    </div>

                    <h3>{label}</h3>

                    <div className="scenario-metadata">
                      <div>
                        <span>Patient ID</span>
                        <strong>{formatValue(patientId)}</strong>
                      </div>
                      <div>
                        <span>Reading IDs</span>
                        <strong>{formatValue(readingIds)}</strong>
                      </div>
                      <div>
                        <span>Alert ID</span>
                        <strong>{formatValue(alertId)}</strong>
                      </div>
                    </div>

                    {Array.isArray(reasons) && reasons.length > 0 && (
                      <div className="scenario-reasons">
                        <strong>Returned reasons</strong>
                        <ul>
                          {reasons.map((reason: any, reasonIndex: number) => (
                            <li key={reasonIndex}>
                              {typeof reason === "string"
                                ? reason
                                : reason.reason ??
                                  `${reason.parameter ?? "Parameter"}: ${formatValue(reason.change)}`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {incomplete && (
                      <p className="scenario-warning">
                        Missing or incomplete data must not be interpreted as
                        evidence of stability.
                      </p>
                    )}

                    <details className="scenario-raw">
                      <summary>View complete scenario response</summary>
                      <pre>{JSON.stringify(item, null, 2)}</pre>
                    </details>
                  </article>
                );
              })}
            </div>
          ) : (
            <section className="panel">
              <h3>Simulation response</h3>
              <p>
                The endpoint returned data, but its response does not match a
                recognised scenario-list format. The full response is shown
                below so its exact structure can be inspected.
              </p>
              <pre className="simulation-json">
                {JSON.stringify(result, null, 2)}
              </pre>
            </section>
          )}
        </>
      )}

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Local database snapshot</h2>
            <p>Current counts returned by your backend.</p>
          </div>
          {loadingSummary && <span>Refreshing…</span>}
        </div>

        <div className="simulation-count-grid">
          <div>
            <span>Registered patients</span>
            <strong>{patients.length}</strong>
          </div>
          <div>
            <span>Total alerts</span>
            <strong>{alerts.length}</strong>
          </div>
          <div>
            <span>Open alerts</span>
            <strong>
              {alerts.filter((a) => a.status?.toUpperCase() === "OPEN").length}
            </strong>
          </div>
        </div>

        <p className="form-hint">
          Counts update after a successful simulation run. They reflect the
          current backend records, not just the scenarios in the latest run.
        </p>
      </section>
    </div>
  );
}
