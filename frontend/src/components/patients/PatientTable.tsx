import { Link } from "react-router-dom";
import type { Patient } from "../../types";

type PatientTableProps = {
  patients: Patient[];
  search: string;
  onSearchChange: (value: string) => void;
};

export default function PatientTable({
  patients,
  search,
  onSearchChange,
}: PatientTableProps) {
  return (
    <section className="panel patient-table-panel">
      <div className="section-heading">
        <div>
          <h2>Registered Patients</h2>
          <p>{patients.length} patient(s) match your search</p>
        </div>

        <input
          className="search-input"
          type="search"
          placeholder="Search patient code..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          aria-label="Search patients by code"
        />
      </div>

      {patients.length === 0 ? (
        <div className="empty-state">
          <h3>No patients found</h3>
          <p>Try another patient code or register a new patient.</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="patient-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Patient Code</th>
                <th>Age</th>
                <th>Registration</th>
                <th>Details</th>
              </tr>
            </thead>

            <tbody>
              {patients.map((patient) => (
                <tr key={patient.id}>
                  <td>
                    <span className="patient-avatar">
                      {String(patient.id).padStart(2, "0")}
                    </span>
                  </td>
                  <td className="patient-code">{patient.patient_code}</td>
                  <td>{patient.age}</td>
                  <td>
                    {patient.created_at
                      ? new Date(patient.created_at).toLocaleDateString()
                      : "—"}
                  </td>
                  <td>
                    <Link
                      className="text-link"
                      to={`/patients/${patient.id}`}
                    >
                      View patient →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}