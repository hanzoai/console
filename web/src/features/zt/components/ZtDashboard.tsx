import { useZtDashboard } from "@/src/features/zt/hooks";
import { Shield, Users, Server, Network, Lock, Settings, Plug, Activity } from "lucide-react";
import Link from "next/link";

type StatCardProps = {
  title: string;
  value: number;
  icon: React.ReactNode;
  href: string;
};

function StatCard({ title, value, icon, href }: StatCardProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
        {icon}
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-2xl font-semibold">{value}</p>
      </div>
    </Link>
  );
}

export function ZtDashboard({ projectId }: { projectId: string }) {
  const dashboardQuery = useZtDashboard(projectId);

  if (dashboardQuery.isPending) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Loading ZT dashboard...
      </div>
    );
  }

  if (dashboardQuery.isError) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        Failed to load dashboard: {dashboardQuery.error.message}
      </div>
    );
  }

  const data = dashboardQuery.data;
  const base = `/project/${projectId}/zt`;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Identities"
          value={data.identityCount}
          icon={<Users className="h-5 w-5" />}
          href={`${base}/identities`}
        />
        <StatCard
          title="Services"
          value={data.serviceCount}
          icon={<Server className="h-5 w-5" />}
          href={`${base}/services`}
        />
        <StatCard
          title="Routers"
          value={data.routerCount}
          icon={<Network className="h-5 w-5" />}
          href={`${base}/routers`}
        />
        <StatCard
          title="Policies"
          value={data.servicePolicyCount}
          icon={<Lock className="h-5 w-5" />}
          href={`${base}/service-policies`}
        />
        <StatCard
          title="Configs"
          value={data.configCount}
          icon={<Settings className="h-5 w-5" />}
          href={`${base}/configs`}
        />
        <StatCard
          title="Sessions"
          value={data.sessionCount}
          icon={<Activity className="h-5 w-5" />}
          href={`${base}/sessions`}
        />
      </div>
    </div>
  );
}
