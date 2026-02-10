import { Loader2 } from "@/src/features/agents/components/ui/icon-bridge";
import type { WorkflowVCChainResponse } from "../../types/did";
import { normalizeExecutionStatus } from "../../utils/status";
import { VerifiableCredentialBadge } from "./VerifiableCredentialBadge";

interface SimpleWorkflowVCProps {
  workflowId: string;
  vcChain?: WorkflowVCChainResponse;
  loading?: boolean;
  className?: string;
}

export function SimpleWorkflowVC({
  workflowId,
  vcChain,
  loading = false,
  className = "",
}: SimpleWorkflowVCProps) {
  if (loading) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <span className="text-sm font-medium text-muted-foreground">Workflow Verification:</span>
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-body-small">Loading...</span>
        </div>
      </div>
    );
  }

  if (!vcChain) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <span className="text-sm font-medium text-muted-foreground">Workflow Verification:</span>
        <VerifiableCredentialBadge
          hasVC={false}
          status="none"
        />
      </div>
    );
  }

  // Determine overall workflow status
  const completedVCs = vcChain.component_vcs?.filter(
    (vc) => normalizeExecutionStatus(vc.status) === "succeeded"
  ).length || 0;
  const totalVCs = vcChain.component_vcs?.length || 0;
  const hasFailures = vcChain.component_vcs?.some(
    (vc) => normalizeExecutionStatus(vc.status) === "failed"
  ) || false;

  let overallStatus = "none";
  if (hasFailures) {
    overallStatus = "failed";
  } else if (completedVCs === totalVCs && totalVCs > 0) {
    overallStatus = "verified";
  } else if (completedVCs > 0) {
    overallStatus = "pending";
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="text-sm font-medium text-muted-foreground">Workflow Verification:</span>
      <VerifiableCredentialBadge
        hasVC={totalVCs > 0}
        status={overallStatus}
        workflowId={workflowId}
        vcData={vcChain.workflow_vc}
        showCopyButton={true}
        showVerifyButton={true}
        variant="detail"
      />
      {totalVCs > 0 && (
        <span className="text-body-small">
          ({completedVCs}/{totalVCs} verified)
        </span>
      )}
    </div>
  );
}
