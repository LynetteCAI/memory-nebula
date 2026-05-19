
import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { TreeMode, MemoryPhoto } from '../types';
import { getNebulaPhotoPosition, getNebulaPhotoScale } from '../utils/nebulaLayout';
import { getConstellationPhotoPosition, getConstellationPhotoScale } from '../utils/constellationLayout';
import { getChronoStreamPhotoPosition, getChronoStreamPhotoScale, getChronoStreamPhotoOpacity } from '../utils/chronoStreamLayout';

// ---------------------------------------------------------------------------
//  v0.3.1 Constants
// ---------------------------------------------------------------------------

/** Screen-center threshold: max normalized screen distance to qualify as candidate */
const CENTER_PICK_THRESHOLD = 0.4;
/** Depth penalty weight in candidate scoring (keeps nearer photos preferred) */
const DEPTH_PENALTY_WEIGHT = 0.05;

// ---------------------------------------------------------------------------
// v0.5.3: Polaroid Visibility & Candidate Focus Polish constants
// ---------------------------------------------------------------------------

const PHOTO_VISIBILITY = {
  distanceBoostStart: 7.5,
  distanceBoostEnd: 15.0,
  distanceScaleBoostMax: 0.35,
  candidateScale: 1.16,
  hoverScale: 1.12,
  lockedScale: 1.22,
  candidateDistanceBoost: 1.12,
  baseEmissive: 0.05,
  distanceEmissiveBoostMax: 0.08,
  candidateEmissive: 0.38,
  hoverEmissive: 0.30,
  lockedEmissive: 0.55,
  candidateRingOpacity: 0.62,
  hoverRingOpacity: 0.55,
  lockedRingOpacity: 0.85,
  candidateOuterGlowOpacity: 0.30,
  lockedOuterGlowOpacity: 0.55,
};

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
  /** v0.3/v0.3.1: Called when a polaroid is clicked (mouse) */
  onPhotoSelect?: (photo: MemoryPhoto) => void;
  /** v0.3: (legacy) ID of the photo focused by two-hand proximity (retained compat) */
  focusedPhotoId?: string | null;
  /** v0.3: (legacy) two-hand proximity focus callback (retained compat) */
  onFocusedPhotoIdChange?: (id: string | null) => void;
  /** v0.3.1: ID of the screen-center candidate photo */
  candidatePhotoId?: string | null;
  /** v0.3.1: Called with new candidate when screen-center photo changes */
  onCandidatePhotoChange?: (photo: MemoryPhoto | null) => void;
  /** v0.3.1: ID of the gesture-locked photo (strong highlight) */
  lockedPhotoId?: string | null;
  /** v0.3.1: Pause candidate updates (e.g. when modal is open) */
  pauseSelection?: boolean;
  /** v0.4: Current focus index for Chrono Stream time river */
  focusIndex?: number;
}

interface PhotoData {
  id: number;
  url: string;
  chaosPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  speed: number;
  formedScale: number;
  chaosScale: number;
  /** v0.4: Opacity for Chrono Stream time river layering */
  opacity: number;
}

interface PolaroidItemProps {
  data: PhotoData;
  mode: TreeMode;
  index: number;
  isCandidate: boolean;
  isLocked: boolean;
  isHovered: boolean;
  /** v0.3.1: mouse enter/leave + click */
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
}

// ---------------------------------------------------------------------------
//  PolaroidItem — individual 3D polaroid frame
// ---------------------------------------------------------------------------

