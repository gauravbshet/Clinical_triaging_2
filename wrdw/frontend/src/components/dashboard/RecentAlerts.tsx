import { Link } from "react-router-dom";
import type { DeteriorationAlert } from "../../types";

type RecentAlertsProps = {
  alerts: DeteriorationAlert[];
};

export default function RecentAlerts({ alerts }: RecentAlertsProps) {
  const recent = [...alerts]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
    )
    .slice(0, 5);

  return (
    <section className="panel recent-alerts-panel">
      <div className="section-heading">
        <div>
          <h2>Recent Alerts</h2>
          <p>Latest recorded deterioration-trend alerts</p>
        </div>
        <Link to="/alerts" className="text-link">
          View all →
        </Link>
      </div>

      {recent.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">✓</span>
          <h3>No recorded alerts</h3>
          <p>
            There are currently no alerts in the returned dataset.
            This does not establish that every patient is stable.
          </p>
        </div>
      ) : (
        <div className="recent-alert-list">
          {recent.map((alert) => {
            const acknowledged =
              alert.status.toLowerCase() === "acknowledged";

            return (
              <article className="recent-alert-row" key={alert.id}>
                <div
                  className={`alert-indicator ${
                    acknowledged ? "acknowledged" : "open"
                  }`}
                >
                  {acknowledged ? "✓" : "!"}
                </div>

                <div className="recent-alert-content">
                  <div className="recent-alert-title">
                    Patient #{alert.patient_id}
                    <span
                      className={`status-pill ${
                        acknowledged ? "status-acknowledged" : "status-open"
                      }`}
                    >
                      {alert.status}
                    </span>
                  </div>

                  <p>{alert.message}</p>

                  <span className="alert-time">
                    {alert.created_at
                      ? new Date(alert.created_at).toLocaleString()
                      : "Time unavailable"}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}