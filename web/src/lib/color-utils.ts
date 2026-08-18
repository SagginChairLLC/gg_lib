export function matchColorNotation(next: string, current: string): string {
    if (!/^rgba?\(/i.test(current)) return next;

    const { commaSeparated } = parseColor(next);
    if (!commaSeparated) return next;

    return `rgb(${commaSeparated})`;
}

export function parseColor(color: string): { spaceSeparated: string; commaSeparated: string } {
    const rgbRegex = /^rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$/;
    const rgbaRegex = /^rgba\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3}),\s*([\d\.]+)\)$/;

    const hslRegex = /^hsl\((\d{1,3}),\s*(\d{1,3})%,\s*(\d{1,3})%\)$/;

    const hexRegex = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;

    let spaceSeparated: string = '';
    let commaSeparated: string = '';

    if (rgbRegex.test(color)) {
        const [, r, g, b] = color.match(rgbRegex)!;
        spaceSeparated = `${r} ${g} ${b}`;
        commaSeparated = `${r}, ${g}, ${b}`;
    }
    else if (rgbaRegex.test(color)) {
        const [, r, g, b] = color.match(rgbaRegex)!;
        spaceSeparated = `${r} ${g} ${b}`;
        commaSeparated = `${r}, ${g}, ${b}`;
    }
    else if (hslRegex.test(color)) {
        const [, h, s, l] = color.match(hslRegex)!;

        const hNum = parseInt(h, 10);
        const sFactor = parseInt(s, 10) / 100;
        const lFactor = parseInt(l, 10) / 100;

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

        r = Math.round((r + m) * 255);
        g = Math.round((g + m) * 255);
        b = Math.round((b + m) * 255);

        spaceSeparated = `${r} ${g} ${b}`;
        commaSeparated = `${r}, ${g}, ${b}`;
    }
    else if (hexRegex.test(color)) {
        const hex = color.replace('#', '');
        let r = parseInt(hex.substr(0, 2), 16);
        let g = parseInt(hex.substr(2, 2), 16);
        let b = parseInt(hex.substr(4, 2), 16);

        if (hex.length === 8) {
        }

        spaceSeparated = `${r} ${g} ${b}`;
        commaSeparated = `${r}, ${g}, ${b}`;
    }

    return { spaceSeparated, commaSeparated };
}
