import { useRouter } from "next/router";
import Link from "next/link";
import Page from "@/src/components/layouts/page";
import { Button } from "@/src/components/ui/button";
import { SearchStatsCards } from "@/src/features/search/components/SearchStatsCards";
import { SearchUsageChart } from "@/src/features/search/components/SearchUsageChart";
import { FileText, Search, Key } from "lucide-react";

export default function SearchOverviewPage() {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  if (!projectId) return null;

  return (
    <Page
      withPadding
      scrollable
      headerProps={{
        title: "Search",
        help: {
          description: "Manage search indexes, test queries, and view API keys for Hanzo Search.",
          href: "https://hanzo.ai/docs/search",
        },
      }}
    >
      <div className="flex flex-col gap-6">
        <SearchStatsCards projectId={projectId} />
        <SearchUsageChart projectId={projectId} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Link href={`/project/${projectId}/search/indexes`} className="group">
            <div className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50">
              <FileText className="h-8 w-8 text-muted-foreground group-hover:text-primary" />
              <div>
                <p className="font-medium">Index New Site</p>
                <p className="text-sm text-muted-foreground">Scrape and index web pages for search</p>
              </div>
            </div>
          </Link>
          <Link href={`/project/${projectId}/search/playground`} className="group">
            <div className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50">
              <Search className="h-8 w-8 text-muted-foreground group-hover:text-primary" />
              <div>
                <p className="font-medium">Test Search</p>
                <p className="text-sm text-muted-foreground">Try search queries in the playground</p>
              </div>
            </div>
          </Link>
          <Link href={`/project/${projectId}/search/keys`} className="group">
            <div className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50">
              <Key className="h-8 w-8 text-muted-foreground group-hover:text-primary" />
              <div>
                <p className="font-medium">View API Keys</p>
                <p className="text-sm text-muted-foreground">Get keys and code snippets</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </Page>
  );
}
