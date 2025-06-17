
import { cn } from "@/src/utils/tailwind";
import { Slot } from "@radix-ui/react-slot";
import * as React from "react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"

    const variantClasses = {
      default: "bg-gray-900 text-[var(--white)] hover:bg-gray-800",
      destructive: "bg-red-600 text-[var(--white)] hover:bg-red-700",
      outline: "border border-white/20 bg-[var(--white)]/5 hover:bg-[var(--white)]/10 text-[var(--white)]",
      secondary: "bg-gray-800 text-[var(--white)] hover:bg-gray-700",
      ghost: "hover:bg-[var(--white)]/10 text-[var(--white)]",
      link: "text-[var(--white)] underline-offset-4 hover:underline"
    }

    const sizeClasses = {
      default: "h-10 px-4 py-2",
      sm: "h-9 rounded-md px-3",
      lg: "h-11 rounded-md px-8",
      icon: "h-10 w-10"
    }

    return (
      <Comp
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button };

