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
  names: Record<string, string>;
  emojis: Record<string, string>;
};

const REFRESH_MS = 60_000;
const DEFAULT_NAMES: Record<string, string> = {
  "1": "Probe 1",
  "2": "Probe 2",
  "3": "Probe 3",
  "4": "Probe 4",
};
const DEFAULT_EMOJIS: Record<string, string> = {
  "1": "",
  "2": "",
  "3": "",
  "4": "",
};

export default function App() {
  const [hours, setHours] = useState(24);
  const [data, setData] = useState<ReadingsResponse | null>(null);
  const [names, setNames] = useState<Record<string, string>>(DEFAULT_NAMES);
  const [emojis, setEmojis] = useState<Record<string, string>>(DEFAULT_EMOJIS);
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
      if (json.names) setNames(json.names);
      if (json.emojis) setEmojis(json.emojis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load readings");
    } finally {
      setLoading(false);
    }
  }, [hours]);

  const updateProbe = useCallback(
    async (probe: string, updates: { name?: string; emoji?: string }) => {
      const res = await fetch(`/api/names/${probe}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as {
        names: Record<string, string>;
        emojis: Record<string, string>;
      };
      setNames(json.names);
      setEmojis(json.emojis);
    },
    [],
  );

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
                  name={names[probe] ?? `Probe ${probe}`}
                  emoji={emojis[probe] ?? ""}
                  reading={reading}
                  onRename={(name) => updateProbe(probe, { name })}
                  onEmojiChange={(emoji) => updateProbe(probe, { emoji })}
                />
              );
            })}
          </div>

          <section className="chart-section">
            <h2>Humidity over time</h2>
            <MoistureChart series={data.series} names={names} emojis={emojis} />
          </section>
        </>
      )}
    </>
  );
}
