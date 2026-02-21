import { useRouter } from "next/router";
import ContainerPage from "@/src/components/layouts/container-page";
import { ZtConfigsTable } from "@/src/features/zt/components/ZtConfigsTable";

export default function ZtConfigsPage() {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  if (!projectId) return null;

  return (
    <ContainerPage
      headerProps={{
        title: "Configs",
      }}
    >
      <ZtConfigsTable projectId={projectId} />
    </ContainerPage>
  );
}
