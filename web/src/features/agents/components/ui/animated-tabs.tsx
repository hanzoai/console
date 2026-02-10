"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/src/features/agents/lib/utils";

type TabsRootProps = React.ComponentProps<typeof TabsPrimitive.Root>;

const AnimatedTabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  TabsRootProps
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Root
    ref={ref}
    data-slot="tabs"
    className={cn("flex flex-col gap-2", className)}
    {...props}
  />
));
AnimatedTabs.displayName = TabsPrimitive.Root.displayName;

const AnimatedTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => {
  const [indicatorStyle, setIndicatorStyle] = React.useState({
    left: 0,
    width: 0,
  });
  const listRef = React.useRef<HTMLDivElement | null>(null);

  const updateIndicator = React.useCallback(() => {
    if (!listRef.current) return;

    const activeTab =
      listRef.current.querySelector<HTMLElement>('[data-state="active"]');
    if (!activeTab) return;

    const activeRect = activeTab.getBoundingClientRect();
    const listRect = listRef.current.getBoundingClientRect();

    requestAnimationFrame(() => {
      setIndicatorStyle({
        left: activeRect.left - listRect.left,
        width: activeRect.width,
      });
    });
  }, []);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(updateIndicator, 0);
    window.addEventListener("resize", updateIndicator);
    const observer = new MutationObserver(updateIndicator);

    if (listRef.current) {
      observer.observe(listRef.current, {
        attributes: true,
        childList: true,
        subtree: true,
      });
    }

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("resize", updateIndicator);
      observer.disconnect();
    };
  }, [updateIndicator]);

  const assignRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      listRef.current = node;

      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ref as React.MutableRefObject<any>).current = node;
      }
    },
    [ref]
  );

  return (
    <div className="relative inline-flex min-w-0 w-full">
      <TabsPrimitive.List
        ref={assignRef}
        data-slot="tabs-list"
        className={cn(
          "relative inline-flex h-full items-center text-muted-foreground min-w-0",
          className
        )}
        {...props}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 h-1 bg-primary transition-all duration-300 ease-in-out"
        style={{
          transform: `translateX(${indicatorStyle.left}px)`,
          width: indicatorStyle.width,
        }}
      />
    </div>
  );
});
AnimatedTabsList.displayName = TabsPrimitive.List.displayName;

const AnimatedTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    data-slot="tabs-trigger"
    className={cn(
      "inline-flex h-full items-center justify-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm font-medium transition-all",
      "text-muted-foreground hover:text-foreground hover:bg-muted/50",
      "data-[state=active]:text-foreground",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-50",
      "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      "relative z-10",
      className
    )}
    {...props}
  />
));
AnimatedTabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const AnimatedTabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    data-slot="tabs-content"
    className={cn("mt-2 flex-1 outline-none", className)}
    {...props}
  />
));
AnimatedTabsContent.displayName = TabsPrimitive.Content.displayName;

export {
  AnimatedTabs,
  AnimatedTabsContent,
  AnimatedTabsList,
  AnimatedTabsTrigger,
};
