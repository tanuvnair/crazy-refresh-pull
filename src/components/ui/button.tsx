import { Component, JSX, splitProps } from "solid-js";
import { cn } from "~/lib/utils";

export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "link" | "destructive";
  size?: "default" | "xs" | "sm" | "lg" | "icon";
}

const Button: Component<ButtonProps> = (props) => {
  const [local, others] = splitProps(props, ["variant", "size", "class"]);

  const variantClasses = {
    default: "bg-primary text-white hover:bg-primary/90 active:bg-primary/95 shadow-apple-button hover:shadow-apple-button-hover active:shadow-none",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/90",
    outline: "border border-border/60 bg-background text-foreground hover:bg-accent/50 hover:border-border active:bg-accent",
    ghost: "text-foreground hover:bg-accent/50 active:bg-accent",
    link: "text-primary underline-offset-4 hover:underline bg-transparent shadow-none",
    destructive: "bg-destructive text-white hover:bg-destructive/90 active:bg-destructive/95 shadow-apple-button hover:shadow-apple-button-hover active:shadow-none",
  };

  const sizeClasses = {
    default: "min-h-11 px-5 text-base font-medium leading-6",
    xs: "min-h-8 px-3 text-xs font-medium leading-5",
    sm: "min-h-11 px-4 text-sm font-medium leading-5",
    lg: "min-h-12 px-6 text-lg font-semibold leading-7",
    icon: "h-11 w-11",
  };

  return (
    <button
      class={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-[color,background-color,border-color,box-shadow]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none",
        "select-none",
        variantClasses[local.variant || "default"],
        sizeClasses[local.size || "default"],
        local.class
      )}
      {...others}
    >
      {props.children}
    </button>
  );
};

export default Button;
