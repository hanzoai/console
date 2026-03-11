import * as React from "react";
import { type SVGProps } from "react";

export const InsightsLogo = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 60" {...props}>
    <text
      x="0"
      y="45"
      fill="currentColor"
      fontFamily="system-ui, -apple-system, sans-serif"
      fontSize="48"
      fontWeight="600"
      letterSpacing="-1"
    >
      Hanzo Insights
    </text>
  </svg>
);
