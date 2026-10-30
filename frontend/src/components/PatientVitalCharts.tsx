import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Scatter,
} from "recharts";
import type { Vital ,DeteriorationAlert} from "../types";

interface Props {
  vitals: Vital[];
  alerts: DeteriorationAlert[];
}

const chartConfigs = [
  {
    key: "heart_rate",
    title: "Heart Rate",
    unit: "bpm",
    color: "#168c7a",
  },
  {
    key: "spo2",
    title: "Oxygen Saturation (SpO₂)",
    unit: "%",
    color: "#2878b5",
  },
  {
    key: "respiratory_rate",
    title: "Respiratory Rate",
    unit: "breaths/min",
    color: "#9b59b6",
  },
  {
    key: "systolic_bp",
    title: "Systolic Blood Pressure",
    unit: "mmHg",
    color: "#d18b32",
  },
  {
    key: "temperature",
    title: "Temperature",
    unit: "°C",
    color: "#d65b5b",
  },
] as const;

export default function PatientVitalCharts({ vitals, alerts }: Props) {
  const chartData = [...vitals]
    .sort(
      (a, b) =>
        new Date(a.recorded_at).getTime() -
        new Date(b.recorded_at).getTime()
    )
    .map((vital) => ({
      time: new Date(vital.recorded_at).toLocaleString(),
      heart_rate: vital.heart_rate,
      spo2: vital.spo2,
      respiratory_rate: vital.respiratory_rate,
      systolic_bp: vital.systolic_bp,
      temperature: vital.temperature,
    }));
  const alertMarkers = alerts.flatMap((alert) => {
    if (!alert.latest_reading) return [];

    return alert.reasons.map((reason) => ({
      parameter: reason.parameter,
      time: new Date(
        alert.latest_reading!.recorded_at
      ).toLocaleString(),
      value: alert.latest_reading![reason.parameter as keyof typeof alert.latest_reading],
      alertId: alert.id,
      message: alert.message,
    }));
  });
    console.log("Alert markers:", alertMarkers); 

  return (
    <div className="patient-vital-charts">
      {chartConfigs.map((config) => {
        const hasReadings = chartData.some(
          (reading) => reading[config.key] !== null
        );
        const markersForChart = alertMarkers.filter(
  (marker) => marker.parameter === config.key
);

        return (
          <section className="panel vital-chart-panel" key={config.key}>
            <div className="section-heading">
              <div>
                <h2>{config.title} Timeline</h2>
                <p>Recorded observations over time.</p>
              </div>
              <span className="count-pill">
                {
                  chartData.filter(
                    (reading) => reading[config.key] !== null
                  ).length
                } readings
              </span>
            </div>

            {!hasReadings ? (
              <div className="empty-state">
                No {config.title.toLowerCase()} readings available.
              </div>
            ) : (
              <div className="vital-chart">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 10 }}
                      minTickGap={25}
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      tick={{ fontSize: 11 }}
                      label={{
                        value: config.unit,
                        angle: -90,
                        position: "insideLeft",
                      }}
                    />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey={config.key}
                      name={config.title}
                      stroke={config.color}
                      strokeWidth={2}
                      connectNulls={false}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Scatter data={markersForChart.map((marker) => ({time: marker.time,[config.key]: marker.value, }))} dataKey={config.key} fill="#e53935" shape="circle"/>

                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}