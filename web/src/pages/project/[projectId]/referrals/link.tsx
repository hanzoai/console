import { useRouter } from "next/router";
import { Link as LinkIcon, Copy } from "lucide-react";
import ContainerPage from "@/src/components/layouts/container-page";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";

export default function ReferralLinkPage() {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  if (!projectId) return null;

  return (
    <ContainerPage
      headerProps={{
        title: "Referral Link",
        help: {
          description: "Share your unique referral link to earn commissions when new users sign up.",
          href: "https://hanzo.ai/docs/referrals",
        },
      }}
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              Your Referral Link
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3">
              <code className="flex-1 text-sm text-muted-foreground">https://hanzo.ai/ref/...</code>
              <button
                className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                disabled
              >
                <Copy className="h-3.5 w-3.5" />
                Copy
              </button>
            </div>
            <p className="text-sm text-muted-foreground">Referral link generation will be available soon.</p>
          </CardContent>
        </Card>
      </div>
    </ContainerPage>
  );
}
