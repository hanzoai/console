import { forwardRef } from "react";
import type { LucideIcon, LucideProps } from "lucide-react";

import {
  RotateCcw as RotateCcwIcon,
  ArrowLeft as ArrowLeftIcon,
  ArrowDown as ArrowDownIcon,
  ArrowUp as ArrowUpIcon,
  ArrowUpRight as ArrowUpRightIcon,
  ArrowUpDown as ArrowsDownUpIcon,
  Maximize2 as ArrowsOutSimpleIcon,
  Minimize2 as ArrowsInSimpleIcon,
  Crosshair as CrosshairSimpleIcon,
  Brain as CognitivePhosphorIcon,
  Braces as BracketsCurlyIcon,
  Shrink as CornersInIcon,
  Radio as BroadcastIcon,
  Calendar as CalendarIcon,
  ChevronDown as CaretDownIcon,
  ChevronLeft as CaretLeftIcon,
  ChevronRight as CaretRightIcon,
  ChevronUp as CaretUpIcon,
  TrendingUp as ChartLineUpIcon,
  BarChart3 as ChartBarIcon,
  CheckCircle2 as CheckCircleIcon,
  MessageCircle as ChatCircleDotsIcon,
  Clock as ClockIcon,
  RotateCw as ClockClockwiseIcon,
  History as ClockCounterClockwiseIcon,
  Copy as CopySimpleIcon,
  Cpu as CpuIcon,
  CircleDashed as CircleDashedIcon,
  Circle as CircleIcon,
  Cloud as CloudIcon,
  CloudOff as CloudSlashIcon,
  Database as DatabaseIcon,
  Download as DownloadSimpleIcon,
  Eye as EyeIcon,
  EyeOff as EyeSlashIcon,
  Filter as FunnelIcon,
  SlidersHorizontal as FunnelSimpleIcon,
  FunctionSquare as FunctionIcon,
  Settings as GearSixIcon,
  Globe as GlobeHemisphereWestIcon,
  IdCard as IdentificationBadgeIcon,
  Zap as LightningIcon,
  Search as MagnifyingGlassIcon,
  Link as LinkSimpleIcon,
  ListChecks as ListChecksIcon,
  List as ListBulletsIcon,
  CirclePause as PauseCircleIcon,
  Package as PackagePhosphorIcon,
  Play as PlayIcon,
  Quote as QuotesIcon,
  Workflow as FlowArrowIcon,
  Activity as PulseIcon,
  CircleHelp as QuestionIcon,
  Rocket as RocketLaunchIcon,
  Bot as RobotIcon,
  Bug as BugIcon,
  ShieldCheck as ShieldCheckIcon,
  Shield as ShieldIcon,
  Loader2 as SpinnerGapIcon,
  Share2 as ShareNetworkIcon,
  PanelLeft as SidebarSimpleIcon,
  Layers as StackIcon,
  LayoutGrid as SquaresFourIcon,
  Grid3x3 as GridFourIcon,
  Tag as TagIcon,
  Timer as TimerIcon,
  Wrench as WrenchIcon,
  User as UserIcon,
  CircleUser as UserCircleIcon,
  Users as UsersThreeIcon,
  CircleAlert as WarningCircleIcon,
  AlertTriangle as WarningDiamondIcon,
  Check as CheckIcon,
  TriangleAlert as WarningIcon,
  OctagonAlert as WarningOctagonIcon,
  CircleX as XCircleIcon,
  X as XIcon,
  GitBranch as GitBranchIcon,
  Github as GithubLogoIcon,
  FileCode as FileCodeIcon,
  FileText as FileTextIcon,
  ExternalLink as ArrowSquareOutIcon,
  Terminal as TerminalWindowIcon,
  Wifi as WifiHighIcon,
  WifiOff as WifiSlashIcon,
  Plus as PlusIcon,
  RefreshCw as ArrowsClockwiseIcon,
  FoldVertical as ArrowsInLineVerticalIcon,
  UnfoldVertical as ArrowsOutLineVerticalIcon,
  Trash2 as TrashIcon,
  Square as StopIcon,
  Info as InfoIcon,
  Hash as HashIcon,
  Target as TargetIcon,
  Gauge as GaugeIcon,
  GitCommitHorizontal as GitCommitIcon,
  Upload as UploadSimpleIcon,
  Save as FloppyDiskIcon,
  TrendingUp as TrendUpIcon,
  TrendingDown as TrendDownIcon,
  Minus as MinusIcon,
  Scan as ScanIcon,
  MoreHorizontal as DotsThreeIcon,
  Type as TextTIcon,
  SortAsc as SortAscendingIcon,
  SortDesc as SortDescendingIcon,
  Table as TableIcon,
  Network as TreeStructureIcon,
  Sun as SunIcon,
  Moon as MoonIcon,
  Monitor as MonitorIcon,
} from "lucide-react";

