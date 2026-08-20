import type { FaceProps } from './parts';

/**
 * The racing face: a big countdown you read at speed. Distance dominates, the
 * accent bar splits it from the label, and the pointer aims at the spot.
 */
export default function RACE({ distance, unit, label }: FaceProps) {
    return (
        <div
            className="relative flex h-full w-full flex-col items-center pt-[3.5vh] text-center uppercase"
            style={{ filter: 'drop-shadow(0 0.15vh 0.15vh rgba(0, 0, 0, 0.72)) drop-shadow(0 0 0.49vh rgba(255, 255, 255, 0.48))' }}
        >
            <div
                className="flex w-full flex-row items-baseline justify-center gap-[2.88vh] whitespace-nowrap font-black leading-[0.9] text-white"
                style={{ textShadow: '0 0.1vh 0.1vh rgba(0, 0, 0, 0.46), 0 0 0.34vh rgba(255, 255, 255, 0.58)' }}
            >
                <span className="text-[40.4vh]">{distance}</span>
                <small className="text-[22.4vh] font-black leading-[0.9]">{unit}</small>
            </div>

            <div
                className="mt-[1.56vh] h-[2.34vh] w-[68.36%] rounded-[0.05vh] bg-primary"
                style={{ boxShadow: '0 0 0.44vh rgba(var(--primary-rgb), 0.95), 0 0 1.27vh rgba(var(--primary-rgb), 0.42)' }}
            />

            <div
                className="mt-[1.32vh] flex w-full justify-center whitespace-nowrap px-[8.47%] text-[19.3vh] font-black italic tracking-[0.1vh] text-white/95"
                style={{ textShadow: '0 0.1vh 0.1vh rgba(0, 0, 0, 0.42), 0 0 0.34vh rgba(255, 255, 255, 0.42)' }}
            >
                {label}
            </div>

            <div
                className="mt-[1.51vh] h-0 w-0 border-l-[1.42vh] border-r-[1.42vh] border-t-[1.56vh] border-l-transparent border-r-transparent border-t-white/90"
                style={{ filter: 'drop-shadow(0 0 0.49vh rgba(255, 255, 255, 0.74))' }}
            />
        </div>
    );
}
