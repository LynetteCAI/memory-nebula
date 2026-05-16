
import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { TreeMode, MemoryPhoto } from '../types';
import { getNebulaPhotoPosition, getNebulaPhotoScale } from '../utils/nebulaLayout';
import { getConstellationPhotoPosition, getConstellationPhotoScale } from '../utils/constellationLayout';

// ---------------------------------------------------------------------------
//  Interfaces
// ---------------------------------------------------------------------------

interface PolaroidsProps {
  mode: TreeMode;
  uploadedPhotos: string[];
  twoHandsDetected: boolean;
  onClosestPhotoChange?: (photoUrl: string | null) => void;
  /** v0.3: MemoryPhoto objects (map 1:1 to uploadedPhotos) for click-to-open */
  memories?: MemoryPhoto[];
  /** v0.3: Called when a polaroid is clicked */
  onPhotoSelect?: (photo: MemoryPhoto) => void;
  /** v0.3: ID of the photo currently focused by two-hand detection */
  focusedPhotoId?: string | null;
  /** v0.3: ID of the photo closest to camera (for internal two-hand tracking) */
  onFocusedPhotoIdChange?: (id: string | null) => void;
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

interface PolaroidItemProps {
  data: PhotoData;
  mode: TreeMode;
  index: number;
  isFocused: boolean;
  /** v0.3: Click handler — receives the photo index */
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
}

// ---------------------------------------------------------------------------
//  PolaroidItem — individual 3D polaroid frame
// ---------------------------------------------------------------------------

const PolaroidItem: React.FC<PolaroidItemProps> = ({ data, mode, index, isFocused, onClick }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [error, setError] = useState(false);
  const [hovered, setHovered] = useState(false);

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
  // v0.3: add hover boost
  const scaleRef = useRef(1);
  useFrame(() => {
    const baseTarget = mode === TreeMode.FORMED ? data.formedScale : data.chaosScale;
    const hoverBoost = hovered ? 1.08 : 1.0;
    scaleRef.current = THREE.MathUtils.lerp(scaleRef.current, baseTarget * hoverBoost, 0.08);
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

  // v0.3: cursor styles via drei useCursor-like approach via DOM
  useEffect(() => {
    if (hovered) {
      document.body.style.cursor = 'pointer';
    }
    return () => {
      document.body.style.cursor = '';
    };
  }, [hovered]);

  return (
    <group ref={groupRef}>
      
      {/* Orbital tether */}
      <mesh position={[0, 0.5, -0.1]}>
        <cylinderGeometry args={[0.003, 0.003, 0.8]} />
        <meshStandardMaterial color="#D4AF37" metalness={1} roughness={0.2} transparent opacity={0.4} />
      </mesh>

      {/* Frame Group */}
      <group position={[0, 0, 0]}>
        {/* v0.3: White frame with hover + focus effects */}
        <mesh
          position={[0, 0, 0]}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
          onClick={onClick}
        >
          <boxGeometry args={[1.2, 1.5, 0.02]} />
          <meshStandardMaterial
            color={isFocused ? "#fffef5" : "#fdfdfd"}
            roughness={0.8}
            emissive={isFocused ? "#D4AF37" : hovered ? "#D4AF37" : "#000000"}
            emissiveIntensity={isFocused ? 0.25 : hovered ? 0.12 : 0}
          />
        </mesh>

        {/* v0.3: Clickable transparent plane in front for reliable hit detection */}
        <mesh
          position={[0, 0.15, 0.035]}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
          onClick={onClick}
        >
          <planeGeometry args={[1.0, 1.0]} />
          <meshBasicMaterial transparent opacity={0} depthTest={false} />
        </mesh>

        {/* Photo texture */}
        <mesh position={[0, 0.15, 0.025]}>
          <planeGeometry args={[1.0, 1.0]} />
          {texture && !error ? (
            <meshBasicMaterial map={texture} />
          ) : (
            <meshStandardMaterial color={error ? "#550000" : "#cccccc"} />
          )}
        </mesh>

        {/* Gold clip */}
        <mesh position={[0, 0.7, 0.025]} rotation={[0,0,0]}>
           <boxGeometry args={[0.1, 0.05, 0.05]} />
           <meshStandardMaterial color="#D4AF37" metalness={1} roughness={0.2} />
        </mesh>

        {/* v0.3: Focused glow ring (visible when focused) */}
        {isFocused && (
          <mesh position={[0, 0, 0.025]}>
            <ringGeometry args={[0.62, 0.65, 64]} />
            <meshBasicMaterial color="#D4AF37" transparent opacity={0.6} side={THREE.DoubleSide} />
          </mesh>
        )}

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

export const Polaroids: React.FC<PolaroidsProps> = ({
  mode,
  uploadedPhotos,
  twoHandsDetected,
  onClosestPhotoChange,
  memories,
  onPhotoSelect,
  focusedPhotoId,
  onFocusedPhotoIdChange,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const [closestPhotoIndex, setClosestPhotoIndex] = React.useState<number>(0);

  const photoData = useMemo(() => {
    if (uploadedPhotos.length === 0) return [];

    const data: PhotoData[] = [];
    const count = uploadedPhotos.length;

    for (let i = 0; i < count; i++) {
      const targetPos = getNebulaPhotoPosition(i, count);
      const chaosPos = getConstellationPhotoPosition(i, count);
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

  // v0.3: Build click handler for a given photo index
  const handlePhotoClick = useCallback(
    (index: number) => (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (memories && memories[index] && onPhotoSelect) {
        onPhotoSelect(memories[index]);
      }
    },
    [memories, onPhotoSelect]
  );

  // Update closest photo when two hands detected (no longer opens overlay)
  useFrame((state) => {
    if (twoHandsDetected && groupRef.current && photoData.length > 0) {
      const cameraPos = state.camera.position.clone();
      let minDistance = Infinity;
      let closestIndex = 0;

      groupRef.current.children.forEach((child, i) => {
        if (i < photoData.length) {
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

      // v0.3: Notify parent of focused photo ID (for highlight, NOT for opening modal)
      if (memories && memories[closestIndex] && onFocusedPhotoIdChange) {
        onFocusedPhotoIdChange(memories[closestIndex].id);
      }

      // Keep legacy callback for backward compatibility (no longer used for overlay)
      if (onClosestPhotoChange) {
        onClosestPhotoChange(uploadedPhotos[closestIndex]);
      }
    } else {
      // Hands not detected — clear focus
      if (onFocusedPhotoIdChange) {
        onFocusedPhotoIdChange(null);
      }
      if (onClosestPhotoChange) {
        onClosestPhotoChange(null);
      }
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
          isFocused={
            focusedPhotoId != null &&
            memories != null &&
            memories[i] != null &&
            memories[i].id === focusedPhotoId
          }
          onClick={memories && onPhotoSelect ? handlePhotoClick(i) : undefined}
        />
      ))}
    </group>
  );
};
