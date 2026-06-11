import * as React from "react";
import { cn } from "@/lib/utils";

export interface AutoResizeTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "rows"> {
  minRows?: number;
  maxRows?: number;
}

/**
 * Textarea com altura adaptável ao conteúdo. Substitui um <Input> de título
 * que precisa crescer conforme o texto digitado.
 */
export const AutoResizeTextarea = React.forwardRef<
  HTMLTextAreaElement,
  AutoResizeTextareaProps
>(({ className, minRows = 1, maxRows = 8, value, onChange, style, ...props }, ref) => {
  const innerRef = React.useRef<HTMLTextAreaElement | null>(null);

  const setRefs = React.useCallback(
    (node: HTMLTextAreaElement | null) => {
      innerRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
    },
    [ref]
  );

  const resize = React.useCallback(() => {
    const el = innerRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = parseInt(window.getComputedStyle(el).lineHeight || "20", 10) || 20;
    const maxHeight = lineHeight * maxRows;
    const minHeight = lineHeight * minRows;
    const next = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [maxRows, minRows]);

  React.useLayoutEffect(() => {
    resize();
  }, [resize, value]);

  return (
    <textarea
      ref={setRefs}
      value={value}
      onChange={(e) => {
        onChange?.(e);
        resize();
      }}
      rows={minRows}
      style={{ resize: "none", ...style }}
      className={cn(
        "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
});
AutoResizeTextarea.displayName = "AutoResizeTextarea";