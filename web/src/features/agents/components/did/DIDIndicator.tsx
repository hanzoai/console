import { useDIDStatus } from "../../hooks/useDIDInfo";
import { Badge } from "../ui/badge";
import { Skeleton } from "../ui/skeleton";
import {
  CheckmarkFilled,
  Security,
  WarningAltFilled,
  Identification,
  Cognitive
} from "@/src/features/agents/components/ui/icon-bridge";

interface DIDIndicatorProps {
  nodeId: string;
  variant?: "minimal" | "badge" | "full";
  className?: string;
}

/**
 * Minimal DID indicator component with world-class dark mode design
 * Inspired by Linear's premium interface aesthetics
 */
export function DIDIndicator({
  nodeId,
  variant = "minimal",
  className = "",
}: DIDIndicatorProps) {
  const { status, loading } = useDIDStatus(nodeId);

  if (loading || !status) {
    return null;
  }

  if (!status.has_did) {
    return null; // Don't show anything if no DID
  }

  // Minimal variant - just a small verification icon
  if (variant === "minimal") {
    return (
      <span
        className={`inline-flex items-center justify-center w-5 h-5 rounded-full transition-colors duration-150 ${
          status.did_status === "active"
            ? "bg-status-success/10 border border-status-success/20"
            : "bg-status-neutral/10 border border-status-neutral/20"
        } ${className}`}
        title={
          status.did_status === "active"
            ? "Verified Identity"
            : "Identity Inactive"
        }
      >
        {status.did_status === "active" ? (
          <CheckmarkFilled size={12} className="text-status-success" />
        ) : (
          <WarningAltFilled size={12} className="text-status-neutral" />
        )}
      </span>
    );
  }

  // Badge variant - small badge with status
  if (variant === "badge") {
    return (
      <Badge
        variant={status.did_status === "active" ? "default" : "secondary"}
        className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors duration-150 ${
          status.did_status === "active"
            ? "bg-status-success/10 text-status-success border-status-success/20 font-medium"
            : "bg-status-neutral/10 text-status-neutral border-status-neutral/20 font-medium"
        } ${className}`}
      >
        {status.did_status === "active" ? (
          <Security size={12} />
        ) : (
          <WarningAltFilled size={12} />
        )}
        Verified
      </Badge>
    );
  }

  // Full variant - shows DID with copy functionality
  return (
    <div className={`flex items-center gap-3 ${className}`}>
        <div className="flex items-center gap-2">
          <div className={`flex items-center justify-center w-6 h-6 rounded-md transition-colors duration-150 bg-muted border border-border`}>
            {status.did_status === "active" ? (
              <Security size={14} className="text-status-success" />
            ) : (
              <WarningAltFilled size={14} className="text-muted-foreground" />
            )}
          </div>
          <div className="flex items-center gap-1.5 text-body-small">
            <Cognitive size={12} />
            <span>{status.reasoner_count} reasoners verified</span>
          </div>
        </div>
    </div>
  );
}

interface NodeDIDCardProps {
  nodeId: string;
  className?: string;
}

/**
 * Clean, minimal DID card for node detail pages with enhanced dark mode design
 * Replaces the complex DIDIdentityCard
 */
export function NodeDIDCard({ nodeId, className = "" }: NodeDIDCardProps) {
  const { status, loading, error } = useDIDStatus(nodeId);

  if (loading) {
    return (
      <div className={`bg-card border border-card-border rounded-xl p-6 shadow-sm ${className}`}>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-3 w-3/4" />
        </div>
      </div>
    );
  }

  if (error || !status || !status.has_did) {
    return null; // Don't show card if no DID
  }

  return (
    <div className={`bg-card border border-card-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent-primary/10 border border-accent-primary/20">
            <Identification size={16} className="text-accent-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Identity
            </h3>
            <span
              className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium transition-colors duration-150 ${
                status.did_status === "active"
                  ? "bg-status-success/10 text-status-success border border-status-success/20"
                  : "bg-status-neutral/10 text-status-neutral border border-status-neutral/20"
              }`}
            >
              {status.did_status === "active" ? (
                <>
                  <CheckmarkFilled size={10} />
                  Verified
                </>
              ) : (
                <>
                  <WarningAltFilled size={10} />
                  Inactive
                </>
              )}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-body-small">
          <Cognitive size={12} />
          <span>{status.reasoner_count} reasoners</span>
        </div>
      </div>

      <div className="text-body-small">
        Node has verified identity and {status.reasoner_count} verified
        reasoners
      </div>
    </div>
  );
}
