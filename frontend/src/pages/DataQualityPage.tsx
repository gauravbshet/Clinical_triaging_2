import { useCallback, useEffect, useMemo, useState } from "react";
import { qualityService } from "../services/api";
import type {
  QualityPatient,
  QualityWatchdogResponse,
} from "../types";

function dateLabel(value: string | null) {
  if (!value) return "No reading recorded";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Not available"
    : date.toLocaleString();
}

function issueLabel(type: string) {
  const labels: Record<string, string> = {
    no_readings: "No readings",
    stale_reading: "Stale reading",
    invalid_timestamp: "Invalid timestamp",
    incomplete_observations: "Incomplete observations",
    invalid_observation_data: "Invalid data",
    validation_pending: "Validation pending",
  };

  return labels[type] || type.replaceAll("_", " ");
}

export default function DataQualityPage() {
  const [data, setData] = useState<QualityWatchdogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const loadQuality = useCallback(async () => {
    setError("");

    try {
      const result = await qualityService.watchdog();
      setData(result);
    } catch {
      setError(
        "Could not load data quality information. Check that the backend is running."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQuality();
  }, [loadQuality]);

  const patients = data?.patients ?? [];

  const staleCount = patients.filter((patient) =>
    patient.issues.some((issue) => issue.type === "stale_reading")
  ).length;

  const incompleteCount = patients.filter((patient) =>
    patient.issues.some(
      (issue) => issue.type === "incomplete_observations"
    )
  ).length;
  const noReadingsCount = patients.filter((patient) =>
  patient.issues.some((issue) => issue.type === "no_readings")
).length;

  const visiblePatients = useMemo(() => {
    return patients.filter((patient) => {
      const matchesSearch =
        patient.patient_code.toLowerCase().includes(search.toLowerCase()) ||
        String(patient.patient_id).includes(search);

      const matchesFilter =
        filter === "ALL" ||
        patient.issues.some((issue) => issue.type === filter);

      return matchesSearch && matchesFilter;
    });
  }, [patients, filter, search]);

  return (
    <div className="data-quality-page">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Data Quality Watchdog</h2>
            <p>
              Monitor vital-sign freshness, completeness and validation status.
            </p>
          </div>

          <button type="button" onClick={() => void loadQuality()}>
            Refresh
          </button>
        </div>

        {error && <div className="form-error">{error}</div>}

        {loading ? (
          <p>Loading data quality information…</p>
        ) : data ? (
          <>
            <div className="alert-summary-grid">
              <div className="dq-summary-card neutral">
  <span>Total patients</span>
  <strong>{data.total_patients}</strong>
</div>

              <div className="dq-summary-card danger">
  <span>Patients with issues</span>
  <strong>{data.patients_with_issues}</strong>
</div>

              <div className="dq-summary-card warning">
  <span>Stale readings</span>
  <strong>{staleCount}</strong>
</div>

              <div className="dq-summary-card warning">
  <span>Incomplete observations</span>
  <strong>{incompleteCount}</strong>
</div>
              <div className="dq-summary-card neutral">
  <span>No readings</span>
  <strong>{noReadingsCount}</strong>
</div>
            </div>

            <div className="dq-filter-row">
              <input
                type="text"
                placeholder="Search patient code or ID"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />

              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              >
                <option value="ALL">All patients</option>
                <option value="no_readings">No readings</option>
                <option value="stale_reading">Stale readings</option>
                <option value="incomplete_observations">
                  Incomplete observations
                </option>
                <option value="invalid_timestamp">Invalid timestamps</option>
                <option value="invalid_observation_data">
                  Invalid data
                </option>
                <option value="validation_pending">
                  Validation pending
                </option>
              </select>
            </div>

            {visiblePatients.length === 0 ? (
              <div className="empty-state">
                No patients match your search or filter.
              </div>
            ) : (
              <div >
                {visiblePatients.map((patient: QualityPatient) => (
                  <article
                    className="dq-patient-card"
                    key={patient.patient_id}
                  >
                    <div className="dq-patient-heading">
                      <div>
                        <span className="alert-id">
                          Patient ID: {patient.patient_id}
                        </span>
                        <h3>{patient.patient_code}</h3>
                      </div>

                      <span
                        className={`status-pill ${
                          patient.issues.length > 0
                            ? "status-open"
                            : "status-acknowledged"
                        }`}
                      >
                        {patient.issues.length > 0
                          ? `${patient.issues.length} issue(s)`
                          : "No issues"}
                      </span>
                    </div>

                    <div className="dq-patient-meta">
  <div>
    <span>Last reading</span>
    <strong>{dateLabel(patient.latest_reading_at)}</strong>
  </div>

  <div>
    <span>Freshness</span>
    <strong>{patient.freshness_status}</strong>
  </div>

  <div>
    <span>Quality status</span>
    <strong>{patient.quality_status}</strong>
  </div>
</div>

                    {patient.missing_parameters.length > 0 && (
                      <p>
                        <strong>Missing parameters:</strong>{" "}
                        {patient.missing_parameters.join(", ")}
                      </p>
                    )}

                    {patient.issues.length > 0 && (
                      <div className="dq-issues">
                        <strong>Detected data-quality issues</strong>

                        <ul>
                          {patient.issues.map((issue, index) => (
                            <li key={`${issue.type}-${index}`}>
                              <b>{issueLabel(issue.type)}</b>:{" "}
                              {issue.message}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </>
        ) : null}
      </section>

      <p className="research-disclaimer">
        Research prototype only. Data-quality indicators are experimental and
        are not a substitute for clinical assessment.
      </p>
    </div>
  );
}