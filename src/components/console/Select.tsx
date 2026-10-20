"use client";

import { Children, isValidElement, useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";

type Opt = { value: string; label: ReactNode };

/** Themed replacement for <select>. The native option list is drawn by the OS
 * and cannot be styled, so this renders its own listbox. Same props as a
 * native select: value, onChange(e.target.value), <option> children. */
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
  const options: Opt[] = Children.toArray(children).flatMap((c) =>
    isValidElement<{ value?: string | number; children?: ReactNode }>(c) && c.type === "option"
      ? [{ value: String(c.props.value ?? ""), label: c.props.children }]
      : []
  );
  const selected = options.find((o) => o.value === value) ?? options[0];

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [alignRight, setAlignRight] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function toggle() {
    if (!open) {
      const r = root.current?.getBoundingClientRect();
      setAlignRight(!!r && r.left + 240 > window.innerWidth);
      setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    }
    setOpen((o) => !o);
  }

  function pick(i: number) {
    onChange({ target: { value: options[i].value } });
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") return setOpen(false);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return toggle();
      setActive((a) => Math.min(options.length - 1, Math.max(0, a + (e.key === "ArrowDown" ? 1 : -1))));
    } else if ((e.key === "Enter" || e.key === " ") && open) {
      e.preventDefault();
      pick(active);
    }
  }

  return (
    <div ref={root} className={`relative inline-block ${className}`} onKeyDown={onKeyDown}>
      <button
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={id}
        onClick={toggle}
        className="flex h-8 w-full min-w-40 items-center justify-between gap-2 rounded-md border border-line bg-surface px-2.5 text-left text-[13px] text-ink transition-colors hover:bg-raised focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span className="truncate">{selected?.label}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-sub transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul
          ref={list}
          id={id}
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute top-full z-40 mt-1 max-h-64 min-w-full w-max max-w-[22rem] overflow-y-auto rounded-md border border-line bg-surface py-1 shadow-lg shadow-black/20 ${
            alignRight ? "right-0" : "left-0"
          }`}
        >
          {options.map((o, i) => {
            const isSel = o.value === (selected?.value ?? value);
            return (
              <li
                key={o.value}
                role="option"
                aria-selected={isSel}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(i)}
                className={`flex cursor-pointer items-center justify-between gap-3 px-2.5 py-1.5 text-[13px] ${
                  i === active ? "bg-raised" : ""
                } ${isSel ? "font-medium text-ink" : "text-ink"}`}
              >
                <span className="truncate">{o.label}</span>
                {isSel && <Check className="h-3.5 w-3.5 shrink-0 text-accent" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
