import { useCallback, useEffect, useState } from "react";
import MoistureChart from "./components/MoistureChart.tsx";
import ProbeCard from "./components/ProbeCard.tsx";

type ProbeReading = {
  probe: string;
  channel: string;
  humidity_pct: number;
  voltage: number;
  time: string;
  stale: boolean;
};

type SeriesPoint = {
  time: string;
  humidity_pct: number;
};

type ReadingsResponse = {
  probes: ProbeReading[];
  series: Record<string, SeriesPoint[]>;
};

const REFRESH_MS = 60_000;

export default function App() {
  const [hours, setHours] = useState(24);
  const [data, setData] = useState<ReadingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReadings = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`/api/readings?hours=${hours}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as ReadingsResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load readings");
    } finally {
      setLoading(false);
    }
  }, [hours]);

  useEffect(() => {
    setLoading(true);
    fetchReadings();
    const id = setInterval(fetchReadings, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchReadings]);

  return (
    <>
      <header>
        <h1>Soil Moisture</h1>
        <div className="range-toggle">
          <button
            type="button"
            className={hours === 24 ? "active" : ""}
            onClick={() => setHours(24)}
          >
            24h
          </button>
          <button
            type="button"
            className={hours === 168 ? "active" : ""}
            onClick={() => setHours(168)}
          >
            7d
          </button>
        </div>
      </header>

      {loading && !data && <p className="status">Loading…</p>}
      {error && <p className="status error">{error}</p>}

      {data && (
        <>
          <div className="cards">
            {["1", "2", "3", "4"].map((probe) => {
              const reading = data.probes.find((p) => p.probe === probe);
              return (
                <ProbeCard
                  key={probe}
                  probe={probe}
                  reading={reading}
                />
              );
            })}
          </div>

          <section className="chart-section">
            <h2>Humidity over time</h2>
            <MoistureChart series={data.series} />
          </section>
        </>
      )}
    </>
  );
}
