import { useRouter } from "next/router";
import ContainerPage from "@/src/components/layouts/container-page";
import { SearchApiKeys } from "@/src/features/search/components/SearchApiKeys";

export default function SearchKeysPage() {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  if (!projectId) return null;

  return (
    <ContainerPage
      headerProps={{
        title: "Search API Keys",
        breadcrumb: [{ name: "Search", href: `/project/${projectId}/search` }],
      }}
    >
      <SearchApiKeys projectId={projectId} />
    </ContainerPage>
  );
}
