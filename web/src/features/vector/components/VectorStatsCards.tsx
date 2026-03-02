import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Skeleton } from "@/src/components/ui/skeleton";
import { useVectorStats } from "@/src/features/vector/hooks";
import { Database, Hash, HardDrive } from "lucide-react";

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function VectorStatsCards({ projectId }: { projectId: string }) {
  const { data, isPending } = useVectorStats(projectId);

  const stats = [
    {
      title: "Collections",
      value: formatNumber(data?.totalCollections ?? 0),
      icon: Database,
    },
    {
      title: "Total Vectors",
      value: formatNumber(data?.totalVectors ?? 0),
      icon: Hash,
    },
    {
      title: "Storage Used",
      value: formatBytes(data?.totalStorageBytes ?? 0),
      icon: HardDrive,
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
            {isPending ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold">{stat.value}</div>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
