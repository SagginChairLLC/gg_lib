import { t } from '@/data/useLang';
import { hideEditor } from '@/data/useLang';
import { PARTICLE_DICT_COUNT, PARTICLE_EFFECT_COUNT } from '@/data/particlesMeta';
import { enterViewer } from '@/data/useParticles';
import { enterEditor } from '@/data/useAttach';
import { BONES } from '@/data/pedBones';
import { highlight } from './settings-utils';

/**
 * Dev Tools: the things that make building a script easier, rather than the
 * things that run one. Separate from the admin pages on purpose -- nothing here
 * changes what players see, and none of it is stored.
 */

type DevTool = {
    id: string;
    label: string;
    icon: string;
    description: string;
    /** What the tool has to work with, shown so it is clear before opening. */
    detail: string;
    open: () => void;
};

const TOOLS: DevTool[] = [
    {
        id: 'particles',
        label: 'Particle Viewer',
        icon: 'fa-fire-flame-curved',
        description: 'Play any ptfx in front of you and dial in its scale, colour and alpha live.',
        detail: `${PARTICLE_EFFECT_COUNT} effects across ${PARTICLE_DICT_COUNT} dictionaries, plus anything you type in`,
        open: () => {
            // The world is the point, so the editor steps aside and the viewer
            // takes a panel down the side instead of the whole screen.
            hideEditor();
            enterViewer();
        },
    },
    {
        id: 'attach',
        label: 'Prop Attacher',
        icon: 'fa-paperclip',
        description: 'Hang a prop off a bone and nudge it into place, then take the attach call with you.',
        detail: `${BONES.length} named bones, or type a raw id`,
        open: () => {
            hideEditor();
            enterEditor();
        },
    },
];

export default function SETTINGS_DEV({ query }: { query: string }) {
    const needle = query.trim().toLowerCase();

    const visible = TOOLS.filter(
        (tool) => !needle || tool.label.toLowerCase().includes(needle) || tool.description.toLowerCase().includes(needle),
    );

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col px-[2vh] py-[1.6vh]">
            <div className="mb-[1.2vh] flex flex-shrink-0 items-baseline gap-[1vh] border-b border-white/5 pb-[0.7vh]">
                <i className="fas fa-screwdriver-wrench text-[1.6vh] text-primary/80" />
                <h2 className="text-[1.8vh] font-bold text-white/90">{t('dev_title')}</h2>
                <span className="min-w-0 flex-1 truncate text-[1.25vh] text-white/35">{t('dev_help')}</span>
            </div>

            <div className="grid min-h-0 flex-1 content-start gap-[1vh] overflow-y-auto" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                {visible.map((tool) => (
                    <button
                        key={tool.id}
                        type="button"
                        onClick={tool.open}
                        className="group flex flex-col items-start gap-[0.7vh] rounded-[0.6vh] border border-white/10 bg-white/[0.02] p-[1.4vh] text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.05]"
                    >
                        <span className="flex items-center gap-[0.9vh]">
                            <span className="flex h-[3.6vh] w-[3.6vh] items-center justify-center rounded-[0.5vh] bg-primary/10 text-primary">
                                <i className={`fas ${tool.icon} text-[1.7vh]`} />
                            </span>

                            <span className="text-[1.6vh] font-bold text-white/95">{highlight(tool.label, query)}</span>
                        </span>

                        <span className="text-[1.25vh] leading-snug text-white/45">{highlight(tool.description, query)}</span>

                        <span className="font-mono text-[1.1vh] text-white/25">{tool.detail}</span>

                        <span className="mt-[0.3vh] flex items-center gap-[0.6vh] text-[1.2vh] font-bold text-primary/70 transition-colors group-hover:text-primary">
                            {t('dev_open')}
                            <i className="fas fa-arrow-right text-[1vh]" />
                        </span>
                    </button>
                ))}

                {visible.length === 0 && (
                    <div className="col-span-2 flex flex-col items-center gap-[1vh] py-[8vh] text-white/35">
                        <i className="fas fa-magnifying-glass-minus text-[3.5vh]" />
                        <span className="text-[1.5vh]">{t('settings_no_results')}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
