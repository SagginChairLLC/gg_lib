/**
 * The waypoint styles gg_lib draws, and what the studio page shows about each.
 *
 * A style is a face: the same distance, unit and label rendered for a different
 * job. Adding one means a face component, an entry here, a settings define and
 * a line in the client's STYLES table — nothing else knows about them.
 */

export type WaypointStyleId = 'race' | 'taxi';

export type WaypointStyle = {
    id: WaypointStyleId;
    label: string;
    icon: string;
    /** Font Awesome name the face itself draws, where it shows one. */
    faceIcon: string;
    description: string;
    /** What it says when a script does not pass a label. */
    defaultLabel: string;
    /** Path of the object setting holding this style's defaults. */
    setting: string;
    /** A line worth copying, shown on the page. */
    usage: string;
};

export const WAYPOINT_STYLES: WaypointStyle[] = [
    {
        id: 'race',
        label: 'Race Checkpoint',
        icon: 'fa-flag-checkered',
        faceIcon: 'fa-flag-checkered',
        description: 'A big countdown you can read at speed. Distance dominates, with the label under it.',
        defaultLabel: 'CHECKPOINT',
        setting: 'waypoints.race',
        usage: 'exports.gg_lib:ggWaypointCreate({ id = "cp1", coords = coords, style = "race", label = "CHECKPOINT 1" })',
    },
    {
        id: 'taxi',
        label: 'Drop Off',
        icon: 'fa-taxi',
        faceIcon: 'fa-user',
        description: 'A destination plate for drop-offs, deliveries and pickups. Badge, name, then the distance.',
        defaultLabel: 'DROP OFF',
        setting: 'waypoints.taxi',
        usage: 'exports.gg_lib:ggWaypointCreate({ id = "fare", coords = coords, style = "taxi", label = "DROP OFF" })',
    },
];

export const WAYPOINT_STYLE_BY_ID = new Map(WAYPOINT_STYLES.map((style) => [style.id, style]));
