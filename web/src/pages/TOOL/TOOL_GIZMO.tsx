import { Canvas, useThree } from '@react-three/fiber';
import { TransformControls } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import { Mesh, PerspectiveCamera, Vector3 } from 'three';
import { fetchNui } from '@/lib/fetchNui';
import { gtaToThree, headingFromForward, headingToThreeY, threeToGta, useGizmo } from '@/data/useGizmo';

/** three's own forward. Rotated by the mesh's quaternion, it gives the heading. */
const FORWARD = new Vector3(0, 0, -1);

/**
 * Drag handles over the entity being placed, drawn by three.js on a transparent
 * canvas above the game.
 *
 * The camera is rebuilt from the game's own rendered camera every frame, so the
 * handles sit exactly where the entity does. Orientation comes from a forward
 * vector and lookAt rather than Euler angles: mapping GTA's pitch/roll/yaw onto
 * a three.js rotation order needs sign corrections that break at certain
 * pitches, which is the usual reason a gizmo like this drags the wrong way.
 *
 * The handles are in LOCAL space and the mesh carries the entity's heading, so
 * the arrows line up with the way the ped faces: forward is forward.
 */

function CameraRig() {
    const camera = useThree((state) => state.camera) as PerspectiveCamera;
    const cam = useGizmo((state) => state.camera);

    useEffect(() => {
        if (!cam) return;

        const pitch = (cam.rotation.x * Math.PI) / 180;
        const yaw = (cam.rotation.z * Math.PI) / 180;
        const flat = Math.abs(Math.cos(pitch));

        // GTA forward from pitch/yaw, then converted once into three space.
        const forward = {
            x: -Math.sin(yaw) * flat,
            y: Math.cos(yaw) * flat,
            z: Math.sin(pitch),
        };

        const [px, py, pz] = gtaToThree(cam.position);
        const [fx, fy, fz] = gtaToThree(forward);

        camera.position.set(px, py, pz);
        camera.up.set(0, 1, 0);
        camera.lookAt(new Vector3(px + fx, py + fy, pz + fz));

        if (camera.fov !== cam.fov) {
            camera.fov = cam.fov;
            camera.updateProjectionMatrix();
        }
    }, [camera, cam]);

    return null;
}

function Handles() {
    const mesh = useRef<Mesh>(null);
    const mode = useGizmo((state) => state.mode);
    const position = useGizmo((state) => state.position);
    const heading = useGizmo((state) => state.heading);
    const dragging = useRef(false);

    // Lua stays the source of truth while nobody is dragging; once a drag
    // starts the mesh owns the transform until it is released, or the incoming
    // frame would fight the pointer.
    useEffect(() => {
        if (!mesh.current || dragging.current || !position) return;

        const [x, y, z] = gtaToThree(position);
        mesh.current.position.set(x, y, z);
        mesh.current.rotation.set(0, headingToThreeY(heading), 0);
    }, [position, heading]);

    const publish = () => {
        const node = mesh.current;
        if (!node) return;

        // Heading comes from the object's own forward vector, not rotation.y.
        // A ped only turns about the vertical, and reading that back off an
        // Euler breaks past a quarter turn (see headingFromForward).
        const forward = FORWARD.clone().applyQuaternion(node.quaternion);
        const turned = headingFromForward({ x: forward.x, z: forward.z });

        // Flatten any pitch or roll the ring picked up on the way. A standing
        // ped has one meaningful axis, so the mesh is put back on it rather
        // than allowed to drift off level.
        node.rotation.set(0, headingToThreeY(turned), 0);

        void fetchNui('gg_gizmo_move', {
            position: threeToGta(node.position.x, node.position.y, node.position.z),
            heading: turned,
        });
    };

    return (
        <>
            <mesh ref={mesh} />
            {mesh.current && (
                <TransformControls
                    object={mesh.current}
                    mode={mode}
                    space="local"
                    size={0.7}
                    showX={mode === 'translate'}
                    showZ={mode === 'translate'}
                    onObjectChange={publish}
                    onMouseDown={() => {
                        dragging.current = true;
                    }}
                    onMouseUp={() => {
                        dragging.current = false;
                        publish();
                    }}
                />
            )}
        </>
    );
}

/**
 * A browser allows only a handful of live WebGL contexts and drops the oldest
 * when the cap is reached -- that is what "THREE.WebGLRenderer: Context Lost"
 * means. Mounting the Canvas per session burns one context every time the
 * cursor is toggled, so it is mounted once and parked instead: hidden, with the
 * frame loop stopped, holding a single context for the page's lifetime.
 */
function ContextGuard() {
    const gl = useThree((state) => state.gl);

    useEffect(() => {
        const canvas = gl.domElement;

        // Without preventDefault the context can never be restored, so a single
        // hiccup would leave the gizmo permanently blank.
        const onLost = (event: Event) => event.preventDefault();

        canvas.addEventListener('webglcontextlost', onLost);

        return () => {
            canvas.removeEventListener('webglcontextlost', onLost);

            // Chromium reclaims contexts lazily; releasing on teardown keeps a
            // reload from stacking them up.
            gl.forceContextLoss?.();
            gl.dispose?.();
        };
    }, [gl]);

    return null;
}

/**
 * Idle state is `invisible`, not pointer-events or opacity. react-three-fiber
 * sets pointerEvents:'auto' on its own container, which overrides anything
 * inherited from a parent -- so a parked canvas would sit over the settings
 * editor and swallow every click. visibility:hidden is not hit-tested at all,
 * and unlike display:none it keeps the element's size, so the renderer is not
 * resized to 0x0 and back on every session.
 */
export default function TOOL_GIZMO() {
    const active = useGizmo((state) => state.active);
    const position = useGizmo((state) => state.position);
    const live = active && position !== null;

    return (
        <div className={`absolute inset-0 ${live ? 'z-40' : 'invisible -z-10'}`}>
            <Canvas
                // Stopped rather than unmounted when idle: no frames are drawn,
                // but the context survives to the next session.
                frameloop={live ? 'always' : 'never'}
                // Handles do not need retina; a 4K NUI canvas at dpr 2 costs a
                // lot of GPU memory and makes context loss far more likely.
                dpr={1}
                gl={{ alpha: true, antialias: true, powerPreference: 'low-power', failIfMajorPerformanceCaveat: false }}
                camera={{ fov: 50, near: 0.05, far: 2000 }}
            >
                <ContextGuard />
                {live && <CameraRig />}
                {live && <Handles />}
            </Canvas>
        </div>
    );
}
