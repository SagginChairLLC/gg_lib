import React from 'react';
import { motion, Variants } from 'framer-motion';
import { usePopup, type PopupPosition } from '@/data/usePopup';

const PopupComponent = React.memo(() => {
    const popupMessage = usePopup((state) => state.message);
    const popupPosition = usePopup((state) => state.position);
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

    // vh throughout, never px or the rem-based spacing scale: both are fixed
    // sizes, so they grow relative to the design on a small screen and shrink
    // on a large one. Sizing off height keeps the popup identical everywhere.
    const PopupContent = () => (
        <div className="flex h-full min-h-[3.7vh] w-full min-w-[2.3vh] flex-row items-center justify-center">
            <i className="fas fa-circle-info absolute left-[1.1vh] top-1/2 z-50 h-fit w-fit -translate-y-1/2 rounded-full border border-primary/75 bg-primary/25 p-[0.5vh] text-[2vh] text-primary/75"></i>

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
