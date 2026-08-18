/**
 * Copy that works inside NUI. The async Clipboard API is blocked by CEF's
 * permissions policy, and merely CALLING it logs a violation the console
 * cannot be spared — so it is never touched. The selection path is what the
 * game honors, and a click-driven copy satisfies its gesture requirement in
 * the browser too.
 */
export function copyText(text: string): boolean {
    try {
        const holder = document.createElement('textarea');

        holder.value = text;
        holder.style.position = 'fixed';
        holder.style.opacity = '0';
        holder.style.pointerEvents = 'none';

        document.body.appendChild(holder);
        holder.select();

        const done = document.execCommand('copy');

        document.body.removeChild(holder);

        return done;
    } catch {
        return false;
    }
}
