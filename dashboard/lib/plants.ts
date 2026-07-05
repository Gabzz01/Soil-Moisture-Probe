export type PlantPreset = {
  id: string;
  label: string;
  minPct: number;
  maxPct: number;
};

export type MoistureStatus = "optimal" | "dry" | "wet";

export const PLANT_PRESETS: PlantPreset[] = [
  { id: "lettuce", label: "Lettuce", minPct: 60, maxPct: 80 },
  { id: "tomato", label: "Tomato", minPct: 50, maxPct: 70 },
  { id: "strawberry", label: "Strawberry", minPct: 60, maxPct: 80 },
  { id: "herbs", label: "Herbs", minPct: 45, maxPct: 65 },
  { id: "peppers", label: "Peppers", minPct: 50, maxPct: 70 },
  { id: "cucumber", label: "Cucumber", minPct: 55, maxPct: 75 },
  { id: "succulent", label: "Succulent", minPct: 20, maxPct: 40 },
];

const PRESET_BY_ID = new Map(PLANT_PRESETS.map((p) => [p.id, p]));

export function getPlantPreset(id: string): PlantPreset | null {
  if (!id) return null;
  return PRESET_BY_ID.get(id) ?? null;
}

export function isValidPlantType(id: string): boolean {
  return id === "" || PRESET_BY_ID.has(id);
}

export function moistureStatus(
  value: number,
  preset: PlantPreset | null,
): MoistureStatus | null {
  if (!preset) return null;
  if (value < preset.minPct) return "dry";
  if (value > preset.maxPct) return "wet";
  return "optimal";
}

export function moistureStatusLabel(status: MoistureStatus | null): string {
  if (status === "optimal") return "Optimal";
  if (status === "dry") return "Too dry";
  if (status === "wet") return "Too wet";
  return "Select plant";
}
