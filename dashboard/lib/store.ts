const DATA_PATH = "./data.json";
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

type DataFile = {
  probes: Record<string, string>;
  emojis?: Record<string, string>;
};

export type ProbeConfig = {
  names: Record<string, string>;
  emojis: Record<string, string>;
};

function defaultData(): DataFile {
  return {
    probes: { ...DEFAULT_NAMES },
    emojis: { ...DEFAULT_EMOJIS },
  };
}

function normalizeData(data: DataFile): DataFile {
  return {
    probes: { ...DEFAULT_NAMES, ...data.probes },
    emojis: { ...DEFAULT_EMOJIS, ...(data.emojis ?? {}) },
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
  return { names: data.probes, emojis: data.emojis ?? { ...DEFAULT_EMOJIS } };
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
  updates: { name?: string; emoji?: string },
): Promise<ProbeConfig> {
  if (!VALID_PROBES.has(probe)) {
    throw new Error(`Invalid probe id: ${probe}`);
  }

  const hasName = updates.name !== undefined;
  const hasEmoji = updates.emoji !== undefined;
  if (!hasName && !hasEmoji) {
    throw new Error("At least one of name or emoji is required");
  }

  if (hasName) {
    const trimmed = updates.name!.trim();
    if (!trimmed) {
      throw new Error("Name cannot be empty");
    }
  }

  const data = await readData();

  if (hasName) {
    data.probes[probe] = updates.name!.trim();
  }
  if (hasEmoji) {
    if (!data.emojis) data.emojis = { ...DEFAULT_EMOJIS };
    data.emojis[probe] = updates.emoji!;
  }

  await writeData(data);
  return { names: data.probes, emojis: data.emojis ?? { ...DEFAULT_EMOJIS } };
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
