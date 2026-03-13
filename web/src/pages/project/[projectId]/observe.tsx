import { useRouter } from "next/router";
import { ExternalLink } from "lucide-react";
import { Button } from "@/src/components/ui/button";

const O11Y_URL = process.env.NEXT_PUBLIC_O11Y_URL ?? "https://o11y.hanzo.ai";

export default function ObservePage() {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  if (!projectId) return null;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <h1 className="text-sm font-medium">Observability</h1>
        <Button variant="outline" size="sm" onClick={() => window.open(O11Y_URL, "_blank")}>
          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
          Open in new tab
        </Button>
      </div>
      <iframe
        src={O11Y_URL}
        className="flex-1 border-0"
        title="Hanzo Observability"
        allow="clipboard-read; clipboard-write"
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals"
      />
    </div>
  );
}
