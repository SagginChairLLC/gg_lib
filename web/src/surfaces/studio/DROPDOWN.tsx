import { useEffect, useRef, useState } from 'react';

/**
 * The studio's own select. A native one cannot be styled past its border, so
 * every list that needs to match the rest of the editor uses this instead.
 */

export type DropdownOption = {
    value: string;
    label: string;
    icon?: string;
    hint?: string;
    disabled?: boolean;
};

export default function Dropdown({
    value,
    options,
    onChange,
    disabled,
    placeholder,
    icon,
    width = '18vh',
    align = 'left',
}: {
    value: string;
    options: DropdownOption[];
    onChange: (next: string) => void;
    disabled?: boolean;
    placeholder?: string;
    icon?: string;
    width?: string;
    /** Which edge the panel lines up with, for a control near the right side. */
    align?: 'left' | 'right';
}) {
    const [open, setOpen] = useState(false);
    const [upward, setUpward] = useState(false);
    const holder = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!open) return;

        const onDown = (event: MouseEvent) => {
            if (!holder.current?.contains(event.target as Node)) setOpen(false);
        };

        const onKey = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;

            // The editor closes on Escape too, and the open list should be what
            // that first press closes.
            event.stopPropagation();
            setOpen(false);
        };

        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey, true);

        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey, true);
        };
    }, [open]);

    const selected = options.find((option) => option.value === value);

    return (
        <div ref={holder} className="relative flex-shrink-0" style={{ width }}>
            <button
                type="button"
                disabled={disabled}
                onClick={(event) => {
                    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();

                    // Opens upward when there is not room below, so a control
                    // near the bottom of the editor still shows its whole list.
                    setUpward(window.innerHeight - rect.bottom < Math.min(options.length, 8) * 34 + 24);
                    setOpen((state) => !state);
                }}
                className={`flex h-[2.8vh] w-full items-center gap-[0.7vh] rounded-[0.5vh] border px-[0.8vh] text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    open ? 'border-primary/50 bg-primary/[0.06]' : 'border-white/10 bg-black/30 hover:border-white/25'
                }`}
            >
                {icon && <i className={`fas ${icon} flex-shrink-0 text-[1.1vh] text-white/30`} />}
                {selected?.icon && <i className={`fas ${selected.icon} flex-shrink-0 text-[1.1vh] text-primary/70`} />}

                <span className={`min-w-0 flex-1 truncate text-[1.2vh] ${selected ? 'text-white/85' : 'text-white/30'}`}>
                    {selected?.label ?? placeholder ?? ''}
                </span>

                <i className={`fas fa-chevron-down flex-shrink-0 text-[0.95vh] text-white/25 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div
                    className={`absolute z-40 flex max-h-[32vh] min-w-full flex-col overflow-y-auto rounded-[0.6vh] border border-white/15 bg-neutral-900 py-[0.4vh] shadow-[0_1vh_3vh_rgba(0,0,0,0.6)] ${
                        upward ? 'bottom-full mb-[0.5vh]' : 'top-full mt-[0.5vh]'
                    } ${align === 'right' ? 'right-0' : 'left-0'}`}
                >
                    {options.map((option) => {
                        const active = option.value === value;

                        return (
                            <button
                                key={option.value}
                                type="button"
                                disabled={option.disabled}
                                onClick={() => {
                                    setOpen(false);
                                    if (option.value !== value) onChange(option.value);
                                }}
                                className={`flex items-center gap-[0.8vh] px-[1.1vh] py-[0.7vh] text-left text-[1.25vh] transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                                    active ? 'bg-primary/15 text-primary' : 'text-white/70 hover:bg-white/[0.06] hover:text-white/95'
                                }`}
                            >
                                {option.icon && <i className={`fas ${option.icon} w-[1.6vh] flex-shrink-0 text-center text-[1.1vh]`} />}

                                <span className="min-w-0 flex-1 truncate">{option.label}</span>

                                {option.hint && <span className="flex-shrink-0 font-mono text-[1vh] text-white/25">{option.hint}</span>}
                                {active && <i className="fas fa-check flex-shrink-0 text-[1vh]" />}
                            </button>
                        );
                    })}

                    {options.length === 0 && <span className="px-[1.1vh] py-[0.7vh] text-[1.2vh] italic text-white/25">—</span>}
                </div>
            )}
        </div>
    );
}
