/**
 * The ped bones a prop is usually hung off, by the id GetPedBoneIndex takes.
 *
 * Not every bone in the skeleton -- the ones people actually attach to, grouped
 * so the list reads like a body rather than a dump. Anything missing can be
 * typed in as a raw id.
 */

export type PedBone = {
    id: number;
    /** The game's own name, which is what you will see in other people's code. */
    name: string;
    label: string;
};

export type BoneGroup = {
    label: string;
    bones: PedBone[];
};

export const BONE_GROUPS: BoneGroup[] = [
    {
        label: 'Hands',
        bones: [
            { id: 57005, name: 'SKEL_R_Hand', label: 'Right hand' },
            { id: 18905, name: 'SKEL_L_Hand', label: 'Left hand' },
            { id: 28422, name: 'PH_R_Hand', label: 'Right hand (prop point)' },
            { id: 60309, name: 'PH_L_Hand', label: 'Left hand (prop point)' },
        ],
    },
    {
        label: 'Arms',
        bones: [
            { id: 40269, name: 'SKEL_R_UpperArm', label: 'Right upper arm' },
            { id: 45509, name: 'SKEL_L_UpperArm', label: 'Left upper arm' },
            { id: 28252, name: 'SKEL_R_Forearm', label: 'Right forearm' },
            { id: 61163, name: 'SKEL_L_Forearm', label: 'Left forearm' },
            { id: 10706, name: 'SKEL_R_Clavicle', label: 'Right clavicle' },
            { id: 64729, name: 'SKEL_L_Clavicle', label: 'Left clavicle' },
        ],
    },
    {
        label: 'Head and spine',
        bones: [
            { id: 31086, name: 'SKEL_Head', label: 'Head' },
            { id: 39317, name: 'SKEL_Neck_1', label: 'Neck' },
            { id: 24818, name: 'SKEL_Spine3', label: 'Upper back' },
            { id: 24817, name: 'SKEL_Spine2', label: 'Mid back' },
            { id: 24816, name: 'SKEL_Spine1', label: 'Lower back' },
            { id: 23553, name: 'SKEL_Spine0', label: 'Spine base' },
            { id: 57597, name: 'SKEL_Spine_Root', label: 'Spine root' },
            { id: 11816, name: 'SKEL_Pelvis', label: 'Pelvis' },
        ],
    },
    {
        label: 'Legs',
        bones: [
            { id: 51826, name: 'SKEL_R_Thigh', label: 'Right thigh' },
            { id: 58271, name: 'SKEL_L_Thigh', label: 'Left thigh' },
            { id: 36864, name: 'SKEL_R_Calf', label: 'Right calf' },
            { id: 63931, name: 'SKEL_L_Calf', label: 'Left calf' },
            { id: 52301, name: 'SKEL_R_Foot', label: 'Right foot' },
            { id: 14201, name: 'SKEL_L_Foot', label: 'Left foot' },
        ],
    },
    {
        label: 'Whole ped',
        bones: [{ id: 0, name: 'ROOT', label: 'Root (no bone)' }],
    },
];

export const BONES = BONE_GROUPS.flatMap((group) => group.bones);

export const BONE_BY_ID = new Map(BONES.map((bone) => [bone.id, bone]));
