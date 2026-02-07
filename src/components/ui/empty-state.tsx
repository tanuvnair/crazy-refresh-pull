import { children, Component, JSX, splitProps } from "solid-js";
import { cn } from "~/lib/utils";

export interface EmptyStateProps extends JSX.HTMLAttributes<HTMLDivElement> {
  /** Primary message */
  title: string;
  /** Optional secondary description */
  description?: string;
  /** Optional action slot (e.g. a button) */
  action?: JSX.Element;
}

const EmptyState: Component<EmptyStateProps> = (props) => {
  const [local, others] = splitProps(props, ["title", "description", "action", "class", "children"]);
  const resolvedAction = children(() => local.action);
  const resolvedChildren = children(() => local.children);

  return (
    <div
      class={cn(
        "rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-muted-foreground",
        local.class
      )}
      {...others}
    >
      <p class="text-sm font-medium">{local.title}</p>
      {local.description && (
        <p class="mt-1 text-sm">{local.description}</p>
      )}
      {resolvedAction() && (
        <div class="mt-4">{resolvedAction()}</div>
      )}
      {resolvedChildren()}
    </div>
  );
};

export default EmptyState;
