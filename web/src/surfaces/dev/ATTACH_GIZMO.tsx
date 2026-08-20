import { Canvas, useThree } from '@react-three/fiber';
import { TransformControls } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import { Mesh, PerspectiveCamera, Vector3 } from 'three';
import { fetchNui } from '@/lib/fetchNui';
import { useAttach } from '@/data/useAttach';

/**
 * The handles you drag the prop around with.
 *
 * A three.js canvas laid over the game, with its camera matched to the game's
 * each frame so the handles sit on the prop rather than floating near it.
 *
 * Rotation is in WORLD space on purpose. Dragging the X ring turns the prop
 * about the world's X, whatever the bone underneath happens to be doing -- the
 * client turns that back into the bone-relative numbers the native wants. A
 * gizmo aligned to the bone is what makes props spin off at angles nobody
 * asked for.
 *
 * The prop's orientation is sent as its three axes rather than as angles, so
 * neither side has to agree about how the other stores a rotation.
 */

// GTA is Z-up, three.js is Y-up.
function gtaToThree(v: { x: number; y: number; z: number }): [number, number, number] {
    return [v.x, v.z, -v.y];
}

function threeToGta(x: number, y: number, z: number) {
    return { x, y: -z, z: y };
}

function CameraRig() {
    const camera = useThree((state) => state.camera) as PerspectiveCamera;
    const cam = useAttach((state) => state.camera);

    useEffect(() => {
        if (!cam) return;

        const pitch = (cam.rotation.x * Math.PI) / 180;
        const yaw = (cam.rotation.z * Math.PI) / 180;
        const flat = Math.abs(Math.cos(pitch));

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
    const mode = useAttach((state) => state.mode);
    const placed = useAttach((state) => state.placed);
    const dragging = useRef(false);

    // Only follow the client while nobody is dragging: writing the object's
    // transform mid-drag fights the handle the mouse is holding.
    useEffect(() => {
        if (!mesh.current || dragging.current || !placed) return;

        const [x, y, z] = gtaToThree(placed.at);

        mesh.current.position.set(x, y, z);

        // Rebuilt from the axes the client sent, so the object is oriented the
        // same way the prop is without either side naming an angle.
        const right = new Vector3(...gtaToThree(placed.right));
        const forward = new Vector3(...gtaToThree(placed.forward));
        const up = new Vector3(...gtaToThree(placed.up));

        mesh.current.matrixAutoUpdate = true;
        mesh.current.rotation.setFromRotationMatrix(
            new (mesh.current.matrix.constructor as typeof import('three').Matrix4)().makeBasis(right, up, forward.negate()),
        );
    }, [placed]);

    const publish = () => {
        const node = mesh.current;
        if (!node) return;

        node.updateMatrixWorld();

        const right = new Vector3(1, 0, 0).applyQuaternion(node.quaternion);
        const up = new Vector3(0, 1, 0).applyQuaternion(node.quaternion);
        const forward = new Vector3(0, 0, -1).applyQuaternion(node.quaternion);

        void fetchNui('attach_gizmo', {
            at: threeToGta(node.position.x, node.position.y, node.position.z),
            right: threeToGta(right.x, right.y, right.z),
            forward: threeToGta(forward.x, forward.y, forward.z),
            up: threeToGta(up.x, up.y, up.z),
        });
    };

    return (
        <>
            <mesh ref={mesh} />
            {mesh.current && (
                <TransformControls
                    object={mesh.current}
                    mode={mode}
                    space="world"
                    size={0.8}
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

function ContextGuard() {
    const gl = useThree((state) => state.gl);

    useEffect(() => {
        const canvas = gl.domElement;

        const onLost = (event: Event) => event.preventDefault();

        canvas.addEventListener('webglcontextlost', onLost);

        return () => {
            canvas.removeEventListener('webglcontextlost', onLost);

            gl.forceContextLoss?.();
            gl.dispose?.();
        };
    }, [gl]);

    return null;
}

export default function ATTACH_GIZMO() {
    const open = useAttach((state) => state.open);
    const placed = useAttach((state) => state.placed);
    const camera = useAttach((state) => state.camera);

    const live = open && placed !== null && camera !== null;

    return (
        <div className={`absolute inset-0 ${live ? 'z-40' : 'invisible -z-10'}`}>
            <Canvas
                frameloop={live ? 'always' : 'never'}
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
