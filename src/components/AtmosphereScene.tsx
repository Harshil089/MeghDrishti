"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function Particles() {
  const ref = useRef<THREE.Points>(null);
  const count = 500;

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 18;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 8;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 10 - 4;
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.02;
    ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.05) * 0.05;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.035} color="#22d3ee" transparent opacity={0.55} sizeAttenuation />
    </points>
  );
}

function ScanRing() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const s = 1 + Math.sin(state.clock.elapsedTime * 0.6) * 0.08;
    ref.current.scale.setScalar(s);
    ref.current.rotation.z = state.clock.elapsedTime * 0.1;
  });
  return (
    <mesh ref={ref} position={[0, 0, -3]}>
      <torusGeometry args={[3.2, 0.006, 8, 100]} />
      <meshBasicMaterial color="#f97316" transparent opacity={0.35} />
    </mesh>
  );
}

export default function AtmosphereScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 55 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 1.5]}
      style={{ pointerEvents: "none" }}
    >
      <ambientLight intensity={0.4} />
      <Particles />
      <ScanRing />
    </Canvas>
  );
}