const ArrowCounterClockwiseIcon = RotateCcwIcon;

/** Backward-compatible icon weight type (lucide doesn't use weights, kept for API compat) */
export type IconWeight = "thin" | "light" | "regular" | "bold" | "fill" | "duotone";

/** Extended props that accept the phosphor weight param for backward compat */
export type IconComponentProps = LucideProps & { weight?: IconWeight; size?: number | string };

/** Icon component type compatible with both phosphor and lucide APIs */
export type IconComponent = LucideIcon;
export type Icon = LucideIcon;

/**
 * Wrap a lucide icon with default props. For "fill" weight, applies
 * fill="currentColor" + strokeWidth={0} to approximate phosphor's filled variant.
 */
const withDefaults = (
  Component: LucideIcon,
  defaults?: Partial<IconComponentProps>,
  displayName?: string,
) => {
  const isFilled = defaults?.weight === "fill";
  const Wrapped = forwardRef<SVGSVGElement, IconComponentProps>(
    ({ weight: _weight, ...props }, ref) => (
      <Component
        ref={ref}
        {...(isFilled ? { fill: "currentColor", strokeWidth: 0 } : {})}
        {...props}
      />
    ),
  ) as unknown as LucideIcon;
  Wrapped.displayName = displayName ?? Component.displayName ?? Component.name;
  return Wrapped;
};

// ── Activity / Status ──────────────────────────────────────
export const Activity = PulseIcon;
export const Pulse = PulseIcon;
export const AlertTriangle = WarningIcon;
export const Analytics = ChartLineUpIcon;
export const TrendingUp = TrendUpIcon;
export const TrendingDown = TrendDownIcon;
export const Bot = RobotIcon;

// ── Arrows / Navigation ───────────────────────────────────
export const ArrowLeft = ArrowLeftIcon;
export const ArrowDown = ArrowDownIcon;
export const ArrowUp = ArrowUpIcon;
export const ArrowUpDown = ArrowsDownUpIcon;
export const ArrowUpRight = ArrowUpRightIcon;
export const ArrowCounterClockwise = ArrowCounterClockwiseIcon;
export const ArrowSquareOut = ArrowSquareOutIcon;
export const ArrowsOutSimple = ArrowsOutSimpleIcon;

// ── Calendar / Time ────────────────────────────────────────
export const Calendar = CalendarIcon;
export const Time = ClockIcon;
export const Clock = ClockIcon;
export const ClockClockwise = ClockClockwiseIcon;
export const Timer = TimerIcon;
export const RecentlyViewed = ClockCounterClockwiseIcon;
export const Events = CalendarIcon;

// ── Chat / Messaging ──────────────────────────────────────
export const Chat = ChatCircleDotsIcon;
export const MessageSquare = ChatCircleDotsIcon;

// ── Check / Success ───────────────────────────────────────
export const Checkmark = CheckIcon;
export const CheckmarkFilled = withDefaults(CheckCircleIcon, { weight: "fill" }, "CheckmarkFilled");
export const CheckCircle = CheckCircleIcon;
export const Check = CheckIcon;
export const CircleCheck = CheckCircleIcon;
export const CheckCircle2 = CheckCircleIcon;

