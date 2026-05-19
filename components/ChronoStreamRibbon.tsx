/**
 * ==================================================================================
 *  CHRONO STREAM RIBBON (v0.4)
 * ==================================================================================
 *
 * A gentle golden-blue time ribbon that flows beneath the photo stream.
 * Uses a CatmullRomCurve3 with TubeGeometry for a smooth, luminous flow.
 * Only rendered in CHRONO_STREAM mode.
 */

import React, { useMemo } from 'react';
import * as THREE from 'three';

interface ChronoStreamRibbonProps {
  /** Number of memories in the stream (determines ribbon length) */
  memoryCount: number;
  /** v0.5.4: Whether the ribbon is visible. Kept mounted to avoid geometry recreation on toggle. */
  visible?: boolean;
}

export const ChronoStreamRibbon: React.FC<ChronoStreamRibbonProps> = ({ memoryCount, visible = true }) => {
  const curve = useMemo(() => {
    if (memoryCount === 0) return null;

    // v0.4.1: Extended ribbon span — covers the visible photo queue with generous margin
    const totalSpan = 36; // from x = -18 to x = +18
    const halfSpan = totalSpan / 2;
    const points: THREE.Vector3[] = [];

    for (let i = 0; i <= 50; i++) {
      const t = i / 50;
      const x = -halfSpan + t * totalSpan;
      // Gentle wave for organic feel — slightly deeper arc
      const y = Math.sin(x * 0.35) * 0.3 - 0.65;
      // Subtle depth curve — recedes slightly at edges
      const z = -Math.abs(x * 0.06) - 0.35;
      points.push(new THREE.Vector3(x, y, z));
    }

    return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
  }, [memoryCount]);

  const tubeGeometry = useMemo(() => {
    if (!curve) return null;
    return new THREE.TubeGeometry(curve, 80, 0.04, 8, false);
  }, [curve]);

  if (!curve || !tubeGeometry) return null;

  return (
    <group visible={visible}>
      {/* Main ribbon tube — golden glow (v0.4.1: reduced opacity for background feel) */}
      <mesh geometry={tubeGeometry}>
        <meshStandardMaterial
          color="#D4AF37"
          emissive="#D4AF37"
          emissiveIntensity={0.3}
          roughness={0.6}
          metalness={0.3}
          transparent
          opacity={0.45}
        />
      </mesh>

      {/* Secondary ribbon — blue accent, slightly offset */}
      <mesh geometry={tubeGeometry} position={[0, 0.03, 0.02]}>
        <meshStandardMaterial
          color="#88CCEE"
          emissive="#88CCEE"
          emissiveIntensity={0.18}
          roughness={0.7}
          metalness={0.2}
          transparent
          opacity={0.22}
        />
      </mesh>

      {/* Ribbon glow points — scattered tiny lights along the curve */}
      {Array.from({ length: Math.min(memoryCount, 20) }).map((_, i) => {
        const t = memoryCount > 1 ? i / (Math.min(memoryCount, 20) - 1) : 0.5;
        const pt = curve.getPointAt(t);
        return (
          <mesh key={i} position={[pt.x, pt.y + 0.05, pt.z]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial
              color={i % 3 === 0 ? '#D4AF37' : '#88CCEE'}
              emissive={i % 3 === 0 ? '#D4AF37' : '#88CCEE'}
              emissiveIntensity={0.5}
              roughness={0.3}
              transparent
              opacity={0.6}
            />
          </mesh>
        );
      })}
    </group>
  );
};
