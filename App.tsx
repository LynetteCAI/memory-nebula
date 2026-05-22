
import React, { useState, Suspense, useEffect, useMemo, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { Loader } from '@react-three/drei';
import { Experience } from './components/Experience';
import { UIOverlay } from './components/UIOverlay';
import { GestureController } from './components/GestureController';
import type { TwoHandTransitionDebugState } from './components/GestureController';
import { GestureOnboarding } from './components/GestureOnboarding';
import { MemoryModal } from './components/MemoryModal';
import { MemoryManager } from './components/MemoryManager';
import { TreeMode, MemoryPhoto } from './types';
import type { TutorialGestureState } from './types';
import { defaultTutorialGestureState } from './types';
import { compareMemoryByTime } from './utils/memorySort';
import { shuffleMemoriesForSession } from './utils/memoryShuffle';
import {
  getAllMemories,
  saveMemory,
  saveMemories,
  deleteMemory,
  deleteMemories,
  clearMemories,
} from './storage/memoryLibraryStore';

// Simple Error Boundary to catch 3D resource loading errors (like textures)
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Error loading 3D scene:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // You can customize this fallback UI
      return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 text-[#D4AF37] font-serif p-8 text-center">
          <div>
            <h2 className="text-2xl mb-2">Something went wrong</h2>
            <p className="opacity-70">A resource failed to load (likely a missing image). Check the console for details.</p>
            <button 
              onClick={() => this.setState({ hasError: false })}
              className="mt-4 px-4 py-2 border border-[#D4AF37] hover:bg-[#D4AF37] hover:text-black transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// v0.6: localStorage key for gesture onboarding "don't show again"
const GESTURE_ONBOARDING_HIDE_KEY = "memory-nebula-hide-gesture-onboarding";

export default function App() {
  const [mode, setMode] = useState<TreeMode>(TreeMode.FORMED);
  const [handPosition, setHandPosition] = useState<{ x: number; y: number; detected: boolean }>({ x: 0.5, y: 0.5, detected: false });
  const [isLoadingShare, setIsLoadingShare] = useState(false);
  const [isSharedView, setIsSharedView] = useState(false);
  const [twoHandsDetected, setTwoHandsDetected] = useState(false);
  
  // v0.3.4: Primary data source — memories loaded from IndexedDB
  const [memories, setMemories] = useState<MemoryPhoto[]>([]);
  const [isLibraryLoading, setIsLibraryLoading] = useState(true);
  
  // v0.3: Memory detail modal state
  const [selectedMemory, setSelectedMemory] = useState<MemoryPhoto | null>(null);
  // v0.3: (legacy) Photo focused by two-hand proximity
  const [focusedPhotoId, setFocusedPhotoId] = useState<string | null>(null);
  
  // v0.3.1: Gesture photo selection states
  const [candidateMemory, setCandidateMemory] = useState<MemoryPhoto | null>(null);
  const [lockedMemory, setLockedMemory] = useState<MemoryPhoto | null>(null);

  // v0.3.4: Memory manager panel state
  const [memoryManagerOpen, setMemoryManagerOpen] = useState(false);

  // v0.4: Chrono Stream state
  const [focusIndex, setFocusIndex] = useState(0);

  // v0.5: Two-hand transition debug state from GestureController
  const [twoHandTransitionState, setTwoHandTransitionState] = useState<TwoHandTransitionDebugState | null>(null);

  // v0.6: Gesture onboarding tutorial state
  const [showGestureOnboarding, setShowGestureOnboarding] = useState(false);
  const [tutorialGestureState, setTutorialGestureState] = useState<TutorialGestureState>(defaultTutorialGestureState);

  // v0.4.5: Session-level shuffle seed — generated once per page load
  const nebulaShuffleSeedRef = useRef(Date.now());

  // v0.4.5: Nebula memories — session-shuffled for FORMED/CHAOS mode variety
  const nebulaMemories = useMemo(() => {
    return shuffleMemoriesForSession(memories, nebulaShuffleSeedRef.current);
  }, [memories]);

  // v0.4: Chrono-sorted memories (by date, then createdAt, then order)
  const chronoMemories = useMemo(() => {
    return [...memories].sort(compareMemoryByTime);
  }, [memories]);

  // v0.5.5: Stable URLs — always derived from the full memories array, never mode-switched
  const stableUrls = useMemo(() => memories.map((m) => m.url), [memories]);

  // v0.5.5: Nebula order map — session-shuffled index for each memory id
  const nebulaOrderById = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    nebulaMemories.forEach((m, index) => { map[m.id] = index; });
    return map;
  }, [nebulaMemories]);

  // v0.5.5: Chrono order map — date-sorted index for each memory id
  const chronoOrderById = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    chronoMemories.forEach((m, index) => { map[m.id] = index; });
    return map;
  }, [chronoMemories]);

  // v0.3 + v0.3.1: Pause navigation when modal is open
  // v0.4.1: Also pause in Chrono Stream (fixed camera)
  const isChronoMode = mode === TreeMode.CHRONO_STREAM;
  // v0.6: Disable all business gestures when onboarding tutorial is open
  const gestureNavigationEnabled = selectedMemory === null && !isChronoMode && !showGestureOnboarding;
  // v0.3.1: Enable gesture photo selection only when modal is NOT open
  // v0.4.1: Also disable in Chrono Stream (no pinch)
  const gesturePhotoSelectionEnabled = selectedMemory === null && !isChronoMode && !showGestureOnboarding;

  // v0.5.5: Polaroids always render the full stable memories array
  // No mode-switching of displayMemories — each photo keeps its React identity
  const renderMemories = memories;
  const renderUrls = stableUrls;

  // v0.3.4: Load memories from IndexedDB on mount
  useEffect(() => {
    getAllMemories()
      .then((loaded) => setMemories(loaded))
      .catch((err) => console.error('Failed to load memories from IndexedDB:', err))
      .finally(() => setIsLibraryLoading(false));
  }, []);

  // v0.6: Check localStorage for gesture onboarding "don't show again"
  useEffect(() => {
    const hide = localStorage.getItem(GESTURE_ONBOARDING_HIDE_KEY) === "true";
    setShowGestureOnboarding(!hide);
  }, []);

  // v0.3.4: CRUD handlers — write to IndexedDB then update React state
  const handleBulkCreateMemories = useCallback(async (newMemories: MemoryPhoto[]) => {
    await saveMemories(newMemories);
    setMemories((prev) => [...prev, ...newMemories]);
  }, []);

  const handleUpdateMemory = useCallback(async (memory: MemoryPhoto) => {
    await saveMemory(memory);
    setMemories((prev) => prev.map((m) => (m.id === memory.id ? memory : m)));
    // Sync selectedMemory if it's the one being edited
    setSelectedMemory((prev) => (prev?.id === memory.id ? memory : prev));
  }, []);

  const handleDeleteMemory = useCallback(async (id: string) => {
    await deleteMemory(id);
    setMemories((prev) => prev.filter((m) => m.id !== id));
    // Close modal / clear locked / clear candidate if deleted
    setSelectedMemory((prev) => (prev?.id === id ? null : prev));
    setLockedMemory((prev) => (prev?.id === id ? null : prev));
    setCandidateMemory((prev) => (prev?.id === id ? null : prev));
  }, []);

  const handleDeleteMemories = useCallback(async (ids: string[]) => {
    await deleteMemories(ids);
    const idSet = new Set(ids);
    setMemories((prev) => prev.filter((m) => !idSet.has(m.id)));
    setSelectedMemory((prev) => (prev && idSet.has(prev.id) ? null : prev));
    setLockedMemory((prev) => (prev && idSet.has(prev.id) ? null : prev));
    setCandidateMemory((prev) => (prev && idSet.has(prev.id) ? null : prev));
  }, []);

  const handleClearAllMemories = useCallback(async () => {
    await clearMemories();
    setMemories([]);
    setSelectedMemory(null);
    setLockedMemory(null);
    setCandidateMemory(null);
  }, []);

  // v0.3.1: Clear locked photo when mode goes to FORMED (core collapsed)
  const prevModeRef = useRef<TreeMode>(mode);
  useEffect(() => {
    if (mode === TreeMode.FORMED && prevModeRef.current === TreeMode.CHAOS) {
      setLockedMemory(null);
    }
    prevModeRef.current = mode;
  }, [mode]);

  // v0.4: Chrono Stream focus navigation
  const clampFocusIndex = useCallback((idx: number) => {
    if (chronoMemories.length === 0) return 0;
    return Math.max(0, Math.min(idx, chronoMemories.length - 1));
  }, [chronoMemories.length]);

  const goPrevMemory = useCallback(() => {
    setFocusIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const goNextMemory = useCallback(() => {
    setFocusIndex((prev) => clampFocusIndex(prev + 1));
  }, [clampFocusIndex]);

  // v0.4: Exit Chrono Stream back to constellation
  const exitChronoStream = useCallback(() => {
    setCandidateMemory(null);
    setLockedMemory(null);
    setMode(TreeMode.CHAOS);
  }, []);

  // v0.4: Mouse wheel navigation in Chrono Stream (throttled)
  // v0.6: Also skip when onboarding is open
  useEffect(() => {
    if (mode !== TreeMode.CHRONO_STREAM || selectedMemory || showGestureOnboarding) return;

    let lastWheelTime = 0;
    const WHEEL_COOLDOWN_MS = 400;

    const onWheel = (e: WheelEvent) => {
      const now = performance.now();
      if (now - lastWheelTime < WHEEL_COOLDOWN_MS) return;
      lastWheelTime = now;

      if (e.deltaY > 0) {
        goNextMemory();
      } else if (e.deltaY < 0) {
        goPrevMemory();
      }
    };

    window.addEventListener('wheel', onWheel, { passive: true });
    return () => window.removeEventListener('wheel', onWheel);
  }, [mode, selectedMemory, showGestureOnboarding, goPrevMemory, goNextMemory]);

  // v0.6: Ref for onboarding state used in key handler to avoid stale closure
  const showGestureOnboardingRef = useRef(showGestureOnboarding);
  useEffect(() => { showGestureOnboardingRef.current = showGestureOnboarding; }, [showGestureOnboarding]);

  // v0.3.1: Esc key logic: close modal OR clear locked photo
  // v0.4: Extended for Chrono Stream navigation (ArrowLeft/Right, A/D, Esc return)
  // v0.6: Skip when onboarding is open (onboarding has its own Esc handler)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // v0.6: Don't handle keys when onboarding is open
      if (showGestureOnboardingRef.current) return;

      // v0.4: Chrono Stream navigation (only when no modal open)
      if (mode === TreeMode.CHRONO_STREAM && !selectedMemory) {
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
          goPrevMemory();
          return;
        }
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
          goNextMemory();
          return;
        }
        if (e.key === 'Escape') {
          exitChronoStream();
          return;
        }
      }

      if (e.key === 'Escape') {
        if (selectedMemory) {
          setSelectedMemory(null);
        } else if (lockedMemory) {
          setLockedMemory(null);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedMemory, lockedMemory, mode, goPrevMemory, goNextMemory, exitChronoStream]);

  // Check for share parameter in URL on mount
  useEffect(() => {
    const loadSharedPhotos = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const shareId = urlParams.get('share');

      if (!shareId) return;

      setIsSharedView(true);
      setIsLoadingShare(true);

      try {
        // Try API first (works in vercel dev and production)
        try {
          const response = await fetch(`/api/share?id=${shareId}`);
          const data = await response.json();

          if (response.ok && data.success) {
            // v0.3.4: Convert shared URLs to MemoryPhoto[] and store in IndexedDB
            const now = Date.now();
            const sharedMemories: MemoryPhoto[] = (data.images as string[]).map((url, i) => ({
              id: `shared-${i}-${now}`,
              url,
              title: `分享回忆 ${i + 1}`,
              date: new Date().toISOString().slice(0, 10),
              type: 'other' as const,
              source: 'shared' as const,
              createdAt: now,
              updatedAt: now,
              order: i,
            }));
            await saveMemories(sharedMemories);
            setMemories(sharedMemories);
            return;
          }
        } catch (apiError) {
          console.log('API not available, trying localStorage fallback');
        }

        // Fallback to localStorage if API fails (pure vite dev mode)
        const shareDataStr = localStorage.getItem(`share_${shareId}`);
        if (shareDataStr) {
          const shareData = JSON.parse(shareDataStr);
          const now = Date.now();
          const sharedMemories: MemoryPhoto[] = (shareData.images as string[]).map((url, i) => ({
            id: `shared-${i}-${now}`,
            url,
            title: `分享回忆 ${i + 1}`,
            date: new Date().toISOString().slice(0, 10),
            type: 'other' as const,
            source: 'shared' as const,
            createdAt: now,
            updatedAt: now,
            order: i,
          }));
          await saveMemories(sharedMemories);
          setMemories(sharedMemories);
        } else {
          console.error('Share not found');
        }
      } catch (error) {
        console.error('Error loading shared photos:', error);
      } finally {
        setIsLoadingShare(false);
      }
    };

    loadSharedPhotos();
  }, []);

  const toggleMode = () => {
    setMode((prev) => (prev === TreeMode.FORMED ? TreeMode.CHAOS : TreeMode.FORMED));
  };

  const handleHandPosition = (x: number, y: number, detected: boolean) => {
    setHandPosition({ x, y, detected });
  };

  const handleTwoHandsDetected = (detected: boolean) => {
    setTwoHandsDetected(detected);
  };

  // v0.3: Two-hand focus updates the focused photo ID (highlight only, no modal auto-open)
  const handleFocusedPhotoIdChange = (id: string | null) => {
    // Don't clear focus if user has a modal open manually
    setFocusedPhotoId(id);
  };

  // v0.3.1: Candidate photo update from screen-center detection
  const handleCandidatePhotoChange = (photo: MemoryPhoto | null) => {
    setCandidateMemory(photo);
  };

  // v0.4: Clamp focusIndex when chronoMemories length changes
  useEffect(() => {
    if (focusIndex >= chronoMemories.length && chronoMemories.length > 0) {
      setFocusIndex(clampFocusIndex(focusIndex));
    }
  }, [chronoMemories.length, focusIndex, clampFocusIndex]);

  // v0.4: Enter Chrono Stream
  const enterChronoStream = useCallback(() => {
    if (memories.length === 0) return;
    if (selectedMemory) return; // don't enter while modal is open
    if (showGestureOnboarding) return; // v0.6: don't enter during onboarding
    setCandidateMemory(null);
    setLockedMemory(null);
    setFocusIndex(clampFocusIndex(0));
    setMode(TreeMode.CHRONO_STREAM);
  }, [memories.length, selectedMemory, showGestureOnboarding, clampFocusIndex]);

  // v0.3.1-lite: Ref for pinch callback to avoid stale closure
  const candidateMemoryRef = useRef<MemoryPhoto | null>(null);
  useEffect(() => {
    // v0.4: In CHRONO_STREAM, candidate is always the focused photo
    if (mode === TreeMode.CHRONO_STREAM && chronoMemories.length > 0) {
      candidateMemoryRef.current = chronoMemories[focusIndex] ?? null;
    } else {
      candidateMemoryRef.current = candidateMemory;
    }
  }, [candidateMemory, mode, chronoMemories, focusIndex]);

  // v0.3.1-lite: Two-hands lock (kept but unused in lite mode)
  const handleLockPhotoGesture = useCallback(() => {
    // v0.3.1-lite: no-op — two-hands lock is disabled
  }, []);

  // v0.3.2: Track when modal opened for grace period
  const [modalOpenedAt, setModalOpenedAt] = useState<number>(0);
  // v0.3.2: Ref for modal close callback to avoid stale closure
  const selectedMemoryRef = useRef<MemoryPhoto | null>(null);
  useEffect(() => {
    selectedMemoryRef.current = selectedMemory;
  }, [selectedMemory]);

  // v0.3.2: Fist hold → close modal callback
  const handleModalCloseGesture = useCallback(() => {
    if (!selectedMemoryRef.current) return;
    setSelectedMemory(null);
  }, []);

  // v0.4.4: Chrono Stream pinch → open current focus memory
  const handleChronoPinchOpen = useCallback(() => {
    if (mode !== TreeMode.CHRONO_STREAM) return;
    if (selectedMemory !== null) return;
    const memory = chronoMemories[focusIndex];
    if (!memory) return;
    setSelectedMemory(memory);
    setModalOpenedAt(performance.now());
  }, [mode, selectedMemory, chronoMemories, focusIndex]);

  // v0.3.1-lite: Pinch hold → open current candidate directly
  const handlePinchConfirm = useCallback(() => {
    const memory = candidateMemoryRef.current;
    if (!memory) return;
    setSelectedMemory(memory);
    setModalOpenedAt(performance.now()); // v0.3.2: record open time for grace
  }, []);

  // v0.6: Gesture onboarding callbacks
  const handleCloseGestureOnboarding = useCallback((dontShowAgain: boolean) => {
    if (dontShowAgain) {
      localStorage.setItem(GESTURE_ONBOARDING_HIDE_KEY, "true");
    }
    setShowGestureOnboarding(false);
  }, []);

  const handleOpenGestureOnboarding = useCallback(() => {
    setShowGestureOnboarding(true);
  }, []);

  return (
    <div className="w-full h-screen relative bg-gradient-to-b from-black via-[#0a0a1a] to-[#0d1b2a]">
      <ErrorBoundary>
        <Canvas
          dpr={[1, 2]}
          camera={{ position: [0, 2, 14], fov: 45 }}
          gl={{ antialias: false, stencil: false, alpha: false }}
          shadows
          frameloop={memoryManagerOpen ? 'demand' : 'always'}
        >
          <Suspense fallback={null}>
            <Experience
              mode={mode}
              handPosition={handPosition}
              uploadedPhotos={renderUrls}
              twoHandsDetected={twoHandsDetected}
              memories={renderMemories}
              focusedPhotoId={focusedPhotoId}
              onPhotoSelect={(photo) => { setSelectedMemory(photo); setModalOpenedAt(performance.now()); }}
              onFocusedPhotoIdChange={handleFocusedPhotoIdChange}
              candidatePhotoId={
                mode === TreeMode.CHRONO_STREAM
                  ? (chronoMemories[focusIndex]?.id ?? null)
                  : (candidateMemory?.id ?? null)
              }
              onCandidatePhotoChange={handleCandidatePhotoChange}
              lockedPhotoId={lockedMemory?.id ?? null}
              pauseSelection={selectedMemory !== null}
              focusIndex={focusIndex}
              nebulaOrderById={nebulaOrderById}
              chronoOrderById={chronoOrderById}
            />
          </Suspense>
        </Canvas>
      </ErrorBoundary>
      
      <Loader 
        containerStyles={{ background: '#000' }} 
        innerStyles={{ width: '300px', height: '10px', background: '#333' }}
        barStyles={{ background: '#D4AF37', height: '10px' }}
        dataStyles={{ color: '#D4AF37', fontFamily: 'Cinzel' }}
      />
      
      <UIOverlay 
        mode={mode} 
        onToggle={toggleMode} 
        onManageMemories={() => setMemoryManagerOpen(true)}
        memoryCount={memories.length}
        isSharedView={isSharedView}
        onEnterChronoStream={enterChronoStream}
        onExitChronoStream={exitChronoStream}
        onPrevMemory={goPrevMemory}
        onNextMemory={goNextMemory}
        focusIndex={focusIndex}
        chronoMemories={chronoMemories}
        selectedMemory={selectedMemory}
        onOpenGestureOnboarding={handleOpenGestureOnboarding}
      />
      
      {/* Loading indicator for shared photos */}
      {isLoadingShare && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="text-[#D4AF37] font-serif text-xl">
            加载分享的照片中...
          </div>
        </div>
      )}
      
      {/* Gesture Control Module — v0.3.2: modal close gesture, v0.4.4: chrono gestures, v0.5: two-hand transition */}
      <GestureController
        currentMode={mode}
        onModeChange={setMode}
        onHandPosition={handleHandPosition}
        onTwoHandsDetected={handleTwoHandsDetected}
        gestureNavigationEnabled={gestureNavigationEnabled}
        gesturePhotoSelectionEnabled={gesturePhotoSelectionEnabled}
        disableHandTracking={memoryManagerOpen}
        hasCandidatePhoto={
          mode === TreeMode.CHRONO_STREAM
            ? chronoMemories.length > 0 && focusIndex < chronoMemories.length
            : candidateMemory !== null
        }
        onLockPhotoGesture={handleLockPhotoGesture}
        onPinchConfirm={handlePinchConfirm}
        modalOpen={selectedMemory !== null}
        modalOpenedAt={modalOpenedAt}
        onModalCloseGesture={handleModalCloseGesture}
        // v0.4.4: Chrono Stream dedicated gestures
        chronoGestureEnabled={isChronoMode && selectedMemory === null && !showGestureOnboarding}
        hasChronoFocusMemory={isChronoMode && chronoMemories.length > 0 && !!chronoMemories[focusIndex]}
        onChronoSwipeLeft={goPrevMemory}
        onChronoSwipeRight={goNextMemory}
        onChronoPinchOpen={handleChronoPinchOpen}
        // v0.5: Two-Hand Chrono Transition (v0.6: disabled during onboarding)
        onEnterChronoGesture={enterChronoStream}
        onExitChronoGesture={exitChronoStream}
        chronoTransitionGestureEnabled={selectedMemory === null && !showGestureOnboarding}
        onTwoHandTransitionStateChange={setTwoHandTransitionState}
        // v0.6: Gesture Onboarding Tutorial
        tutorialMode={showGestureOnboarding}
        onTutorialGestureStateChange={setTutorialGestureState}
      />
      
      {/* v0.6: Gesture Onboarding Tutorial */}
      <GestureOnboarding
        open={showGestureOnboarding}
        tutorialGestureState={tutorialGestureState}
        onComplete={handleCloseGestureOnboarding}
        onSkip={handleCloseGestureOnboarding}
      />

      {/* v0.3: Memory Detail Modal — replaces old two-hand photo overlay */}
      <MemoryModal
        memory={selectedMemory}
        onClose={() => setSelectedMemory(null)}
      />

      {/* v0.3.2: Fist-to-close hint when modal is open */}
      {selectedMemory && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-fade-in">
          <div className="bg-black/40 backdrop-blur-sm border border-[#D4AF37]/20 rounded-full px-4 py-1.5">
            <p className="text-[#D4AF37]/50 font-serif text-xs tracking-wider text-center">
              {isChronoMode
                ? '握拳保持片刻，收起这段回忆'
                : '握拳保持片刻，收起这段回忆'}
            </p>
          </div>
        </div>
      )}
      
      {/* v0.5.3: Gesture photo selection status hint — shows candidate title */}
      {!selectedMemory && memories.length > 0 && mode === TreeMode.CHAOS && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 pointer-events-none transition-opacity duration-300">
          <div className="bg-black/50 backdrop-blur-sm border border-[#D4AF37]/20 rounded-full px-5 py-2">
            {candidateMemory ? (
              <p className="text-[#D4AF37]/80 font-serif text-sm tracking-wide text-center">
                已选中「{candidateMemory.title}」· 捏合打开
              </p>
            ) : (
              <p className="text-[#D4AF37]/50 font-serif text-xs tracking-wide text-center">
                移动视角 · 让照片靠近中心
              </p>
            )}
          </div>
        </div>
      )}

      {/* v0.5: Two-hand spread progress hint (CHAOS, two hands detected) */}
      {!selectedMemory && memories.length > 0 && mode === TreeMode.CHAOS && twoHandTransitionState?.twoHandsDetected && twoHandTransitionState.kind === 'spread' && (
        <div className="fixed bottom-36 left-1/2 -translate-x-1/2 z-30 pointer-events-none transition-opacity duration-300">
          <div className="bg-black/60 backdrop-blur-md border border-[#D4AF37]/30 rounded-lg px-6 py-3">
            <p className="text-[#D4AF37]/80 font-serif text-sm tracking-wider text-center mb-2">
              展开双手，整理成时间流
            </p>
            <div className="w-40 h-1 bg-[#D4AF37]/15 rounded-full overflow-hidden mx-auto">
              <div
                className="h-full bg-gradient-to-r from-[#D4AF37]/40 via-[#E8C860] to-[#D4AF37]/40 rounded-full transition-all duration-100"
                style={{ width: `${Math.round(twoHandTransitionState.progress * 100)}%` }}
              />
            </div>
            <p className="text-[#D4AF37]/30 font-serif text-[9px] tracking-wider text-center mt-1">
              {Math.round(twoHandTransitionState.progress * 100)}%
            </p>
          </div>
        </div>
      )}

      {/* v0.4.4: Chrono Stream gesture hints */}
      {!selectedMemory && memories.length > 0 && mode === TreeMode.CHRONO_STREAM && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 pointer-events-none transition-opacity duration-300">
          <div className="bg-black/50 backdrop-blur-sm border border-[#D4AF37]/20 rounded-full px-5 py-2">
            <p className="text-[#D4AF37]/70 font-serif text-sm tracking-wide text-center">
              左右挥手切换回忆 · 捏合打开当前照片
            </p>
          </div>
        </div>
      )}

      {/* v0.5: Two-hand gather progress hint (CHRONO_STREAM, two hands detected) */}
      {!selectedMemory && memories.length > 0 && mode === TreeMode.CHRONO_STREAM && twoHandTransitionState?.twoHandsDetected && twoHandTransitionState.kind === 'gather' && (
        <div className="fixed bottom-44 left-1/2 -translate-x-1/2 z-30 pointer-events-none transition-opacity duration-300">
          <div className="bg-black/60 backdrop-blur-md border border-[#D4AF37]/30 rounded-lg px-6 py-3">
            <p className="text-[#D4AF37]/80 font-serif text-sm tracking-wider text-center mb-2">
              合拢双手，回到记忆星云
            </p>
            <div className="w-40 h-1 bg-[#D4AF37]/15 rounded-full overflow-hidden mx-auto">
              <div
                className="h-full bg-gradient-to-r from-[#D4AF37]/40 via-[#E8C860] to-[#D4AF37]/40 rounded-full transition-all duration-100"
                style={{ width: `${Math.round(twoHandTransitionState.progress * 100)}%` }}
              />
            </div>
            <p className="text-[#D4AF37]/30 font-serif text-[9px] tracking-wider text-center mt-1">
              {Math.round(twoHandTransitionState.progress * 100)}%
            </p>
          </div>
        </div>
      )}
      
      {/* v0.3.1: Center crosshair (subtle, only in CHAOS with photos, not during modal) */}
      {mode === TreeMode.CHAOS && memories.length > 0 && !selectedMemory && (
        <div className="fixed inset-0 z-10 pointer-events-none flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border border-[#D4AF37]/15 flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-[#D4AF37]/25" />
          </div>
        </div>
      )}
      {/* v0.3.4: Memory Library Manager */}
      <MemoryManager
        open={memoryManagerOpen}
        memories={memories}
        onClose={() => setMemoryManagerOpen(false)}
        onCreateMany={handleBulkCreateMemories}
        onUpdate={handleUpdateMemory}
        onDelete={handleDeleteMemory}
        onDeleteMany={handleDeleteMemories}
        onClearAll={handleClearAllMemories}
      />
    </div>
  );
}