// ── Chevrons / Carets ─────────────────────────────────────
export const ChevronDown = CaretDownIcon;
export const ChevronLeft = CaretLeftIcon;
export const ChevronRight = CaretRightIcon;
export const ChevronUp = CaretUpIcon;
export const CaretDown = CaretDownIcon;
export const CaretRight = CaretRightIcon;
export const CaretUp = CaretUpIcon;

// ── Close / Error ─────────────────────────────────────────
export const Close = XIcon;
export const CloseFilled = withDefaults(XCircleIcon, { weight: "fill" }, "CloseFilled");
export const ErrorFilled = withDefaults(XCircleIcon, { weight: "fill" }, "ErrorFilled");
export const CircleX = XCircleIcon;
export const X = XIcon;
export const XCircle = XCircleIcon;

// ── Code / Development ────────────────────────────────────
export const Code = BracketsCurlyIcon;
export const Braces = BracketsCurlyIcon;
export const BracketsCurly = BracketsCurlyIcon;
export const Function = FunctionIcon;
export const FileText = FileTextIcon;
export const FileJson = FileCodeIcon;
export const Document = FileTextIcon;
export const Terminal = TerminalWindowIcon;
export const Bug = BugIcon;
export const GitBranch = GitBranchIcon;
export const GitCommit = GitCommitIcon;
export const GithubLogo = GithubLogoIcon;
export const Wrench = WrenchIcon;

// ── Copy ──────────────────────────────────────────────────
export const Copy = CopySimpleIcon;
export const CopySimple = CopySimpleIcon;

// ── Data & Analytics ──────────────────────────────────────
export const BarChart3 = ChartBarIcon;
export const Dashboard = SquaresFourIcon;
export const Grid = SquaresFourIcon;
export const SquaresFour = SquaresFourIcon;
export const GridFour = GridFourIcon;
export const Table = TableIcon;
export const TreeStructure = TreeStructureIcon;
export const SortAscending = SortAscendingIcon;
export const SortDescending = SortDescendingIcon;

// ── Database / Storage ────────────────────────────────────
export const Chip = CpuIcon;
export const Cpu = CpuIcon;
export const DataBase = DatabaseIcon;
export const Database = DatabaseIcon;
export const Layers = StackIcon;
export const Stack = StackIcon;
export const Server = StackIcon;
export const Package = PackagePhosphorIcon;
export const PackageIcon = PackagePhosphorIcon;

// ── Filter / Search ───────────────────────────────────────
export const Filter = FunnelIcon;
export const FunnelSimple = FunnelSimpleIcon;
export const Search = MagnifyingGlassIcon;
export const Scan = ScanIcon;

// ── Info / Help ───────────────────────────────────────────
export const Info = InfoIcon;
export const Information = InfoIcon;
export const Unknown = QuestionIcon;
export const Question = QuestionIcon;

// ── Layout / Window ───────────────────────────────────────
export const CornersIn = CornersInIcon;
export const Maximize = ArrowsOutSimpleIcon;
export const Maximize2 = ArrowsOutSimpleIcon;
export const Minimize = ArrowsInSimpleIcon;
export const Minimize2 = ArrowsInSimpleIcon;
export const Focus = CrosshairSimpleIcon;
export const CollapseAll = ArrowsInLineVerticalIcon;
export const ExpandAll = ArrowsOutLineVerticalIcon;
export const PanelLeft = SidebarSimpleIcon;

// ── Light / Theme ─────────────────────────────────────────
export const Flash = LightningIcon;
export const Zap = LightningIcon;
export const Sun = SunIcon;
export const Moon = MoonIcon;
export const Monitor = MonitorIcon;

// ── Links / Sharing ───────────────────────────────────────
export const Link = LinkSimpleIcon;
export const ExternalLink = ArrowSquareOutIcon;
export const Network_3 = ShareNetworkIcon;
export const ShareNetwork = ShareNetworkIcon;
export const Share2 = ShareNetworkIcon;

// ── List ──────────────────────────────────────────────────
export const List = ListBulletsIcon;
export const Checklist = ListChecksIcon;
export const MoreHorizontal = DotsThreeIcon;

