import {
  CheckmarkFilled,
  ChevronDown,
  ChevronUp,
  Download,
  ErrorFilled,
  InProgress,
  Link,
  Security,
  Time,
} from "@/src/features/agents/components/ui/icon-bridge";
import { useState } from "react";
import { cn } from "../../lib/utils";
import { normalizeExecutionStatus } from "../../utils/status";
import { exportWorkflowComplianceReport } from "../../services/vcApi";
import type { WorkflowVCChainResponse } from "../../types/did";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import { Separator } from "../ui/separator";
import { Skeleton } from "../ui/skeleton";
import { VCVerificationCard } from "./VCVerificationCard";

interface WorkflowVCChainProps {
  workflowId: string;
  vcChain?: WorkflowVCChainResponse;
  loading?: boolean;
  className?: string;
}

export function WorkflowVCChain({
  workflowId,
  vcChain,
  loading = false,
  className = "",
}: WorkflowVCChainProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  if (loading) {
    return (
      <Card className={cn("card-foundation", className)}>
        <CardHeader className="foundation-spacing-card">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div>
              <CardTitle className="text-heading-3 text-primary-foundation">
                Workflow Verification Chain
              </CardTitle>
              <p className="text-sm text-tertiary-foundation mt-1">
                Loading verification chain...
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="foundation-spacing-card">
          <div className="space-y-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-8" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!vcChain) {
    return (
      <Card className={cn("card-foundation", className)}>
        <CardHeader className="foundation-spacing-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-950/20">
              <Security size={20} className="text-gray-400" />
            </div>
            <div>
              <CardTitle className="text-heading-3 text-primary-foundation">
                Workflow Verification Chain
              </CardTitle>
              <p className="text-sm text-tertiary-foundation mt-1">
                No verification chain available for this workflow.
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  const getChainStatusConfig = () => {
    const completedVCs = vcChain.component_vcs?.filter(
      (vc) => normalizeExecutionStatus(vc.status) === "succeeded"
    ).length || 0;
    const totalVCs = vcChain.component_vcs?.length || 0;
    const hasFailures = vcChain.component_vcs?.some(
      (vc) => normalizeExecutionStatus(vc.status) === "failed"
    ) || false;

    if (hasFailures) {
      return {
        variant: "destructive" as const,
        label: "Chain Broken",
        icon: ErrorFilled,
        className:
          "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800",
        description: "One or more verifications in the chain have failed.",
      };
    }

    if (completedVCs === totalVCs && totalVCs > 0) {
      return {
        variant: "default" as const,
        label: "Chain Complete",
        icon: CheckmarkFilled,
        className:
          "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800",
        description: "All executions in the workflow are verified.",
      };
    }

    if (completedVCs > 0) {
      return {
        variant: "secondary" as const,
        label: "Chain In Progress",
        icon: InProgress,
        className:
          "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-800",
        description: "Workflow verification is in progress.",
      };
    }

    return {
      variant: "outline" as const,
      label: "Chain Pending",
      icon: Time,
      className:
        "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-800",
      description: "Workflow verification has not started.",
    };
  };

  const config = getChainStatusConfig();
  const completedVCs = vcChain.component_vcs?.filter(
    (vc) => normalizeExecutionStatus(vc.status) === "succeeded"
  ).length || 0;
  const totalVCs = vcChain.component_vcs?.length || 0;
  const progress = totalVCs > 0 ? (completedVCs / totalVCs) * 100 : 0;

  const handleExportCompliance = async (format: "json" | "csv") => {
    setIsExporting(true);
    try {
      await exportWorkflowComplianceReport(workflowId, format);
    } catch (error) {
      console.error("Failed to export compliance report:", error);
    } finally {
      setIsExporting(false);
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
                Workflow Verification Chain
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
        {/* Progress Overview */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-tertiary-foundation">
              Verification Progress
            </span>
            <span className="text-secondary-foundation font-medium">
              {completedVCs}/{totalVCs} verified
            </span>
          </div>

          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.max(progress, 2)}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-heading-3 text-primary-foundation">
                {totalVCs}
              </div>
              <div className="text-xs text-tertiary-foundation">Total VCs</div>
            </div>
            <div>
              <div className="text-heading-3 text-green-600">
                {completedVCs}
              </div>
              <div className="text-xs text-tertiary-foundation">Verified</div>
            </div>
            <div>
              <div className="text-heading-3 text-red-600">
                {
                  vcChain.component_vcs?.filter((vc) => vc.status === "failed")
                    .length || 0
                }
              </div>
              <div className="text-xs text-tertiary-foundation">Failed</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExportCompliance("json")}
            disabled={isExporting}
            className="foundation-focus"
          >
            <Download size={14} className="mr-2" />
            Export JSON
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExportCompliance("csv")}
            disabled={isExporting}
            className="foundation-focus"
          >
            <Download size={14} className="mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Workflow VC Details */}
        {vcChain.workflow_vc && (
          <div className="mb-6">
            <VCVerificationCard
              title="Workflow-Level Verification"
              hasVC={true}
              status={vcChain.workflow_vc.status}
              vcData={vcChain.workflow_vc}
              vcId={vcChain.workflow_vc.workflow_vc_id}
              createdAt={vcChain.workflow_vc.start_time}
              showDetails={false}
            />
          </div>
        )}

        {/* Component VCs */}
        {totalVCs > 0 && (
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between foundation-focus mb-4"
              >
                <span className="text-sm font-medium">
                  Component Verifications ({totalVCs})
                </span>
                {isExpanded ? (
                  <ChevronUp size={16} />
                ) : (
                  <ChevronDown size={16} />
                )}
              </Button>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <Separator className="mb-4" />

              <div className="space-y-4">
                {vcChain.component_vcs?.map((vc, index) => (
                  <div key={vc.vc_id} className="relative">
                    {/* Connection line */}
                    {index < (vcChain.component_vcs?.length || 0) - 1 && (
                      <div className="absolute left-6 top-12 w-0.5 h-8 bg-border"></div>
                    )}

                    <div className="flex items-start gap-4">
                      {/* Step indicator */}
                      <div className="flex-shrink-0 w-12 h-12 rounded-full border-2 border-border bg-background flex items-center justify-center">
                        <span className="text-sm font-medium text-secondary-foundation">
                          {index + 1}
                        </span>
                      </div>

                      {/* VC Card */}
                      <div className="flex-1">
                        <VCVerificationCard
                          title={`Execution ${vc.execution_id.slice(0, 8)}...`}
                          hasVC={true}
                          status={vc.status}
                          vcData={vc}
                          vcId={vc.vc_id}
                          createdAt={vc.created_at}
                          showDetails={false}
                          className="border-l-4 border-l-blue-200"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {totalVCs === 0 && (
          <div className="text-center py-6">
            <Link size={32} className="mx-auto text-gray-400 mb-3" />
            <p className="text-sm text-tertiary-foundation">
              No component verifications found for this workflow.
            </p>
            <p className="text-xs text-tertiary-foundation mt-1">
              VCs will appear here as executions complete.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
