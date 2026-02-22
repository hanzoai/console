import { useRouter } from "next/router";
import ContainerPage from "@/src/components/layouts/container-page";
import { PlatformDashboard } from "@/src/features/platform/components/PlatformDashboard";

export default function PlatformPage() {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  if (!projectId) return null;

  return (
    <ContainerPage
      headerProps={{
        title: "Platform",
        help: {
          description: "View and manage PaaS container deployments, pipeline runs, and build triggers.",
          href: "https://hanzo.com/docs/platform",
        },
      }}
    >
      <PlatformDashboard projectId={projectId} />
    </ContainerPage>
  );
}
