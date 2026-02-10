import { cva } from "class-variance-authority";

export const typographyVariants = cva("", {
  variants: {
    variant: {
      display: "text-display",
      heading: "text-heading-1",
      subheading: "text-heading-2",
      section: "text-heading-3",
      body: "text-body",
      secondary: "text-body-small",
      tertiary: "text-caption",
      disabled: "text-body-small text-text-disabled",
    }
  },
  defaultVariants: {
    variant: "body",
  },
});
