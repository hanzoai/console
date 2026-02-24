import { useRouter } from "next/router";
import ContainerPage from "@/src/components/layouts/container-page";
import { MpcSessionsTable } from "@/src/features/mpc/components/MpcSessionsTable";

export default function MpcSessionsPage() {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  if (!projectId) return null;

  return (
    <ContainerPage
      headerProps={{
        title: "Signing Sessions",
        breadcrumb: [{ name: "MPC", href: `/project/${projectId}/mpc` }],
        help: {
          description: "Monitor active and completed signing sessions across all MPC wallets.",
          href: "https://hanzo.com/docs/mpc/sessions",
        },
      }}
    >
      <MpcSessionsTable projectId={projectId} />
    </ContainerPage>
  );
}
