import { BrowserRouter, Routes, Route } from "react-router-dom";
import PageLayout from "./components/layout/PageLayout";

import DashboardPage from "./pages/DashboardPage";
import PatientQueuePage from "./pages/PatientQueuePage";
import PatientDetailsPage from "./pages/PatientDetailsPage";
import ObservationsPage from "./pages/ObservationsPage";
import AlertsPage from "./pages/AlertsPage";
import SimulationPage from "./pages/SimulationPage";

import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <PageLayout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/patients" element={<PatientQueuePage />} />
          <Route path="/patients/:id" element={<PatientDetailsPage />} />
          <Route path="/observations" element={<ObservationsPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/simulation" element={<SimulationPage />} />
        </Routes>
      </PageLayout>
    </BrowserRouter>
  );
}