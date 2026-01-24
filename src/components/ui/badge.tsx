import { Component, JSX, splitProps } from "solid-js";
import { cn } from "~/lib/utils";

export interface BadgeProps extends JSX.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "destructive";
}

const Badge: Component<BadgeProps> = (props) => {
  const [local, others] = splitProps(props, ["variant", "class", "children"]);

  const variantClasses = {
    default: "bg-primary text-primary-foreground",
    secondary: "bg-secondary text-secondary-foreground",
    outline: "border border-border bg-background text-foreground",
    destructive: "bg-destructive text-destructive-foreground",
  };

  return (
    <div
      class={cn(
        "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium leading-5 min-h-6",
        variantClasses[local.variant || "default"],
        local.class
      )}
      {...others}
    >
      {local.children}
    </div>
  );
};

export default Badge;
