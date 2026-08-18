export const isEnvBrowser = (): boolean =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    process.env.NODE_ENV === 'development' && !(window as any).invokeNative;

export interface ServerPromiseResp<T = undefined> {
    errorMsg?: string;
    status: true | false;
    data: T;
}

export const buildRespObj = <T = unknown>(data: T, status: true | false, errorMsg?: string): ServerPromiseResp<T> => ({
    data,
    status,
    errorMsg,
});

/**
 * Module-level lock, keyed by event name. Lives outside React so re-renders
 * can never reset it — once a server-bound event is in flight, every further
 * click on any button firing that event is dropped until the server answers
 * (or the request fails). This is the first line of defense against players
 * cutting their connection and spamming a button to queue duplicate requests.
 */
const pendingEvents = new Set<string>();

export function isNuiEventPending(eventName: string): boolean {
    return pendingEvents.has(eventName);
}

export async function fetchNuiLocked<T = any>(eventName: string, data?: any, mock?: { data: T; delay?: number }): Promise<T | undefined> {
    if (pendingEvents.has(eventName)) return undefined;

    pendingEvents.add(eventName);
    try {
        return await fetchNui<T>(eventName, data, mock);
    } finally {
        pendingEvents.delete(eventName);
    }
}

export async function fetchNui<T = any>(eventName: string, data?: any, mock?: { data: T; delay?: number }): Promise<T> {
    if (isEnvBrowser()) {
        if (!mock) return undefined as T;
        await new Promise((r) => setTimeout(r, mock.delay ?? 200));
        return mock.data;
    }

    const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(data),
    };

    const resourceName = (window as any).GetParentResourceName?.() ?? 'nui-fallback';

    const resp = await fetch(`https://${resourceName}/${eventName}`, options);

    if (!resp.ok) throw new Error(`NUI fetch failed for ${eventName}: ${resp.statusText}`);

    try {
        return await resp.json();
    } catch (e) {
        throw new Error(`Invalid JSON from ${eventName}`);
    }
}
