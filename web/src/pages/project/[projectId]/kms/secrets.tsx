import { useRouter } from "next/router";
import ContainerPage from "@/src/components/layouts/container-page";
import { SecretsTable } from "@/src/features/kms/components/SecretsTable";

export default function KmsSecretsPage() {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  if (!projectId) return null;

  return (
    <ContainerPage
      headerProps={{
        title: "Secrets",
      }}
    >
      <SecretsTable projectId={projectId} />
    </ContainerPage>
  );
}
