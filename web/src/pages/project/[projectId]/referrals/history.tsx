import { useRouter } from "next/router";
import ContainerPage from "@/src/components/layouts/container-page";
import { Card, CardContent } from "@/src/components/ui/card";

export default function ReferralHistoryPage() {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  if (!projectId) return null;

  return (
    <ContainerPage
      headerProps={{
        title: "Referral History",
        help: {
          description: "View all users who signed up through your referral link and their current status.",
          href: "https://hanzo.ai/docs/referrals",
        },
      }}
    >
      <Card>
        <CardContent className="flex min-h-[300px] items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-medium">No referrals yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Share your referral link to start tracking sign-ups here.
            </p>
          </div>
        </CardContent>
      </Card>
    </ContainerPage>
  );
}
