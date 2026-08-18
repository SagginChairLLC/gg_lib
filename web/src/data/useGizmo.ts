import { create } from 'zustand';

/**
 * State for the placement gizmo. Lua mirrors the game camera and the entity
 * into here every frame; three.js renders drag handles over the top.
 *
 * GTA is Z-up, three.js is Y-up, so every vector crosses one conversion — kept
 * in this file, in one pair of functions, because a coordinate swap scattered
 * across components is exactly how a gizmo ends up dragging sideways.
 */

export type Vec3 = { x: number; y: number; z: number };

/** GTA (x east, y north, z up) -> three (x east, y up, z south). */
export function gtaToThree(v: Vec3): [number, number, number] {
    return [v.x, v.z, -v.y];
}

export function threeToGta(x: number, y: number, z: number): Vec3 {
    return { x, y: -z, z: y };
}

/**
 * A GTA heading maps straight onto a three.js Y rotation: heading 0 faces +Y
 * (three -Z, which is three's own forward), and both grow counter-clockwise
 * seen from above. No sign flips, no special cases.
 */
export function headingToThreeY(heading: number): number {
    return (heading * Math.PI) / 180;
}

export function threeYToHeading(rotationY: number): number {
    return ((((rotationY * 180) / Math.PI) % 360) + 360) % 360;
}

/**
 * Heading from a rotated forward vector rather than from `rotation.y`.
 *
 * three.js stores rotation as an Euler, and in its default XYZ order the middle
 * angle -- Y, the one that is heading -- is only extractable over ±90°. Past
 * that the quaternion is expressed with X and Z at π and Y mirrored, so reading
 * `rotation.y` makes a ped turning past a quarter circle snap and reverse.
 *
 * Taking the object's own forward vector sidesteps Euler order entirely and is
 * correct through a full turn. `forward` is three's -Z basis after rotation.
 */
export function headingFromForward(forward: { x: number; z: number }): number {
    // three forward -> GTA forward is (x, -z); GTA forward is (-sin h, cos h).
    const degrees = (Math.atan2(-forward.x, -forward.z) * 180) / Math.PI;

    return ((degrees % 360) + 360) % 360;
}

type GizmoState = {
    active: boolean;
    /** 'translate' moves, 'rotate' turns. */
    mode: 'translate' | 'rotate';
    /** Entity transform, in GTA space. */
    position: Vec3 | null;
    heading: number;
    /** Camera, in GTA space; rotation is (pitch, roll, yaw) degrees. */
    camera: { position: Vec3; rotation: Vec3; fov: number } | null;
};

export const useGizmo = create<GizmoState>(() => ({
    active: false,
    mode: 'translate',
    position: null,
    heading: 0,
    camera: null,
}));

type GizmoPayload = {
    ACTIVE?: boolean;
    MODE?: 'translate' | 'rotate';
    POSITION?: Vec3;
    HEADING?: number;
    CAMERA?: { position: Vec3; rotation: Vec3; fov: number };
};

export function applyGizmoState(data: GizmoPayload) {
    if (data.ACTIVE === false) {
        useGizmo.setState({ active: false, position: null, camera: null });
        return;
    }

    useGizmo.setState((state) => ({
        active: true,
        mode: data.MODE ?? state.mode,
        position: data.POSITION ?? state.position,
        heading: data.HEADING ?? state.heading,
        camera: data.CAMERA ?? state.camera,
    }));
}
