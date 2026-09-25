"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function Sweep() {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (group.current) group.current.rotation.z = -state.clock.elapsedTime * 1.1;
  });
  return (
    <group ref={group}>
      <mesh>
        <circleGeometry args={[1, 32, 0, Math.PI / 4]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

export default function RadarSweepScene() {
  return (
    <Canvas
      orthographic
      camera={{ zoom: 28, position: [0, 0, 5] }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 1.5]}
      style={{ pointerEvents: "none" }}
    >
      <mesh>
        <ringGeometry args={[0.58, 0.6, 40]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.25} />
      </mesh>
      <mesh>
        <ringGeometry args={[0.94, 0.96, 40]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.18} />
      </mesh>
      <Sweep />
      <mesh>
        <circleGeometry args={[0.08, 16]} />
        <meshBasicMaterial color="#e6edf7" />
      </mesh>
    </Canvas>
  );
}
