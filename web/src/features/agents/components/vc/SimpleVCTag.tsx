import { CheckmarkFilled, Copy, Download, ErrorFilled, Time, PauseFilled } from "@/src/features/agents/components/ui/icon-bridge";
import { useState } from "react";
import { cn } from "../../lib/utils";
import { normalizeExecutionStatus } from "../../utils/status";
import { copyVCToClipboard, downloadVCDocument, exportWorkflowComplianceReport } from "../../services/vcApi";
import type { ExecutionVC, WorkflowVC } from "../../types/did";
import { Button } from "../ui/button";

interface SimpleVCTagProps {
  hasVC: boolean;
  status: string;
  vcData?: ExecutionVC | WorkflowVC;
  workflowId?: string; // For workflow-level VCs
  className?: string;
}

export function SimpleVCTag({
  hasVC,
  status,
  vcData,
  workflowId,
  className = "",
}: SimpleVCTagProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const getStatusConfig = (status: string, hasVC: boolean) => {
    if (!hasVC) {
      return {
        label: "No Verification",
        icon: null,
        className: "bg-gray-900/40 text-gray-400 border-gray-700/50",
        showActions: false,
      };
    }

    const normalized = normalizeExecutionStatus(status);

    switch (normalized) {
      case "succeeded":
        return {
          label: "Verified",
          icon: CheckmarkFilled,
          className: "bg-green-900/40 text-green-400 border-green-700/50",
          showActions: true,
        };
      case "running":
      case "queued":
      case "pending":
        return {
          label: "Pending",
          icon: Time,
          className: "bg-yellow-900/40 text-yellow-400 border-yellow-700/50",
          showActions: false,
        };
      case "failed":
        return {
          label: "Failed",
          icon: ErrorFilled,
          className: "bg-red-900/40 text-red-400 border-red-700/50",
          showActions: false,
        };
      case "cancelled":
        return {
          label: "Cancelled",
          icon: PauseFilled,
          className: "bg-gray-900/40 text-gray-400 border-gray-700/50",
          showActions: false,
        };
      case "timeout":
        return {
          label: "Timed Out",
          icon: Time,
          className: "bg-purple-900/40 text-purple-400 border-purple-700/50",
          showActions: false,
        };
      default:
        return {
          label: "Unknown",
          icon: null,
          className: "bg-gray-900/40 text-gray-400 border-gray-700/50",
          showActions: false,
        };
    }
  };

  const config = getStatusConfig(status, hasVC);

  const handleDownload = async () => {
    if (!vcData && !workflowId) return;

    setIsDownloading(true);
    try {
      if (workflowId) {
        // Download workflow compliance report
        await exportWorkflowComplianceReport(workflowId, "json");
      } else if (vcData) {
        // Download individual VC
        await downloadVCDocument(vcData as ExecutionVC);
      }
    } catch (error) {
      console.error("Failed to download:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopy = async () => {
    if (!vcData) return;

    setIsCopying(true);
    try {
      const success = await copyVCToClipboard(vcData as ExecutionVC);
      if (success) {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      }
    } catch (error) {
      console.error("Failed to copy:", error);
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      {/* Status Tag */}
      <div
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-colors",
          config.className
        )}
      >
        {config.icon && <config.icon size={12} />}
        {config.label}
      </div>

      {/* Action Buttons */}
      {config.showActions && (vcData || workflowId) && (
        <div className="inline-flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            disabled={isDownloading}
            className="h-7 w-7 p-0 text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 transition-colors"
            title="Download VC"
          >
            <Download size={12} />
          </Button>

          {vcData && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              disabled={isCopying}
              className="h-7 w-7 p-0 text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 transition-colors"
              title={copySuccess ? "Copied!" : "Copy VC"}
            >
              <Copy size={12} />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
