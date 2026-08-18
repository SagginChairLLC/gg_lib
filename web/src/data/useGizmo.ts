import { create } from 'zustand';

export type Vec3 = { x: number; y: number; z: number };

export function gtaToThree(v: Vec3): [number, number, number] {
    return [v.x, v.z, -v.y];
}

export function threeToGta(x: number, y: number, z: number): Vec3 {
    return { x, y: -z, z: y };
}

export function headingToThreeY(heading: number): number {
    return (heading * Math.PI) / 180;
}

export function threeYToHeading(rotationY: number): number {
    return ((((rotationY * 180) / Math.PI) % 360) + 360) % 360;
}

export function headingFromForward(forward: { x: number; z: number }): number {
    const degrees = (Math.atan2(-forward.x, -forward.z) * 180) / Math.PI;

    return ((degrees % 360) + 360) % 360;
}

type GizmoState = {
    active: boolean;
    mode: 'translate' | 'rotate';
    position: Vec3 | null;
    heading: number;
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
