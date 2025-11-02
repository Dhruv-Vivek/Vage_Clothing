import React from "react";
import { cn } from "../../lib/utils";

export const Button = React.forwardRef(({ className, children, ...props }, ref) => {
  return (
    <button
      ref={ref}
      className={cn(
        "relative inline-flex h-12 overflow-hidden rounded-lg p-[1px] focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-dark",
        className
      )}
      {...props}
    >
      <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#ffffff_0%,#4a4a4a_50%,#ffffff_100%)]" />
      <span className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-lg bg-dark px-8 py-1 text-sm font-medium text-white backdrop-blur-3xl hover:bg-dark-secondary transition-colors">
        {children}
      </span>
    </button>
  );
});

Button.displayName = "Button";

export function MovingBorderButton({ children, className, ...props }) {
  return (
    <Button className={className} {...props}>
      {children}
    </Button>
  );
}