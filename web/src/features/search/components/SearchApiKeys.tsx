import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Skeleton } from "@/src/components/ui/skeleton";
import { useSearchApiKeys, useRegenerateSearchKey } from "@/src/features/search/hooks";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/src/components/ui/alert-dialog";
import { Copy, RefreshCw, Eye, EyeOff } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";

function KeyDisplay({
  label,
  value,
  description,
  onRegenerate,
  isRegenerating,
}: {
  label: string;
  value: string;
  description: string;
  onRegenerate: () => void;
  isRegenerating: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  const maskedValue = value ? `${value.slice(0, 7)}${"*".repeat(Math.max(0, value.length - 7))}` : "Not configured";

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <div className="flex items-center gap-1">
            {value && (
              <>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setRevealed(!revealed)}>
                  {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => void navigator.clipboard.writeText(value)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={() => setConfirmRegenerate(true)} disabled={isRegenerating}>
              <RefreshCw className="mr-2 h-3 w-3" />
              Regenerate
            </Button>
          </div>
        </div>
        <code className="rounded-md border bg-muted px-3 py-2 text-sm font-mono">{revealed ? value : maskedValue}</code>
      </div>

      <AlertDialog open={confirmRegenerate} onOpenChange={setConfirmRegenerate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate {label}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will invalidate the current key. Any applications using it will need to be updated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onRegenerate();
                setConfirmRegenerate(false);
              }}
            >
              Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

const CLIENT_SNIPPET = `<!-- Client-side search -->
<script src="https://cdn.hanzo.ai/search.js"></script>
<script>
  const search = new HanzoSearch({ apiKey: 'pk-...' });
  const results = await search.query('your query');
</script>`;

const SERVER_SNIPPET = `// Server-side indexing (Node.js)
const response = await fetch('https://api.cloud.hanzo.ai/api/index-docs', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer hk-...',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    storeName: 'my-docs',
    documents: [
      { url: 'https://example.com', title: 'Example', content: '...' },
    ],
  }),
});`;

const CURL_SNIPPET = `# Search documents
curl -X POST 'https://api.cloud.hanzo.ai/api/search-docs' \\
  -H 'Authorization: Bearer pk-...' \\
  -H 'Content-Type: application/json' \\
  -d '{"query": "how to get started", "mode": "hybrid"}'`;

export function SearchApiKeys({ projectId }: { projectId: string }) {
  const { data, isPending } = useSearchApiKeys(projectId);
  const regenerateKey = useRegenerateSearchKey();

  if (isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">API Keys</CardTitle>
          <CardDescription>Use these keys to integrate Hanzo Search into your application.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <KeyDisplay
            label="Publishable Key"
            value={data?.publishableKey ?? ""}
            description="Safe for client-side use. Can only perform searches."
            onRegenerate={() => regenerateKey.mutate({ projectId, keyType: "publishable" })}
            isRegenerating={regenerateKey.isPending}
          />
          <KeyDisplay
            label="Admin Key"
            value={data?.adminKey ?? ""}
            description="Server-side only. Full access to indexing and management."
            onRegenerate={() => regenerateKey.mutate({ projectId, keyType: "admin" })}
            isRegenerating={regenerateKey.isPending}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Start</CardTitle>
          <CardDescription>Code snippets to integrate Hanzo Search into your application.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="client">
            <TabsList>
              <TabsTrigger value="client">Client-side</TabsTrigger>
              <TabsTrigger value="server">Server-side</TabsTrigger>
              <TabsTrigger value="curl">cURL</TabsTrigger>
            </TabsList>
            <TabsContent value="client">
              <div className="relative">
                <pre className="overflow-x-auto rounded-md border bg-muted p-4 text-sm">
                  <code>{CLIENT_SNIPPET}</code>
                </pre>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-2 h-8 w-8 p-0"
                  onClick={() => void navigator.clipboard.writeText(CLIENT_SNIPPET)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="server">
              <div className="relative">
                <pre className="overflow-x-auto rounded-md border bg-muted p-4 text-sm">
                  <code>{SERVER_SNIPPET}</code>
                </pre>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-2 h-8 w-8 p-0"
                  onClick={() => void navigator.clipboard.writeText(SERVER_SNIPPET)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="curl">
              <div className="relative">
                <pre className="overflow-x-auto rounded-md border bg-muted p-4 text-sm">
                  <code>{CURL_SNIPPET}</code>
                </pre>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-2 h-8 w-8 p-0"
                  onClick={() => void navigator.clipboard.writeText(CURL_SNIPPET)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
