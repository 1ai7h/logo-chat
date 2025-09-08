"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export type ModelOption = {
  id: string;
  label: string;
  provider: "OpenAI" | "Gemini" | "Other";
  icon: string; // public path to icon
  disabled?: boolean;
};

export default function ModelSelector({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (id: string) => void;
  options: ModelOption[];
}) {
  const current = options.find((o) => o.id === value) || options[0];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="inline-flex items-center gap-3 border rounded-lg px-3 py-2 bg-white text-sm shadow-sm hover:bg-neutral-50"
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Select model"
      >
        {current && (
          <Image src={current.icon} alt="provider" width={24} height={24} className="rounded-md object-contain" />
        )}
        <span className="max-w-[220px] truncate">{current?.label || value}</span>
        <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden className="opacity-60">
          <path d="M5 7l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 mt-1 w-[320px] max-h-80 overflow-auto rounded-lg border bg-white shadow-lg z-50"
        >
          {options.map((o) => (
            <li key={o.id} role="option" aria-selected={o.id === value}>
              <button
                type="button"
                onClick={() => {
                  if (o.disabled) return;
                  onChange(o.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-3 text-left text-sm hover:bg-neutral-50 ${
                  o.disabled ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <Image src={o.icon} alt="provider" width={28} height={28} className="rounded-md object-contain" />
                <div className="flex-1 truncate">
                  <div className="truncate">{o.label}</div>
                  <div className="text-[11px] opacity-60">{o.provider}</div>
                </div>
                {o.id === value && (
                  <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden>
                    <path d="M7 10l2 2 4-4" fill="none" stroke="currentColor" strokeWidth="2" />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

