import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { OrganizationProjectOverview } from "@/src/features/organizations/components/ProjectOverview";

export default function Home() {
  const router = useRouter();
  const { data: session } = useSession();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!session?.user || checked) return;
    setChecked(true);

    const lastProjectId = typeof window !== "undefined" ? localStorage.getItem("hanzo_last_project_id") : null;
    if (!lastProjectId) return;

    // Verify the project still exists in the user's session
    const orgWithProject = session.user.organizations?.find((org) => org.projects.some((p) => p.id === lastProjectId));
    if (orgWithProject) {
      void router.replace(`/project/${lastProjectId}`);
    }
  }, [session, router, checked]);

  // Show org overview while checking, or if no last project
  return <OrganizationProjectOverview />;
}
