import { useRouter } from "next/router";
import ContainerPage from "@/src/components/layouts/container-page";
import { EncryptionKeysTable } from "@/src/features/kms/components/EncryptionKeysTable";

export default function KmsKeysPage() {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  if (!projectId) return null;

  return (
    <ContainerPage
      headerProps={{
        title: "Encryption Keys",
      }}
    >
      <EncryptionKeysTable projectId={projectId} />
    </ContainerPage>
  );
}
