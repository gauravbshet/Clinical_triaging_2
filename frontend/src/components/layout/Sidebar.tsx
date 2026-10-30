import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Command Centre", icon: "◈", end: true },
  { to: "/patients", label: "Patient Queue", icon: "♙" },
  { to: "/observations", label: "Observations", icon: "♡" },
  { to: "/alerts", label: "Alert Centre", icon: "⚠" },
  { to: "/data-quality", label: "Data Quality Watchdog", icon: "◉" },
  { to: "/simulation", label: "Research & Simulation", icon: "⌁" },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">W</div>
        <div>
          <div className="brand-name">WRDW</div>
          <div className="brand-subtitle">Research Platform</div>
        </div>
      </div>

      <div className="nav-section-label">WORKSPACE</div>

      <nav>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `nav-item${isActive ? " active" : ""}`
            }
          >
            <span className="nav-icon">{link.icon}</span>
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="status-dot" />
        <span>Research mode · Not for clinical use</span>
      </div>
    </aside>
  );
}