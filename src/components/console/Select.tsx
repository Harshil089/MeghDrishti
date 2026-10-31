"use client";

import { Children, isValidElement, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";

type Opt = { value: string; label: ReactNode; text: string };

function extractText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join(" ");
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return extractText(node.props.children);
  }
  return "";
}

function extractOptions(children: ReactNode): Opt[] {
  const result: Opt[] = [];

  function walk(node: ReactNode) {
    Children.forEach(node, (c) => {
      if (!isValidElement(c)) return;
      if (c.type === "option") {
        const props = c.props as { value?: string | number; children?: ReactNode };
        const val = String(props.value ?? "");
        const labelNode = props.children;
        const text = extractText(labelNode) || val;
        result.push({ value: val, label: labelNode, text });
      } else if (c.type === "optgroup" || (c.props as { children?: ReactNode })?.children) {
        walk((c.props as { children?: ReactNode }).children);
      }
    });
  }

  walk(children);
  return result;
}

/**
 * Universal Native-Style Typeahead Select component (No Search Box).
 *
 * Implements W3C Combobox Typeahead:
 * - As the operator types keys (e.g., "m", "mah", "del"), it instantly jumps to and
 *   highlights the matching option and scrolls it into view.
 * - Repeated single-character keypresses (e.g., "m", "m", "m") cycle through all options
 *   starting with that character.
 * - Clean, distraction-free popover with no input box.
 * - Works whether the dropdown is closed or open.
 */
