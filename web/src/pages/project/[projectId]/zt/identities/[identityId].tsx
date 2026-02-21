import { useRouter } from "next/router";
import ContainerPage from "@/src/components/layouts/container-page";
import { useZtIdentity } from "@/src/features/zt/hooks";
import { Badge } from "@/src/components/ui/badge";

export default function ZtIdentityDetailPage() {
  const router = useRouter();
  const projectId = router.query.projectId as string;
  const identityId = router.query.identityId as string;

  const identityQuery = useZtIdentity(projectId, identityId);

  if (!projectId || !identityId) return null;

  const identity = identityQuery.data?.data as Record<string, unknown> | undefined;

  return (
    <ContainerPage
      headerProps={{
        title: (identity?.name as string) ?? "Identity Detail",
        breadcrumb: [
          { name: "Identities", href: `/project/${projectId}/zt/identities` },
        ],
      }}
    >
      {identityQuery.isPending && (
        <div className="py-12 text-center text-muted-foreground">
          Loading...
        </div>
      )}

      {identityQuery.isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {identityQuery.error.message}
        </div>
      )}

      {identity && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">ID</p>
              <p className="font-mono text-sm">{identity.id as string}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{identity.name as string}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Type</p>
              <p>{((identity.type as Record<string, string>)?.name) ?? "Unknown"}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Status</p>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    identity.isOnline ? "bg-green-500" : "bg-gray-400"
                  }`}
                />
                {identity.isOnline ? "Online" : "Offline"}
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Admin</p>
              <p>{identity.isAdmin ? "Yes" : "No"}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Role Attributes</p>
              <div className="flex flex-wrap gap-1">
                {(identity.roleAttributes as string[] | null)?.map((attr) => (
                  <Badge key={attr} variant="secondary">
                    {attr}
                  </Badge>
                )) ?? <span className="text-muted-foreground">None</span>}
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Created</p>
              <p>
                {identity.createdAt
                  ? new Date(identity.createdAt as string).toLocaleString()
                  : "-"}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Updated</p>
              <p>
                {identity.updatedAt
                  ? new Date(identity.updatedAt as string).toLocaleString()
                  : "-"}
              </p>
            </div>
          </div>
        </div>
      )}
    </ContainerPage>
  );
}
