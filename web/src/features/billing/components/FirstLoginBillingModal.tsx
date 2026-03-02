/**
 * FirstLoginBillingModal
 *
 * Shown once on first login for new users. Prompts them to add a payment method
 * via billing.hanzo.ai/topup to unlock the $5 trial credit.
 *
 * Dismissed permanently via localStorage (per user ID).
 * Also dismisses automatically when billing.hanzo.ai sends a topup-complete postMessage.
 */
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { X } from "lucide-react";

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
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const userId = session?.user?.id ?? session?.user?.email ?? "";

  useEffect(() => {
    if (status !== "authenticated" || !userId) return;

    // Already captured payment method
    if (hasCapture(userId)) return;

    // Skipped recently
    if (hasSkipped(userId) && !isSkipExpired(userId)) return;

    // First authenticated session → show modal after short delay
    const timer = setTimeout(() => setOpen(true), 1500);
    return () => clearTimeout(timer);
  }, [status, userId]);

  // Listen for success postMessage from billing iframe
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

  if (!userId || !open) return null;

  const iframeSrc = `${BILLING_URL}/topup?userId=${encodeURIComponent(userId)}&embed=1&credit=500`;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleSkip();
      }}
    >
      <DialogContent className="max-w-lg p-0 overflow-hidden gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-lg font-semibold">Claim your $5 trial credit</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            Add a payment method to activate your free $5 credit and unlock full access to Hanzo Cloud.
          </DialogDescription>
          <button
            onClick={handleSkip}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        </DialogHeader>

        <div className="relative w-full" style={{ height: 480 }}>
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            className="absolute inset-0 w-full h-full border-0"
            title="Add payment method"
            allow="payment"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>

        <div className="px-6 py-4 border-t flex items-center justify-between bg-muted/30">
          <p className="text-xs text-muted-foreground">
            Secured by Square. Your card details are never stored on our servers.
          </p>
          <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground">
            Skip for now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
