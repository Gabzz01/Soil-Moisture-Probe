import { useEffect, useRef, useState } from "react";

export type Location = {
  name: string;
  latitude: number;
  longitude: number;
};

type SearchResult = Location & {
  admin1?: string;
  country?: string;
};

type Props = {
  location: Location | null;
  onLocationChange: (location: Location) => void;
};

function formatResultLabel(r: SearchResult): string {
  const parts = [r.name];
  if (r.admin1) parts.push(r.admin1);
  if (r.country) parts.push(r.country);
  return parts.join(", ");
}

export default function LocationSelector({ location, onLocationChange }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }

    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/locations/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const json = (await res.json()) as { results: SearchResult[] };
        setResults(json.results ?? []);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(id);
  }, [query]);

  async function select(result: SearchResult) {
    const label = formatResultLabel(result);
    const res = await fetch("/api/location", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: label,
        latitude: result.latitude,
        longitude: result.longitude,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    const json = (await res.json()) as { location: Location };
    onLocationChange(json.location);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  return (
    <div className="location-selector" ref={rootRef}>
      <span className="location-icon" aria-hidden="true">
        ☁
      </span>
      <input
        type="text"
        className="location-input"
        placeholder={location ? location.name : "Search city for weather…"}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && query.trim().length >= 2 && (
        <ul className="location-results" role="listbox">
          {loading && <li className="location-result muted">Searching…</li>}
          {!loading && results.length === 0 && (
            <li className="location-result muted">No results</li>
          )}
          {!loading &&
            results.map((r) => (
              <li key={`${r.latitude},${r.longitude},${r.name}`}>
                <button
                  type="button"
                  className="location-result"
                  onClick={() => select(r)}
                >
                  {formatResultLabel(r)}
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