export function Select({
  value,
  onChange,
  children,
  className = "",
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  const options = useMemo(() => extractOptions(children), [children]);
  const selected = options.find((o) => o.value === value) ?? options[0];

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [alignRight, setAlignRight] = useState(false);

  const root = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeaheadBufferRef = useRef<string>("");
  const typeaheadTimerRef = useRef<NodeJS.Timeout | null>(null);
  const id = useId();

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setOpen(false);
        typeaheadBufferRef.current = "";
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Ensure active option is scrolled into view whenever active changes
  useEffect(() => {
    if (open) {
      listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
    }
  }, [open, active]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
    };
  }, []);

  function openDropdown() {
    const r = root.current?.getBoundingClientRect();
    setAlignRight(!!r && r.left + 260 > window.innerWidth);

    const initialIndex = options.findIndex((o) => o.value === value);
    setActive(Math.max(0, initialIndex));
    typeaheadBufferRef.current = "";
    setOpen(true);
  }

  function closeDropdown() {
    setOpen(false);
    typeaheadBufferRef.current = "";
    buttonRef.current?.focus();
  }

  function pick(val: string) {
    onChange({ target: { value: val } });
    closeDropdown();
  }

  // Typeahead search logic across options
  function handleTypeaheadKey(char: string) {
    if (typeaheadTimerRef.current) {
      clearTimeout(typeaheadTimerRef.current);
    }

    const prevBuffer = typeaheadBufferRef.current;
    const isSingleRepeat =
      char.toLowerCase() === prevBuffer.toLowerCase() && prevBuffer.length === 1;

    let newBuffer = isSingleRepeat ? char.toLowerCase() : prevBuffer + char.toLowerCase();
    typeaheadBufferRef.current = newBuffer;

    // Reset buffer after 800ms of inactivity
    typeaheadTimerRef.current = setTimeout(() => {
      typeaheadBufferRef.current = "";
    }, 800);

    let matchIndex = -1;

    if (isSingleRepeat) {
      // Cycle through options starting with that character from current active + 1
      const c = char.toLowerCase();
      const startFrom = (active + 1) % options.length;
      for (let offset = 0; offset < options.length; offset++) {
        const idx = (startFrom + offset) % options.length;
        if (options[idx].text.trim().toLowerCase().startsWith(c)) {
          matchIndex = idx;
          break;
        }
      }
    } else {
      // 1. Prefix match
      matchIndex = options.findIndex((o) =>
        o.text.trim().toLowerCase().startsWith(newBuffer)
      );

      // 2. Word prefix match (e.g., "Pradesh" in "Andhra Pradesh")
      if (matchIndex === -1) {
        matchIndex = options.findIndex((o) => {
          const words = o.text.trim().toLowerCase().split(/\s+/);
          return words.some((w) => w.startsWith(newBuffer));
        });
      }

      // 3. Substring match
      if (matchIndex === -1) {
        matchIndex = options.findIndex((o) =>
          o.text.trim().toLowerCase().includes(newBuffer)
        );
      }
    }

    if (matchIndex !== -1) {
      setActive(matchIndex);
      if (!open) {
        // If closed, typing directly updates selection (native OS behavior)
        onChange({ target: { value: options[matchIndex].value } });
      }
    }
  }

  // Keyboard navigation & typeahead key handler
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeDropdown();
      return;
    }

    if (e.key === "Tab") {
      if (open) {
        setOpen(false);
        typeaheadBufferRef.current = "";
      }
      return;
    }

    // When dropdown is closed
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        openDropdown();
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openDropdown();
        return;
      }

      // Typeahead while closed
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && /[a-zA-Z0-9]/.test(e.key)) {
        e.preventDefault();
        handleTypeaheadKey(e.key);
        return;
      }
      return;
    }

    // When dropdown is open
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(options.length - 1, a + 1));
      typeaheadBufferRef.current = "";
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
      typeaheadBufferRef.current = "";
      return;
    }

    if (e.key === "PageDown") {
      e.preventDefault();
      setActive((a) => Math.min(options.length - 1, a + 8));
      return;
    }

    if (e.key === "PageUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 8));
      return;
    }

    if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
      return;
    }

    if (e.key === "End") {
      e.preventDefault();
      setActive(options.length - 1);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (options[active]) {
        pick(options[active].value);
      }
      return;
    }

    if (e.key === " ") {
      // If typing buffer has characters, space is part of the query (e.g., "New Delhi")
      if (typeaheadBufferRef.current.length > 0) {
        e.preventDefault();
        handleTypeaheadKey(" ");
        return;
      }
      // Otherwise, Space selects active and closes
      e.preventDefault();
      if (options[active]) {
        pick(options[active].value);
      }
      return;
    }

    if (e.key === "Backspace") {
      if (typeaheadBufferRef.current.length > 0) {
        e.preventDefault();
        typeaheadBufferRef.current = typeaheadBufferRef.current.slice(0, -1);
        if (typeaheadBufferRef.current.length > 0) {
          handleTypeaheadKey("");
        }
        return;
      }
    }

    // Alphanumeric typeahead while dropdown is open
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && /[a-zA-Z0-9]/.test(e.key)) {
      e.preventDefault();
      handleTypeaheadKey(e.key);
      return;
    }
  }

  return (
    <div ref={root} className={`relative inline-block ${className}`} onKeyDown={handleKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={id}
        onClick={() => (open ? closeDropdown() : openDropdown())}
        className="flex h-8 w-full min-w-40 items-center justify-between gap-2 rounded-md border border-line bg-surface px-2.5 text-left text-[13px] text-ink transition-colors hover:bg-raised focus-visible:outline-2 focus-visible:outline-accent cursor-pointer"
      >
        <span className="truncate">{selected?.label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-sub transition-transform duration-150 ${
            open ? "rotate-180 text-accent" : ""
          }`}
        />
      </button>

      {open && (
        <div
          id={id}
          className={`absolute top-full z-[1000] mt-1 max-h-72 min-w-full w-max max-w-[24rem] overflow-hidden rounded-md border border-line bg-surface shadow-xl shadow-ink/15 animate-in fade-in-50 zoom-in-95 duration-100 ${
            alignRight ? "right-0" : "left-0"
          }`}
        >
          <ul
            ref={listRef}
            role="listbox"
            tabIndex={-1}
            aria-label={ariaLabel}
            className="max-h-72 overflow-y-auto divide-y divide-line/40 py-1 overscroll-contain focus:outline-none"
          >
            {options.map((o, i) => {
              const isSel = o.value === value;
              const isAct = i === active;
              return (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={isSel}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(o.value)}
                  className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-[13px] transition-colors ${
                    isAct
                      ? "bg-accent-soft/80 text-ink font-semibold"
                      : "text-ink hover:bg-raised/70"
                  } ${isSel && !isAct ? "bg-accent-soft/30 font-medium" : ""}`}
                >
                  <span className="truncate">{o.label}</span>
                  {isSel && <Check className="h-3.5 w-3.5 shrink-0 text-accent" />}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
