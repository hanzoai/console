import { useRouter } from "next/router";
import Page from "@/src/components/layouts/page";
import { VectorStatsCards } from "@/src/features/vector/components/VectorStatsCards";
import { CollectionsTable } from "@/src/features/vector/components/CollectionsTable";

export default function VectorOverviewPage() {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  if (!projectId) return null;

  return (
    <Page
      withPadding
      scrollable
      headerProps={{
        title: "Vector",
        help: {
          description: "Manage vector collections and search for similar embeddings.",
          href: "https://hanzo.com/docs/vector",
        },
      }}
    >
      <div className="flex flex-col gap-6">
        <VectorStatsCards projectId={projectId} />
        <CollectionsTable projectId={projectId} />
      </div>
    </Page>
  );
}
