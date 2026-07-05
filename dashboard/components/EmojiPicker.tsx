import { useEffect, useRef, useState } from "react";

const EMOJI_OPTIONS = [
  "🌱",
  "🌿",
  "🍃",
  "🪴",
  "🥬",
  "🍅",
  "🌶️",
  "🥕",
  "🌻",
  "🍓",
  "🥒",
  "🫑",
  "💧",
  "🌳",
  "🌾",
  "🪻",
];

type Props = {
  emoji: string;
  onSelect: (emoji: string) => void;
};

export default function EmojiPicker({ emoji, onSelect }: Props) {
  const [open, setOpen] = useState(false);
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

  function pick(value: string) {
    onSelect(value);
    setOpen(false);
  }

  return (
    <div className="emoji-picker" ref={rootRef}>
      <button
        type="button"
        className="emoji-picker-btn"
        title="Choose emoji"
        onClick={() => setOpen((v) => !v)}
      >
        {emoji || "➕"}
      </button>
      {open && (
        <div className="emoji-grid" role="listbox">
          <button
            type="button"
            className="emoji-option emoji-clear"
            title="Clear emoji"
            onClick={() => pick("")}
          >
            ×
          </button>
          {EMOJI_OPTIONS.map((e) => (
            <button
              key={e}
              type="button"
              className={`emoji-option${e === emoji ? " selected" : ""}`}
              onClick={() => pick(e)}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
