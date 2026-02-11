import { Component, JSX, splitProps } from "solid-js";
import { cn } from "~/lib/utils";

export type CardProps = JSX.HTMLAttributes<HTMLDivElement>;

const Card: Component<CardProps> = (props) => {
  const [local, others] = splitProps(props, ["class", "children"]);

  return (
    <div
      class={cn(
        "rounded-2xl border border-border bg-card text-card-foreground shadow-apple p-4",
        local.class,
      )}
      {...others}
    >
      {local.children}
    </div>
  );
};

export type CardHeaderProps = JSX.HTMLAttributes<HTMLDivElement>;

const CardHeader: Component<CardHeaderProps> = (props) => {
  const [local, others] = splitProps(props, ["class", "children"]);

  return (
    <div
      class={cn("flex flex-col gap-2 px-6 pt-6 pb-4", local.class)}
      {...others}
    >
      {local.children}
    </div>
  );
};

export type CardTitleProps = JSX.HTMLAttributes<HTMLHeadingElement>;

const CardTitle: Component<CardTitleProps> = (props) => {
  const [local, others] = splitProps(props, ["class", "children"]);

  return (
    <h3 class={cn("text-2xl font-semibold leading-8", local.class)} {...others}>
      {local.children}
    </h3>
  );
};

export type CardDescriptionProps = JSX.HTMLAttributes<HTMLParagraphElement>;

const CardDescription: Component<CardDescriptionProps> = (props) => {
  const [local, others] = splitProps(props, ["class", "children"]);

  return (
    <p
      class={cn(
        "text-base font-normal leading-6 text-muted-foreground",
        local.class,
      )}
      {...others}
    >
      {local.children}
    </p>
  );
};

export type CardContentProps = JSX.HTMLAttributes<HTMLDivElement>;

const CardContent: Component<CardContentProps> = (props) => {
  const [local, others] = splitProps(props, ["class", "children"]);

  return (
    <div
      class={cn("flex flex-col gap-4 px-6 pt-4 pb-6", local.class)}
      {...others}
    >
      {local.children}
    </div>
  );
};

export type CardFooterProps = JSX.HTMLAttributes<HTMLDivElement>;

const CardFooter: Component<CardFooterProps> = (props) => {
  const [local, others] = splitProps(props, ["class", "children"]);

  return (
    <div
      class={cn("flex items-center px-6 pt-2 pb-6", local.class)}
      {...others}
    >
      {local.children}
    </div>
  );
};

export { CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
export default Card;
