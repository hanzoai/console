"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Building2, FolderKanban } from "lucide-react";
import { useRouter } from "next/router";

import { Avatar, AvatarFallback } from "@/src/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/src/components/ui/sidebar";

type Organization = {
  id: string;
  name: string;
  projects: Array<{ id: string; name: string }>;
};

type OrgProjectSwitcherProps = {
  organizations: Organization[];
  currentOrgId?: string;
  currentProjectId?: string;
};

export function OrgProjectSwitcher({ organizations, currentOrgId, currentProjectId }: OrgProjectSwitcherProps) {
  const router = useRouter();
  const { isMobile } = useSidebar();

  const currentOrg = organizations.find((o) => o.id === currentOrgId);
  const currentProject = currentOrg?.projects.find((p) => p.id === currentProjectId);

  const orgInitial = currentOrg?.name?.charAt(0)?.toUpperCase() ?? "?";

  // Preserve the current page path segment when switching projects
  // e.g. /project/old-id/bots → /project/new-id/bots
  const getProjectUrl = (projectId: string) => {
    const path = router.asPath;
    const match = path.match(/\/project\/[^/]+(\/.*)?/);
    const suffix = match?.[1] ?? "";
    return `/project/${projectId}${suffix}`;
  };

  const handleOrgChange = (org: Organization) => {
    if (org.id === currentOrgId) return;
    const firstProject = org.projects[0];
    if (firstProject) {
      void router.push(`/project/${firstProject.id}`);
    }
  };

  const handleProjectChange = (projectId: string) => {
    if (projectId === currentProjectId) return;
    void router.push(getProjectUrl(projectId));
  };

  if (organizations.length === 0) return null;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              tooltip={currentOrg?.name ?? "Select organization"}
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarFallback className="rounded-lg bg-primary text-primary-foreground text-xs">
                  {orgInitial}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{currentOrg?.name ?? "Select org"}</span>
                <span className="truncate text-xs text-muted-foreground">{currentProject?.name ?? "No project"}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="start"
            sideOffset={4}
          >
            {/* Organization section */}
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Building2 className="h-3 w-3" />
                Organizations
              </div>
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              {organizations.map((org) => (
                <DropdownMenuItem key={org.id} onClick={() => handleOrgChange(org)} className="gap-2">
                  <Avatar className="h-5 w-5 rounded-sm">
                    <AvatarFallback className="rounded-sm bg-primary/10 text-[10px]">
                      {org.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{org.name}</span>
                  {org.id === currentOrgId && <Check className="ml-auto h-4 w-4" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>

            {/* Project section */}
            {currentOrg && currentOrg.projects.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <FolderKanban className="h-3 w-3" />
                    Projects
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuGroup>
                  {currentOrg.projects
                    .filter((p) => !("deletedAt" in p) || !(p as Record<string, unknown>).deletedAt)
                    .map((project) => (
                      <DropdownMenuItem
                        key={project.id}
                        onClick={() => handleProjectChange(project.id)}
                        className="gap-2 pl-4"
                      >
                        <span className="truncate">{project.name}</span>
                        {project.id === currentProjectId && <Check className="ml-auto h-4 w-4" />}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuGroup>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
