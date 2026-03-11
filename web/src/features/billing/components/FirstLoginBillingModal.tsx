/**
 * FirstLoginBillingModal
 *
 * Shown once on first login for new users. Prompts them to add a payment method
 * via billing.hanzo.ai/topup to unlock the $5 trial credit.
 *
 * Dismissed permanently via localStorage (per user ID).
 * Opens billing in a new tab instead of iframe (billing.hanzo.ai blocks framing).
 */
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { ExternalLink, CreditCard } from "lucide-react";

const BILLING_URL = process.env.NEXT_PUBLIC_BILLING_URL ?? "https://billing.hanzo.ai";
const STORAGE_KEY_PREFIX = "hanzo:billing:card-captured:";
const SKIP_KEY_PREFIX = "hanzo:billing:card-skipped:";

function storageKey(userId: string) {
  return STORAGE_KEY_PREFIX + userId;
}
function skipKey(userId: string) {
  return SKIP_KEY_PREFIX + userId;
}

function hasCapture(userId: string) {
  return typeof window !== "undefined" && !!localStorage.getItem(storageKey(userId));
}

function markCapture(userId: string) {
  localStorage.setItem(storageKey(userId), "1");
}

function hasSkipped(userId: string) {
  return typeof window !== "undefined" && !!localStorage.getItem(skipKey(userId));
}

function markSkipped(userId: string) {
  // Skip reminder for 7 days
  localStorage.setItem(skipKey(userId), String(Date.now() + 7 * 24 * 60 * 60 * 1000));
}

function isSkipExpired(userId: string) {
  const val = localStorage.getItem(skipKey(userId));
  if (!val) return true;
  return Date.now() > parseInt(val, 10);
}

export function FirstLoginBillingModal() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);

  const userId = session?.user?.id ?? session?.user?.email ?? "";

  useEffect(() => {
    if (status !== "authenticated" || !userId) return;

    // Already captured payment method
    if (hasCapture(userId)) return;

    // Skipped recently
    if (hasSkipped(userId) && !isSkipExpired(userId)) return;

    // First authenticated session -> show modal after short delay
    const timer = setTimeout(() => setOpen(true), 1500);
    return () => clearTimeout(timer);
  }, [status, userId]);

  // Listen for topup-complete postMessage (fired when user returns from billing tab)
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== BILLING_URL.replace(/\/$/, "")) return;
      if (event.data?.type === "topup-complete") {
        markCapture(userId);
        setOpen(false);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [userId]);

  function handleSkip() {
    if (userId) markSkipped(userId);
    setOpen(false);
  }

  function handleOpenBilling() {
    const billingUrl = `${BILLING_URL}/topup?userId=${encodeURIComponent(userId)}&credit=500`;
    window.open(billingUrl, "_blank", "noopener,noreferrer");
    // Mark as captured optimistically — user opened billing
    if (userId) markCapture(userId);
    setOpen(false);
  }

  if (!userId || !open) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleSkip();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Claim your $5 trial credit</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            Add a payment method to activate your free $5 credit and unlock full access to Hanzo Cloud.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="flex items-start gap-3 rounded-lg border p-4 bg-muted/30">
            <CreditCard className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
            <div className="text-sm">
              <p>You&apos;ll be taken to our secure billing portal to add a payment method.</p>
              <p className="text-muted-foreground mt-1">
                Secured by Square. Your card details are never stored on our servers.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground">
              Skip for now
            </Button>
            <Button onClick={handleOpenBilling} className="gap-2">
              Add payment method
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
