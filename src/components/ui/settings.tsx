import { Component, JSX } from "solid-js";
import { cn } from "~/lib/utils";

// ── Section header: uppercase label above a group ──

export interface SettingsSectionProps {
  class?: string;
  children: JSX.Element;
}

export const SettingsSection: Component<SettingsSectionProps> = (props) => (
  <p
    class={cn(
      "text-xs font-medium uppercase tracking-wider text-muted-foreground pt-4 first:pt-2",
      props.class,
    )}
  >
    {props.children}
  </p>
);

// ── Group: rounded bordered container for rows ──

export interface SettingsGroupProps {
  class?: string;
  children: JSX.Element;
}

export const SettingsGroup: Component<SettingsGroupProps> = (props) => (
  <div
    class={cn(
      "rounded-lg border border-border bg-background overflow-hidden",
      props.class,
    )}
  >
    {props.children}
  </div>
);

// ── Row: label (+ optional description) on left, control slot on right ──

export interface SettingsRowProps {
  /** Primary label text */
  label: string;
  /** Optional secondary description below the label */
  description?: string;
  /** Whether to show a bottom border (default true) */
  border?: boolean;
  /** Extra class on the row container */
  class?: string;
  /** Control(s) rendered on the right side */
  children: JSX.Element;
}

export const SettingsRow: Component<SettingsRowProps> = (props) => {
  const showBorder = () => props.border !== false;

  return (
    <div
      class={cn(
        "flex items-center justify-between px-4 py-3",
        showBorder() && "border-b border-border",
        props.class,
      )}
    >
      <div class="flex flex-col gap-0.5 min-w-0 mr-3">
        <span class="text-sm">{props.label}</span>
        {props.description && (
          <span class="text-xs text-muted-foreground">{props.description}</span>
        )}
      </div>
      <div class="shrink-0">{props.children}</div>
    </div>
  );
};

// ── Content row: full-width content below a label ──

export interface SettingsContentRowProps {
  /** Primary label text */
  label: string;
  /** Optional secondary description below the content */
  description?: string;
  /** Whether to show a bottom border (default true) */
  border?: boolean;
  /** Extra class on the row container */
  class?: string;
  /** Content rendered below the label */
  children: JSX.Element;
}

export const SettingsContentRow: Component<SettingsContentRowProps> = (
  props,
) => {
  const showBorder = () => props.border !== false;

  return (
    <div
      class={cn(
        "flex flex-col gap-2 px-4 py-3",
        showBorder() && "border-b border-border",
        props.class,
      )}
    >
      <span class="text-sm">{props.label}</span>
      {props.children}
      {props.description && (
        <span class="text-xs text-muted-foreground">{props.description}</span>
      )}
    </div>
  );
};
