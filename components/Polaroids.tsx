
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { TreeMode } from '../types';
import { getNebulaPhotoPosition, getNebulaPhotoScale } from '../utils/nebulaLayout';
import { getConstellationPhotoPosition, getConstellationPhotoScale } from '../utils/constellationLayout';

/**
 * ==================================================================================
 *  INSTRUCTIONS FOR LOCAL PHOTOS
 * ==================================================================================
 * 1. Create a folder named "photos" inside your "public" directory.
 *    (e.g., public/photos/)
 * 
 * 2. Place your JPG images in there.
 * 
 * 3. Rename them sequentially:
 *    1.jpg, 2.jpg, 3.jpg ... up to 13.jpg
 * 
 *    If a file is missing (e.g., you only have 5 photos), the frame will 
 *    display a placeholder instead of crashing the app.
 * ==================================================================================
 */

const PHOTO_COUNT = 22; // How many polaroid frames to generate

interface PolaroidsProps {
  mode: TreeMode;
  uploadedPhotos: string[];
  twoHandsDetected: boolean;
  onClosestPhotoChange?: (photoUrl: string | null) => void;
}

interface PhotoData {
  id: number;
  url: string;
  chaosPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  speed: number;
  formedScale: number;
  chaosScale: number;
}

const PolaroidItem: React.FC<{ data: PhotoData; mode: TreeMode; index: number }> = ({ data, mode, index }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [error, setError] = useState(false);

  // Safe texture loading that won't crash the app if a file is missing
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(
      data.url,
      (loadedTex) => {
        loadedTex.colorSpace = THREE.SRGBColorSpace;
        setTexture(loadedTex);
        setError(false);
      },
      undefined,
      (err) => {
        console.warn(`Failed to load image: ${data.url}`, err);
        setError(true);
      }
    );
  }, [data.url]);
  
  const swayOffset = useMemo(() => Math.random() * 100, []);

  // v0.2.5: dynamic scale — lerp between formed & chaos scale
  const scaleRef = useRef(1);
  useFrame(() => {
    const target = mode === TreeMode.FORMED ? data.formedScale : data.chaosScale;
    scaleRef.current = THREE.MathUtils.lerp(scaleRef.current, target, 0.08);
  });

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const isFormed = mode === TreeMode.FORMED;
    const time = state.clock.elapsedTime;
    
    // 1. Position Interpolation
    const targetPos = isFormed ? data.targetPos : data.chaosPos;
    const step = delta * data.speed;
    groupRef.current.position.lerp(targetPos, step);

    // 2. Scale
    const s = scaleRef.current;
    groupRef.current.scale.setScalar(s);

    // 3. Rotation & Sway Logic
    if (isFormed) {
        const dummy = new THREE.Object3D();
        dummy.position.copy(groupRef.current.position);
        dummy.lookAt(0, 0, 0);
        dummy.rotateY(Math.PI);
        groupRef.current.quaternion.slerp(dummy.quaternion, step);
        const swayAngle = Math.sin(time * 1.5 + swayOffset) * 0.06;
        const tiltAngle = Math.cos(time * 1.2 + swayOffset) * 0.04;
        groupRef.current.rotateZ(swayAngle * delta * 5);
        const currentRot = new THREE.Euler().setFromQuaternion(groupRef.current.quaternion);
        groupRef.current.rotation.z = currentRot.z + swayAngle * 0.04; 
        groupRef.current.rotation.x = currentRot.x + tiltAngle * 0.04;
    } else {
        const dummy = new THREE.Object3D();
        dummy.position.copy(groupRef.current.position);
        dummy.lookAt(0, 0, 0);
        dummy.rotateY(Math.PI);
        groupRef.current.quaternion.slerp(dummy.quaternion, delta * 3);
        const wobbleX = Math.sin(time * 1.5 + swayOffset) * 0.03;
        const wobbleZ = Math.cos(time * 1.2 + swayOffset) * 0.03;
        const currentRot = new THREE.Euler().setFromQuaternion(groupRef.current.quaternion);
        groupRef.current.rotation.x = currentRot.x + wobbleX;
        groupRef.current.rotation.z = currentRot.z + wobbleZ;
    }
  });

  return (
    <group ref={groupRef}>
      
      {/* Orbital tether */}
      <mesh position={[0, 0.5, -0.1]}>
        <cylinderGeometry args={[0.003, 0.003, 0.8]} />
        <meshStandardMaterial color="#D4AF37" metalness={1} roughness={0.2} transparent opacity={0.4} />
      </mesh>

      {/* Frame Group */}
      <group position={[0, 0, 0]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1.2, 1.5, 0.02]} />
          <meshStandardMaterial color="#fdfdfd" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.15, 0.025]}>
          <planeGeometry args={[1.0, 1.0]} />
          {texture && !error ? (
            <meshBasicMaterial map={texture} />
          ) : (
            <meshStandardMaterial color={error ? "#550000" : "#cccccc"} />
          )}
        </mesh>
        <mesh position={[0, 0.7, 0.025]} rotation={[0,0,0]}>
           <boxGeometry args={[0.1, 0.05, 0.05]} />
           <meshStandardMaterial color="#D4AF37" metalness={1} roughness={0.2} />
        </mesh>
        <Text
          position={[0, -0.55, 0.03]}
          fontSize={0.12}
          color="#333"
          anchorX="center"
          anchorY="middle"
        >
          {error ? "Image not found" : "Memory"}
        </Text>
      </group>
    </group>
  );
};

