import { children, Component, JSX, splitProps } from "solid-js";
import { cn } from "~/lib/utils";
import Info from "lucide-solid/icons/info";
import AlertTriangle from "lucide-solid/icons/alert-triangle";
import AlertCircle from "lucide-solid/icons/circle-alert";

export interface AlertProps extends JSX.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "warning" | "destructive";
}

const variantConfig: Record<string, { container: string; icon: string }> = {
  default: {
    container: "bg-secondary/60 text-foreground",
    icon: "text-muted-foreground",
  },
  warning: {
    container: "bg-secondary/60 text-foreground",
    icon: "text-amber-500 dark:text-amber-400",
  },
  destructive: {
    container: "bg-secondary/60 text-foreground",
    icon: "text-destructive",
  },
};

const variantIcon: Record<string, Component<{ class?: string }>> = {
  default: Info,
  warning: AlertTriangle,
  destructive: AlertCircle,
};

const Alert: Component<AlertProps> = (props) => {
  const [local, others] = splitProps(props, ["variant", "class", "children"]);
  const resolved = children(() => local.children);
  const variant = () => local.variant || "default";
  const config = () => variantConfig[variant()];
  const Icon = variantIcon[local.variant || "default"];

  return (
    <div
      role="alert"
      class={cn(
        "flex items-start gap-3 rounded-xl px-4 py-3.5",
        config().container,
        local.class
      )}
      {...others}
    >
      <Icon class={cn("mt-0.5 h-4 w-4 shrink-0", config().icon)} />
      <p class="text-sm leading-relaxed">{resolved()}</p>
    </div>
  );
};

export default Alert;
