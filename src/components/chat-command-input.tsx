"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";

interface ChatCommandInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  disabled?: boolean;
}

export function ChatCommandInput({
  value,
  onChange,
  onKeyDown,
  placeholder,
  disabled,
}: ChatCommandInputProps) {
  const editableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = editableRef.current;
    if (!el || el.innerText === value) return;
    el.innerText = value;
  }, [value]);

  return (
    <div className="chat-command-input-wrap col-start-2 row-start-1 min-w-0 self-end">
      <div
        ref={editableRef}
        role="textbox"
        aria-multiline="true"
        aria-placeholder={placeholder}
        contentEditable={disabled ? false : "plaintext-only"}
        suppressContentEditableWarning
        onInput={(e) => {
          const text = e.currentTarget.innerText.replace(/\n$/, "");
          onChange(text);
        }}
        onKeyDown={(e) => onKeyDown(e as unknown as KeyboardEvent<HTMLTextAreaElement>)}
        data-placeholder={placeholder}
        className="chat-command-editable"
      />
    </div>
  );
}
