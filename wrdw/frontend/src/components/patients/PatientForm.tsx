import { useState, type FormEvent } from "react";

type PatientFormProps = {
  submitting: boolean;
  onSubmit: (data: { patient_code: string; age: number }) => Promise<void>;
};

export default function PatientForm({
  submitting,
  onSubmit,
}: PatientFormProps) {
  const [patientCode, setPatientCode] = useState("");
  const [age, setAge] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const code = patientCode.trim();
    const parsedAge = Number(age);

    if (!code) {
      setError("Enter a patient code.");
      return;
    }

    if (!Number.isInteger(parsedAge) || parsedAge < 0 || parsedAge > 125) {
      setError("Enter a valid age between 0 and 125.");
      return;
    }

    try {
      await onSubmit({ patient_code: code, age: parsedAge });
      setPatientCode("");
      setAge("");
    } catch {
      setError("Registration failed. Check the message above and try again.");
    }
  }

  return (
    <section className="panel patient-form-panel">
      <div className="section-heading">
        <div>
          <h2>Register Patient</h2>
          <p>Add a patient record to the research database</p>
        </div>
      </div>

      <form className="patient-form" onSubmit={handleSubmit}>
        <label>
          Patient code
          <input
            type="text"
            value={patientCode}
            onChange={(event) => setPatientCode(event.target.value)}
            placeholder="e.g. WRD-001"
            maxLength={50}
            required
          />
        </label>

        <label>
          Age
          <input
            type="number"
            min="0"
            max="125"
            step="1"
            value={age}
            onChange={(event) => setAge(event.target.value)}
            placeholder="Enter age"
            required
          />
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? "Registering..." : "＋ Register Patient"}
        </button>

        <p className="form-note">
          Use a non-identifying research code. Avoid entering real patient
          names or other personal identifiers.
        </p>
      </form>
    </section>
  );
}