import { useRouter } from "next/router";
import ContainerPage from "@/src/components/layouts/container-page";
import { ZtServicePoliciesTable } from "@/src/features/zt/components/ZtServicePoliciesTable";

export default function ZtServicePoliciesPage() {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  if (!projectId) return null;

  return (
    <ContainerPage
      headerProps={{
        title: "Service Policies",
      }}
    >
      <ZtServicePoliciesTable projectId={projectId} />
    </ContainerPage>
  );
}
