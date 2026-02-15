import { useRouter } from "next/router";
import ContainerPage from "@/src/components/layouts/container-page";
import { BotDashboard } from "@/src/features/bots/components/BotDashboard";

export default function BotsPage() {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  if (!projectId) return null;

  return (
    <ContainerPage
      headerProps={{
        title: "Bots",
        help: {
          description:
            "Deploy and manage conversational bots across WhatsApp, Telegram, Discord, Slack, and more.",
          href: "https://hanzo.com/docs/bots",
        },
      }}
    >
      <BotDashboard projectId={projectId} />
    </ContainerPage>
  );
}
