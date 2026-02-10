import type { NavigationSection } from './types';
import { NavigationItemComponent } from './NavigationItem.tsx';
import { cn } from '../../lib/utils';

interface NavigationSectionProps {
  section: NavigationSection;
  isCollapsed?: boolean;
}

export function NavigationSectionComponent({ section, isCollapsed = false }: NavigationSectionProps) {
  return (
    <div>
      {!isCollapsed && (
        <div className={cn(
          "mb-4 px-4", // Professional spacing with generous bottom margin
          "select-none" // Prevent text selection on headers
        )}>
          {/* Non-interactive section header with refined typography hierarchy */}
          <h3 className={cn(
            "text-xs font-semibold uppercase tracking-wider",
            "text-muted-foreground/70", // Slightly more contrast for readability
            "pb-2", // More breathing room below header
            "pointer-events-none", // Explicitly non-interactive
            "border-b border-border/5", // Very subtle separator line
            "mb-0" // Reset any default margins
          )}>
            {section.title}
          </h3>
        </div>
      )}

      {/* Navigation items container with optimal spacing */}
      <div className={cn(
        "space-y-1", // Perfect balance - not too tight, not too loose (4px)
        isCollapsed ? "px-1" : "px-2" // Proper horizontal padding for items
      )}>
        {section.items.map((item) => (
          <NavigationItemComponent
            key={item.id}
            item={item}
            isCollapsed={isCollapsed}
          />
        ))}
      </div>
    </div>
  );
}
