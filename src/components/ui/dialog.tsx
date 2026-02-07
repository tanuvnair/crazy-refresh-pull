import { Component, JSX, createEffect, onCleanup, createSignal, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { cn } from "~/lib/utils";

const DURATION_MS = 200;

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  class?: string;
  children: JSX.Element;
}

export interface DialogContentProps {
  class?: string;
  children: JSX.Element;
}

export interface DialogHeaderProps {
  class?: string;
  children: JSX.Element;
}

export interface DialogBodyProps {
  class?: string;
  children: JSX.Element;
}

export interface DialogFooterProps {
  class?: string;
  children: JSX.Element;
}

export interface DialogTitleProps {
  class?: string;
  children: JSX.Element;
}

export interface DialogDescriptionProps {
  class?: string;
  children: JSX.Element;
}

const Dialog: Component<DialogProps> = (props) => {
  const [entered, setEntered] = createSignal(false);
  const [exiting, setExiting] = createSignal(false);

  /** Stay mounted while exit animation plays */
  const visible = () => props.open || exiting();
  const state = () => (entered() && !exiting() ? "open" : "closed");

  const close = () => {
    if (exiting()) return;
    setExiting(true);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") close();
  };

  // Open/close lifecycle
  createEffect(() => {
    if (props.open) {
      setExiting(false);
      setEntered(false);
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setEntered(true));
      });
      onCleanup(() => cancelAnimationFrame(raf));
    } else if (entered()) {
      // Only trigger exit animation if we were previously entered (avoids initial mount flicker)
      setExiting(true);
    }
  });

  // Exit animation timer -- after animation completes, unmount and notify parent
  createEffect(() => {
    if (!exiting()) return;
    const id = setTimeout(() => {
      setExiting(false);
      setEntered(false);
      props.onOpenChange(false);
    }, DURATION_MS);
    onCleanup(() => clearTimeout(id));
  });

  // Body scroll lock and keyboard handling while open
  createEffect(() => {
    if (!visible()) return;
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    onCleanup(() => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    });
  });

  return (
    <Show when={visible()}>
      <Portal mount={document.body}>
        <div
          class="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            class="dialog-overlay fixed inset-0 bg-black/50"
            data-state={state()}
            data-exiting={exiting() ? "true" : undefined}
            onclick={close}
            aria-hidden="true"
          />
          <div
            class={cn("dialog-content relative z-[9999]", props.class)}
            data-state={state()}
            data-exiting={exiting() ? "true" : undefined}
            onclick={(e) => e.stopPropagation()}
          >
            {props.children}
          </div>
        </div>
      </Portal>
    </Show>
  );
};

const DialogContent: Component<DialogContentProps> = (props) => (
  <div
    class={cn(
      "flex w-full flex-col sm:w-lg sm:max-w-lg max-h-[85vh] rounded-lg border border-border bg-card text-card-foreground shadow-apple-xl",
      props.class
    )}
  >
    {props.children}
  </div>
);

const DialogHeader: Component<DialogHeaderProps> = (props) => (
  <div class={cn("sticky top-0 z-10 flex flex-col gap-1.5 border-b border-border bg-card px-6 pt-6 pb-4 rounded-t-lg", props.class)}>
    {props.children}
  </div>
);

const DialogBody: Component<DialogBodyProps> = (props) => (
  <div class={cn("flex-1 overflow-y-auto px-6 py-4", props.class)}>
    {props.children}
  </div>
);

const DialogFooter: Component<DialogFooterProps> = (props) => (
  <div class={cn("sticky bottom-0 z-10 flex items-center justify-end border-t border-border bg-card px-6 py-4 rounded-b-lg", props.class)}>
    {props.children}
  </div>
);

const DialogTitle: Component<DialogTitleProps> = (props) => (
  <h2 class={cn("text-lg font-semibold leading-none", props.class)}>{props.children}</h2>
);

const DialogDescription: Component<DialogDescriptionProps> = (props) => (
  <p class={cn("text-sm text-muted-foreground", props.class)}>{props.children}</p>
);

export default Dialog;
export { DialogContent, DialogHeader, DialogBody, DialogFooter, DialogTitle, DialogDescription };
