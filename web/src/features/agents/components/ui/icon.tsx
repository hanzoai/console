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
  Bot,
  Users,
} from "@/src/features/agents/components/ui/icon-bridge";
import type { IconComponent } from "@/src/features/agents/components/ui/icon-bridge";

const icons = {
  activity: Pulse,
  bot: Bot,
  dashboard: SquaresFour,
  "data-center": Stack,
  function: Cpu,
  run: Play,
  "flow-data": FlowArrow,
  settings: Settings,
  user: UserCircle,
  users: Users,
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
}

export function Icon({ name, className, size = 16 }: IconProps) {
  const Component = icons[name] as IconComponent;

  if (!Component) {
    console.warn(`Icon "${name}" not found`);
    return null;
  }

  return <Component className={cn("shrink-0", className)} size={size} />;
}
