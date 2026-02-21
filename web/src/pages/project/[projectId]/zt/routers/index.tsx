import { useRouter } from "next/router";
import ContainerPage from "@/src/components/layouts/container-page";
import { ZtRoutersTable } from "@/src/features/zt/components/ZtRoutersTable";

export default function ZtRoutersPage() {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  if (!projectId) return null;

  return (
    <ContainerPage
      headerProps={{
        title: "Routers",
      }}
    >
      <ZtRoutersTable projectId={projectId} />
    </ContainerPage>
  );
}
