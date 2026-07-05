import { useEffect, useRef, useState } from "react";
import { PLANT_PRESETS, getPlantPreset } from "../lib/plants.ts";

type Props = {
  plantType: string;
  onSelect: (plantType: string) => void;
};

export default function PlantTypePicker({ plantType, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const preset = getPlantPreset(plantType);
  const label = preset?.label ?? "Plant type";

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

  function pick(id: string) {
    onSelect(id);
    setOpen(false);
  }

  return (
    <div className="plant-type-picker" ref={rootRef}>
      <button
        type="button"
        className="plant-type-picker-btn"
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </button>
      {open && (
        <ul className="plant-type-list" role="listbox">
          {PLANT_PRESETS.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className={`plant-type-option${p.id === plantType ? " selected" : ""}`}
                onClick={() => pick(p.id)}
              >
                <span className="plant-type-name">{p.label}</span>
                <span className="plant-type-range">
                  {p.minPct}–{p.maxPct}%
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
