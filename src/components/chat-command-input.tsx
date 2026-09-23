"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";

/** Matches .chat-command-editable min-height (2.25rem). */
const SINGLE_LINE_HEIGHT_PX = 36;
const LINE_HEIGHT_REM = 1.25;

interface ChatCommandInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  disabled?: boolean;
  onMultilineChange?: (multiline: boolean) => void;
  /** Overrides default grid placement (Alex bar: mode | input | attach | mic/send). */
  className?: string;
  /** Fixed minimum visible lines (e.g. AI Build = 5). */
  minLines?: number;
}

function placeCaretAtEnd(el: HTMLElement) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function ChatCommandInput({
  value,
  onChange,
  onKeyDown,
  placeholder,
  disabled,
  onMultilineChange,
  className,
  minLines,
}: ChatCommandInputProps) {
  const editableRef = useRef<HTMLDivElement>(null);
  const lastValueRef = useRef(value);
  const minHeightPx =
    minLines && minLines > 1
      ? Math.round(minLines * LINE_HEIGHT_REM * 16)
      : null;

  useEffect(() => {
    const el = editableRef.current;
    if (!el || el.innerText === value) {
      lastValueRef.current = value;
      return;
    }
    const grew = value.length >= lastValueRef.current.length;
    el.innerText = value;
    lastValueRef.current = value;
    // Keep caret at the end while voice / programmatic text streams in.
    if (grew && document.activeElement === el) {
      placeCaretAtEnd(el);
    }
  }, [value]);

  useEffect(() => {
    if (!onMultilineChange) return;
    if (minLines && minLines > 1) {
      onMultilineChange(true);
      return;
    }

    const el = editableRef.current;
    if (!el) return;

    const syncMultiline = () => {
      const hasExplicitBreak = el.innerText.includes("\n");
      const wrapped = el.scrollHeight > SINGLE_LINE_HEIGHT_PX + 1;
      onMultilineChange(hasExplicitBreak || wrapped);
    };

    syncMultiline();
    const observer = new ResizeObserver(syncMultiline);
    observer.observe(el);
    return () => observer.disconnect();
  }, [onMultilineChange, value, minLines]);

  return (
    <div
      className={
        className ??
        "chat-command-input-wrap col-start-2 row-start-1 min-w-0 self-end"
      }
    >
      <div
        ref={editableRef}
        role="textbox"
        aria-multiline="true"
        aria-placeholder={placeholder}
        contentEditable={disabled ? false : "plaintext-only"}
        suppressContentEditableWarning
        onInput={(e) => {
          const text = e.currentTarget.innerText.replace(/\n$/, "");
          lastValueRef.current = text;
          onChange(text);
          if (onMultilineChange && !(minLines && minLines > 1)) {
            const el = e.currentTarget;
            const hasExplicitBreak = el.innerText.includes("\n");
            const wrapped = el.scrollHeight > SINGLE_LINE_HEIGHT_PX + 1;
            onMultilineChange(hasExplicitBreak || wrapped);
          }
        }}
        onKeyDown={(e) => onKeyDown(e as unknown as KeyboardEvent<HTMLTextAreaElement>)}
        data-placeholder={placeholder}
        className="chat-command-editable"
        style={minHeightPx ? { minHeight: minHeightPx } : undefined}
      />
    </div>
  );
}
