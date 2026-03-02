import { useRouter } from "next/router";
import ContainerPage from "@/src/components/layouts/container-page";
import { CollectionsTable } from "@/src/features/vector/components/CollectionsTable";

export default function VectorCollectionsPage() {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  if (!projectId) return null;

  return (
    <ContainerPage
      headerProps={{
        title: "Vector Collections",
        breadcrumb: [{ name: "Vector", href: `/project/${projectId}/vector` }],
      }}
    >
      <CollectionsTable projectId={projectId} />
    </ContainerPage>
  );
}
