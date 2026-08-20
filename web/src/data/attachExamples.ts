/**
 * Something to open the editor onto.
 *
 * Every one of these is a prop and an animation that already go together, lifted
 * from a shipping script rather than invented, along with the placement someone
 * actually settled on. Loading one puts a real, finished attachment in front of
 * you -- which is both the fastest way to see what the tool does and the fastest
 * way to tell whether it is placing things correctly.
 *
 * Bone 91 in the original is the right hand's index; here it is named by its id,
 * which is what GetPedBoneIndex takes.
 */

export type AttachExample = {
    label: string;
    model: string;
    bone: number;
    pos: { x: number; y: number; z: number };
    rot: { x: number; y: number; z: number };
    anim: { dict: string; name: string };
};

const CARRY_BAG = { dict: 'missfbi4prepp1', name: '_bag_walk_garbage_man' };
const CARRY_BOX = { dict: 'anim@heists@box_carry@', name: 'idle' };

export const ATTACH_EXAMPLES: AttachExample[] = [
    {
        label: 'Bin bag',
        model: 'prop_cs_rub_binbag_01',
        bone: 57005,
        pos: { x: 0.12, y: 0.0, z: -0.05 },
        rot: { x: 220.0, y: 120.0, z: 0.0 },
        anim: CARRY_BAG,
    },
    {
        label: 'Crate',
        model: 'prop_skid_box_05',
        bone: 57005,
        pos: { x: 0.3984, y: 0.1001, z: -0.1278 },
        rot: { x: -110.6, y: 68.9, z: -0.7 },
        anim: CARRY_BOX,
    },
    {
        label: 'Mattress',
        model: 'prop_rub_matress_04',
        bone: 57005,
        pos: { x: 0.0559, y: 0.063, z: -0.2859 },
        rot: { x: -60.65, y: 66.86, z: -9.6 },
        anim: CARRY_BOX,
    },
    {
        label: 'Suitcase',
        model: 'prop_luggage_09a',
        bone: 57005,
        pos: { x: 0.1626, y: 0.1906, z: -0.1427 },
        rot: { x: -71.6, y: 27.3, z: 18.2 },
        anim: CARRY_BOX,
    },
    {
        label: 'Monitor',
        model: 'prop_rub_monitor',
        bone: 57005,
        pos: { x: 0.1476, y: 0.0554, z: -0.1722 },
        rot: { x: 0.0, y: 0.0, z: 125.6 },
        anim: CARRY_BOX,
    },
];
