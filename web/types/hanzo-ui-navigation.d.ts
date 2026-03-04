// Type declarations for @hanzo/ui/navigation
// The @hanzo/ui@5.3.38 package outputs .d.ts to dist/src/navigation/ instead of dist/navigation/
// This shim provides correct types until the package build is fixed.
declare module "@hanzo/ui/navigation" {
  import type { ReactNode } from "react";

  export type HanzoApp = {
    id: string;
    label: string;
    href: string;
    icon?: ReactNode;
    description?: string;
  };

  export type HanzoOrg = {
    id: string;
    name: string;
    slug: string;
    role?: string;
  };

  export type HanzoUser = {
    id?: string;
    name?: string;
    email: string;
    avatar?: string;
  };

  export type HanzoShellProps = {
    currentApp: string;
    currentAppId?: string;
    user?: HanzoUser;
    organizations?: HanzoOrg[];
    currentOrgId?: string;
    onOrgSwitch?: (orgId: string) => void;
    onSignOut?: () => void;
    apps?: HanzoApp[];
    headerRight?: ReactNode;
    children?: ReactNode;
  };

  export function HanzoHeader(
    props: Omit<HanzoShellProps, "children">,
  ): import("react/jsx-runtime").JSX.Element;

  export function useHanzoAuth(): {
    user: HanzoUser | undefined;
    organizations: HanzoOrg[];
    currentOrgId: string | undefined;
    token: string | null;
    loading: boolean;
    signOut: () => void;
    switchOrg: (orgId: string) => void;
  };

  export const AppSwitcher: React.ComponentType<any>;
  export const UserOrgDropdown: React.ComponentType<any>;
  export const HanzoCommandPalette: React.ComponentType<any>;
  export const DEFAULT_HANZO_APPS: HanzoApp[];
}
