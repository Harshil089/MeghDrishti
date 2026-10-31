"use client";

import { Children, isValidElement, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

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

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.trim().toLowerCase() ? (
          <mark key={i} className="rounded bg-accent/20 px-0.5 font-semibold text-accent">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

/**
 * Universal Typeahead Select component.
 * Provides instant live filtering, keyboard-driven navigation,
 * matching text highlights, and accessible ARIA combobox patterns.
 */
export function Select({
  value,
  onChange,
  children,
  className = "",
  placeholder,
  searchable,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  children: ReactNode;
  className?: string;
  placeholder?: string;
  searchable?: boolean;
  "aria-label"?: string;
}) {
  const options = useMemo(() => extractOptions(children), [children]);
  const selected = options.find((o) => o.value === value) ?? options[0];

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(0);
  const [alignRight, setAlignRight] = useState(false);

  const root = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeaheadBufferRef = useRef<string>("");
  const typeaheadTimerRef = useRef<NodeJS.Timeout | null>(null);
  const id = useId();

  // Show search filter input if options >= 4 or explicitly requested
  const showSearch = searchable ?? options.length >= 4;

  // Filter options based on typeahead search query
  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.trim().toLowerCase();
    return options.filter(
      (o) => o.text.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  }, [options, search]);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Ensure active option is scrolled into view
  useEffect(() => {
    if (open) {
      listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
    }
  }, [open, active]);

  // Focus search input when popover opens
  useEffect(() => {
    if (open && showSearch) {
      // Delay slightly for render stability
      const t = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 30);
      return () => clearTimeout(t);
    }
  }, [open, showSearch]);

  function openDropdown(initialQuery = "") {
    const r = root.current?.getBoundingClientRect();
    setAlignRight(!!r && r.left + 260 > window.innerWidth);

    setSearch(initialQuery);
    const initialIndex = options.findIndex((o) => o.value === value);
    setActive(Math.max(0, initialIndex));
    setOpen(true);
  }

  function closeDropdown() {
    setOpen(false);
    setSearch("");
    buttonRef.current?.focus();
  }

  function pick(val: string) {
    onChange({ target: { value: val } });
    closeDropdown();
  }

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeDropdown();
      return;
    }

    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openDropdown();
        return;
      }

      // If user presses any alphanumeric key while focused on closed button, open & search
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && /[a-zA-Z0-9]/.test(e.key)) {
        e.preventDefault();
        openDropdown(e.key);
        return;
      }
      return;
    }

    // Dropdown is open
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(filtered.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[active]) {
        pick(filtered[active].value);
      }
    } else if (e.key === "Tab") {
      setOpen(false);
      setSearch("");
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
          className={`absolute top-full z-[1000] mt-1 max-h-80 min-w-full w-max max-w-[24rem] overflow-hidden rounded-md border border-line bg-surface shadow-xl shadow-ink/15 animate-in fade-in-50 zoom-in-95 duration-100 ${
            alignRight ? "right-0" : "left-0"
          }`}
        >
          {showSearch && (
            <div className="border-b border-line bg-raised/50 p-1.5">
              <div className="relative flex items-center">
                <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-sub" />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setActive(0);
                  }}
                  placeholder={placeholder ?? `Type to filter ${ariaLabel ? ariaLabel.toLowerCase() : "options"}…`}
                  aria-label={`Typeahead search for ${ariaLabel || "options"}`}
                  className="h-7 w-full rounded border border-line bg-surface pl-8 pr-7 font-sans text-xs text-ink placeholder:text-sub focus:border-accent focus:outline-none"
                />
                {search && (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => {
                      setSearch("");
                      inputRef.current?.focus();
                      setActive(0);
                    }}
                    className="absolute right-2 flex h-4 w-4 items-center justify-center rounded text-sub hover:text-ink cursor-pointer"
                    aria-label="Clear filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              {search.trim() && (
                <div className="mt-1 px-1 flex items-center justify-between text-[10px] font-mono text-sub">
                  <span>{filtered.length} match{filtered.length === 1 ? "" : "es"}</span>
                  <span className="text-[9px] uppercase tracking-wider">↑↓ navigate · ↵ select</span>
                </div>
              )}
            </div>
          )}

          <ul
            ref={listRef}
            role="listbox"
            aria-label={ariaLabel}
            className="max-h-60 overflow-y-auto divide-y divide-line/40 py-1 overscroll-contain"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-sub">
                No matching options for &ldquo;<span className="text-ink font-semibold">{search}</span>&rdquo;
              </li>
            ) : (
              filtered.map((o, i) => {
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
                      isAct ? "bg-accent-soft/80 text-ink font-medium" : "text-ink hover:bg-raised/70"
                    } ${isSel ? "bg-accent-soft/30 font-semibold" : ""}`}
                  >
                    <span className="truncate">
                      {typeof o.label === "string" ? (
                        <HighlightMatch text={o.label} query={search} />
                      ) : (
                        o.label
                      )}
                    </span>
                    {isSel && <Check className="h-3.5 w-3.5 shrink-0 text-accent" />}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
