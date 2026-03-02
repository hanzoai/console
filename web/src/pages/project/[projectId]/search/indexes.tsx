import { useRouter } from "next/router";
import ContainerPage from "@/src/components/layouts/container-page";
import { IndexesTable } from "@/src/features/search/components/IndexesTable";

export default function SearchIndexesPage() {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  if (!projectId) return null;

  return (
    <ContainerPage
      headerProps={{
        title: "Search Indexes",
        breadcrumb: [{ name: "Search", href: `/project/${projectId}/search` }],
      }}
    >
      <IndexesTable projectId={projectId} />
    </ContainerPage>
  );
}
