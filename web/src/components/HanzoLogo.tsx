import { cn } from "@/src/utils/tailwind";
import Link from "next/link";
import { VersionLabel } from "./VersionLabel";
import { env } from "@/src/env.mjs";
import { useUiCustomization } from "@/src/features/ui-customization/useUiCustomization";
import { PlusIcon } from "lucide-react";

export const HanzoCloudIcon = ({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src={`${env.NEXT_PUBLIC_BASE_PATH ?? ""}/icon.svg`}
    width={size}
    height={size}
    alt="Hanzo Cloud Icon"
    className={className}
  />
);

// Alias for backwards compatibility with HanzoIcon imports
export const HanzoIcon = HanzoCloudIcon;

const HanzoCloudLogotypeOrCustomized = ({ size }: { size: "sm" | "xl" }) => {
  const uiCustomization = useUiCustomization();

  if (uiCustomization?.logoLightModeHref && uiCustomization?.logoDarkModeHref) {
    // logo is a url, maximum aspect ratio of 1:3 needs to be supported according to docs
    return (
      <div className="flex items-center gap-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={uiCustomization.logoLightModeHref}
          alt="Hanzo Cloud Logo"
          className={cn(
            "group-data-[collapsible=icon]:hidden dark:hidden",
            size === "sm" ? "max-h-4 max-w-14" : "max-h-5 max-w-16",
          )}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={uiCustomization.logoDarkModeHref}
          alt="Hanzo Cloud Logo"
          className={cn(
            "hidden group-data-[collapsible=icon]:hidden dark:block",
            size === "sm" ? "max-h-4 max-w-14" : "max-h-5 max-w-16",
          )}
        />
        <PlusIcon
          size={size === "sm" ? 8 : 12}
          className="group-data-[collapsible=icon]:hidden"
        />
        <HanzoCloudIcon size={size === "sm" ? 16 : 20} />
      </div>
    );
  }

  return (
    <div className="flex items-center">
      <HanzoCloudIcon size={size === "sm" ? 16 : 20} />
      <span
        className={cn(
          "ml-2 font-mono font-semibold leading-none group-data-[collapsible=icon]:hidden",
          size === "sm" ? "text-sm" : "text-xl",
        )}
      >
        Hanzo
      </span>
    </div>
  );
};

export const HanzoCloudLogo = ({
  className,
  size = "sm",
  version = false,
}: {
  size?: "sm" | "xl";
  className?: string;
  version?: boolean;
}) => {
  return (
    <div
      className={cn(
        "-mt-2 ml-1 flex flex-wrap gap-4 lg:flex-col lg:items-start",
        className,
      )}
    >
      {/* Hanzo Cloud Logo */}
      <div className="flex items-center">
        <Link href="/" className="flex items-center">
          <HanzoCloudLogotypeOrCustomized size={size} />
        </Link>
        {version && (
          <VersionLabel className="ml-2 group-data-[collapsible=icon]:hidden" />
        )}
      </div>
    </div>
  );
};

// Alias for backwards compatibility
export const HanzoLogo = HanzoCloudLogo;
