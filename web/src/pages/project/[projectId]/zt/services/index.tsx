import { useRouter } from "next/router";
import ContainerPage from "@/src/components/layouts/container-page";
import { ZtServicesTable } from "@/src/features/zt/components/ZtServicesTable";

export default function ZtServicesPage() {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  if (!projectId) return null;

  return (
    <ContainerPage
      headerProps={{
        title: "Services",
      }}
    >
      <ZtServicesTable projectId={projectId} />
    </ContainerPage>
  );
}
