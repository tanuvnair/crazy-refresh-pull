import { Component, JSX, splitProps } from "solid-js";
import { cn } from "~/lib/utils";

export interface SeparatorProps extends JSX.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
}

const Separator: Component<SeparatorProps> = (props) => {
  const [local, others] = splitProps(props, ["orientation", "class"]);

  return (
    <div
      class={cn(
        "shrink-0 bg-border/60",
        local.orientation === "vertical" ? "h-full w-px" : "h-px w-full",
        local.class
      )}
      role="separator"
      aria-orientation={local.orientation || "horizontal"}
      {...others}
    />
  );
};

export default Separator;
