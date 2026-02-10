import type { VCStatusSummary } from "../../types/did";
import { normalizeExecutionStatus } from "../../utils/status";
import { Badge } from "../ui/badge";
import {
  CheckmarkFilled,
  Time,
  ErrorFilled,
  Document,
  View,
  Download,
  Link,
  InProgress,
  WarningFilled
} from "@/src/features/agents/components/ui/icon-bridge";

interface VCStatusIndicatorProps {
  status: VCStatusSummary;
  showDetails?: boolean;
  onClick?: () => void;
  className?: string;
}

export function VCStatusIndicator({
  status,
  showDetails = true,
  onClick,
  className = "",
}: VCStatusIndicatorProps) {
  const getStatusConfig = (
    verificationStatus: VCStatusSummary["verification_status"]
  ) => {
    switch (verificationStatus) {
      case "verified":
        return {
          variant: "default" as const,
          label: "Verified",
          icon: CheckmarkFilled,
          className: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800",
        };
      case "pending":
        return {
          variant: "secondary" as const,
          label: "Pending",
          icon: Time,
          className: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-800",
        };
      case "failed":
        return {
          variant: "destructive" as const,
          label: "Failed",
          icon: ErrorFilled,
          className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800",
        };
      case "none":
      default:
        return {
          variant: "outline" as const,
          label: "No VCs",
          icon: Document,
          className: "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-950/20 dark:text-gray-400 dark:border-gray-700",
        };
    }
  };

  const config = getStatusConfig(status.verification_status);
  const isClickable = onClick !== undefined;

  const formatLastUpdate = (dateString: string) => {
    if (!dateString) return "Never";

    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString();
    } catch {
      return "Unknown";
    }
  };

  if (!showDetails) {
    return (
      <Badge
        variant={config.variant}
        className={`${config.className} ${
          isClickable ? "cursor-pointer hover:opacity-80" : ""
        } ${className}`}
        onClick={onClick}
      >
        <config.icon size={12} className="mr-1" />
        {config.label}
      </Badge>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2 ${
        isClickable ? "cursor-pointer" : ""
      } ${className}`}
      onClick={onClick}
    >
      <Badge
        variant={config.variant}
        className={`${config.className} ${
          isClickable ? "hover:opacity-80" : ""
        }`}
      >
        <config.icon size={12} className="mr-1" />
        {config.label}
      </Badge>

      {status.has_vcs && (
        <>
          <Badge
            variant="outline"
            className="text-xs bg-blue-50 text-blue-700 border-blue-200"
          >
            {status.vc_count} VCs
          </Badge>

          {status.verification_status === "verified" &&
            status.verified_count !== status.vc_count && (
              <Badge
                variant="outline"
                className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200"
              >
                {status.verified_count}/{status.vc_count} verified
              </Badge>
            )}

          <span className="text-xs text-gray-500">
            Last: {formatLastUpdate(status.last_vc_created)}
          </span>
        </>
      )}
    </div>
  );
}

interface ExecutionVCStatusProps {
  hasVC: boolean;
  status: string;
  vcId?: string;
  createdAt?: string;
  onViewVC?: () => void;
  onDownloadVC?: () => void;
  className?: string;
}

export function ExecutionVCStatus({
  hasVC,
  status,
  vcId,
  onViewVC,
  onDownloadVC,
  className = "",
}: ExecutionVCStatusProps) {
  if (!hasVC) {
    return (
      <Badge
        variant="outline"
        className={`text-xs bg-gray-50 text-gray-600 dark:bg-gray-950/20 dark:text-gray-400 dark:border-gray-700 ${className}`}
      >
        <Document size={12} className="mr-1" />
        No VC
      </Badge>
    );
  }

  const getStatusConfig = (status: string) => {
    const normalized = normalizeExecutionStatus(status);
    switch (normalized) {
      case "succeeded":
        return {
          variant: "default" as const,
          label: "Verified",
          icon: CheckmarkFilled,
          className: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800",
        };
      case "running":
      case "queued":
      case "pending":
        return {
          variant: "secondary" as const,
          label: "Pending",
          icon: Time,
          className: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-800",
        };
      case "failed":
        return {
          variant: "destructive" as const,
          label: "Failed",
          icon: ErrorFilled,
          className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800",
        };
      case "cancelled":
        return {
          variant: "outline" as const,
          label: "Cancelled",
          icon: Document,
          className: "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-950/20 dark:text-gray-400 dark:border-gray-700",
        };
      case "timeout":
        return {
          variant: "outline" as const,
          label: "Timed Out",
          icon: Time,
          className: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-800",
        };
      default:
        return {
          variant: "outline" as const,
          label: normalized,
          icon: Document,
          className: "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-950/20 dark:text-gray-400 dark:border-gray-700",
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <Badge
        variant={config.variant}
        className={`${config.className} text-xs`}
        title={vcId ? `VC ID: ${vcId}` : undefined}
      >
        <config.icon size={12} className="mr-1" />
        {config.label}
      </Badge>

      {(onViewVC || onDownloadVC) && (
        <div className="inline-flex items-center gap-1">
          {onViewVC && (
            <button
              onClick={onViewVC}
              className="p-1 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
              title="View VC details"
              aria-label="View VC details"
            >
              <View size={12} />
            </button>
          )}

          {onDownloadVC && (
            <button
              onClick={onDownloadVC}
              className="p-1 text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 transition-colors"
              title="Download VC"
              aria-label="Download VC"
            >
              <Download size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface VCChainStatusProps {
  totalSteps: number;
  completedSteps: number;
  status: string;
  onViewChain?: () => void;
  className?: string;
}

export function VCChainStatus({
  totalSteps,
  completedSteps,
  status,
  onViewChain,
  className = "",
}: VCChainStatusProps) {
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
  const isComplete = completedSteps === totalSteps && totalSteps > 0;

  const getChainStatusConfig = (status: string, isComplete: boolean) => {
    if (isComplete) {
      return {
        variant: "default" as const,
        label: "Complete",
        icon: CheckmarkFilled,
        className: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800",
      };
    }

    switch (status.toLowerCase()) {
      case "running":
      case "processing":
        return {
          variant: "secondary" as const,
          label: "In Progress",
          icon: InProgress,
          className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-800",
        };
      case "failed":
      case "error":
        return {
          variant: "destructive" as const,
          label: "Failed",
          icon: WarningFilled,
          className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800",
        };
      default:
        return {
          variant: "outline" as const,
          label: status,
          icon: Link,
          className: "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-950/20 dark:text-gray-400 dark:border-gray-700",
        };
    }
  };

  const config = getChainStatusConfig(status, isComplete);

  return (
    <div
      className={`inline-flex items-center gap-2 ${
        onViewChain ? "cursor-pointer" : ""
      } ${className}`}
      onClick={onViewChain}
    >
      <Badge
        variant={config.variant}
        className={`${config.className} ${
          onViewChain ? "hover:opacity-80" : ""
        }`}
      >
        <config.icon size={12} className="mr-1" />
        {config.label}
      </Badge>

      <div className="flex items-center gap-1">
        <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isComplete
                ? "bg-green-500 dark:bg-green-400"
                : progress > 0
                ? "bg-blue-500 dark:bg-blue-400"
                : "bg-gray-300 dark:bg-gray-600"
            }`}
            style={{ width: `${Math.max(progress, 5)}%` }}
          />
        </div>
        <span className="text-xs text-gray-600 dark:text-gray-400">
          {completedSteps}/{totalSteps}
        </span>
      </div>
    </div>
  );
}
