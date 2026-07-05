import { useEffect, useRef, useState } from "react";
import { formatLocalTime } from "../lib/time.ts";
import { getPlantPreset } from "../lib/plants.ts";
import EmojiPicker from "./EmojiPicker.tsx";
import MoistureGauge from "./MoistureGauge.tsx";
import PlantTypePicker from "./PlantTypePicker.tsx";

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
  name: string;
  emoji: string;
  plantType: string;
  reading?: ProbeReading;
  onRename: (name: string) => Promise<void>;
  onEmojiChange: (emoji: string) => Promise<void>;
  onPlantTypeChange: (plantType: string) => Promise<void>;
};

export default function ProbeCard({
  name,
  emoji,
  plantType,
  reading,
  onRename,
  onEmojiChange,
  onPlantTypeChange,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const preset = getPlantPreset(plantType);

  useEffect(() => {
    setDraft(name);
  }, [name]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function save() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === name) {
      setDraft(name);
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onRename(trimmed);
      setEditing(false);
    } catch {
      setDraft(name);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setDraft(name);
    setEditing(false);
  }

  const channel = reading?.channel;

  const title = (
    <>
      <EmojiPicker emoji={emoji} onSelect={(e) => onEmojiChange(e)} />
      {editing ? (
        <input
          ref={inputRef}
          className="probe-name-input"
          value={draft}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") cancel();
          }}
        />
      ) : (
        <>
          <span className="probe-name">{name}</span>
          <button
            type="button"
            className="probe-rename-btn"
            title="Rename"
            onClick={() => setEditing(true)}
          >
            ✎
          </button>
        </>
      )}
    </>
  );

  if (!reading) {
    return (
      <div className="probe-card">
        <h2 className="probe-title">{title}</h2>
        <PlantTypePicker
          plantType={plantType}
          onSelect={(id) => onPlantTypeChange(id)}
        />
        <div className="humidity">—</div>
        <div className="voltage">No data</div>
      </div>
    );
  }

  return (
    <div className={`probe-card${reading.stale ? " stale" : ""}`}>
      <h2 className="probe-title">
        {title}
        {channel && <span className="probe-channel">{channel}</span>}
      </h2>
      <PlantTypePicker
        plantType={plantType}
        onSelect={(id) => onPlantTypeChange(id)}
      />
      <MoistureGauge
        value={reading.humidity_pct}
        preset={preset}
        stale={reading.stale}
      />
      <div className="voltage">{reading.voltage.toFixed(3)} V</div>
      <div className="time">{formatLocalTime(reading.time)}</div>
    </div>
  );
}
