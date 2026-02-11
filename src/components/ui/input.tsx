import { Component, JSX, splitProps } from "solid-js";
import { cn } from "~/lib/utils";

export interface InputProps extends JSX.InputHTMLAttributes<HTMLInputElement> {}

const Input: Component<InputProps> = (props) => {
  const [local, others] = splitProps(props, ["class", "type"]);

  return (
    <input
      type={local.type}
      class={cn(
        "flex min-h-11 w-full rounded-lg border border-input/60 bg-background px-4 py-3 text-base leading-6",
        "ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "placeholder:text-muted-foreground placeholder:font-normal",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:border-primary/60",
        "disabled:cursor-not-allowed disabled:opacity-50",
        local.class,
      )}
      {...others}
    />
  );
};

export default Input;
