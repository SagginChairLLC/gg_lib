import { create } from 'zustand';
import { fetchNui, isEnvBrowser } from '@/lib/fetchNui';
import { showEditor } from '@/data/useLang';

/**
 * The particle viewer's state. The panel owns what is selected and how it looks;
 * the client owns the effect itself, so every change is sent rather than kept
 * in two places.
 */

export type ParticleColour = { r: number; g: number; b: number };

type ParticleState = {
    /** Whether the viewer has the screen. */
    open: boolean;
    playing: boolean;
    dict: string | null;
    effect: string | null;
    /** The dictionary or effect name the client could not load, if any. */
    problem: string | null;
    /** True while the camera has the mouse instead of the cursor. */
    looking: boolean;
    scale: number;
    alpha: number;
    colour: ParticleColour;
};

export const useParticles = create<ParticleState>(() => ({
    open: false,
    playing: false,
    dict: null,
    effect: null,
    problem: null,
    looking: false,
    scale: 1,
    alpha: 1,
    colour: { r: 255, g: 255, b: 255 },
}));

export function applyParticleOpen(data: { OPEN?: boolean }) {
    if (data.OPEN === false) {
        useParticles.setState({ open: false, playing: false, problem: null, looking: false });
        return;
    }

    useParticles.setState({ open: true, problem: null });
}

export function applyParticleLook(data: { LOOKING?: boolean }) {
    useParticles.setState({ looking: data.LOOKING === true });
}

export function applyParticleState(data: { PLAYING?: boolean; DICT?: string; EFFECT?: string; ERROR?: string }) {
    useParticles.setState((state) => ({
        playing: data.PLAYING ?? state.playing,
        dict: data.DICT ?? state.dict,
        effect: data.EFFECT ?? state.effect,
        problem: data.ERROR ?? null,
    }));
}

export function enterViewer() {
    if (isEnvBrowser()) {
        useParticles.setState({ open: true });
        return;
    }

    void fetchNui('particle_enter');
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

    void fetchNui('particle_look', { free });
}

export function exitViewer() {
    // Back to the page it was opened from. The client hands the focus back at
    // the same time, so the editor is usable rather than just visible.
    useParticles.setState({ open: false, playing: false });
    showEditor();

    if (isEnvBrowser()) return;

    void fetchNui('particle_exit');
}

export function playParticle(dict: string, effect: string) {
    useParticles.setState({ dict, effect, problem: null });

    if (isEnvBrowser()) {
        useParticles.setState({ playing: true });
        return;
    }

    void fetchNui('particle_play', { dict, effect });
}

export function stopParticle() {
    useParticles.setState({ playing: false });

    if (!isEnvBrowser()) void fetchNui('particle_stop');
}

/** Sends the whole look every time: one shape to read on the other side. */
export function styleParticle(patch: Partial<Pick<ParticleState, 'scale' | 'alpha' | 'colour'>>) {
    const next = { ...useParticles.getState(), ...patch };

    useParticles.setState(patch);

    if (isEnvBrowser()) return;

    void fetchNui('particle_style', { scale: next.scale, alpha: next.alpha, colour: next.colour });
}

/** Replays the current effect where the player is standing now. */
export function recentreParticle() {
    if (!isEnvBrowser()) void fetchNui('particle_recentre');
}
