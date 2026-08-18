/**
 * Re-express a color in the notation the existing value already uses, so
 * editing an `rgb(252, 186, 3)` setting does not silently rewrite it to
 * `#fcba03` — the field would change width mid-edit and the stored value would
 * stop matching the Lua default it is compared against.
 */
export function matchColorNotation(next: string, current: string): string {
    if (!/^rgba?\(/i.test(current)) return next;

    const { commaSeparated } = parseColor(next);
    if (!commaSeparated) return next;

    return `rgb(${commaSeparated})`;
}

export function parseColor(color: string): { spaceSeparated: string; commaSeparated: string } {
    // Check for rgb() format
    const rgbRegex = /^rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$/;
    const rgbaRegex = /^rgba\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3}),\s*([\d\.]+)\)$/;

    // Check for hsl() format
    const hslRegex = /^hsl\((\d{1,3}),\s*(\d{1,3})%,\s*(\d{1,3})%\)$/;

    // Check for hex format (#RRGGBB or #RRGGBBAA)
    const hexRegex = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;

    let spaceSeparated: string = '';
    let commaSeparated: string = '';

    // Handle rgb format
    if (rgbRegex.test(color)) {
        const [, r, g, b] = color.match(rgbRegex)!;
        spaceSeparated = `${r} ${g} ${b}`;
        commaSeparated = `${r}, ${g}, ${b}`;
    }
    // Handle rgba format
    else if (rgbaRegex.test(color)) {
        const [, r, g, b] = color.match(rgbaRegex)!;
        spaceSeparated = `${r} ${g} ${b}`;
        commaSeparated = `${r}, ${g}, ${b}`;
    }
    // Handle hsl format
    else if (hslRegex.test(color)) {
        const [, h, s, l] = color.match(hslRegex)!;

        // Convert hsl values from string to number
        const hNum = parseInt(h, 10);
        const sFactor = parseInt(s, 10) / 100;
        const lFactor = parseInt(l, 10) / 100;

        // Use a simple HSL to RGB formula
        let r, g, b;

        const c = (1 - Math.abs(2 * lFactor - 1)) * sFactor;
        const x = c * (1 - Math.abs(((hNum / 60) % 2) - 1));
        const m = lFactor - c / 2;

        if (hNum >= 0 && hNum < 60) {
            r = c;
            g = x;
            b = 0;
        } else if (hNum >= 60 && hNum < 120) {
            r = x;
            g = c;
            b = 0;
        } else if (hNum >= 120 && hNum < 180) {
            r = 0;
            g = c;
            b = x;
        } else if (hNum >= 180 && hNum < 240) {
            r = 0;
            g = x;
            b = c;
        } else if (hNum >= 240 && hNum < 300) {
            r = x;
            g = 0;
            b = c;
        } else {
            r = c;
            g = 0;
            b = x;
        }

        // Add m to each value and convert to 0-255 range
        r = Math.round((r + m) * 255);
        g = Math.round((g + m) * 255);
        b = Math.round((b + m) * 255);

        spaceSeparated = `${r} ${g} ${b}`;
        commaSeparated = `${r}, ${g}, ${b}`;
    }
    // Handle hex format
    else if (hexRegex.test(color)) {
        const hex = color.replace('#', '');
        let r = parseInt(hex.substr(0, 2), 16);
        let g = parseInt(hex.substr(2, 2), 16);
        let b = parseInt(hex.substr(4, 2), 16);

        // If it's an 8-character hex (rgba), we can ignore the alpha for now
        if (hex.length === 8) {
            // You can process the alpha if needed
        }

        spaceSeparated = `${r} ${g} ${b}`;
        commaSeparated = `${r}, ${g}, ${b}`;
    }

    return { spaceSeparated, commaSeparated };
}
