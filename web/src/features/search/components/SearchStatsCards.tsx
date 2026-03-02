import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Skeleton } from "@/src/components/ui/skeleton";
import { useSearchStats } from "@/src/features/search/hooks";
import { FileText, Search, MessageSquare } from "lucide-react";

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function SearchStatsCards({ projectId }: { projectId: string }) {
  const { data, isPending } = useSearchStats(projectId);

  const stats = [
    {
      title: "Documents Indexed",
      value: data?.totalDocuments ?? 0,
      icon: FileText,
    },
    {
      title: "Total Searches",
      value: data?.totalSearches ?? 0,
      icon: Search,
    },
    {
      title: "AI Sessions",
      value: data?.totalSessions ?? 0,
      icon: MessageSquare,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isPending ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatNumber(stat.value)}</div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
