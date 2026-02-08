import { Component, JSX, splitProps, Show } from "solid-js";
import { cn } from "~/lib/utils";
import Check from "lucide-solid/icons/check";

export interface CheckboxProps extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "type"> { }

const Checkbox: Component<CheckboxProps> = (props) => {
  const [local, others] = splitProps(props, ["class", "checked", "disabled"]);

  return (
    <div class="relative inline-flex items-center">
      <input
        type="checkbox"
        class={cn(
          "peer h-4 w-4 shrink-0 rounded border",
          "appearance-none cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          !local.checked && "hover:border-primary/60",
          local.class
        )}
        style={{
          "background-color": local.checked ? "hsl(var(--primary))" : "hsl(var(--background))",
          "border-color": local.checked ? "hsl(var(--primary))" : "hsl(var(--input) / 0.6)",
        }}
        {...others}
      />
      <Show when={local.checked}>
        <Check
          class={cn(
            "absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 text-white pointer-events-none"
          )}
        />
      </Show>
    </div>
  );
};

export default Checkbox;
