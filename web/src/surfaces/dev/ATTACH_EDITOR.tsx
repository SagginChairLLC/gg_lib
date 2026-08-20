import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { t } from '@/data/useLang';
import { BONE_BY_ID, BONE_GROUPS } from '@/data/pedBones';
import { ATTACH_EXAMPLES } from '@/data/attachExamples';
import { TEST_VEHICLES, VEHICLE_BONE_GROUPS } from '@/data/vehicleBones';
import {
    clearProp,
    exitEditor,
    playAnim,
    resetPlacement,
    loadExample,
    setBone,
    setBoneName,
    setMode,
    setTarget,
    setVehicle,
    spawnProp,
    useAttach,
    type Vec3,
} from '@/data/useAttach';
import { copyText } from '@/lib/clipboard';
import Dropdown from '../studio/DROPDOWN';

/**
 * Hang a prop off a bone and drag it into place.
 *
 * The placing is done with the handles out in the world, not in here -- this
 * side picks the animation, the prop and the bone, shows what the drag came
 * out as, and hands it over.
 *
 * The handles work in world space, so dragging the X ring turns the prop
 * about the world X whatever the bone underneath is doing. The client turns
 * that back into the bone-relative numbers the native wants.
 */

/** The call to paste, and the bare numbers for a config table. */
function snippets(model: string, bone: number, pos: Vec3, rot: Vec3) {
    const n = (value: number) => value.toFixed(4).replace(/\.?0+$/, '') || '0';
    const named = BONE_BY_ID.get(bone);

    const args = [n(pos.x), n(pos.y), n(pos.z), n(rot.x), n(rot.y), n(rot.z)];

    return {
        call: [
            `local prop = CreateObject(joaat("${model || 'prop_model'}"), GetEntityCoords(PlayerPedId()), true, true, false)`,
            '',
            `AttachEntityToEntity(prop, PlayerPedId(), GetPedBoneIndex(PlayerPedId(), ${bone}), ${args.join(', ')}, true, true, false, true, 2, true)`,
        ].join('\n'),
        table: [
            '{',
            `    model = "${model || 'prop_model'}",`,
            `    bone = ${bone},${named ? ` -- ${named.name}` : ''}`,
            `    pos = vector3(${args[0]}, ${args[1]}, ${args[2]}),`,
            `    rot = vector3(${args[3]}, ${args[4]}, ${args[5]}),`,
            '}',
        ].join('\n'),
        numbers: args.join(', '),
    };
}

