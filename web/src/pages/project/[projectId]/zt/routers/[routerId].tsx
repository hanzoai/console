import { useRouter } from "next/router";
import ContainerPage from "@/src/components/layouts/container-page";
import { useZtRouter } from "@/src/features/zt/hooks";
import { Badge } from "@/src/components/ui/badge";

export default function ZtRouterDetailPage() {
  const router = useRouter();
  const projectId = router.query.projectId as string;
  const routerId = router.query.routerId as string;

  const routerQuery = useZtRouter(projectId, routerId);

  if (!projectId || !routerId) return null;

  const ztRouter = routerQuery.data?.data as Record<string, unknown> | undefined;

  return (
    <ContainerPage
      headerProps={{
        title: (ztRouter?.name as string) ?? "Router Detail",
        breadcrumb: [
          { name: "Routers", href: `/project/${projectId}/zt/routers` },
        ],
      }}
    >
      {routerQuery.isPending && (
        <div className="py-12 text-center text-muted-foreground">
          Loading...
        </div>
      )}

      {routerQuery.isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {routerQuery.error.message}
        </div>
      )}

      {ztRouter && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">ID</p>
            <p className="font-mono text-sm">{ztRouter.id as string}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Name</p>
            <p className="font-medium">{ztRouter.name as string}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Status</p>
            <div className="flex items-center gap-2">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  ztRouter.isOnline ? "bg-green-500" : "bg-gray-400"
                }`}
              />
              {ztRouter.isOnline ? "Online" : "Offline"}
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Verified</p>
            <p>{ztRouter.isVerified ? "Yes" : "No"}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Cost</p>
            <p>{ztRouter.cost as number}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Tunneler Enabled</p>
            <p>{ztRouter.isTunnelerEnabled ? "Yes" : "No"}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Fingerprint</p>
            <p className="font-mono text-xs">
              {(ztRouter.fingerprint as string) ?? "N/A"}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Role Attributes</p>
            <div className="flex flex-wrap gap-1">
              {(ztRouter.roleAttributes as string[] | null)?.map((attr) => (
                <Badge key={attr} variant="secondary">
                  {attr}
                </Badge>
              )) ?? <span className="text-muted-foreground">None</span>}
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Created</p>
            <p>
              {ztRouter.createdAt
                ? new Date(ztRouter.createdAt as string).toLocaleString()
                : "-"}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Updated</p>
            <p>
              {ztRouter.updatedAt
                ? new Date(ztRouter.updatedAt as string).toLocaleString()
                : "-"}
            </p>
          </div>
        </div>
      )}
    </ContainerPage>
  );
}
