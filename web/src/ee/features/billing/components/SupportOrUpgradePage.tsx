import type { ReactNode } from "react";

interface SupportOrUpgradePageProps {
  children?: ReactNode;
  title?: string;
  description?: string;
}

export function SupportOrUpgradePage({ children, title, description }: SupportOrUpgradePageProps) {
  if (children) return <>{children}</>;
  return null;
}
