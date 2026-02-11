import { Component, JSX, splitProps } from "solid-js";
import { cn } from "~/lib/utils";

export interface LabelProps extends JSX.LabelHTMLAttributes<HTMLLabelElement> {
  selectable?: boolean;
}

const Label: Component<LabelProps> = (props) => {
  const [local, others] = splitProps(props, [
    "class",
    "children",
    "selectable",
  ]);

  return (
    <label
      class={cn(
        "flex flex-row gap-2 items-center text-base font-medium leading-6 text-foreground",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        local.selectable === false && "select-none",
        local.class,
      )}
      {...others}
    >
      {local.children}
    </label>
  );
};

export default Label;
