import { useRouter } from "next/router";
import ContainerPage from "@/src/components/layouts/container-page";
import { useZtService } from "@/src/features/zt/hooks";
import { Badge } from "@/src/components/ui/badge";

export default function ZtServiceDetailPage() {
  const router = useRouter();
  const projectId = router.query.projectId as string;
  const serviceId = router.query.serviceId as string;

  const serviceQuery = useZtService(projectId, serviceId);

  if (!projectId || !serviceId) return null;

  const service = serviceQuery.data?.data as Record<string, unknown> | undefined;

  return (
    <ContainerPage
      headerProps={{
        title: (service?.name as string) ?? "Service Detail",
        breadcrumb: [
          { name: "Services", href: `/project/${projectId}/zt/services` },
        ],
      }}
    >
      {serviceQuery.isPending && (
        <div className="py-12 text-center text-muted-foreground">
          Loading...
        </div>
      )}

      {serviceQuery.isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {serviceQuery.error.message}
        </div>
      )}

      {service && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">ID</p>
            <p className="font-mono text-sm">{service.id as string}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Name</p>
            <p className="font-medium">{service.name as string}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Encryption Required</p>
            <p>{service.encryptionRequired ? "Yes" : "No"}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Role Attributes</p>
            <div className="flex flex-wrap gap-1">
              {(service.roleAttributes as string[] | null)?.map((attr) => (
                <Badge key={attr} variant="secondary">
                  {attr}
                </Badge>
              )) ?? <span className="text-muted-foreground">None</span>}
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Created</p>
            <p>
              {service.createdAt
                ? new Date(service.createdAt as string).toLocaleString()
                : "-"}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Updated</p>
            <p>
              {service.updatedAt
                ? new Date(service.updatedAt as string).toLocaleString()
                : "-"}
            </p>
          </div>
        </div>
      )}
    </ContainerPage>
  );
}
