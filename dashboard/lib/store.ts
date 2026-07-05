import { isValidPlantType } from "./plants.ts";

const DATA_PATH = process.env.DATA_PATH ?? "./data.json";
const VALID_PROBES = new Set(["1", "2", "3", "4"]);

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

const DEFAULT_PLANT_TYPES: Record<string, string> = {
  "1": "",
  "2": "",
  "3": "",
  "4": "",
};

export type Location = {
  name: string;
  latitude: number;
  longitude: number;
};

type DataFile = {
  probes: Record<string, string>;
  emojis?: Record<string, string>;
  plantTypes?: Record<string, string>;
  location?: Location | null;
};

export type ProbeConfig = {
  names: Record<string, string>;
  emojis: Record<string, string>;
  plantTypes: Record<string, string>;
};

function defaultData(): DataFile {
  return {
    probes: { ...DEFAULT_NAMES },
    emojis: { ...DEFAULT_EMOJIS },
    plantTypes: { ...DEFAULT_PLANT_TYPES },
    location: null,
  };
}

function normalizeData(data: DataFile): DataFile {
  return {
    probes: { ...DEFAULT_NAMES, ...data.probes },
    emojis: { ...DEFAULT_EMOJIS, ...(data.emojis ?? {}) },
    plantTypes: { ...DEFAULT_PLANT_TYPES, ...(data.plantTypes ?? {}) },
    location: data.location ?? null,
  };
}

async function writeData(data: DataFile): Promise<void> {
  await Bun.write(DATA_PATH, JSON.stringify(normalizeData(data), null, 2) + "\n");
}

async function readData(): Promise<DataFile> {
  const file = Bun.file(DATA_PATH);
  if (!(await file.exists())) {
    const data = defaultData();
    await writeData(data);
    return data;
  }

  try {
    const data = (await file.json()) as DataFile;
    if (!data.probes || typeof data.probes !== "object") {
      const fallback = defaultData();
      await writeData(fallback);
      return fallback;
    }
    return normalizeData(data);
  } catch {
    const fallback = defaultData();
    await writeData(fallback);
    return fallback;
  }
}

export function displayName(probe: string, names: Record<string, string>): string {
  return names[probe] ?? `Probe ${probe}`;
}

export async function loadProbeConfig(): Promise<ProbeConfig> {
  const data = await readData();
  return {
    names: data.probes,
    emojis: data.emojis ?? { ...DEFAULT_EMOJIS },
    plantTypes: data.plantTypes ?? { ...DEFAULT_PLANT_TYPES },
  };
}

export async function loadProbeNames(): Promise<Record<string, string>> {
  const { names } = await loadProbeConfig();
  return names;
}

export async function loadProbeEmojis(): Promise<Record<string, string>> {
  const { emojis } = await loadProbeConfig();
  return emojis;
}

export async function updateProbe(
  probe: string,
  updates: { name?: string; emoji?: string; plantType?: string },
): Promise<ProbeConfig> {
  if (!VALID_PROBES.has(probe)) {
    throw new Error(`Invalid probe id: ${probe}`);
  }

  const hasName = updates.name !== undefined;
  const hasEmoji = updates.emoji !== undefined;
  const hasPlantType = updates.plantType !== undefined;
  if (!hasName && !hasEmoji && !hasPlantType) {
    throw new Error("At least one of name, emoji, or plantType is required");
  }

  if (hasName) {
    const trimmed = updates.name!.trim();
    if (!trimmed) {
      throw new Error("Name cannot be empty");
    }
  }

  if (hasPlantType && !isValidPlantType(updates.plantType!)) {
    throw new Error(`Invalid plant type: ${updates.plantType}`);
  }

  const data = await readData();

  if (hasName) {
    data.probes[probe] = updates.name!.trim();
  }
  if (hasEmoji) {
    if (!data.emojis) data.emojis = { ...DEFAULT_EMOJIS };
    data.emojis[probe] = updates.emoji!;
  }
  if (hasPlantType) {
    if (!data.plantTypes) data.plantTypes = { ...DEFAULT_PLANT_TYPES };
    data.plantTypes[probe] = updates.plantType!;
  }

  await writeData(data);
  return {
    names: data.probes,
    emojis: data.emojis ?? { ...DEFAULT_EMOJIS },
    plantTypes: data.plantTypes ?? { ...DEFAULT_PLANT_TYPES },
  };
}

export async function saveProbeName(
  probe: string,
  name: string,
): Promise<Record<string, string>> {
  const { names } = await updateProbe(probe, { name });
  return names;
}

export async function saveProbeEmoji(
  probe: string,
  emoji: string,
): Promise<Record<string, string>> {
  const { emojis } = await updateProbe(probe, { emoji });
  return emojis;
}

export async function loadLocation(): Promise<Location | null> {
  const data = await readData();
  return data.location ?? null;
}

export async function saveLocation(location: Location): Promise<Location> {
  const name = location.name.trim();
  if (!name) {
    throw new Error("Location name cannot be empty");
  }
  if (
    !Number.isFinite(location.latitude) ||
    location.latitude < -90 ||
    location.latitude > 90
  ) {
    throw new Error("Invalid latitude");
  }
  if (
    !Number.isFinite(location.longitude) ||
    location.longitude < -180 ||
    location.longitude > 180
  ) {
    throw new Error("Invalid longitude");
  }

  const data = await readData();
  const saved: Location = {
    name,
    latitude: location.latitude,
    longitude: location.longitude,
  };
  data.location = saved;
  await writeData(data);
  return saved;
}
