import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

const pageInfo: Record<string, { title: string; subtitle: string }> = {
  "/": {
    title: "Command Centre",
    subtitle: "Waiting-room monitoring overview",
  },
  "/patients": {
    title: "Patient Queue",
    subtitle: "View and manage registered research patients",
  },
  "/observations": {
    title: "Vital Observations",
    subtitle: "Review readings and data quality",
  },
  "/alerts": {
    title: "Alert Centre",
    subtitle: "Review deterioration-trend alerts and audit history",
  },
  "/simulation": {
    title: "Research & Simulation",
    subtitle: "Explore synthetic waiting-room scenarios",
  },
};

export default function PageLayout({
  children,
}: {
  children: ReactNode;
}) {
  const location = useLocation();
  const isPatientDetails = location.pathname.startsWith("/patients/");
  const info = isPatientDetails
    ? {
        title: "Patient Details",
        subtitle: "Patient observations and assessment history",
      }
    : pageInfo[location.pathname] ?? pageInfo["/"];

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <Topbar title={info.title} subtitle={info.subtitle} />
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}