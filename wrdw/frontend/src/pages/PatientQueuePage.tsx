import { useCallback, useEffect, useMemo, useState } from "react";
import PatientTable from "../components/patients/PatientTable";
import PatientForm from "../components/patients/PatientForm";
import { patientService } from "../services/api";
import type { Patient } from "../types";

export default function PatientQueuePage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadPatients = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await patientService.list();
      setPatients(data);
    } catch {
      setError(
        "Could not load patients. Check that the backend is running and GET /patients is working."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPatients();
  }, [loadPatients]);

  const filteredPatients = useMemo(() => {
    const query = search.trim().toLowerCase();

    return patients.filter((patient) =>
      patient.patient_code.toLowerCase().includes(query)
    );
  }, [patients, search]);

  async function handleRegister(data: {
    patient_code: string;
    age: number;
  }) {
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      await patientService.create(data);
      await loadPatients();
      setSuccess(`Patient ${data.patient_code} registered successfully.`);
    } catch (err: unknown) {
      const message =
        typeof err === "object" &&
        err !== null &&
        "response" in err
          ? (
              err as {
                response?: { data?: { detail?: string | { msg?: string }[] } };
              }
            ).response?.data?.detail
          : undefined;

      const readableMessage = Array.isArray(message)
        ? message.map((item) => item.msg ?? "Invalid input").join(", ")
        : typeof message === "string"
          ? message
          : "Registration failed. Check whether the patient code already exists.";

      setError(readableMessage);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="patient-queue-page">
      <div className="page-intro">
        <div>
          <h2>Patient Management</h2>
          <p>Register and browse research patient records.</p>
        </div>

        <button
          className="secondary-button"
          type="button"
          onClick={() => void loadPatients()}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "↻ Refresh"}
        </button>
      </div>

      {error && (
        <div className="error-banner" role="alert">
          <strong>Something went wrong</strong>
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="success-banner" role="status">
          {success}
        </div>
      )}

      <PatientForm
        submitting={submitting}
        onSubmit={handleRegister}
      />

      {loading ? (
        <section className="panel loading-panel">
          Loading patient records...
        </section>
      ) : (
        <PatientTable
          patients={filteredPatients}
          search={search}
          onSearchChange={setSearch}
        />
      )}

      <p className="research-disclaimer">
        Research prototype only · Not for clinical decision-making
      </p>
    </div>
  );
}