export default function ATTACH_EDITOR() {
    const open = useAttach((state) => state.open);
    const looking = useAttach((state) => state.looking);
    const model = useAttach((state) => state.model);
    const problem = useAttach((state) => state.problem);
    const bone = useAttach((state) => state.bone);
    const pos = useAttach((state) => state.pos);
    const rot = useAttach((state) => state.rot);
    const mode = useAttach((state) => state.mode);
    const target = useAttach((state) => state.target);
    const vehicle = useAttach((state) => state.vehicle);
    const boneName = useAttach((state) => state.boneName);
    const boneOk = useAttach((state) => state.boneOk);

    const [draftModel, setDraftModel] = useState('');
    const [copied, setCopied] = useState<string | null>(null);
    const [example, setExample] = useState(-1);
    const [vehicleDraft, setVehicleDraft] = useState('');
    const [animDict, setAnimDict] = useState('');
    const [animName, setAnimName] = useState('');

    // W and R swap the handles, which is what every editor with a gizmo
    // binds them to. Only while this panel has the keyboard.
    useEffect(() => {
        if (!open) return;

        const onKey = (event: KeyboardEvent) => {
            const typing = document.activeElement?.tagName === 'INPUT';

            if (typing || event.repeat || event.ctrlKey || event.altKey) return;

            const key = event.key.toLowerCase();

            if (key === 'w') setMode('translate');
            if (key === 'r') setMode('rotate');
        };

        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, [open]);

    useEffect(() => {
        if (!copied) return;

        const timer = setTimeout(() => setCopied(null), 1400);

        return () => clearTimeout(timer);
    }, [copied]);

    if (!open) return null;

    const cut = snippets(model, bone, pos, rot);

    const boneOptions = BONE_GROUPS.flatMap((group) =>
        group.bones.map((entry) => ({ value: String(entry.id), label: `${entry.label} · ${entry.name}` })),
    );

    const copies: { id: string; label: string; text: string }[] = [
        { id: 'call', label: t('attach_copy_call'), text: cut.call },
        { id: 'table', label: t('attach_copy_table'), text: cut.table },
        { id: 'numbers', label: t('attach_copy_numbers'), text: cut.numbers },
    ];

    return (
        <motion.aside
            initial={{ opacity: 0, x: '4vh' }}
            exit={{ opacity: 0, x: '4vh' }}
            animate={{ opacity: looking ? 0.35 : 1, x: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="pointer-events-auto absolute right-[2vh] top-[2vh] bottom-[2vh] z-50 flex w-[34vh] flex-col overflow-hidden rounded-[0.7vh] border border-white/10 bg-neutral-950/95"
        >
            <div className="flex flex-shrink-0 items-center gap-[0.9vh] border-b border-white/10 px-[1.3vh] py-[1vh]">
                <i className="fas fa-paperclip text-[1.5vh] text-primary" />

                <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[1.5vh] font-bold text-white/95">{t('attach_title')}</span>
                    <span className="truncate text-[1.05vh] text-white/30">
                        {target === 'vehicle' ? `${vehicle} · ${boneName}` : (BONE_BY_ID.get(bone)?.name ?? bone)}
                    </span>
                </div>

                {/* Something to open onto: a real prop, placement and
                    animation that already go together. */}
                <button
                    type="button"
                    title={t('attach_example_hint')}
                    onClick={() => {
                        const next = ATTACH_EXAMPLES[(example + 1) % ATTACH_EXAMPLES.length];

                        setDraftModel(next.model);
                        setAnimDict(next.anim.dict);
                        setAnimName(next.anim.name);

                        setExample((current) => (current + 1) % ATTACH_EXAMPLES.length);
                        loadExample(next);
                    }}
                    className="flex h-[2.8vh] flex-shrink-0 items-center gap-[0.5vh] rounded-[0.4vh] border border-primary/40 bg-primary/10 px-[0.8vh] text-[1.1vh] font-bold text-primary transition-colors hover:bg-primary/25"
                >
                    <i className="fas fa-wand-magic-sparkles text-[1vh]" />
                    {t('attach_example')}
                </button>

                <button
                    type="button"
                    title={t('attach_close')}
                    onClick={exitEditor}
                    className="flex h-[2.8vh] w-[2.8vh] flex-shrink-0 items-center justify-center rounded-[0.4vh] border border-white/10 text-[1.3vh] text-white/40 transition-colors hover:border-red-400/50 hover:text-red-300"
                >
                    <i className="fas fa-xmark" />
                </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
                {/* First, because it is the reason the prop is being placed:
                    a prop that sits right on a still ped is still wrong the
                    moment they move. */}
                <div className="flex flex-col gap-[0.5vh] border-b border-white/10 px-[1.3vh] py-[1vh]">
                    <span className="text-[1.05vh] font-semibold uppercase tracking-widest text-white/25">{t('attach_anim')}</span>

                    <div className="flex gap-[0.4vh]">
                        <input
                            value={animDict}
                            onChange={(event) => setAnimDict(event.target.value)}
                            placeholder={t('attach_anim_dict')}
                            className="h-[2.4vh] min-w-0 flex-1 rounded-[0.3vh] border border-white/10 bg-neutral-900/70 px-[0.6vh] font-mono text-[1.05vh] text-white/85 focus:border-primary/50"
                        />
                        <input
                            value={animName}
                            onChange={(event) => setAnimName(event.target.value)}
                            placeholder={t('attach_anim_name')}
                            className="h-[2.4vh] min-w-0 flex-1 rounded-[0.3vh] border border-white/10 bg-neutral-900/70 px-[0.6vh] font-mono text-[1.05vh] text-white/85 focus:border-primary/50"
                        />
                        <button
                            type="button"
                            onClick={() => playAnim(animDict.trim(), animName.trim())}
                            className="flex h-[2.4vh] flex-shrink-0 items-center rounded-[0.3vh] border border-white/10 px-[0.8vh] text-[1.05vh] font-semibold text-white/45 transition-colors hover:border-primary/40 hover:text-primary"
                        >
                            <i className="fas fa-person-running text-[0.95vh]" />
                        </button>
                    </div>
                </div>
                {/* The prop */}
                <div className="flex flex-col gap-[0.6vh] border-b border-white/10 px-[1.3vh] py-[1vh]">
                    <span className="text-[1.05vh] font-semibold uppercase tracking-widest text-white/25">{t('attach_prop')}</span>

                    <div className="flex gap-[0.4vh]">
                        <input
                            value={draftModel}
                            onChange={(event) => setDraftModel(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' && draftModel.trim()) spawnProp(draftModel.trim());
                            }}
                            placeholder={t('attach_model')}
                            className="h-[2.6vh] min-w-0 flex-1 rounded-[0.4vh] border border-white/10 bg-neutral-900/70 px-[0.8vh] font-mono text-[1.1vh] text-white/85 focus:border-primary/50"
                        />

                        <button
                            type="button"
                            disabled={!draftModel.trim()}
                            onClick={() => spawnProp(draftModel.trim())}
                            className="flex h-[2.6vh] flex-shrink-0 items-center rounded-[0.4vh] border border-primary/40 bg-primary/10 px-[1vh] text-[1.1vh] font-bold text-primary transition-colors hover:bg-primary/25 disabled:opacity-30"
                        >
                            <i className="fas fa-cube text-[0.95vh]" />
                        </button>
                    </div>

                    {model && (
                        <div className="flex items-center gap-[0.6vh]">
                            <span className="min-w-0 flex-1 truncate font-mono text-[1.15vh] text-primary">{model}</span>

                            <button
                                type="button"
                                onClick={clearProp}
                                className="flex-shrink-0 text-[1.05vh] font-semibold text-white/30 transition-colors hover:text-red-300"
                            >
                                {t('attach_remove')}
                            </button>
                        </div>
                    )}

                    {problem && (
                        <span className="flex items-center gap-[0.5vh] text-[1.1vh] font-semibold text-red-300">
                            <i className="fas fa-triangle-exclamation text-[1vh]" />
                            {t('attach_failed')} {problem}
                        </span>
                    )}
                </div>

                {/* What it is hanging off. A roof sign that fits a Stanier
                    will not fit a Zentorno, so the car is part of the job. */}
                <div className="flex flex-col gap-[0.5vh] border-b border-white/10 px-[1.3vh] py-[1vh]">
                    <span className="text-[1.05vh] font-semibold uppercase tracking-widest text-white/25">{t('attach_target')}</span>

                    <div className="flex gap-[0.4vh]">
                        {(['ped', 'vehicle'] as const).map((option) => (
                            <button
                                key={option}
                                type="button"
                                onClick={() => setTarget(option)}
                                className={`flex h-[2.6vh] flex-1 items-center justify-center gap-[0.5vh] rounded-[0.4vh] border text-[1.15vh] font-bold transition-colors ${
                                    target === option
                                        ? 'border-primary/60 bg-primary/15 text-primary'
                                        : 'border-white/10 text-white/40 hover:border-primary/40 hover:text-primary'
                                }`}
                            >
                                <i className={`fas ${option === 'ped' ? 'fa-person' : 'fa-car'} text-[1vh]`} />
                                {option === 'ped' ? t('attach_on_ped') : t('attach_on_vehicle')}
                            </button>
                        ))}
                    </div>

                    {target === 'vehicle' && (
                        <>
                            <Dropdown
                                value={vehicle}
                                options={TEST_VEHICLES.map((name) => ({ value: name, label: name }))}
                                width="100%"
                                onChange={(next) => setVehicle(next)}
                            />

                            <input
                                value={vehicleDraft || vehicle}
                                onChange={(event) => setVehicleDraft(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') setVehicle((event.target as HTMLInputElement).value.trim());
                                }}
                                placeholder={t('attach_vehicle_model')}
                                className="h-[2.3vh] w-full rounded-[0.3vh] border border-white/10 bg-neutral-900/70 px-[0.6vh] text-center font-mono text-[1.1vh] text-white/70 focus:border-primary/50"
                            />
                        </>
                    )}
                </div>

                {/* The bone */}
                <div className="flex flex-col gap-[0.5vh] border-b border-white/10 px-[1.3vh] py-[1vh]">
                    <span className="text-[1.05vh] font-semibold uppercase tracking-widest text-white/25">{t('attach_bone')}</span>

                    {target === 'vehicle' ? (
                        <Dropdown
                            value={boneName}
                            options={VEHICLE_BONE_GROUPS.flatMap((group) =>
                                group.bones.map((entry) => ({ value: entry.name, label: entry.label })),
                            )}
                            width="100%"
                            onChange={(next) => setBoneName(next)}
                        />
                    ) : (
                        <Dropdown
                            value={String(bone)}
                            options={boneOptions}
                            width="100%"
                            onChange={(next) => setBone(Number(next))}
                        />
                    )}

                    {target === 'vehicle' && !boneOk && (
                        <span className="flex items-center gap-[0.5vh] text-[1.1vh] font-semibold text-red-300">
                            <i className="fas fa-triangle-exclamation text-[1vh]" />
                            {t('attach_bone_missing')}
                        </span>
                    )}
                </div>
                {/* What the handles are doing, and what came out of it. The
                    numbers are shown because they are what gets pasted, not
                    because anything is typed into them. */}
                <div className="flex flex-col gap-[0.6vh] px-[1.3vh] py-[1vh]">
                    <div className="flex gap-[0.4vh]">
                        {(['translate', 'rotate'] as const).map((option) => (
                            <button
                                key={option}
                                type="button"
                                onClick={() => setMode(option)}
                                className={`flex h-[2.6vh] flex-1 items-center justify-center gap-[0.5vh] rounded-[0.4vh] border text-[1.15vh] font-bold transition-colors ${
                                    mode === option
                                        ? 'border-primary/60 bg-primary/15 text-primary'
                                        : 'border-white/10 text-white/40 hover:border-primary/40 hover:text-primary'
                                }`}
                            >
                                <i className={`fas ${option === 'translate' ? 'fa-up-down-left-right' : 'fa-rotate'} text-[1vh]`} />
                                {option === 'translate' ? t('attach_move') : t('attach_turn')}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-col gap-[0.25vh] rounded-[0.4vh] border border-white/10 bg-neutral-900/50 px-[0.8vh] py-[0.6vh]">
                        {(
                            [
                                [t('attach_offset'), pos],
                                [t('attach_rotation'), rot],
                            ] as const
                        ).map(([label, value]) => (
                            <div key={label} className="flex items-baseline gap-[0.6vh]">
                                <span className="w-[6vh] flex-shrink-0 text-[1.05vh] font-semibold uppercase tracking-widest text-white/25">{label}</span>
                                <span className="min-w-0 flex-1 truncate text-right font-mono text-[1.1vh] text-white/70">
                                    {[value.x, value.y, value.z].map((part) => part.toFixed(3)).join(', ')}
                                </span>
                            </div>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={resetPlacement}
                        className="h-[2.2vh] rounded-[0.3vh] border border-white/10 text-[1.05vh] font-semibold text-white/35 transition-colors hover:border-white/25 hover:text-white/70"
                    >
                        {t('attach_reset')}
                    </button>

                    <p className="text-[1vh] leading-snug text-white/25">{t('attach_gizmo_help')}</p>
                </div>
            </div>

            {/* Take it with you */}
            <div className="flex flex-shrink-0 flex-wrap gap-[0.4vh] border-t border-white/10 px-[1.3vh] py-[0.9vh]">
                {copies.map((entry) => (
                    <button
                        key={entry.id}
                        type="button"
                        title={entry.text}
                        onClick={() => {
                            if (copyText(entry.text)) setCopied(entry.id);
                        }}
                        className={`flex h-[2.4vh] flex-1 items-center justify-center gap-[0.4vh] rounded-[0.35vh] border text-[1.05vh] font-semibold transition-colors ${
                            copied === entry.id
                                ? 'border-primary/60 bg-primary/15 text-primary'
                                : 'border-white/10 text-white/40 hover:border-primary/40 hover:text-primary'
                        }`}
                    >
                        <i className={`fas ${copied === entry.id ? 'fa-check' : 'fa-copy'} text-[0.9vh]`} />
                        {entry.label}
                    </button>
                ))}
            </div>

            <div className="flex flex-shrink-0 items-center gap-[0.6vh] border-t border-white/10 px-[1.3vh] py-[0.6vh] text-[1.05vh] text-white/30">
                <kbd className="rounded-[0.3vh] border border-white/15 px-[0.5vh] font-mono text-[1vh] text-white/50">ALT</kbd>
                {t('particles_look_hint')}
            </div>
        </motion.aside>
    );
}
