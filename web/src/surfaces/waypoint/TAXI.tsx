import type { FaceProps } from './parts';

/**
 * The destination face. Same idea as the checkpoint -- glowing marks lifted off
 * the world, no panel behind them, because anything with a background reads as
 * a black rectangle hanging in the sky.
 *
 * Where the checkpoint leads with the number, this leads with the place: you
 * already know where you are going, so what you are looking for is the marker
 * itself. The checker band is the only taxi in it.
 */

const LIFT = 'drop-shadow(0 0.15vh 0.15vh rgba(0, 0, 0, 0.72)) drop-shadow(0 0 0.49vh rgba(255, 255, 255, 0.42))';

const GLOW = '0 0.1vh 0.1vh rgba(0, 0, 0, 0.5), 0 0 0.34vh rgba(255, 255, 255, 0.5)';

export default function TAXI({ distance, unit, label, icon }: FaceProps) {
    return (
        <div className="flex h-full w-full flex-col items-center pt-[4vh] text-center uppercase" style={{ filter: LIFT }}>
            <i
                className={'fas ' + icon + ' text-primary'}
                style={{ fontSize: '21vh', filter: 'drop-shadow(0 0 1.2vh rgba(var(--primary-rgb), 0.8))' }}
            />

            <div
                className="mt-[1.6vh] w-full truncate px-[6%] text-[21vh] font-black leading-[1] tracking-[0.3vh] text-white"
                style={{ textShadow: GLOW }}
            >
                {label}
            </div>

            {/* The checker band, the one thing here that says taxi. Two rows
                offset by half a square, drawn in the accent. */}
            <div
                className="mt-[2vh] flex h-[4.6vh] w-[56%] flex-col overflow-hidden rounded-[0.2vh]"
                style={{ filter: 'drop-shadow(0 0 0.7vh rgba(var(--primary-rgb), 0.85))' }}
            >
                <div
                    className="h-1/2 w-full"
                    style={{ background: 'repeating-linear-gradient(90deg, rgb(var(--primary-rgb)) 0 5%, transparent 5% 10%)' }}
                />
                <div
                    className="h-1/2 w-full"
                    style={{ background: 'repeating-linear-gradient(90deg, transparent 0 5%, rgb(var(--primary-rgb)) 5% 10%)' }}
                />
            </div>

            <div
                className="mt-[2vh] flex items-baseline justify-center gap-[2vh] whitespace-nowrap font-black leading-[0.9] text-white"
                style={{ textShadow: GLOW }}
            >
                <span className="text-[26vh]">{distance}</span>
                <span className="text-[15vh] text-white/70">{unit}</span>
            </div>

            <div
                className="mt-[2vh] h-0 w-0 border-l-[1.42vh] border-r-[1.42vh] border-t-[1.56vh] border-l-transparent border-r-transparent border-t-white/90"
                style={{ filter: 'drop-shadow(0 0 0.49vh rgba(255, 255, 255, 0.74))' }}
            />
        </div>
    );
}
