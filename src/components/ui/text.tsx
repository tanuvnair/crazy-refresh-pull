import { children, Component, JSX, splitProps } from "solid-js";
import { cn } from "~/lib/utils";

export interface TextProps extends JSX.HTMLAttributes<HTMLParagraphElement> {
  variant?: "body" | "caption" | "footnote" | "headline" | "subheadline" | "title1" | "title2" | "title3";
  muted?: boolean;
}

const Text: Component<TextProps> = (props) => {
  const [local, others] = splitProps(props, ["variant", "muted", "class", "children"]);
  const resolved = children(() => local.children);

  const variantClasses = {
    body: "text-lg font-normal leading-7",
    caption: "text-xs font-normal leading-5",
    footnote: "text-sm font-normal leading-6",
    headline: "text-lg font-semibold leading-7",
    subheadline: "text-base font-normal leading-6",
    title1: "text-4xl font-bold leading-tight",
    title2: "text-3xl font-bold leading-tight",
    title3: "text-xl font-semibold leading-8",
  };

  return (
    <p
      class={cn(
        variantClasses[local.variant || "body"],
        local.muted && "text-muted-foreground",
        local.class
      )}
      {...others}
    >
      {resolved()}
    </p>
  );
};

export default Text;
