type TopbarProps = {
  title: string;
  subtitle: string;
};

export default function Topbar({ title, subtitle }: TopbarProps) {
  return (
    <header className="topbar">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      <div className="topbar-status">
        <span className="status-dot" />
        Backend connection requires verification
      </div>
    </header>
  );
}