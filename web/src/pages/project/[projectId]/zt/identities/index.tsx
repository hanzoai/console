import { useRouter } from "next/router";
import ContainerPage from "@/src/components/layouts/container-page";
import { ZtIdentitiesTable } from "@/src/features/zt/components/ZtIdentitiesTable";

export default function ZtIdentitiesPage() {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  if (!projectId) return null;

  return (
    <ContainerPage
      headerProps={{
        title: "Identities",
      }}
    >
      <ZtIdentitiesTable projectId={projectId} />
    </ContainerPage>
  );
}
