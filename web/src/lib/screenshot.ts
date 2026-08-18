/**
 * Turns a greenscreen capture into a cropped, transparent webp.
 *
 * This runs in gg_lib's own NUI, not the calling script's. A script asks for a
 * vehicle image and gets one back — it never has to bundle canvas code or know
 * that any of this happened.
 */

type Processed = {
    ok: boolean;
    id: string;
    webpB64?: string;
    error?: string;
};

/** Green is keyed out by how far green leads the other channels, not by hue. */
const HARD_CUT = 90;
const SOFT_CUT = 60;

/** Pixels kept around the vehicle after cropping. */
const PADDING = 4;

function keyOutGreen(data: Uint8ClampedArray, width: number, height: number) {
    const count = width * height;

    for (let i = 0; i < count; i += 1) {
        const at = i * 4;
        const r = data[at];
        const g = data[at + 1];
        const b = data[at + 2];

        const greenness = g - Math.max(r, b);

        if (greenness > HARD_CUT) {
            data[at + 3] = 0;
        } else if (greenness > SOFT_CUT) {
            // Partly green: fade it out and pull the green channel back down, so
            // a windscreen reflecting the backdrop does not keep a green rim.
            const t = (greenness - SOFT_CUT) / (HARD_CUT - SOFT_CUT);
            data[at + 3] = Math.round((1 - t) * data[at + 3]);
            data[at + 1] = Math.max(r, b);
        } else if (greenness > 0) {
            data[at + 1] = Math.max(r, b);
        }
    }

    // One pass of edge erosion. The pixels bordering the keyed area are always
    // part backdrop, and they read as a green halo at any size.
    const alpha = new Uint8Array(count);
    for (let i = 0; i < count; i += 1) alpha[i] = data[i * 4 + 3];

    for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
            const i = y * width + x;
            if (alpha[i] === 0) continue;

            if (alpha[i - 1] === 0 || alpha[i + 1] === 0 || alpha[i - width] === 0 || alpha[i + width] === 0) {
                data[i * 4 + 3] = 0;
            }
        }
    }
}

/** The box holding every pixel that survived keying, or null if none did. */
function opaqueBounds(data: Uint8ClampedArray, width: number, height: number) {
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            if (data[(y * width + x) * 4 + 3] === 0) continue;

            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
    }

    return minX <= maxX ? { minX, maxX, minY, maxY } : null;
}

/** screenshot-basic answers with a data URL or a bare base64 body. */
function asDataUrl(raw: string): string {
    if (typeof raw !== 'string') return raw;
    if (raw.startsWith('data:')) return raw;

    return `data:image/png;base64,${raw}`;
}

function process(imageUrl: string, quality: number): Promise<{ webpB64?: string; error?: string }> {
    return new Promise((resolve) => {
        const image = new Image();

        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;

            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) return resolve({ error: 'no 2d context' });

            ctx.drawImage(image, 0, 0);

            const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
            keyOutGreen(frame.data, canvas.width, canvas.height);
            ctx.putImageData(frame, 0, 0);

            const bounds = opaqueBounds(frame.data, canvas.width, canvas.height);
            let out = canvas;

            if (bounds) {
                const x = Math.max(0, bounds.minX - PADDING);
                const y = Math.max(0, bounds.minY - PADDING);
                const w = Math.min(canvas.width, bounds.maxX + PADDING + 1) - x;
                const h = Math.min(canvas.height, bounds.maxY + PADDING + 1) - y;

                out = document.createElement('canvas');
                out.width = w;
                out.height = h;
                out.getContext('2d')?.drawImage(canvas, x, y, w, h, 0, 0, w, h);
            }

            resolve({ webpB64: out.toDataURL('image/webp', quality) });
        };

        image.onerror = () => resolve({ error: 'image failed to load' });

        image.src = asDataUrl(imageUrl);
    });
}

/**
 * Listens for capture jobs from gg_lib's client. Registered once at start-up —
 * the editor being closed does not stop it, because an NUI page keeps running
 * whether or not it is focused.
 */
export function registerScreenshotProcessor() {
    window.addEventListener('message', async (event: MessageEvent) => {
        const message = event.data;
        if (message?.action !== 'gg_screenshot_process') return;

        const { id, image, quality } = message.data ?? {};

        const result: Processed = { ok: false, id: String(id ?? '') };

        try {
            const { webpB64, error } = await process(image, typeof quality === 'number' ? quality : 0.85);

            if (webpB64) {
                result.ok = true;
                result.webpB64 = webpB64;
            } else {
                result.error = error ?? 'unknown failure';
            }
        } catch (err) {
            result.error = String(err);
        }

        // Answered even on failure. The client waits on this reply, and a silent
        // drop would hang the whole capture run.
        void fetch(`https://${(window as unknown as { GetParentResourceName?: () => string }).GetParentResourceName?.() ?? 'gg_lib'}/gg_screenshot_done`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(result),
        }).catch(() => undefined);
    });
}
