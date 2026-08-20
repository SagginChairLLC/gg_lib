import { create } from 'zustand';
import { fetchNui, isEnvBrowser } from '@/lib/fetchNui';
import { showEditor } from '@/data/useLang';

/**
 * The prop attach editor's state.
 *
 * Offsets and rotations are exactly what AttachEntityToEntity takes, in the
 * bone's own frame, so what the panel shows and what you paste are the same
 * numbers -- there is no second representation to drift out of step.
 */

export type Vec3 = { x: number; y: number; z: number };

/** Where the prop is in the world, as axes rather than angles. */
export type Placed = { at: Vec3; right: Vec3; forward: Vec3; up: Vec3 };

export type GameCamera = { position: Vec3; rotation: Vec3; fov: number };

type AttachState = {
    open: boolean;
    looking: boolean;
    model: string;
    /** The model the client could not spawn, if any. */
    problem: string | null;
    /** Whether the prop is hanging off the player or off a test vehicle. */
    target: 'ped' | 'vehicle';
    /** The car being tried, while the target is a vehicle. */
    vehicle: string;
    bone: number;
    /** Vehicles name their bones; peds hash them. */
    boneName: string;
    /** False when the chosen bone is not on this vehicle. */
    boneOk: boolean;
    pos: Vec3;
    rot: Vec3;
    mode: 'translate' | 'rotate';
    placed: Placed | null;
    camera: GameCamera | null;
};

const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 };

export const useAttach = create<AttachState>(() => ({
    open: false,
    looking: false,
    model: '',
    problem: null,
    target: 'ped',
    vehicle: 'taxi',
    bone: 57005,
    boneName: 'chassis',
    boneOk: true,
    pos: { ...ORIGIN },
    rot: { ...ORIGIN },
    mode: 'translate',
    placed: null,
    camera: null,
}));

export function applyAttachOpen(data: { OPEN?: boolean }) {
    if (data.OPEN === false) {
        useAttach.setState({ open: false, looking: false, problem: null, placed: null, camera: null });
        return;
    }

    useAttach.setState({ open: true, problem: null });
}

export function applyAttachLook(data: { LOOKING?: boolean }) {
    useAttach.setState({ looking: data.LOOKING === true });
}

export function applyAttachState(data: { MODEL?: string; ERROR?: string | false }) {
    useAttach.setState((state) => ({
        model: data.MODEL ?? state.model,
        problem: data.ERROR === false ? null : (data.ERROR ?? state.problem),
    }));
}

export function applyAttachProp(data: { PLACED?: boolean; AT?: Vec3; RIGHT?: Vec3; FORWARD?: Vec3; UP?: Vec3; POS?: Vec3; ROT?: Vec3; BONE_OK?: boolean }) {
    if (!data.PLACED || !data.AT || !data.RIGHT || !data.FORWARD || !data.UP) {
        useAttach.setState({ placed: null });
        return;
    }

    useAttach.setState((state) => ({
        placed: { at: data.AT!, right: data.RIGHT!, forward: data.FORWARD!, up: data.UP! },
        pos: data.POS ?? state.pos,
        rot: data.ROT ?? state.rot,
        boneOk: data.BONE_OK ?? state.boneOk,
    }));
}

export function applyAttachTarget(data: { TARGET?: string; VEHICLE?: string }) {
    useAttach.setState((state) => ({
        target: data.TARGET === 'vehicle' ? 'vehicle' : 'ped',
        vehicle: data.VEHICLE ?? state.vehicle,
    }));
}

/** The numbers the client worked out from the last gizmo drag. */
export function applyAttachValues(data: { POS?: Vec3; ROT?: Vec3 }) {
    useAttach.setState((state) => ({ pos: data.POS ?? state.pos, rot: data.ROT ?? state.rot }));
}

export function applyAttachCamera(data: { POSITION?: Vec3; ROTATION?: Vec3; FOV?: number }) {
    if (!data.POSITION || !data.ROTATION) return;

    useAttach.setState({ camera: { position: data.POSITION, rotation: data.ROTATION, fov: data.FOV ?? 50 } });
}

export function setMode(mode: 'translate' | 'rotate') {
    useAttach.setState({ mode });
}

export function enterEditor() {
    if (isEnvBrowser()) {
        useAttach.setState({ open: true });
        return;
    }

    void fetchNui('attach_enter');
}

/**
 * Hands the input back to the game, or takes it again.
 *
 * While the page has focus the game never sees Alt, so the page has to say
 * so itself. Going the other way the client watches the control, because by
 * then the page is the one that cannot hear anything.
 */
export function freeLook(free: boolean) {
    if (isEnvBrowser()) return;

    void fetchNui('attach_look', { free });
}

export function exitEditor() {
    useAttach.setState({ open: false, looking: false });
    showEditor();

    if (isEnvBrowser()) return;

    void fetchNui('attach_exit');
}

export function spawnProp(model: string) {
    useAttach.setState({ model, problem: null });

    if (isEnvBrowser()) return;

    void fetchNui('attach_spawn', { model });
}

export function clearProp() {
    useAttach.setState({ model: '', problem: null });

    if (isEnvBrowser()) return;

    void fetchNui('attach_clear');
}

/** The bone is the one thing the panel still chooses directly. */
export function setBone(bone: number) {
    useAttach.setState({ bone });

    if (isEnvBrowser()) return;

    void fetchNui('attach_bone', { bone });
}

export function setBoneName(boneName: string) {
    useAttach.setState({ boneName });

    if (isEnvBrowser()) return;

    void fetchNui('attach_bone', { boneName });
}

/** Ped or vehicle. Swapping brings a test car in, or takes it away. */
export function setTarget(target: 'ped' | 'vehicle') {
    useAttach.setState({ target });

    if (isEnvBrowser()) return;

    void fetchNui('attach_target', { target, vehicle: useAttach.getState().vehicle });
}

export function setVehicle(vehicle: string) {
    useAttach.setState({ vehicle });

    if (isEnvBrowser()) return;

    void fetchNui('attach_vehicle', { vehicle });
}

export function resetPlacement() {
    useAttach.setState({ pos: { ...ORIGIN }, rot: { ...ORIGIN } });

    if (isEnvBrowser()) return;

    void fetchNui('attach_reset');
}
/** Drops a whole worked example in: prop, bone, placement and animation. */
export function loadExample(example: {
    model: string;
    bone: number;
    pos: Vec3;
    rot: Vec3;
    anim: { dict: string; name: string };
}) {
    useAttach.setState({
        model: example.model,
        bone: example.bone,
        pos: example.pos,
        rot: example.rot,
        problem: null,
    });

    if (isEnvBrowser()) return;

    void fetchNui('attach_example', {
        model: example.model,
        bone: example.bone,
        pos: example.pos,
        rot: example.rot,
    });

    playAnim(example.anim.dict, example.anim.name);
}

export function playAnim(dict: string, anim: string) {
    if (isEnvBrowser()) return;

    void fetchNui('attach_anim', { dict, anim });
}
