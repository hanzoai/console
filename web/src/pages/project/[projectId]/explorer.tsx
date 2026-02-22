import { useRouter } from "next/router";
import ContainerPage from "@/src/components/layouts/container-page";
import { ExplorerDashboard } from "@/src/features/explorer/components/ExplorerDashboard";

export default function ExplorerPage() {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  if (!projectId) return null;

  return (
    <ContainerPage
      headerProps={{
        title: "Explorer",
        help: {
          description:
            "Monitor Lux Network chain sync status, block heights, and indexer health across mainnet, testnet, and devnet.",
          href: "https://explore.lux.network",
        },
      }}
    >
      <ExplorerDashboard projectId={projectId} />
    </ContainerPage>
  );
}
