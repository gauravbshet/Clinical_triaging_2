
import { useEffect, useState } from "react";
import { patientService } from "../services/api";
import type { Patient, Vital } from "../types";

const emptyForm = {
  heart_rate: "",
  spo2: "",
  respiratory_rate: "",
  systolic_bp: "",
  temperature: "",
  consciousness: "Alert",
  supplemental_oxygen: "No",
  recorded_at: new Date().toISOString().slice(0, 16),
};

function optionalNumber(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

function display(value: number | string | null | undefined, unit = "") {
  return value === null || value === undefined || value === ""
    ? "Not recorded"
    : `${value}${unit}`;
}

export default function ObservationsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState("");
  const [vitals, setVitals] = useState<Vital[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadPatients() {
    const data = await patientService.list();
    setPatients(data);

    if (data.length && !patientId) {
      setPatientId(String(data[0].id));
    }
  }

  async function loadVitals(id: number) {
    const data = await patientService.vitals(id);
    setVitals(
      [...data].sort(
        (a, b) =>
          new Date(b.recorded_at).getTime() -
          new Date(a.recorded_at).getTime()
      )
    );
  }

  useEffect(() => {
    loadPatients()
      .catch(() => setError("Could not load registered patients."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!patientId) {
      setVitals([]);
      return;
    }

    let active = true;

    patientService
      .vitals(Number(patientId))
      .then((data) => {
        if (active) {
          setVitals(
            [...data].sort(
              (a, b) =>
                new Date(b.recorded_at).getTime() -
                new Date(a.recorded_at).getTime()
            )
          );
        }
      })
      .catch(() => {
        if (active) setError("Could not load observation history.");
      });

    return () => {
      active = false;
    };
  }, [patientId]);

  function updateField(
    field: keyof typeof emptyForm,
    value: string
  ) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!patientId) {
      setError("Select a patient first.");
      return;
    }

    if (!form.recorded_at) {
      setError("Choose the observation date and time.");
      return;
    }

    const numericFields = [
      ["Heart rate", form.heart_rate, 1, 300],
      ["SpO₂", form.spo2, 0, 100],
      ["Respiratory rate", form.respiratory_rate, 1, 150],
      ["Systolic BP", form.systolic_bp, 1, 350],
      ["Temperature", form.temperature, 25, 45],
    ] as const;

    for (const [label, value, min, max] of numericFields) {
      if (value.trim() === "") continue;

      const number = Number(value);
      if (!Number.isFinite(number) || number < min || number > max) {
        setError(`${label} must be between ${min} and ${max}.`);
        return;
      }
    }

    setSaving(true);

    try {
      await patientService.createVital(Number(patientId), {
        heart_rate: optionalNumber(form.heart_rate),
        spo2: optionalNumber(form.spo2),
        respiratory_rate: optionalNumber(form.respiratory_rate),
        systolic_bp: optionalNumber(form.systolic_bp),
        temperature: optionalNumber(form.temperature),
        consciousness: form.consciousness || null,
        supplemental_oxygen: form.supplemental_oxygen || null,
        recorded_at: new Date(form.recorded_at).toISOString(),
        source: "nurse_entry",
      });

      await loadVitals(Number(patientId));
      setForm({
        ...emptyForm,
        recorded_at: new Date().toISOString().slice(0, 16),
      });
      setMessage("Observation saved successfully.");
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : "Could not save the observation. Check your backend and try again."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <section className="panel">Loading observations…</section>;
  }

  return (
    <div className="observations-page">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Record observations</h2>
            <p>Enter a patient's measured vital signs.</p>
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}
        {message && <div className="form-success">{message}</div>}

        <form onSubmit={handleSubmit} className="observation-form">
          <label>
            Patient
            <select
              value={patientId}
              onChange={(e) => {
                setPatientId(e.target.value);
                setError("");
                setMessage("");
              }}
              required
            >
              <option value="">Select a patient</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.patient_code} — Patient #{patient.id}
                </option>
              ))}
            </select>
          </label>

          <div className="observation-fields">
            <label>
              Heart rate (bpm)
              <input
                type="number"
                min="1"
                max="300"
                value={form.heart_rate}
                onChange={(e) => updateField("heart_rate", e.target.value)}
                placeholder="e.g. 82"
              />
            </label>

            <label>
              SpO₂ (%)
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={form.spo2}
                onChange={(e) => updateField("spo2", e.target.value)}
                placeholder="e.g. 98"
              />
            </label>

            <label>
              Respiratory rate (/min)
              <input
                type="number"
                min="1"
                max="150"
                value={form.respiratory_rate}
                onChange={(e) =>
                  updateField("respiratory_rate", e.target.value)
                }
                placeholder="e.g. 16"
              />
            </label>

            <label>
              Systolic BP (mmHg)
              <input
                type="number"
                min="1"
                max="350"
                value={form.systolic_bp}
                onChange={(e) => updateField("systolic_bp", e.target.value)}
                placeholder="e.g. 120"
              />
            </label>

            <label>
              Temperature (°C)
              <input
                type="number"
                min="25"
                max="45"
                step="0.1"
                value={form.temperature}
                onChange={(e) => updateField("temperature", e.target.value)}
                placeholder="e.g. 36.8"
              />
            </label>

            <label>
              Consciousness
              <select
                value={form.consciousness}
                onChange={(e) =>
                  updateField("consciousness", e.target.value)
                }
              >
                <option value="Alert">Alert</option>
                <option value="Confusion">Confusion</option>
                <option value="Voice">Responds to voice</option>
                <option value="Pain">Responds to pain</option>
                <option value="Unresponsive">Unresponsive</option>
                <option value="">Not recorded</option>
              </select>
            </label>

            <label>
              Supplemental oxygen
              <select
                value={form.supplemental_oxygen}
                onChange={(e) =>
                  updateField("supplemental_oxygen", e.target.value)
                }
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
                <option value="">Not recorded</option>
              </select>
            </label>

            <label>
              Observation date and time
              <input
                type="datetime-local"
                value={form.recorded_at}
                onChange={(e) => updateField("recorded_at", e.target.value)}
                required
              />
            </label>
          </div>

          <p className="form-hint">
            Leave unmeasured numeric fields blank. Missing values will not be
            treated as normal readings.
          </p>

          <button type="submit" disabled={saving || !patients.length}>
            {saving ? "Saving…" : "Save observation"}
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Observation history</h2>
            <p>
              {patientId
                ? `Patient #${patientId} · ${vitals.length} recorded observations`
                : "Select a patient to view their history."}
            </p>
          </div>
        </div>

        {vitals.length === 0 ? (
          <div className="empty-state">
            No observations recorded for this patient yet.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Recorded at</th>
                  <th>HR</th>
                  <th>SpO₂</th>
                  <th>RR</th>
                  <th>Systolic BP</th>
                  <th>Temp.</th>
                  <th>Quality</th>
                </tr>
              </thead>
              <tbody>
                {vitals.map((vital) => (
                  <tr key={vital.id}>
                    <td>
                      {new Date(vital.recorded_at).toLocaleString()}
                    </td>
                    <td>{display(vital.heart_rate, " bpm")}</td>
                    <td>{display(vital.spo2, "%")}</td>
                    <td>{display(vital.respiratory_rate, "/min")}</td>
                    <td>{display(vital.systolic_bp, " mmHg")}</td>
                    <td>{display(vital.temperature, " °C")}</td>
                    <td>{vital.quality_status || "Unknown"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="research-disclaimer">
        Research prototype only. These observations and calculations are not
        clinically validated and must not be used to make actual clinical
        decisions.
      </p>
    </div>
  );
}
