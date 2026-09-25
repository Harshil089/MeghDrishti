"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function Ping({ phase }: { phase: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = (state.clock.elapsedTime * 0.5 + phase) % 1;
    ref.current.scale.setScalar(0.15 + t * 1.4);
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.55 * (1 - t);
  });
  return (
    <mesh ref={ref}>
      <ringGeometry args={[0.42, 0.5, 32]} />
      <meshBasicMaterial color="#fb7185" transparent opacity={0.5} />
    </mesh>
  );
}

export default function AlertPulseScene() {
  return (
    <Canvas
      orthographic
      camera={{ zoom: 30, position: [0, 0, 5] }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 1.5]}
      style={{ pointerEvents: "none" }}
    >
      <Ping phase={0} />
      <Ping phase={0.33} />
      <Ping phase={0.66} />
      <mesh>
        <circleGeometry args={[0.16, 20]} />
        <meshBasicMaterial color="#fb7185" />
      </mesh>
    </Canvas>
  );
}
