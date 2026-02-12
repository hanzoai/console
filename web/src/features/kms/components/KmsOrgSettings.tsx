import { useSession } from "next-auth/react";
import { api } from "@/src/utils/api";
import { StatusBadge } from "@/src/components/layouts/status-badge";
import Header from "@/src/components/layouts/header";

export function KmsOrgSettings({ orgId }: { orgId: string }) {
  const session = useSession();

  // Find a project in this org to probe KMS connectivity
  const org = session.data?.user?.organizations.find((o) => o.id === orgId);
  const firstProjectId = org?.projects[0]?.id;

  const envQuery = api.kms.listEnvironments.useQuery(
    { projectId: firstProjectId ?? "" },
    { enabled: !!firstProjectId, retry: false },
  );

  const isConnected = envQuery.isSuccess;
  const isError = envQuery.isError;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Header title="KMS Connection" />
        <div className="mt-2 flex items-center gap-3">
          <span className="text-sm font-medium">Status:</span>
          {!firstProjectId ? (
            <StatusBadge type="disabled" />
          ) : envQuery.isPending ? (
            <StatusBadge type="pending" />
          ) : isConnected ? (
            <StatusBadge type="active" />
          ) : isError ? (
            <StatusBadge type="error" />
          ) : (
            <StatusBadge type="disabled" />
          )}
        </div>
        {!firstProjectId && (
          <p className="mt-2 text-sm text-muted-foreground">
            Create a project first to test KMS connectivity.
          </p>
        )}
        {isError && (
          <p className="mt-2 text-sm text-muted-foreground">
            Could not connect to KMS. Verify that KMS_SERVICE_TOKEN and
            KMS_API_URL are configured correctly.
          </p>
        )}
      </div>

      {isConnected && (
        <div>
          <Header title="Environments" />
          <div className="mt-2 flex flex-col gap-1">
            {(
              envQuery.data as {
                environments?: { slug: string; name: string }[];
              }
            )?.environments?.map((e) => (
              <div
                key={e.slug}
                className="flex items-center gap-2 text-sm"
              >
                <span className="font-medium">{e.name}</span>
                <span className="text-muted-foreground">({e.slug})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <Header title="Project Access" />
        <p className="mt-2 text-sm text-muted-foreground">
          KMS secrets and encryption keys are available on each project&apos;s
          sidebar under the &quot;KMS&quot; section. Navigate to a project to
          manage its secrets and keys.
        </p>
      </div>
    </div>
  );
}
