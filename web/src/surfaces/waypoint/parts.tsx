/** What every waypoint face is handed. Lua sends these on a fixed interval. */
export type FaceProps = {
    distance: number | string;
    unit: string;
    label: string;
    /** Font Awesome name, for the faces that show one. */
    icon: string;
};
