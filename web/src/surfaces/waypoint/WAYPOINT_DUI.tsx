import { useState, type ReactElement } from 'react';
import { useNuiEvent } from '@/hooks/useNuiEvent';
import { WAYPOINT_STYLE_BY_ID, type WaypointStyleId } from '@/data/useWaypoints';
import type { FaceProps } from './parts';
import RACE from './RACE';
import TAXI from './TAXI';

/**
 * The face of a world waypoint.
 *
 * This is not a screen overlay. It is drawn into an offscreen DUI texture that
 * Lua maps onto a billboard out in the world, so the viewport here is the
 * texture's own size rather than the player's screen. Everything is sized in vh
 * against that texture: change the texture height and the whole face scales
 * with it, at any player resolution.
 */

type WaypointPayload = {
    distance?: number;
    unit?: string;
    label?: string;
    icon?: string;
    style?: string;
};

const FACES: Record<WaypointStyleId, (props: FaceProps) => ReactElement> = {
    race: RACE,
    taxi: TAXI,
};

// The style rides in the URL so the very first frame is already the right face,
// and in the message too, so changing it on a placed waypoint takes effect
// without rebuilding the texture behind it.
function styleFromUrl(): WaypointStyleId {
    const asked = new URLSearchParams(window.location.search).get('style') ?? '';

    return asked in FACES ? (asked as WaypointStyleId) : 'race';
}

export default function WAYPOINT_DUI() {
    const [style, setStyle] = useState<WaypointStyleId>(styleFromUrl);
    const [state, setState] = useState<Omit<FaceProps, 'icon'> & { icon?: string }>(() => {
        const meta = WAYPOINT_STYLE_BY_ID.get(styleFromUrl());

        return { distance: 307, unit: 'YD', label: meta?.defaultLabel ?? 'CHECKPOINT' };
    });

    useNuiEvent<WaypointPayload>('waypoint_update', (payload) => {
        if (payload?.style && payload.style in FACES) setStyle(payload.style as WaypointStyleId);

        setState((current) => ({
            distance: payload?.distance ?? current.distance,
            unit: payload?.unit ?? current.unit,
            label: payload?.label ?? current.label,
            icon: payload?.icon ?? current.icon,
        }));
    });

    const meta = WAYPOINT_STYLE_BY_ID.get(style);
    const Face = FACES[style] ?? RACE;

    return (
        <main className="h-screen w-full overflow-hidden bg-transparent font-sans text-white">
            <Face distance={state.distance} unit={state.unit} label={state.label} icon={state.icon ?? meta?.faceIcon ?? 'fa-location-dot'} />
        </main>
    );
}
