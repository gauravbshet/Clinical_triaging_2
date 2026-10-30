
import { useCallback, useEffect, useState } from "react";
import { alertService } from "../services/api";
import type { DeteriorationAlert } from "../types";

interface AuditEntry {
  id?: number;
  alert_id?: number;
  event_type?: string;
  action?: string;
  actor?: string;
  note?: string;
  created_at?: string;
  timestamp?: string;
  [key: string]: unknown;
}

function dateLabel(value?: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString();
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<DeteriorationAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [selectedAlert, setSelectedAlert] =
    useState<DeteriorationAlert | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [actor, setActor] = useState("nurse_demo");
  const [note, setNote] = useState("");

  const loadAlerts = useCallback(async () => {
    setError("");
    try {
      const data = await alertService.list();
      setAlerts(
        [...data].sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        )
      );
    } catch {
      setError("Could not load alerts. Check that the backend is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  const visibleAlerts = alerts.filter((alert) => {
    if (filter === "ALL") return true;
    return alert.status?.toUpperCase() === filter;
  });

  async function acknowledge(alert: DeteriorationAlert) {
    const actorName = actor.trim();
    if (!actorName) {
      setError("Enter an actor name before acknowledging an alert.");
      return;
    }

    setBusyId(alert.id);
    setError("");

    try {
      await alertService.acknowledge(alert.id, note.trim() || undefined);
      await loadAlerts();
      if (selectedAlert?.id === alert.id) {
        setSelectedAlert({
          ...alert,
          status: "ACKNOWLEDGED",
          acknowledged_by: actorName,
          acknowledged_at: new Date().toISOString(),
        });
      }
      setNote("");
    } catch {
      setError("Could not acknowledge this alert. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function viewAudit(alert: DeteriorationAlert) {
    setSelectedAlert(alert);
    setAudit([]);
    setAuditError("");
    setAuditLoading(true);

    try {
      const result = await alertService.audit(alert.id);
      const entries = Array.isArray(result)
        ? result
        : Array.isArray(result?.entries)
          ? result.entries
          : Array.isArray(result?.audit)
            ? result.audit
            : [];

      setAudit(entries as AuditEntry[]);
    } catch {
      setAuditError("Could not load audit history for this alert.");
    } finally {
      setAuditLoading(false);
    }
  }

  return (
    <div className="alerts-page">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Alert Centre</h2>
            <p>Review detected trends and acknowledgement history.</p>
          </div>
          <button type="button" onClick={() => void loadAlerts()}>
            Refresh
          </button>
        </div>

        <div className="alert-summary-grid">
          <div>
            <span>Total alerts</span>
            <strong>{alerts.length}</strong>
          </div>
          <div>
            <span>Open alerts</span>
            <strong>
              {alerts.filter(
                (a) => a.status?.toUpperCase() === "OPEN"
              ).length}
            </strong>
          </div>
          <div>
            <span>Acknowledged</span>
            <strong>
              {alerts.filter(
                (a) => a.status?.toUpperCase() === "ACKNOWLEDGED"
              ).length}
            </strong>
          </div>
        </div>

        <div className="alert-filter-row">
          {["ALL", "OPEN", "ACKNOWLEDGED"].map((value) => (
            <button
              key={value}
              type="button"
              className={filter === value ? "filter-active" : ""}
              onClick={() => setFilter(value)}
            >
              {value === "ALL"
                ? "All alerts"
                : value === "OPEN"
                  ? "Open"
                  : "Acknowledged"}
            </button>
          ))}
        </div>

        {error && <div className="form-error">{error}</div>}

        {loading ? (
          <p>Loading alerts…</p>
        ) : visibleAlerts.length === 0 ? (
          <div className="empty-state">No alerts in this filter.</div>
        ) : (
          <div className="alert-centre-list">
            {visibleAlerts.map((alert) => (
              <article className="alert-centre-card" key={alert.id}>
                <div className="alert-card-heading">
                  <div>
                    <span className="alert-id">Alert #{alert.id}</span>
                    <h3>Patient #{alert.patient_id}</h3>
                  </div>
                  <span
                    className={`status-pill ${
                      alert.status?.toUpperCase() === "OPEN"
                        ? "status-open"
                        : "status-acknowledged"
                    }`}
                  >
                    {alert.status}
                  </span>
                </div>

                <p>{alert.message || "Trend detected in recorded observations."}</p>
                <small>Created: {dateLabel(alert.created_at)}</small>

                {alert.reasons?.length ? (
                  <div className="alert-reasons">
                    <strong>Detected trend reasons</strong>
                    <ul>
                      {alert.reasons.map((reason, index) => (
                        <li key={`${reason.parameter}-${index}`}>
                          <b>{reason.parameter}</b>: {reason.reason}
                          {" "}({reason.previous} → {reason.latest})
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="form-hint">No reason details supplied.</p>
                )}

                {alert.status?.toUpperCase() === "ACKNOWLEDGED" && (
                  <p className="acknowledgement-detail">
                    Acknowledged by {alert.acknowledged_by || "Not specified"}
                    {" · "}
                    {dateLabel(alert.acknowledged_at)}
                  </p>
                )}

                <div className="alert-actions">
                  <button
                    type="button"
                    onClick={() => void viewAudit(alert)}
                  >
                    View audit history
                  </button>

                  {alert.status?.toUpperCase() === "OPEN" && (
                    <button
                      type="button"
                      disabled={busyId === alert.id}
                      onClick={() => void acknowledge(alert)}
                    >
                      {busyId === alert.id
                        ? "Acknowledging…"
                        : "Acknowledge"}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {visibleAlerts.some(
        (alert) => alert.status?.toUpperCase() === "OPEN"
      ) && (
        <section className="panel">
          <h2>Acknowledge an open alert</h2>
          <p className="form-hint">
            Select an open alert above, then enter the acknowledgement details
            here. The backend currently uses its configured actor field.
          </p>
          <label className="alert-input-label">
            Actor name
            <input
              value={actor}
              onChange={(e) => setActor(e.target.value)}
              maxLength={100}
            />
          </label>
          <label className="alert-input-label">
            Note (optional)
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Add an acknowledgement note"
            />
          </label>
          <p className="form-hint">
            To acknowledge an alert, use its Acknowledge button above.
          </p>
        </section>
      )}

      {selectedAlert && (
        <section className="panel audit-panel">
          <div className="section-heading">
            <div>
              <h2>Audit history · Alert #{selectedAlert.id}</h2>
              <p>Recorded events returned by the backend.</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedAlert(null)}
            >
              Close
            </button>
          </div>

          {auditLoading ? (
            <p>Loading audit history…</p>
          ) : auditError ? (
            <div className="form-error">{auditError}</div>
          ) : audit.length === 0 ? (
            <div className="empty-state">
              No audit entries returned for this alert.
            </div>
          ) : (
            <div className="audit-list">
              {audit.map((entry, index) => (
                <article key={entry.id ?? index}>
                  <strong>
                    {entry.event_type || entry.action || "Audit event"}
                  </strong>
                  <p>Actor: {entry.actor || "Not specified"}</p>
                  {entry.note && <p>Note: {entry.note}</p>}
                  <small>
                    {dateLabel(entry.created_at || entry.timestamp)}
                  </small>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <p className="research-disclaimer">
        Research prototype only. These trend alerts are not clinically
        validated and must not be used to make actual clinical decisions.
      </p>
    </div>
  );
}
