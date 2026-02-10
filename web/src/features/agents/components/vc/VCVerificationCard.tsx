import {
  CheckmarkFilled,
  ChevronDown,
  ChevronUp,
  Copy,
  Document,
  Download,
  ErrorFilled,
  InProgress,
  Security,
  Time,
  View,
} from "@/src/features/agents/components/ui/icon-bridge";
import { useState } from "react";
import { cn } from "../../lib/utils";
import { normalizeExecutionStatus } from "../../utils/status";
import { copyVCToClipboard, downloadVCDocument } from "../../services/vcApi";
import type { ExecutionVC, WorkflowVC } from "../../types/did";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import { Separator } from "../ui/separator";

interface VCVerificationCardProps {
  title: string;
  hasVC: boolean;
  status: string;
  vcData?: ExecutionVC | WorkflowVC;
  vcId?: string;
  createdAt?: string;
  className?: string;
  showDetails?: boolean;
  onViewDetails?: () => void;
}

export function VCVerificationCard({
  title,
  hasVC,
  status,
  vcData,
  vcId,
  createdAt,
  className = "",
  showDetails = true,
  onViewDetails,
}: VCVerificationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const getStatusConfig = (status: string, hasVC: boolean) => {
    if (!hasVC) {
      return {
        variant: "outline" as const,
        label: "No Verification",
        icon: Document,
        className:
          "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-950/20 dark:text-gray-400 dark:border-gray-700",
        description:
          "No verifiable credential has been generated for this item.",
      };
    }

    const normalized = normalizeExecutionStatus(status);

    switch (normalized) {
      case "succeeded":
        return {
          variant: "default" as const,
          label: "Verified",
          icon: CheckmarkFilled,
          className:
            "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800",
          description: "Cryptographically verified and tamper-proof.",
        };
      case "running":
      case "queued":
      case "pending":
        return {
          variant: "secondary" as const,
          label: "Pending Verification",
          icon: Time,
          className:
            "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-800",
          description: "Verification is in progress.",
        };
      case "failed":
        return {
          variant: "destructive" as const,
          label: "Verification Failed",
          icon: ErrorFilled,
          className:
            "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800",
          description: "Verification could not be completed.",
        };
      default:
        return {
          variant: "outline" as const,
          label: normalized,
          icon: InProgress,
          className:
            "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-800",
          description: "Verification status unknown.",
        };
    }
  };

  const config = getStatusConfig(status, hasVC);

  const handleDownload = async () => {
    if (!vcData) return;

    setIsDownloading(true);
    try {
      await downloadVCDocument(vcData as ExecutionVC);
    } catch (error) {
      console.error("Failed to download VC:", error);
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
      console.error("Failed to copy VC:", error);
    } finally {
      setIsCopying(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Unknown";
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return "Invalid date";
    }
  };

  return (
    <Card className={cn("card-foundation", className)}>
      <CardHeader className="foundation-spacing-card pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20">
              <Security
                size={20}
                className="text-blue-600 dark:text-blue-400"
              />
            </div>
            <div>
              <CardTitle className="text-heading-3 text-primary-foundation">
                {title}
              </CardTitle>
              <p className="text-sm text-tertiary-foundation mt-1">
                {config.description}
              </p>
            </div>
          </div>

          <Badge
            variant={config.variant}
            className={cn("text-sm px-3 py-1", config.className)}
          >
            <config.icon size={14} className="mr-2" />
            {config.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="foundation-spacing-card pt-0">
        {hasVC && vcData && (
          <>
            {/* Quick Actions */}
            <div className="flex items-center gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={isDownloading}
                className="foundation-focus"
              >
                <Download size={14} className="mr-2" />
                {isDownloading ? "Downloading..." : "Download VC"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                disabled={isCopying}
                className="foundation-focus"
              >
                <Copy size={14} className="mr-2" />
                {isCopying ? "Copying..." : copySuccess ? "Copied!" : "Copy VC"}
              </Button>

              {onViewDetails && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onViewDetails}
                  className="foundation-focus"
                >
                  <View size={14} className="mr-2" />
                  View Details
                </Button>
              )}
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs font-medium text-tertiary-foundation uppercase tracking-wide">
                  VC ID
                </label>
                <p className="text-sm font-mono text-secondary-foundation mt-1 break-all">
                  {vcId || "Unknown"}
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-tertiary-foundation uppercase tracking-wide">
                  Created
                </label>
                <p className="text-sm text-secondary-foundation mt-1">
                  {formatDate(createdAt)}
                </p>
              </div>
            </div>

            {showDetails && (
              <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-between foundation-focus"
                  >
                    <span className="text-sm font-medium">
                      Technical Details
                    </span>
                    {isExpanded ? (
                      <ChevronUp size={16} />
                    ) : (
                      <ChevronDown size={16} />
                    )}
                  </Button>
                </CollapsibleTrigger>

                <CollapsibleContent className="mt-3">
                  <Separator className="mb-4" />

                  <div className="space-y-4">
                    {/* Execution-specific details */}
                    {"execution_id" in vcData && (
                      <div>
                        <label className="text-xs font-medium text-tertiary-foundation uppercase tracking-wide">
                          Execution ID
                        </label>
                        <p className="text-sm font-mono text-secondary-foundation mt-1 break-all">
                          {vcData.execution_id}
                        </p>
                      </div>
                    )}

                    {/* Workflow-specific details */}
                    {"workflow_id" in vcData && (
                      <div>
                        <label className="text-xs font-medium text-tertiary-foundation uppercase tracking-wide">
                          Workflow ID
                        </label>
                        <p className="text-sm font-mono text-secondary-foundation mt-1 break-all">
                          {vcData.workflow_id}
                        </p>
                      </div>
                    )}

                    {/* Execution VC specific details */}
                    {'caller_did' in vcData && (
                      <>
                        {/* DID Information */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-medium text-tertiary-foundation uppercase tracking-wide">
                              Caller DID
                            </label>
                            <p className="text-sm font-mono text-secondary-foundation mt-1 break-all">
                              {vcData.caller_did}
                            </p>
                          </div>

                          <div>
                            <label className="text-xs font-medium text-tertiary-foundation uppercase tracking-wide">
                              Target DID
                            </label>
                            <p className="text-sm font-mono text-secondary-foundation mt-1 break-all">
                              {vcData.target_did}
                            </p>
                          </div>
                        </div>

                        {/* Hash Information */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-medium text-tertiary-foundation uppercase tracking-wide">
                              Input Hash
                            </label>
                            <p className="text-sm font-mono text-secondary-foundation mt-1 break-all">
                              {vcData.input_hash}
                            </p>
                          </div>

                          <div>
                            <label className="text-xs font-medium text-tertiary-foundation uppercase tracking-wide">
                              Output Hash
                            </label>
                            <p className="text-sm font-mono text-secondary-foundation mt-1 break-all">
                              {vcData.output_hash}
                            </p>
                          </div>
                        </div>

                        {/* Signature */}
                        <div>
                          <label className="text-xs font-medium text-tertiary-foundation uppercase tracking-wide">
                            Digital Signature
                          </label>
                          <p className="text-sm font-mono text-secondary-foundation mt-1 break-all bg-gray-50 dark:bg-gray-900 p-2 rounded border">
                            {vcData.signature}
                          </p>
                        </div>
                      </>
                    )}

                    {/* Workflow VC specific details */}
                    {'component_vcs' in vcData && (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-medium text-tertiary-foundation uppercase tracking-wide">
                              Component VCs
                            </label>
                            <p className="text-sm text-secondary-foundation mt-1">
                              {vcData.component_vcs.length} execution VCs
                            </p>
                          </div>

                          <div>
                            <label className="text-xs font-medium text-tertiary-foundation uppercase tracking-wide">
                              Progress
                            </label>
                            <p className="text-sm text-secondary-foundation mt-1">
                              {vcData.completed_steps}/{vcData.total_steps} steps
                            </p>
                          </div>
                        </div>

                        {vcData.start_time && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs font-medium text-tertiary-foundation uppercase tracking-wide">
                                Start Time
                              </label>
                              <p className="text-sm text-secondary-foundation mt-1">
                                {formatDate(vcData.start_time)}
                              </p>
                            </div>

                            {vcData.end_time && (
                              <div>
                                <label className="text-xs font-medium text-tertiary-foundation uppercase tracking-wide">
                                  End Time
                                </label>
                                <p className="text-sm text-secondary-foundation mt-1">
                                  {formatDate(vcData.end_time)}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </>
        )}

        {!hasVC && (
          <div className="text-center py-6">
            <Document size={32} className="mx-auto text-gray-400 mb-3" />
            <p className="text-sm text-tertiary-foundation">
              No verifiable credential available for this item.
            </p>
            <p className="text-xs text-tertiary-foundation mt-1">
              VCs are generated automatically when executions complete
              successfully.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