// ── Misc ──────────────────────────────────────────────────
export const Cognitive = CognitivePhosphorIcon;
export const WatsonxAi = CognitivePhosphorIcon;
export const FlowArrow = FlowArrowIcon;
export const Gauge = GaugeIcon;
export const GaugeCircle = GaugeIcon;
export const Hash = HashIcon;
export const Tag = TagIcon;
export const Target = TargetIcon;
export const LocateFixed = TargetIcon;
export const Type = TextTIcon;
export const Quote = QuotesIcon;

// ── Network / Cloud ───────────────────────────────────────
export const Cloud = CloudIcon;
export const CloudOffline = CloudSlashIcon;
export const ServerProxy = CloudIcon;
export const RadioTower = BroadcastIcon;
export const Earth = GlobeHemisphereWestIcon;
export const Wifi = WifiHighIcon;
export const WifiHigh = WifiHighIcon;
export const WifiOff = WifiSlashIcon;
export const WifiSlash = WifiSlashIcon;

// ── Playback / Controls ───────────────────────────────────
export const Play = PlayIcon;
export const PauseFilled = withDefaults(PauseCircleIcon, { weight: "fill" }, "PauseFilled");
export const PauseCircle = PauseCircleIcon;
export const Stop = StopIcon;
export const Plus = PlusIcon;
export const Minus = MinusIcon;

// ── Refresh / Reset ───────────────────────────────────────
export const Reset = ArrowCounterClockwiseIcon;
export const RotateCcw = RotateCcwIcon;
export const RefreshCw = ArrowsClockwiseIcon;
export const ArrowClockwise = ArrowsClockwiseIcon;
export const Renew = ArrowsClockwiseIcon;
export const Restart = ArrowsClockwiseIcon;

// ── Security / Auth ───────────────────────────────────────
export const Security = ShieldCheckIcon;
export const ShieldCheck = ShieldCheckIcon;
export const Shield = ShieldIcon;
export const Identification = IdentificationBadgeIcon;

// ── Shapes / Circles ──────────────────────────────────────
export const CircleDash = CircleDashedIcon;
export const Circle = CircleIcon;
export const CircleFilled = withDefaults(CircleIcon, { weight: "fill" }, "CircleFilled");

// ── Spinner / Loading ─────────────────────────────────────
export const InProgress = SpinnerGapIcon;
export const Loader = SpinnerGapIcon;
export const Loader2 = SpinnerGapIcon;
export const SpinnerGap = SpinnerGapIcon;

// ── File Operations ───────────────────────────────────────
export const Download = DownloadSimpleIcon;
export const DownloadSimple = DownloadSimpleIcon;
export const Upload = UploadSimpleIcon;
export const UploadSimple = UploadSimpleIcon;
export const Save = FloppyDiskIcon;
export const Trash = TrashIcon;
export const TrashCan = TrashIcon;

// ── Tools / Settings ──────────────────────────────────────
export const Settings = GearSixIcon;
export const Cog = GearSixIcon;
export const Tools = WrenchIcon;
export const Launch = RocketLaunchIcon;

// ── User ──────────────────────────────────────────────────
export const User = UserIcon;
export const UserCircle = UserCircleIcon;
export const Users = UsersThreeIcon;

// ── Visibility ────────────────────────────────────────────
export const View = EyeIcon;
export const Eye = EyeIcon;
export const EyeOff = EyeSlashIcon;

// ── Warning ───────────────────────────────────────────────
export const Warning = WarningIcon;
export const WarningAlt = WarningCircleIcon;
export const WarningCircle = WarningCircleIcon;
export const WarningDiamond = WarningDiamondIcon;
export const WarningOctagon = WarningOctagonIcon;
export const AlertCircle = WarningCircleIcon;
export const WarningAltFilled = withDefaults(WarningCircleIcon, { weight: "fill" }, "WarningAltFilled");
export const WarningFilled = withDefaults(WarningOctagonIcon, { weight: "fill" }, "WarningFilled");
