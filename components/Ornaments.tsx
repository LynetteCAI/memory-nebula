import React, { useMemo, useRef, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TreeMode } from '../types';
import { getNebulaOrnamentPosition } from '../utils/nebulaLayout';

interface OrnamentsProps {
  mode: TreeMode;
  count: number;
}

// Memory Nebula ornament types
type OrnamentType = 'planet' | 'crystal' | 'stardust';

interface InstanceData {
  chaosPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  type: OrnamentType;
  color: THREE.Color;
  scale: number;
  speed: number;
  rotationOffset: THREE.Euler;
}

/**
 * Nebula ornament colors — pale, translucent, cosmic.
 * No Christmas red/green.
 */
const NEBULA_ORNAMENT_COLORS = {
  paleBlue:    new THREE.Color('#A8C8E8'),
  cyanMist:    new THREE.Color('#88CCEE'),
  violet:      new THREE.Color('#6B5B95'),
  champagne:   new THREE.Color('#D4AF37'),
  ivory:       new THREE.Color('#F5E6BF'),
  roseGold:    new THREE.Color('#B76E79'),
  softAmber:   new THREE.Color('#E8A860'),
};

export const Ornaments: React.FC<OrnamentsProps> = ({ mode, count }) => {
  // 3 InstancedMeshes for different geometries: mini planets, crystal shards, stardust lights
  const planetsRef = useRef<THREE.InstancedMesh>(null);
  const crystalsRef = useRef<THREE.InstancedMesh>(null);
  const stardustRef = useRef<THREE.InstancedMesh>(null);
  
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Generate data once
  const { planetsData, crystalsData, stardustData } = useMemo(() => {
    const _planets: InstanceData[] = [];
    const _crystals: InstanceData[] = [];
    const _stardust: InstanceData[] = [];
    
    const { paleBlue, cyanMist, violet, champagne, ivory, roseGold, softAmber } = NEBULA_ORNAMENT_COLORS;
    const palette = [champagne, ivory, champagne, roseGold, paleBlue, violet, softAmber, ivory, cyanMist, paleBlue];

    for (let i = 0; i < count; i++) {
      const rnd = Math.random();
      let type: OrnamentType = 'planet';
      if (rnd > 0.75) type = 'crystal';
      if (rnd > 0.90) type = 'stardust';

      // Target Position: Memory Nebula Core sphere
      const targetPos = getNebulaOrnamentPosition(i, count);

      // Chaos Position
      const cR = 15 + Math.random() * 15;
      const cTheta = Math.random() * Math.PI * 2;
      const cPhi = Math.acos(2 * Math.random() - 1);
      const chaosPos = new THREE.Vector3(
        cR * Math.sin(cPhi) * Math.cos(cTheta),
        cR * Math.sin(cPhi) * Math.sin(cTheta) + 5,
        cR * Math.cos(cPhi)
      );

      // Scales: stardust tiny, crystals medium, planets slightly larger
      const scale = type === 'stardust' 
        ? 0.06 + Math.random() * 0.08 
        : type === 'crystal' 
          ? 0.12 + Math.random() * 0.16 
          : 0.14 + Math.random() * 0.18;
      
      // Colors: stardust gets softer warm/cool tones, others from palette
      const color = type === 'stardust' 
        ? [ivory, cyanMist, new THREE.Color('#FFEEDD'), champagne][Math.floor(Math.random() * 4)]
        : palette[Math.floor(Math.random() * palette.length)];

      const data: InstanceData = {
        chaosPos,
        targetPos,
        type,
        color,
        scale,
        speed: 0.5 + Math.random() * 1.5,
        rotationOffset: new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, 0)
      };

      if (type === 'planet') _planets.push(data);
      else if (type === 'crystal') _crystals.push(data);
      else _stardust.push(data);
    }

    return { planetsData: _planets, crystalsData: _crystals, stardustData: _stardust };
  }, [count]);

  useLayoutEffect(() => {
    // Set initial colors on each InstancedMesh
    [
      { ref: planetsRef, data: planetsData },
      { ref: crystalsRef, data: crystalsData },
      { ref: stardustRef, data: stardustData }
    ].forEach(({ ref, data }) => {
      if (ref.current) {
        data.forEach((d, i) => {
          ref.current!.setColorAt(i, d.color);
        });
        ref.current.instanceColor!.needsUpdate = true;
      }
    });
  }, [planetsData, crystalsData, stardustData]);

  useFrame((state, delta) => {
    const isFormed = mode === TreeMode.FORMED;
    const time = state.clock.elapsedTime;

    // Helper to update a mesh ref
    const updateMesh = (ref: React.RefObject<THREE.InstancedMesh>, data: InstanceData[]) => {
      if (!ref.current) return;

      let needsUpdate = false;

      data.forEach((d, i) => {
        // Interpolation Factor based on individual speed and global delta
        // We use a simple approach: if formed, target is targetPos, else chaosPos
        const dest = isFormed ? d.targetPos : d.chaosPos;
        
        // We actually want to lerp the CURRENT position to the DESTINATION
        // But extracting current position from matrix is expensive every frame for all.
        // Instead, we calculate "current" based on a virtual progress 0-1 driven by state.
        
        // To simulate "physics" (heavy/light), we don't store state per particle here (too complex for this snippet).
        // Instead, we calculate position based on a time-dependent lerp factor.
        
        // However, a simple way to make it feel organic is:
        // Position = Mix(Chaos, Target, SmoothStep(GlobalProgress * speed))
        
        // Let's use a sin wave derived from time for hover, but the main transition is driven by a hidden 'progress' value
        // Since we don't have a global store for animation progress per particle, we approximate using the mode switch time.
        // For a robust system, we'd use a spring library, but here we do manual lerping.

        // Get current matrix position to lerp from? Too expensive.
        // Let's assume a global transition variable `t` that goes 0->1 or 1->0.
        // We will misuse the object's userdata or just calculate purely functional.
        
        // Functional approach:
        // We need an accumulated value. Let's create a visual wobble.
        
        // NOTE: For true interactive physics, we'd use useSprings from react-spring/three, 
        // but for 1000 instances, manual matrix manipulation is better.
        // Here we will simply interpolate between the two static positions based on a "progress" variable
        // that we track manually or approximate.
        
        // Let's read a custom progress from the dataset. 
        // We'll augment the data object with a mutable `currentProgress` property in a closure if possible,
        // but `data` is static.
        
        // Let's just use the `MathUtils.lerp` on the vectors directly inside the loop 
        // by reading the matrix, lerping, writing back.
        ref.current!.getMatrixAt(i, dummy.matrix);
        dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
        
        const step = delta * d.speed;
        dummy.position.lerp(dest, step);

        // Add nebula drift when formed
        if (isFormed && dummy.position.distanceTo(d.targetPos) < 0.5) {
          dummy.position.x += Math.sin(time * 1.2 + d.chaosPos.x * 2) * 0.003;
          dummy.position.y += Math.cos(time * 1.0 + d.chaosPos.y * 2) * 0.002;
          dummy.position.z += Math.cos(time * 1.3 + d.chaosPos.z * 2) * 0.003;
        }

        // Rotation per type
        if (d.type === 'crystal') {
          // Crystal shards: gentle continuous spin
          dummy.rotation.x += delta * 0.35;
          dummy.rotation.y += delta * 0.25;
          dummy.rotation.z += delta * 0.15;
        } else if (d.type === 'planet') {
          // Mini planets: very slow rotation, face outward
          dummy.rotation.y += delta * 0.08;
          dummy.lookAt(0, 0, 0);
        } else {
          // Stardust: face outward with subtle wobble
          dummy.lookAt(0, 0, 0);
        }

        dummy.scale.setScalar(d.scale);
        if (d.type === 'stardust') {
          // Subtle twinkle
          const twinkle = 1 + Math.sin(time * 4 + d.chaosPos.y * 3) * 0.2;
          dummy.scale.multiplyScalar(twinkle);
        }

        dummy.updateMatrix();
        ref.current!.setMatrixAt(i, dummy.matrix);
        needsUpdate = true;
      });

      if (needsUpdate) ref.current.instanceMatrix.needsUpdate = true;
    };

    updateMesh(planetsRef, planetsData);
    updateMesh(crystalsRef, crystalsData);
    updateMesh(stardustRef, stardustData);
  });

  return (
    <>
      {/* Mini Planets: translucent low-saturation spheres orbiting the nebula core */}
      <instancedMesh ref={planetsRef} args={[undefined, undefined, planetsData.length]}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial 
          roughness={0.2} 
          metalness={0.3} 
          transparent
          opacity={0.55}
          envMapIntensity={0.8}
        />
      </instancedMesh>

      {/* Crystal Shards: memory crystals — octahedron fragments with glassy feel */}
      <instancedMesh ref={crystalsRef} args={[undefined, undefined, crystalsData.length]}>
        <octahedronGeometry args={[0.9, 0]} />
        <meshStandardMaterial 
          roughness={0.15} 
          metalness={0.1} 
          transparent
          opacity={0.5}
        />
      </instancedMesh>

      {/* Stardust Lights: tiny emissive memory light dust */}
      <instancedMesh ref={stardustRef} args={[undefined, undefined, stardustData.length]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshStandardMaterial 
          emissive="white"
          emissiveIntensity={1.5}
          toneMapped={false}
          transparent
          opacity={0.7}
        />
      </instancedMesh>
    </>
  );
};