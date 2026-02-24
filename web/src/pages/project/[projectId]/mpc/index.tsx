import { useRouter } from "next/router";
import ContainerPage from "@/src/components/layouts/container-page";
import { MpcDashboard } from "@/src/features/mpc/components/MpcDashboard";

export default function MpcDashboardPage() {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  if (!projectId) return null;

  return (
    <ContainerPage
      headerProps={{
        title: "MPC \u2014 Multi-Party Computation",
        help: {
          description: "Create and manage MPC wallets, monitor signing sessions, and configure threshold policies.",
          href: "https://hanzo.com/docs/mpc",
        },
      }}
    >
      <MpcDashboard projectId={projectId} />
    </ContainerPage>
  );
}
