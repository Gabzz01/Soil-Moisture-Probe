import { formatLocalDateTime } from "../lib/time.ts";

type ProbeReading = {
  probe: string;
  channel: string;
  humidity_pct: number;
  voltage: number;
  time: string;
  stale: boolean;
};

type Props = {
  probe: string;
  reading?: ProbeReading;
};

export default function ProbeCard({ probe, reading }: Props) {
  if (!reading) {
    return (
      <div className="probe-card">
        <h2>Probe {probe}</h2>
        <div className="humidity">—</div>
        <div className="voltage">No data</div>
      </div>
    );
  }

  return (
    <div className={`probe-card${reading.stale ? " stale" : ""}`}>
      <h2>
        Probe {probe} ({reading.channel})
      </h2>
      <div className="humidity">{reading.humidity_pct.toFixed(1)}%</div>
      <div className="voltage">{reading.voltage.toFixed(3)} V</div>
      <div className="time">{formatLocalDateTime(reading.time)}</div>
    </div>
  );
}
