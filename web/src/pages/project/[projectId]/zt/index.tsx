import { useRouter } from "next/router";
import ContainerPage from "@/src/components/layouts/container-page";
import { ZtDashboard } from "@/src/features/zt/components/ZtDashboard";

export default function ZtDashboardPage() {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  if (!projectId) return null;

  return (
    <ContainerPage
      headerProps={{
        title: "Zero Trust Dashboard",
      }}
    >
      <ZtDashboard projectId={projectId} />
    </ContainerPage>
  );
}
