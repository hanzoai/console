import { useConsoleCloudRegion } from "@/src/features/organizations/hooks";
import { cn } from "@/src/utils/tailwind";
import { useSession } from "next-auth/react";
import { useState } from "react";

export const EnvLabel = ({ className }: { className?: string }) => {
  const [isHidden, setIsHidden] = useState(false);
  const session = useSession();
  const { isConsoleCloud, region } = useConsoleCloudRegion();
  if (!isConsoleCloud) return null;
  if (!session.data?.user?.email?.endsWith("@hanzo.com")) return null;
  if (isHidden) return null;
  return (
    <div
      className={cn(
        "flex cursor-pointer items-center gap-1 self-stretch whitespace-nowrap rounded-md px-1 py-0.5 text-xs",
        region === "STAGING"
          ? "bg-light-blue text-dark-blue"
          : region === "DEV"
            ? "bg-light-green text-dark-green"
            : "bg-light-red text-dark-red",
        className,
      )}
      onClick={() => setIsHidden(true)}
    >
      {region && ["EU", "US", "HIPAA"].includes(region) ? `PROD-${region}` : region}
    </div>
  );
};
