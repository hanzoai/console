import { useRouter } from "next/router";
import ContainerPage from "@/src/components/layouts/container-page";
import { ZtSessionsTable } from "@/src/features/zt/components/ZtSessionsTable";

export default function ZtSessionsPage() {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  if (!projectId) return null;

  return (
    <ContainerPage
      headerProps={{
        title: "Sessions",
      }}
    >
      <ZtSessionsTable projectId={projectId} />
    </ContainerPage>
  );
}
