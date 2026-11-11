"use client";

// A single, real, reusable dropdown -- replaces every native <select> in
// the admin with something that actually matches the dark UI (native
// selects render as the OS's own unstyled popup, which is what "hazlo
// estético" is about). Built on @headlessui/react (already an installed
// dependency, previously unused) rather than inventing custom popup/
// focus/keyboard-nav logic from scratch.

import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from "@headlessui/react";
import { Check, ChevronDown } from "lucide-react";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export interface SelectGroup<T extends string> {
  label: string;
  options: SelectOption<T>[];
}

function isGrouped<T extends string>(
  items: SelectOption<T>[] | SelectGroup<T>[],
): items is SelectGroup<T>[] {
  return items.length > 0 && "options" in items[0];
}

export default function Select<T extends string>({
  value, onChange, options, placeholder = "Seleccionar", className = "", buttonClassName = "", disabled = false,
}: {
  value: T | null;
  onChange: (value: T) => void;
  options: SelectOption<T>[] | SelectGroup<T>[];
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
}) {
  const flatOptions: SelectOption<T>[] = isGrouped(options) ? options.flatMap((g) => g.options) : options;
  const selected = flatOptions.find((o) => o.value === value);

  return (
    <Listbox value={value ?? undefined} onChange={onChange} disabled={disabled}>
      <div className={`relative ${className}`}>
        <ListboxButton
          className={`w-full flex items-center justify-between gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-left transition-colors focus:outline-none focus:ring-1 focus:ring-white/25 disabled:opacity-50 disabled:cursor-not-allowed ${
            disabled ? "" : "hover:border-white/20 hover:bg-white/[0.07]"
          } ${buttonClassName}`}
        >
          <span className={selected ? "text-white truncate" : "text-neutral-500 truncate"}>{selected?.label ?? placeholder}</span>
          <ChevronDown size={14} className="text-neutral-500 flex-shrink-0" />
        </ListboxButton>
        <ListboxOptions
          anchor="bottom start"
          transition
          className="z-50 w-[var(--button-width)] max-h-72 overflow-y-auto rounded-lg border border-white/10 bg-neutral-900 shadow-xl shadow-black/50 p-1 [--anchor-gap:4px] focus:outline-none origin-top transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
        >
          {isGrouped(options) ? (
            options.map((group) => (
              <div key={group.label} className="mb-1 last:mb-0">
                <div className="px-2.5 pt-1.5 pb-1 text-[10px] font-semibold text-neutral-600 uppercase tracking-wide">{group.label}</div>
                {group.options.map((opt) => (
                  <SelectRow key={opt.value} option={opt} />
                ))}
              </div>
            ))
          ) : (
            options.map((opt) => <SelectRow key={opt.value} option={opt} />)
          )}
        </ListboxOptions>
      </div>
    </Listbox>
  );
}

function SelectRow<T extends string>({ option }: { option: SelectOption<T> }) {
  return (
    <ListboxOption
      value={option.value}
      className="group flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-neutral-300 cursor-pointer data-[focus]:bg-white/10 data-[focus]:text-white data-[selected]:text-white"
    >
      <span className="truncate">{option.label}</span>
      <Check size={13} className="invisible group-data-[selected]:visible text-white flex-shrink-0" />
    </ListboxOption>
  );
}
