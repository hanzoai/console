import { useRouter } from "next/router";
import ContainerPage from "@/src/components/layouts/container-page";
import { ZtTerminatorsTable } from "@/src/features/zt/components/ZtTerminatorsTable";

export default function ZtTerminatorsPage() {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  if (!projectId) return null;

  return (
    <ContainerPage
      headerProps={{
        title: "Terminators",
      }}
    >
      <ZtTerminatorsTable projectId={projectId} />
    </ContainerPage>
  );
}
