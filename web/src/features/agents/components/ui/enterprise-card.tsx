import { cva } from "class-variance-authority";

export const cardVariants = cva(
  "rounded-lg border bg-card text-card-foreground shadow-sm transition-colors",
  {
    variants: {
      variant: {
        default: "border-border hover:border-border-secondary",
        elevated: "border-border shadow-md",
        interactive: "border-border hover:border-primary/30 cursor-pointer transition-all duration-200",
      },
      padding: {
        none: "p-0",
        sm: "p-3",
        default: "p-4",
        lg: "p-6",
      }
    },
    defaultVariants: {
      variant: "default",
      padding: "default"
    }
  }
);