export const Polaroids: React.FC<PolaroidsProps> = ({ mode, uploadedPhotos, twoHandsDetected, onClosestPhotoChange }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [closestPhotoIndex, setClosestPhotoIndex] = React.useState<number>(0);

  const photoData = useMemo(() => {
    // Don't render any photos if none are uploaded
    if (uploadedPhotos.length === 0) {
      return [];
    }

    const data: PhotoData[] = [];
    const count = uploadedPhotos.length;

    for (let i = 0; i < count; i++) {
      // Target Position: Memory Nebula Core (FORMED) — v0.2.5 volume distribution
      const targetPos = getNebulaPhotoPosition(i, count);

      // Chaos Position: Memory Constellation — v0.2.5 volume distribution
      const chaosPos = getConstellationPhotoPosition(i, count);

      // Dynamic scales per mode
      const formedScale = getNebulaPhotoScale(i, count);
      const chaosScale = getConstellationPhotoScale(i, count);

      data.push({
        id: i,
        url: uploadedPhotos[i],
        chaosPos,
        targetPos,
        speed: 0.8 + Math.random() * 1.5,
        formedScale,
        chaosScale,
      });
    }
    return data;
  }, [uploadedPhotos]);

  // Update closest photo every frame when two hands are detected
  useFrame((state) => {
    if (twoHandsDetected && groupRef.current && photoData.length > 0) {
      // Get camera position in world coordinates
      const cameraPos = state.camera.position.clone();
      
      let minDistance = Infinity;
      let closestIndex = 0;
      
      // Check each photo's actual world position
      groupRef.current.children.forEach((child, i) => {
        if (i < photoData.length) {
          // Get world position of the photo
          const worldPos = new THREE.Vector3();
          child.getWorldPosition(worldPos);
          
          const distance = worldPos.distanceTo(cameraPos);
          if (distance < minDistance) {
            minDistance = distance;
            closestIndex = i;
          }
        }
      });
      
      setClosestPhotoIndex(closestIndex);
      
      // Notify parent component about the closest photo
      if (onClosestPhotoChange) {
        onClosestPhotoChange(uploadedPhotos[closestIndex]);
      }
    } else if (onClosestPhotoChange) {
      // Clear the overlay when two hands are not detected
      onClosestPhotoChange(null);
    }
  });

  return (
    <group ref={groupRef}>
      {photoData.map((data, i) => (
        <PolaroidItem 
          key={i} 
          index={i} 
          data={data} 
          mode={mode}
        />
      ))}
    </group>
  );
};
