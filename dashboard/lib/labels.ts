export function probeLabel(name: string, emoji?: string): string {
  return emoji ? `${emoji} ${name}` : name;
}