const PolaroidItem: React.FC<PolaroidItemProps> = ({
  data, mode, index,
  isCandidate, isLocked, isHovered,
  onPointerEnter, onPointerLeave, onClick,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [error, setError] = useState(false);

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

  // v0.5.3: Frame mesh ref for per-frame emissive updates
  const frameMeshRef = useRef<THREE.Mesh>(null!);

  // v0.3.1: Highlight priority: locked(3) > hovered(2) > candidate(1) > none(0)
  const highlightLevel = isLocked ? 3 : isHovered ? 2 : isCandidate ? 1 : 0;

  const scaleRef = useRef(1);
  useFrame((state) => {
    const V = PHOTO_VISIBILITY;
    const isChaos = mode === TreeMode.CHAOS;
    const baseTarget = mode === TreeMode.FORMED ? data.formedScale : data.chaosScale;

    // Highlight multiplier
    const hlMulti = isLocked ? V.lockedScale : isHovered ? V.hoverScale : isCandidate ? V.candidateScale : 1.0;

    // Pulse animation
    const pulseFreq = isLocked || isHovered ? 3 : 2;
    const pulseAmp = isLocked || isHovered ? 0.02 : isCandidate ? 0.025 : 0;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * pulseFreq) * pulseAmp;

    // Distance scale boost (CHAOS only)
    let distanceScaleBoost = 1.0;
    let candidateDistBoost = 1.0;
    if (isChaos && groupRef.current) {
      const dist = groupRef.current.position.distanceTo(state.camera.position);
      const distT = THREE.MathUtils.clamp(
        (dist - V.distanceBoostStart) / (V.distanceBoostEnd - V.distanceBoostStart),
        0, 1
      );
      distanceScaleBoost = 1 + distT * V.distanceScaleBoostMax;
      if (isCandidate) candidateDistBoost = V.candidateDistanceBoost;
    }

    // Final scale
    const targetScale = baseTarget * hlMulti * pulse * distanceScaleBoost * candidateDistBoost;
    scaleRef.current = THREE.MathUtils.lerp(scaleRef.current, targetScale, 0.08);

    // Emissive intensity — write directly to material (per-frame)
    let distEmissiveBoost = 0;
    if (isChaos && groupRef.current) {
      const dist = groupRef.current.position.distanceTo(state.camera.position);
      const distT = THREE.MathUtils.clamp(
        (dist - V.distanceBoostStart) / (V.distanceBoostEnd - V.distanceBoostStart),
        0, 1
      );
      distEmissiveBoost = distT * V.distanceEmissiveBoostMax;
    }
    const hlEmissive = isLocked ? V.lockedEmissive : isHovered ? V.hoverEmissive : isCandidate ? V.candidateEmissive : 0;
    const emissiveVal = V.baseEmissive + distEmissiveBoost + hlEmissive;

    if (frameMeshRef.current) {
      const mat = frameMeshRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = emissiveVal;
    }
  });

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const isFormed = mode === TreeMode.FORMED;
    const time = state.clock.elapsedTime;
    
    const targetPos = isFormed ? data.targetPos : data.chaosPos;
    const step = delta * data.speed;
    groupRef.current.position.lerp(targetPos, step);

    const s = scaleRef.current;
    groupRef.current.scale.setScalar(s);

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
        // v0.3.3: CHAOS / Memory Constellation — face towards camera (no flip)
        const dummy = new THREE.Object3D();
        dummy.position.copy(groupRef.current.position);
        dummy.lookAt(state.camera.position);
        groupRef.current.quaternion.slerp(
          dummy.quaternion,
          1 - Math.exp(-delta * 4.0)
        );
        // Gentle wobble for natural feel — relative to camera-facing basis
        const wobbleX = Math.sin(time * 1.5 + swayOffset) * 0.02;
        const wobbleZ = Math.cos(time * 1.2 + swayOffset) * 0.02;
        const currentRot = new THREE.Euler().setFromQuaternion(groupRef.current.quaternion);
        groupRef.current.rotation.x = currentRot.x + wobbleX;
        groupRef.current.rotation.z = currentRot.z + wobbleZ;
    }
  });

  useEffect(() => {
    if (isHovered) document.body.style.cursor = 'pointer';
    return () => { document.body.style.cursor = ''; };
  }, [isHovered]);

  return (
    <group ref={groupRef}>
      
      {/* Orbital tether */}
      <mesh position={[0, 0.5, -0.1]}>
        <cylinderGeometry args={[0.003, 0.003, 0.8]} />
        <meshStandardMaterial
          color="#D4AF37" metalness={1} roughness={0.2} transparent
          opacity={data.opacity * (highlightLevel >= 3 ? 0.7 : highlightLevel >= 2 ? 0.6 : highlightLevel === 1 ? 0.5 : 0.4)}
        />
      </mesh>

      {/* Frame Group */}
      <group position={[0, 0, 0]}>
        <mesh
          ref={frameMeshRef}
          position={[0, 0, 0]}
          onPointerEnter={onPointerEnter}
          onPointerLeave={onPointerLeave}
          onClick={onClick}
        >
          <boxGeometry args={[1.2, 1.5, 0.02]} />
          <meshStandardMaterial
            color={highlightLevel >= 3 ? "#fffef0" : highlightLevel >= 1 ? "#fff9dc" : "#fffdf2"}
            roughness={0.8}
            emissive="#D4AF37"
            emissiveIntensity={0.05}
          />
        </mesh>

        <mesh
          position={[0, 0.15, 0.035]}
          onPointerEnter={onPointerEnter}
          onPointerLeave={onPointerLeave}
          onClick={onClick}
        >
          <planeGeometry args={[1.0, 1.0]} />
          <meshBasicMaterial transparent opacity={0} depthTest={false} />
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

        {/* v0.5.3: Highlight ring — enhanced for candidate visibility */}
        {highlightLevel >= 1 && (
          <mesh position={[0, 0, 0.025]}>
            <ringGeometry args={[0.62, 0.66, 64]} />
            <meshBasicMaterial
              color="#E8C860" transparent
              opacity={highlightLevel >= 3 ? 0.85 : highlightLevel >= 2 ? 0.55 : 0.62}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}

        {/* v0.5.3: Outer glow ring — visible for candidate+ */}
        {highlightLevel >= 1 && (
          <mesh position={[0, 0, 0.03]}>
            <ringGeometry args={[0.67, 0.72, 64]} />
            <meshBasicMaterial
              color="#F5E6BF" transparent
              opacity={highlightLevel >= 3 ? 0.55 : 0.30}
              side={THREE.DoubleSide}
            />
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
  candidatePhotoId,
  onCandidatePhotoChange,
  lockedPhotoId,
  pauseSelection,
  focusIndex = 0,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const [closestPhotoIndex, setClosestPhotoIndex] = React.useState<number>(0);
  // Track hover per photo index
  const hoverRef = useRef<boolean[]>([]);
  const [, setHoverTick] = useState(0);
  const setHovered = useCallback((i: number, v: boolean) => {
    hoverRef.current[i] = v;
    setHoverTick(t => t + 1); // trigger re-render
  }, []);

  const photoData = useMemo(() => {
    if (uploadedPhotos.length === 0) return [];
    const data: PhotoData[] = [];
    const count = uploadedPhotos.length;
    const isChrono = mode === TreeMode.CHRONO_STREAM;
    for (let i = 0; i < count; i++) {
      const targetPos = getNebulaPhotoPosition(i, count);
      let chaosPos: THREE.Vector3;
      let formedScale: number;
      let chaosScale: number;

      if (isChrono) {
        const pos = getChronoStreamPhotoPosition(i, focusIndex, count);
        chaosPos = new THREE.Vector3(pos[0], pos[1], pos[2]);
        formedScale = getChronoStreamPhotoScale(i, focusIndex, count);
        chaosScale = getChronoStreamPhotoScale(i, focusIndex, count);
      } else {
        chaosPos = getConstellationPhotoPosition(i, count);
        formedScale = getNebulaPhotoScale(i, count);
        chaosScale = getConstellationPhotoScale(i, count);
      }

      data.push({
        id: i,
        url: uploadedPhotos[i],
        chaosPos,
        targetPos,
        speed: 0.3 + Math.random() * 0.4,
        formedScale,
        chaosScale,
        opacity: isChrono ? getChronoStreamPhotoOpacity(i, focusIndex, count) : 1,
      });
    }
    return data;
  }, [uploadedPhotos, mode, focusIndex]);

  const handlePhotoClick = useCallback(
    (index: number) => (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (memories && memories[index] && onPhotoSelect) {
        onPhotoSelect(memories[index]);
      }
    },
    [memories, onPhotoSelect]
  );

  // ---------------------------------------------------------------------------
  // v0.3.1: Screen-center candidate detection (replaces closest-to-camera)
  // ---------------------------------------------------------------------------
  const candidateRef = useRef<string | null>(null);
  const lastCandidateRef = useRef<string | null>(null);

  useFrame((state) => {
    // v0.4: In CHRONO_STREAM, candidate is determined by focusIndex (handled in App.tsx), skip detection
    if (pauseSelection || !groupRef.current || photoData.length === 0) return;
    if (mode === TreeMode.CHRONO_STREAM) return;
    
    // --- Screen-center projection for candidate ---
    const camera = state.camera;
    const frustum = new THREE.Frustum();
    const projScreenMatrix = new THREE.Matrix4();
    projScreenMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(projScreenMatrix);

    let bestScore = Infinity;
    let bestIndex = -1;

    groupRef.current.children.forEach((child, i) => {
      if (i >= photoData.length) return;

      const worldPos = new THREE.Vector3();
      child.getWorldPosition(worldPos);

      // Skip photos behind camera or outside frustum
      if (!frustum.containsPoint(worldPos)) return;

      const projected = worldPos.clone().project(camera);

      // Clip-space check: valid range
      if (projected.z < -1 || projected.z > 1) return;

      const dx = projected.x; // 0 = screen center horizontal
      const dy = projected.y; // 0 = screen center vertical
      const distanceToCenter = Math.sqrt(dx * dx + dy * dy);

      if (distanceToCenter > CENTER_PICK_THRESHOLD) return;

      // Score: center distance + slight depth penalty
      const depthPenalty = Math.max(0, projected.z) * DEPTH_PENALTY_WEIGHT;
      const score = distanceToCenter + depthPenalty;

      if (score < bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    });

    // Candidate found
    if (bestIndex >= 0 && memories && memories[bestIndex]) {
      candidateRef.current = memories[bestIndex].id;
    } else {
      candidateRef.current = null;
    }

    // Only fire callback if candidate changed
    if (candidateRef.current !== lastCandidateRef.current) {
      lastCandidateRef.current = candidateRef.current;
      if (onCandidatePhotoChange) {
        const mem =
          bestIndex >= 0 && memories && memories[bestIndex] ? memories[bestIndex] : null;
        onCandidatePhotoChange(mem);
      }
    }

    // --- Legacy two-hand closest-to-camera (kept for backward compat) ---
    if (twoHandsDetected) {
      const cameraPos = camera.position.clone();
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

      if (memories && memories[closestIndex] && onFocusedPhotoIdChange) {
        onFocusedPhotoIdChange(memories[closestIndex].id);
      }
      if (onClosestPhotoChange) {
        onClosestPhotoChange(uploadedPhotos[closestIndex]);
      }
    } else {
      if (onFocusedPhotoIdChange) onFocusedPhotoIdChange(null);
      if (onClosestPhotoChange) onClosestPhotoChange(null);
    }
  });

  // Which ID to use for "is focused" (legacy focusedPhotoId compat)
  const effectiveFocusedId = focusedPhotoId;

  return (
    <group ref={groupRef}>
      {photoData.map((data, i) => {
        const memId = memories?.[i]?.id;
        return (
          <PolaroidItem
            key={i}
            index={i}
            data={data}
            mode={mode}
            isCandidate={memId != null && memId === candidatePhotoId}
            isLocked={memId != null && memId === lockedPhotoId}
            isHovered={!!hoverRef.current[i]}
            onPointerEnter={() => setHovered(i, true)}
            onPointerLeave={() => setHovered(i, false)}
            onClick={memories && onPhotoSelect ? handlePhotoClick(i) : undefined}
          />
        );
      })}
    </group>
  );
};
