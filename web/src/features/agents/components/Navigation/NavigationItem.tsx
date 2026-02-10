import { NavLink } from "../../adapters";
import { cn } from "../../lib/utils";
import { Icon } from "../ui/icon";
import type { NavigationItem } from "./types";

interface NavigationItemProps {
  item: NavigationItem;
  isCollapsed?: boolean;
}

export function NavigationItemComponent({
  item,
  isCollapsed = false,
}: NavigationItemProps) {
  return (
    <NavLink
      to={item.href}
      className={({ isActive }) =>
        cn(
          // Base navigation item styling - clearly differentiated from headings
          "group relative flex items-center",
          "rounded-md transition-all duration-150", // Fast GitHub-like transitions
          "text-sm font-normal", // Clear typography hierarchy

          // Spacing and layout - refined for better visual balance
          isCollapsed ? "justify-center p-3 mx-1" : "px-4 py-2.5 mx-2",

          // Interactive states - fast and snappy
          "hover:bg-bg-elevated/60 hover:text-foreground",
          "active:bg-bg-elevated/80",

          // Active state with clean indicator
          isActive
            ? cn(
                "bg-bg-elevated text-foreground font-medium",
                "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2",
                "before:w-0.5 before:h-4 before:bg-primary before:rounded-r-full"
              )
            : "text-muted-foreground/85 hover:text-muted-foreground",

          // Disabled state
          item.disabled && "opacity-50 cursor-not-allowed pointer-events-none"
        )
      }
    >
      {item.icon && (
        <Icon
          name={item.icon}
          className={cn(
            "h-4 w-4 shrink-0",
            !isCollapsed && "mr-3"
          )}
        />
      )}

      {!isCollapsed && (
        <span className="select-none truncate">
          {item.label}
        </span>
      )}

      {/* Tooltip for collapsed state */}
      {isCollapsed && item.label && (
        <div className={cn(
          "absolute left-full ml-2 px-2 py-1",
          "bg-popover text-popover-foreground text-xs",
          "rounded-md shadow-md border border-border/50",
          "opacity-0 scale-95 pointer-events-none",
          "group-hover:opacity-100 group-hover:scale-100",
          "transition-all duration-200 delay-500",
          "whitespace-nowrap z-50"
        )}>
          {item.label}
          {item.description && (
            <div className="text-body-small mt-1">
              {item.description}
            </div>
          )}
        </div>
      )}
    </NavLink>
  );
}
