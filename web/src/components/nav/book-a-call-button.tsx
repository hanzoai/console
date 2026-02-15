import { CalendarDays } from "lucide-react";
import { SidebarMenuButton } from "@/src/components/ui/sidebar";
import { usePostHogClientCapture } from "@/src/features/posthog-analytics/usePostHogClientCapture";
import { useEffect } from "react";

declare global {
  interface Window {
    Cal?: (...args: unknown[]) => void;
  }
}

export const BookACallButton = () => {
  const capture = usePostHogClientCapture();

  useEffect(() => {
    // Load Cal.com embed script once
    if (document.getElementById("cal-embed-script")) return;

    const script = document.createElement("script");
    script.id = "cal-embed-script";
    script.src = "https://app.cal.com/embed/embed.js";
    script.async = true;
    script.onload = () => {
      if (window.Cal) {
        window.Cal("init", { origin: "https://cal.com" });
      }
    };
    document.head.appendChild(script);
  }, []);

  return (
    <SidebarMenuButton
      onClick={() => {
        capture("sidebar:book_a_call_clicked");
        if (window.Cal) {
          window.Cal("modal", {
            calLink: "hanzo/welcome-to-hanzo",
            config: { layout: "month_view", theme: "dark" },
          });
        } else {
          window.open(
            "https://cal.com/hanzo/welcome-to-hanzo",
            "_blank",
            "noopener,noreferrer",
          );
        }
      }}
    >
      <CalendarDays className="h-4 w-4" />
      Book a call
    </SidebarMenuButton>
  );
};
