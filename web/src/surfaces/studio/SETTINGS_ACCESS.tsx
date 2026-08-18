import { useState } from 'react';
import { t } from '@/data/useLang';
import { useAccess } from '@/data/useAccess';
import { copyText } from '@/lib/clipboard';

/**
 * Shown to anyone who runs the command without access.
 *
 * The command used to refuse silently, which reads as broken. This answers the
 * question they were about to ask instead: here is your identifier, here is the
 * file, put one in the other.
 */
export default function SETTINGS_ACCESS() {
    const identifier = useAccess((state) => state.identifier);
    const file = useAccess((state) => state.file);
    const [copied, setCopied] = useState<string | null>(null);

    const copy = (value: string, key: string) => {
        if (!copyText(value)) return;

        setCopied(key);
        setTimeout(() => setCopied((current) => (current === key ? null : current)), 1500);
    };

    const Field = ({ label, value, name, mono }: { label: string; value: string; name: string; mono?: boolean }) => (
        <div className="flex flex-col gap-[0.6vh]">
            <span className="text-[1.2vh] font-semibold uppercase tracking-widest text-white/35">{label}</span>

            <div className="flex items-center gap-[0.8vh]">
                <span
                    className={`min-w-0 flex-1 truncate rounded-[0.5vh] border border-white/10 bg-neutral-950/60 px-[1.2vh] py-[0.9vh] text-[1.4vh] text-white/85 ${
                        mono ? 'font-mono' : ''
                    }`}
                    title={value}
                >
                    {value || '—'}
                </span>

                <button
                    type="button"
                    disabled={!value}
                    onClick={() => copy(value, name)}
                    className={`flex h-[3.6vh] w-[3.6vh] flex-shrink-0 items-center justify-center rounded-[0.5vh] border text-[1.4vh] transition-colors ${
                        value ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20' : 'cursor-not-allowed border-white/5 text-white/20'
                    }`}
                    title={t('access_copy')}
                >
                    <i className={`fas ${copied === name ? 'fa-check' : 'fa-copy'}`} />
                </button>
            </div>
        </div>
    );

    return (
        <div className="flex h-full w-full items-center justify-center">
            <div className="flex w-[80vh] flex-col gap-[2vh] rounded-[1vh] border border-white/10 bg-neutral-900/95 p-[2.6vh] shadow-[0_2vh_6vh_rgba(0,0,0,0.6)]">
                <div className="flex items-center gap-[1.2vh] border-b border-white/10 pb-[1.4vh]">
                    <i className="fas fa-lock text-[2.2vh] text-primary/80" />

                    <div className="min-w-0 flex-1">
                        <h1 className="text-[2.1vh] font-bold text-white/95">{t('access_title')}</h1>
                        <p className="text-[1.35vh] text-white/45">{t('access_subtitle')}</p>
                    </div>
                </div>

                <Field label={t('access_your_license')} value={identifier} name="id" mono />
                <Field label={t('access_file')} value={file} name="file" />

                <div className="rounded-[0.6vh] border border-white/10 bg-white/[0.02] p-[1.4vh]">
                    <span className="text-[1.2vh] font-semibold uppercase tracking-widest text-white/35">{t('access_how')}</span>

                    <ol className="mt-[0.8vh] flex list-decimal flex-col gap-[0.5vh] pl-[2vh] text-[1.4vh] leading-snug text-white/70">
                        <li>{t('access_step_open')}</li>
                        <li>{t('access_step_paste')}</li>
                        <li>{t('access_step_restart')}</li>
                    </ol>

                    <pre className="mt-[1.2vh] overflow-x-auto rounded-[0.5vh] border border-white/10 bg-neutral-950/70 p-[1.2vh] font-mono text-[1.3vh] leading-relaxed text-white/80">
{`admins = {
    "${identifier || 'license2:your_license_here'}",
},`}
                    </pre>
                </div>

                <p className="text-center text-[1.3vh] text-white/30">{t('access_close_hint')}</p>
            </div>
        </div>
    );
}
