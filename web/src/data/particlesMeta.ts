/**
 * How big the particle library is, without being the particle library.
 *
 * The data itself is loaded only when the viewer opens -- it is two
 * thousand strings that most players will never see -- so anything that
 * only needs the size reads it from here and doesn't pull the rest in.
 */

export const PARTICLE_DICT_COUNT = 278;
export const PARTICLE_EFFECT_COUNT = 2320;
