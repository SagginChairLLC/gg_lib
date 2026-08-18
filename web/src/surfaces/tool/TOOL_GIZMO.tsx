import { Canvas, useThree } from '@react-three/fiber';
import { TransformControls } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import { Mesh, PerspectiveCamera, Vector3 } from 'three';
import { fetchNui } from '@/lib/fetchNui';
import { gtaToThree, headingFromForward, headingToThreeY, threeToGta, useGizmo } from '@/data/useGizmo';

const FORWARD = new Vector3(0, 0, -1);

function CameraRig() {
    const camera = useThree((state) => state.camera) as PerspectiveCamera;
    const cam = useGizmo((state) => state.camera);

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
    const mode = useGizmo((state) => state.mode);
    const position = useGizmo((state) => state.position);
    const heading = useGizmo((state) => state.heading);
    const dragging = useRef(false);

    useEffect(() => {
        if (!mesh.current || dragging.current || !position) return;

        const [x, y, z] = gtaToThree(position);
        mesh.current.position.set(x, y, z);
        mesh.current.rotation.set(0, headingToThreeY(heading), 0);
    }, [position, heading]);

    const publish = () => {
        const node = mesh.current;
        if (!node) return;

        const forward = FORWARD.clone().applyQuaternion(node.quaternion);
        const turned = headingFromForward({ x: forward.x, z: forward.z });

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

export default function TOOL_GIZMO() {
    const active = useGizmo((state) => state.active);
    const position = useGizmo((state) => state.position);
    const live = active && position !== null;

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
