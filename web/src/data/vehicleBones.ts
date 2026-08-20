/**
 * The vehicle bones a prop is usually hung off.
 *
 * Vehicles name their bones rather than hashing them, so these are the strings
 * GetEntityBoneIndexByName takes. Not every vehicle has every bone -- a coupe
 * has no rear doors -- so the editor says when the one you picked is missing
 * rather than silently attaching to the chassis.
 *
 * `chassis` is the one most things end up on: a light bar or a taxi sign is a
 * roof offset from the chassis, because there is no roof bone to hang it from.
 */

export type VehicleBone = {
    name: string;
    label: string;
};

export type VehicleBoneGroup = {
    label: string;
    bones: VehicleBone[];
};

export const VEHICLE_BONE_GROUPS: VehicleBoneGroup[] = [
    {
        label: 'Body',
        bones: [
            { name: 'chassis', label: 'Chassis (roof signs, light bars)' },
            { name: 'chassis_dummy', label: 'Chassis dummy' },
            { name: 'bodyshell', label: 'Bodyshell' },
            { name: 'bonnet', label: 'Bonnet' },
            { name: 'boot', label: 'Boot' },
        ],
    },
    {
        label: 'Glass and lights',
        bones: [
            { name: 'windscreen', label: 'Windscreen' },
            { name: 'windscreen_r', label: 'Rear windscreen' },
            { name: 'headlight_l', label: 'Headlight left' },
            { name: 'headlight_r', label: 'Headlight right' },
            { name: 'taillight_l', label: 'Tail light left' },
            { name: 'taillight_r', label: 'Tail light right' },
            { name: 'platelight', label: 'Plate light' },
        ],
    },
    {
        label: 'Doors',
        bones: [
            { name: 'door_dside_f', label: 'Driver front door' },
            { name: 'door_dside_r', label: 'Driver rear door' },
            { name: 'door_pside_f', label: 'Passenger front door' },
            { name: 'door_pside_r', label: 'Passenger rear door' },
        ],
    },
    {
        label: 'Inside',
        bones: [
            { name: 'seat_dside_f', label: 'Driver seat' },
            { name: 'seat_pside_f', label: 'Passenger seat' },
            { name: 'seat_dside_r', label: 'Rear left seat' },
            { name: 'seat_pside_r', label: 'Rear right seat' },
            { name: 'steeringwheel', label: 'Steering wheel' },
        ],
    },
    {
        label: 'Wheels and exhaust',
        bones: [
            { name: 'wheel_lf', label: 'Wheel left front' },
            { name: 'wheel_rf', label: 'Wheel right front' },
            { name: 'wheel_lr', label: 'Wheel left rear' },
            { name: 'wheel_rr', label: 'Wheel right rear' },
            { name: 'exhaust', label: 'Exhaust' },
            { name: 'exhaust_2', label: 'Exhaust 2' },
        ],
    },
    {
        label: 'Spare dummies',
        bones: [
            { name: 'misc_a', label: 'misc_a' },
            { name: 'misc_b', label: 'misc_b' },
            { name: 'misc_c', label: 'misc_c' },
            { name: 'misc_d', label: 'misc_d' },
            { name: 'misc_e', label: 'misc_e' },
            { name: 'misc_f', label: 'misc_f' },
        ],
    },
];

export const VEHICLE_BONES = VEHICLE_BONE_GROUPS.flatMap((group) => group.bones);

/** Cars worth trying a taxi or light-bar fit against. */
export const TEST_VEHICLES = [
    'taxi',
    'stanier',
    'zentorno',
    'sultan',
    'police',
    'baller',
    'schafter2',
    'premier',
];
