import { useRouter } from "next/router";
import ContainerPage from "@/src/components/layouts/container-page";
import { InfrastructureDashboard } from "@/src/features/infrastructure/components/InfrastructureDashboard";

export default function InfrastructurePage() {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  if (!projectId) return null;

  return (
    <ContainerPage
      headerProps={{
        title: "Infrastructure",
        help: {
          description: "Monitor service health, memory usage, and recent deployment events across your infrastructure.",
          href: "https://hanzo.com/docs/infrastructure",
        },
      }}
    >
      <InfrastructureDashboard projectId={projectId} />
    </ContainerPage>
  );
}
