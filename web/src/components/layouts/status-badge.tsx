import { cn } from "@/src/utils/tailwind";

const statusCategories = {
  active: ["production", "live", "active", "public"],
  pending: ["pending", "waiting", "queued"],
  inactive: ["disabled", "inactive"],
  completed: ["completed", "done", "finished"],
  error: ["error", "failed"],
};

export type Status =
  (typeof statusCategories)[keyof typeof statusCategories][number];

export const StatusBadge = ({
  type,
  isLive = true,
  className,
  showText = true,
}: {
  type: Status | (string & {});
  isLive?: boolean;
  className?: string;
  showText?: boolean;
}) => {
  // Safely handle undefined or null type
  const safeType = type?.toLowerCase() ?? '';

  // Check if type exists before using it
  if (!safeType) return null;

  // Check if the type is included in active categories
  const isActive = statusCategories.active.includes(safeType);

  const badgeColor = isActive 
    ? "bg-light-green text-dark-green" 
    : "bg-dark-green";

  const dotColor = isActive 
    ? "animate-ping bg-dark-green" 
    : "";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs",
        badgeColor,
        className,
      )}
    >
      <span className={`${dotColor} mr-2 h-2 w-2 rounded-full`}></span>
      {showText && <span>{safeType}</span>}
    </div>
  );
};
