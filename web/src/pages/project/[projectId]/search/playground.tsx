import { useRouter } from "next/router";
import ContainerPage from "@/src/components/layouts/container-page";
import { SearchPlayground } from "@/src/features/search/components/SearchPlayground";

export default function SearchPlaygroundPage() {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  if (!projectId) return null;

  return (
    <ContainerPage
      headerProps={{
        title: "Search Playground",
        breadcrumb: [{ name: "Search", href: `/project/${projectId}/search` }],
      }}
    >
      <SearchPlayground projectId={projectId} />
    </ContainerPage>
  );
}
