import { useRouter } from "next/router";
import ContainerPage from "@/src/components/layouts/container-page";
import { MpcWalletsTable } from "@/src/features/mpc/components/MpcWalletsTable";

export default function MpcWalletsPage() {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  if (!projectId) return null;

  return (
    <ContainerPage
      headerProps={{
        title: "MPC Wallets",
        breadcrumb: [{ name: "MPC", href: `/project/${projectId}/mpc` }],
        help: {
          description:
            "View and manage all MPC wallets. Each wallet uses threshold signatures across multiple parties.",
          href: "https://hanzo.com/docs/mpc/wallets",
        },
      }}
    >
      <MpcWalletsTable projectId={projectId} />
    </ContainerPage>
  );
}
