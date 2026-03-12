import { EnvLabel } from "@/src/components/EnvLabel";
import { ItemBadge, type ConsoleItemType } from "@/src/components/ItemBadge";
import BreadcrumbComponent from "@/src/components/layouts/breadcrumb";
import DocPopup from "@/src/components/layouts/doc-popup";
import { SidebarTrigger } from "@/src/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/src/components/ui/tooltip";
import { cn } from "@/src/utils/tailwind";
import Link from "next/link";
import { useRouter } from "next/router";
import { type ParsedUrlQuery } from "querystring";
import { type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/src/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { useCommandMenu } from "@/src/features/command-k-menu/CommandMenuProvider";
import { Search } from "lucide-react";

type TabDefinition = {
  value: string;
  label: string;
  href: string;
  querySelector?: (query: ParsedUrlQuery) => Record<string, string | string[] | undefined>;
  disabled?: boolean;
  className?: string;
};

type PageTabsProps = {
  tabs: TabDefinition[];
  activeTab: string;
  className?: string;
  listClassName?: string;
};

export type PageHeaderProps = {
  title: string;
  breadcrumb?: { name: string; href?: string }[];
  actionButtonsLeft?: React.ReactNode; // Right-side actions (buttons, etc.)
  actionButtonsRight?: React.ReactNode; // Right-side actions (buttons, etc.)
  help?: { description: React.ReactNode; href?: string; className?: string };
  titleTooltip?: string;
  itemType?: ConsoleItemType;
  container?: boolean;
  tabsProps?: PageTabsProps;
  className?: string;
  showSidebarTrigger?: boolean;
  leadingControl?: ReactNode;
  titleBadges?: ReactNode;
  breadcrumbBadges?: ReactNode;
};

const PageHeader = ({
  title,
  itemType,
  actionButtonsLeft,
  actionButtonsRight,
  breadcrumb,
  help,
  titleTooltip,
  tabsProps,
  container = false,
  className,
  showSidebarTrigger = true,
  leadingControl,
  titleBadges,
  breadcrumbBadges,
}: PageHeaderProps) => {
  const router = useRouter();
  return (
    <div
      className={cn(["sticky top-banner-offset z-30 w-full border-b bg-background shadow-sm", className])}
      id="page-header"
    >
      <div className="flex flex-col justify-center">
        {/* Top Row — unified header bar */}
        <div className="border-b">
          <div className={cn("flex min-h-11 items-center gap-3 px-3 py-2", container && "lg:container")}>
            {showSidebarTrigger ? (
              <SidebarTrigger />
            ) : (
              leadingControl && <div className="flex items-center">{leadingControl}</div>
            )}
            <div>
              <EnvLabel />
            </div>
            <div className="flex flex-1 items-center gap-2">
              <BreadcrumbComponent items={breadcrumb} />
              {breadcrumbBadges}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <HeaderCommandK />
              <HeaderAccountMenu />
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="bg-header">
          <div
            className={cn(
              "flex min-h-11 w-full flex-wrap items-center justify-between gap-1 px-3 py-1 md:flex-nowrap",
              container && "lg:container",
            )}
          >
            {/* Left side content */}
            <div className="flex flex-grow flex-wrap items-center md:flex-grow-0">
              <div className="mr-2 flex items-center gap-1">
                {itemType && (
                  <div className="flex items-center">
                    <ItemBadge type={itemType} showLabel />
                  </div>
                )}
                <div className="relative inline-block max-w-md md:max-w-none">
                  <h2 className="line-clamp-1 text-lg font-semibold leading-7">
                    {titleTooltip ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help break-words" data-testid="page-header-title">
                              {title}
                              {help && (
                                <span className="whitespace-nowrap">
                                  &nbsp;
                                  <DocPopup
                                    description={help.description}
                                    href={help.href}
                                    className={help.className}
                                  />
                                </span>
                              )}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs">
                            {titleTooltip}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <span className="break-words" title={title} data-testid="page-header-title">
                        {title}
                        {help && (
                          <span className="whitespace-nowrap">
                            &nbsp;
                            <DocPopup description={help.description} href={help.href} className={help.className} />
                          </span>
                        )}
                      </span>
                    )}
                  </h2>
                </div>
                {titleBadges && <div className="ml-1 flex items-center gap-1">{titleBadges}</div>}
              </div>
              {actionButtonsLeft && (
                <div className="flex flex-wrap items-center gap-1 self-center">{actionButtonsLeft}</div>
              )}
            </div>

            {/* Right side content */}
            <div className="ml-auto flex flex-grow flex-wrap items-center justify-end gap-1">{actionButtonsRight}</div>
          </div>

          {tabsProps && (
            <div className={cn("ml-2", tabsProps.className)}>
              <div className={cn("inline-flex h-8 items-center justify-start", tabsProps.listClassName)}>
                {tabsProps.tabs.map((tab) => (
                  <Link
                    key={tab.value}
                    href={{
                      pathname: tab.href,
                      query: tab.querySelector?.(router.query),
                    }}
                    className={cn(
                      "inline-flex h-full items-center justify-center whitespace-nowrap rounded-none border-b-4 border-transparent px-2 py-0.5 text-sm font-medium transition-all hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      tab.value === tabsProps.activeTab ? "border-primary-accent bg-transparent shadow-none" : "",
                      tab.disabled && "pointer-events-none opacity-50",
                      tab.className,
                    )}
                  >
                    {tab.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function HeaderCommandK() {
  let cmdMenu: { setOpen: (open: boolean) => void } | undefined;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    cmdMenu = useCommandMenu();
  } catch {
    // CommandMenuProvider not available
  }

  if (!cmdMenu) return null;

  return (
    <button
      type="button"
      onClick={() => cmdMenu!.setOpen(true)}
      className="flex h-8 items-center gap-2 rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted"
    >
      <Search className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Search</span>
      <kbd className="pointer-events-none ml-1 hidden h-5 select-none items-center gap-0.5 rounded border px-1.5 font-mono text-[10px] sm:inline-flex">
        <span className="text-[11px]">⌘</span>K
      </kbd>
    </button>
  );
}

function HeaderAccountMenu() {
  const { data: session } = useSession();
  const user = session?.user;
  if (!user) return null;

  const initials = (user.name ?? user.email ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-border transition-colors hover:ring-foreground/20"
        >
          <Avatar className="h-7 w-7">
            <AvatarImage src={user.image ?? ""} alt={user.name ?? ""} />
            <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium">{user.name ?? "User"}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account/settings">Account Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="https://billing.hanzo.ai" target="_blank" rel="noopener noreferrer">
            Billing
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="https://hanzo.chat" target="_blank" rel="noopener noreferrer">
            Chat
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="https://cloud.hanzo.ai" target="_blank" rel="noopener noreferrer">
            Cloud
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="https://platform.hanzo.ai" target="_blank" rel="noopener noreferrer">
            Platform
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default PageHeader;
