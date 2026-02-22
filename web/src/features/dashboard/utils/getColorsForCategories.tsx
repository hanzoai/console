/** Hex color palette (Tailwind 500-shade equivalents) */
const predefinedColors: string[] = [
  "#6366f1", // indigo
  "#06b6d4", // cyan
  "#71717a", // zinc
  "#a855f7", // purple
  "#eab308", // yellow
  "#ef4444", // red
  "#84cc16", // lime
  "#ec4899", // pink
  "#10b981", // emerald
  "#14b8a6", // teal
  "#d946ef", // fuchsia
  "#0ea5e9", // sky
  "#3b82f6", // blue
  "#f97316", // orange
  "#8b5cf6", // violet
  "#f43f5e", // rose
  "#22c55e", // green
  "#f59e0b", // amber
  "#64748b", // slate
  "#6b7280", // gray
  "#737373", // neutral
  "#78716c", // stone
];

export function getRandomColor(): string {
  return predefinedColors[Math.floor(Math.random() * predefinedColors.length)];
}

export function getColorsForCategories(categories: string[]): string[] {
  if (categories.length <= predefinedColors.length) {
    return predefinedColors.slice(0, categories.length);
  }
  const colors: string[] = [...predefinedColors];
  while (colors.length < categories.length) {
    colors.push(getRandomColor());
  }
  return colors;
}
