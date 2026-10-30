type StatCardProps = {
  label: string;
  value: number | string;
  detail: string;
  icon: string;
  accent?: string;
};

export default function StatCard({
  label,
  value,
  detail,
  icon,
  accent = "#27c3a7",
}: StatCardProps) {
  return (
    <article className="stat-card">
      <div className="stat-card-top">
        <span className="stat-label">{label}</span>
        <span
          className="stat-icon"
          style={{ color: accent, backgroundColor: `${accent}18` }}
        >
          {icon}
        </span>
      </div>

      <div className="stat-value">{value}</div>
      <div className="stat-detail">{detail}</div>
    </article>
  );
}