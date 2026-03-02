import { useRouter } from "next/router";
import Page from "@/src/components/layouts/page";
import { ModelsTable } from "@/src/features/cloud-models/components/ModelsTable";
import { ModelConfigPanel } from "@/src/features/cloud-models/components/ModelConfigPanel";

export default function CloudModelsPage() {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  if (!projectId) return null;

  return (
    <Page
      withPadding
      scrollable
      headerProps={{
        title: "Model Configuration",
        help: {
          description: "Browse available AI models and configure which model your project uses by default.",
          href: "https://hanzo.ai/docs/models",
        },
      }}
    >
      <div className="flex flex-col gap-6">
        <ModelConfigPanel projectId={projectId} />
        <ModelsTable projectId={projectId} />
      </div>
    </Page>
  );
}
