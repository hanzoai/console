"use client";

/**
 * Re-export wrapper for @hanzo/ui/navigation components.
 *
 * The @hanzo/ui/navigation package exports HanzoHeader and useHanzoAuth at
 * runtime, but webpack's static CJS analysis cannot detect them in the
 * minified bundle, producing "Attempted import error" warnings that break
 * the CI Docker build.
 *
 * This module re-exports the real components via require() to bypass
 * webpack's static named-export analysis while preserving full runtime
 * functionality. Types are provided by web/types/hanzo-ui-navigation.d.ts.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const _nav = require("@hanzo/ui/navigation");

// Re-export with explicit typing so consumers get proper IntelliSense
export const HanzoHeader: React.FC<{
  currentApp: string;
  currentAppId?: string;
  user?: { id?: string; name?: string; email: string; avatar?: string };
  organizations?: Array<{ id: string; name: string; slug: string; role?: string }>;
  currentOrgId?: string;
  onOrgSwitch?: (orgId: string) => void;
  onSignOut?: () => void;
  apps?: Array<{ id: string; label: string; href: string; icon?: React.ReactNode; description?: string }>;
  headerRight?: React.ReactNode;
}> = _nav.HanzoHeader;

export const useHanzoAuth: () => {
  user: { id?: string; name?: string; email: string; avatar?: string } | undefined;
  organizations: Array<{ id: string; name: string; slug: string; role?: string }>;
  currentOrgId: string | undefined;
  token: string | null;
  loading: boolean;
  signOut: () => void;
  switchOrg: (orgId: string) => void;
} = _nav.useHanzoAuth;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const AppSwitcher: React.ComponentType<any> = _nav.AppSwitcher;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const UserOrgDropdown: React.ComponentType<any> = _nav.UserOrgDropdown;
export const DEFAULT_HANZO_APPS: Array<{
  id: string;
  label: string;
  href: string;
  icon?: React.ReactNode;
  description?: string;
}> = _nav.DEFAULT_HANZO_APPS;
