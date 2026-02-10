import { cn } from "../../lib/utils";
import {
  SquaresFour,
  Stack,
  Cpu,
  Play,
  FlowArrow,
  Settings,
  UserCircle,
  GridFour,
  Package,
  Pulse,
  Sun,
  Moon,
  Monitor,
  ShieldCheck,
  Identification,
  FileText,
  GithubLogo,
  Question,
} from "@/src/features/agents/components/ui/icon-bridge";
import type { IconComponent, IconWeight } from "@/src/features/agents/components/ui/icon-bridge";

const icons = {
  activity: Pulse,
  dashboard: SquaresFour,
  "data-center": Stack,
  function: Cpu,
  run: Play,
  "flow-data": FlowArrow,
  settings: Settings,
  user: UserCircle,
  grid: GridFour,
  package: Package,
  sun: Sun,
  moon: Moon,
  monitor: Monitor,
  "shield-check": ShieldCheck,
  identification: Identification,
  documentation: FileText,
  github: GithubLogo,
  support: Question,
} as const;

export interface IconProps {
  name: keyof typeof icons;
  className?: string;
  size?: number;
  weight?: IconWeight;
}

export function Icon({ name, className, size = 16, weight = "regular" }: IconProps) {
  const IconComponent = icons[name] as IconComponent;

  if (!IconComponent) {
    console.warn(`Icon "${name}" not found`);
    return null;
  }

  return (
    <IconComponent
      className={cn("shrink-0", className)}
      size={size}
      weight={weight}
    />
  );
}
