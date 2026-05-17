
import React, { useState, Suspense, useEffect, useMemo, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { Loader } from '@react-three/drei';
import { Experience } from './components/Experience';
import { UIOverlay } from './components/UIOverlay';
import { GestureController } from './components/GestureController';
import { MemoryModal } from './components/MemoryModal';
import { TreeMode, MemoryPhoto, normalizeUploadToMemoryPhoto } from './types';

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

export default function App() {
  const [mode, setMode] = useState<TreeMode>(TreeMode.FORMED);
  const [handPosition, setHandPosition] = useState<{ x: number; y: number; detected: boolean }>({ x: 0.5, y: 0.5, detected: false });
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [isLoadingShare, setIsLoadingShare] = useState(false);
  const [isSharedView, setIsSharedView] = useState(false);
  const [twoHandsDetected, setTwoHandsDetected] = useState(false);
  
  // v0.3: Memory detail modal state
  const [selectedMemory, setSelectedMemory] = useState<MemoryPhoto | null>(null);
  // v0.3: (legacy) Photo focused by two-hand proximity
  const [focusedPhotoId, setFocusedPhotoId] = useState<string | null>(null);
  
  // v0.3.1: Gesture photo selection states
  const [candidateMemory, setCandidateMemory] = useState<MemoryPhoto | null>(null);
  const [lockedMemory, setLockedMemory] = useState<MemoryPhoto | null>(null);

  // v0.3 + v0.3.1: Pause navigation when modal is open
  const gestureNavigationEnabled = selectedMemory === null;
  // v0.3.1: Enable gesture photo selection only when modal is NOT open
  const gesturePhotoSelectionEnabled = selectedMemory === null;

  // v0.3: Derive MemoryPhoto[] from uploadedPhotos
  const memories = useMemo<MemoryPhoto[]>(() => {
    return uploadedPhotos.map((url, i) =>
      normalizeUploadToMemoryPhoto(url, i, uploadedPhotos.length)
    );
  }, [uploadedPhotos]);

  // v0.3.1: Clear locked photo when mode goes to FORMED (core collapsed)
  const prevModeRef = useRef<TreeMode>(mode);
  useEffect(() => {
    if (mode === TreeMode.FORMED && prevModeRef.current === TreeMode.CHAOS) {
      setLockedMemory(null);
    }
    prevModeRef.current = mode;
  }, [mode]);

  // v0.3.1: Esc key logic: close modal OR clear locked photo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
  }, [selectedMemory, lockedMemory]);

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
            setUploadedPhotos(data.images);
            return;
          }
        } catch (apiError) {
          console.log('API not available, trying localStorage fallback');
        }

        // Fallback to localStorage if API fails (pure vite dev mode)
        const shareDataStr = localStorage.getItem(`share_${shareId}`);
        if (shareDataStr) {
          const shareData = JSON.parse(shareDataStr);
          setUploadedPhotos(shareData.images);
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

  // v0.3.1-lite: Ref for pinch callback to avoid stale closure
  const candidateMemoryRef = useRef<MemoryPhoto | null>(null);
  useEffect(() => {
    candidateMemoryRef.current = candidateMemory;
  }, [candidateMemory]);

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

  // v0.3.1-lite: Pinch hold → open current candidate directly
  const handlePinchConfirm = useCallback(() => {
    const memory = candidateMemoryRef.current;
    if (!memory) return;
    setSelectedMemory(memory);
    setModalOpenedAt(performance.now()); // v0.3.2: record open time for grace
  }, []);

  const handlePhotosUpload = (photos: string[]) => {
    setUploadedPhotos(photos);
  };

  return (
    <div className="w-full h-screen relative bg-gradient-to-b from-black via-[#0a0a1a] to-[#0d1b2a]">
      <ErrorBoundary>
        <Canvas
          dpr={[1, 2]}
          camera={{ position: [0, 2, 14], fov: 45 }}
          gl={{ antialias: false, stencil: false, alpha: false }}
          shadows
        >
          <Suspense fallback={null}>
            <Experience
              mode={mode}
              handPosition={handPosition}
              uploadedPhotos={uploadedPhotos}
              twoHandsDetected={twoHandsDetected}
              memories={memories}
              focusedPhotoId={focusedPhotoId}
              onPhotoSelect={(photo) => { setSelectedMemory(photo); setModalOpenedAt(performance.now()); }}
              onFocusedPhotoIdChange={handleFocusedPhotoIdChange}
              candidatePhotoId={candidateMemory?.id ?? null}
              onCandidatePhotoChange={handleCandidatePhotoChange}
              lockedPhotoId={lockedMemory?.id ?? null}
              pauseSelection={selectedMemory !== null}
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
        onPhotosUpload={handlePhotosUpload} 
        hasPhotos={uploadedPhotos.length > 0}
        uploadedPhotos={uploadedPhotos}
        isSharedView={isSharedView}
      />
      
      {/* Loading indicator for shared photos */}
      {isLoadingShare && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="text-[#D4AF37] font-serif text-xl">
            加载分享的照片中...
          </div>
        </div>
      )}
      
      {/* Gesture Control Module — v0.3.2: modal close gesture */}
      <GestureController
        currentMode={mode}
        onModeChange={setMode}
        onHandPosition={handleHandPosition}
        onTwoHandsDetected={handleTwoHandsDetected}
        gestureNavigationEnabled={gestureNavigationEnabled}
        gesturePhotoSelectionEnabled={gesturePhotoSelectionEnabled}
        hasCandidatePhoto={candidateMemory !== null}
        onLockPhotoGesture={handleLockPhotoGesture}
        onPinchConfirm={handlePinchConfirm}
        modalOpen={selectedMemory !== null}
        modalOpenedAt={modalOpenedAt}
        onModalCloseGesture={handleModalCloseGesture}
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
              握拳保持片刻，收起这段回忆
            </p>
          </div>
        </div>
      )}
      
      {/* v0.3.1-lite: Gesture photo selection status hint */}
      {!selectedMemory && uploadedPhotos.length > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 pointer-events-none transition-opacity duration-300">
          <div className="bg-black/50 backdrop-blur-sm border border-[#D4AF37]/20 rounded-full px-5 py-2">
            {candidateMemory ? (
              <p className="text-[#D4AF37]/70 font-serif text-sm tracking-wide text-center">
                捏合手指，打开这段回忆
              </p>
            ) : (
              <p className="text-[#D4AF37]/50 font-serif text-xs tracking-wide text-center">
                移动视角 · 让照片靠近中心
              </p>
            )}
          </div>
        </div>
      )}
      
      {/* v0.3.1: Center crosshair (subtle, only in CHAOS with photos, not during modal) */}
      {mode === TreeMode.CHAOS && uploadedPhotos.length > 0 && !selectedMemory && (
        <div className="fixed inset-0 z-10 pointer-events-none flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border border-[#D4AF37]/15 flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-[#D4AF37]/25" />
          </div>
        </div>
      )}
    </div>
  );
}
