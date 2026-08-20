import React from 'react';
import { motion, Variants } from 'framer-motion';
import { usePopup, type PopupPosition, type PopupVariant } from '@/data/usePopup';

const PopupComponent = React.memo(() => {
    const popupMessage = usePopup((state) => state.message);
    const popupPosition = usePopup((state) => state.position);
    const popupVariant = usePopup((state) => state.variant);
    const popupKeybind = usePopup((state) => state.keybind);
    const positions: Record<PopupPosition, string> = {
        'bottom-middle': 'bottom-1 left-1/2 -translate-x-1/2',
        'right-middle': 'top-1/2 right-1 -translate-y-1/2',
        'left-middle': 'top-1/2 left-1 -translate-y-1/2',
        'top-middle': 'top-1 left-1/2 -translate-x-1/2',
        'top-left': 'top-1 left-1',
        'top-right': 'top-1 right-1',
        'bottom-left': 'bottom-1 left-1',
        'bottom-right': 'bottom-1 right-1',
    };

    const currentPosition: PopupPosition = positions[popupPosition] ? popupPosition : 'bottom-middle';

    const getAnimationVariants = (pos: PopupPosition): Variants => {
        const variants: Record<PopupPosition, { x?: [number, number]; y?: [number, number]; opacity: [number, number] }> = {
            'bottom-middle': { y: [50, 0], opacity: [0, 1] },
            'right-middle': { x: [50, 0], opacity: [0, 1] },
            'left-middle': { x: [-50, 0], opacity: [0, 1] },
            'top-middle': { y: [-50, 0], opacity: [0, 1] },
            'top-left': { x: [-50, 0], y: [-50, 0], opacity: [0, 1] },
            'top-right': { x: [50, 0], y: [-50, 0], opacity: [0, 1] },
            'bottom-left': { x: [-50, 0], y: [50, 0], opacity: [0, 1] },
            'bottom-right': { x: [50, 0], y: [50, 0], opacity: [0, 1] },
        };

        return {
            initial: {
                x: variants[pos]?.x?.[0] || 0,
                y: variants[pos]?.y?.[0] || 0,
                opacity: 0,
            },
            animate: {
                x: variants[pos]?.x?.[1] || 0,
                y: variants[pos]?.y?.[1] || 0,
                opacity: 1,
            },
            exit: {
                x: variants[pos]?.x?.[0] || 0,
                y: variants[pos]?.y?.[0] || 0,
                opacity: 0,
            },
        };
    };

    const variant: PopupVariant = ['info', 'keybind', 'warn'].includes(popupVariant) ? popupVariant : 'info';

    // A warning is the only one that changes colour. Anything that reads as an
    // ordinary hint keeps the primary accent, so urgency stays meaningful.
    const accent =
        variant === 'warn'
            ? { border: 'border-orange-400/75', bg: 'bg-orange-400/25', text: 'text-orange-300' }
            : { border: 'border-primary/75', bg: 'bg-primary/25', text: 'text-primary/75' };

    const Mark = () => {
        // The key cap IS the mark on a keybind popup: a player scanning the
        // screen should see what to press, not an icon meaning "press something".
        if (variant === 'keybind' && popupKeybind) {
            return (
                <span
                    className={`absolute left-[1.1vh] top-1/2 z-50 flex h-[2.9vh] min-w-[2.9vh] -translate-y-1/2 items-center justify-center rounded-[0.45vh] border px-[0.55vh] text-[1.35vh] font-black uppercase ${accent.border} ${accent.bg} ${accent.text}`}
                >
                    {popupKeybind}
                </span>
            );
        }

        return (
            <i
                className={`fas ${variant === 'warn' ? 'fa-triangle-exclamation' : 'fa-circle-info'} absolute left-[1.1vh] top-1/2 z-50 h-fit w-fit -translate-y-1/2 rounded-full border p-[0.5vh] text-[2vh] ${accent.border} ${accent.bg} ${accent.text}`}
            />
        );
    };

    const PopupContent = () => (
        <div className="flex h-full min-h-[3.7vh] w-full min-w-[2.3vh] flex-row items-center justify-center">
            <Mark />

            <div className="ml-[4.4vh] flex w-full justify-end pr-[0.9vh]">
                <p className="h-full w-full text-[1.5vh] font-medium">{popupMessage}</p>
            </div>
        </div>
    );

    return (
        <div className="pointer-events-none absolute inset-0 h-full w-full">
            <div className={`pointer-events-none absolute ${positions[currentPosition]}`}>
                <motion.div
                    className="pointer-events-auto h-auto w-auto min-w-[20vh] max-w-[50vh] rounded-[0.5vh] bg-neutral-900/[0.99] p-[0.9vh] text-[#eeeeee]"
                    variants={getAnimationVariants(currentPosition)}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={{
                        duration: 0.5,
                        ease: 'easeOut',
                    }}
                >
                    <PopupContent />
                </motion.div>
            </div>
        </div>
    );
});

export default PopupComponent;
