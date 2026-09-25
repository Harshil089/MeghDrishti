"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function Field({ color, seed }: { color: string; seed: number }) {
  const ref = useRef<THREE.Points>(null);
  const count = 90;

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 16;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 2.2;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 4 - seed;
    }
    return arr;
  }, [seed]);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.position.x = Math.sin(state.clock.elapsedTime * 0.08 + seed) * 0.6;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.045} color={color} transparent opacity={0.4} sizeAttenuation />
    </points>
  );
}

export default function StatsFieldScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 50 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 1.5]}
      style={{ pointerEvents: "none" }}
    >
      <Field color="#22d3ee" seed={0} />
      <Field color="#fb923c" seed={2} />
    </Canvas>
  );
}
