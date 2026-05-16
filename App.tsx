
import React, { useState, Suspense, useEffect, useMemo } from 'react';
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
  // v0.3: Photo focused by two-hand detection (highlight only, doesn't open modal)
  const [focusedPhotoId, setFocusedPhotoId] = useState<string | null>(null);

  // v0.3: Pause gesture navigation when modal is open
  const gestureNavigationEnabled = selectedMemory === null;

  // v0.3: Derive MemoryPhoto[] from uploadedPhotos
  const memories = useMemo<MemoryPhoto[]>(() => {
    return uploadedPhotos.map((url, i) =>
      normalizeUploadToMemoryPhoto(url, i, uploadedPhotos.length)
    );
  }, [uploadedPhotos]);

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
              onPhotoSelect={setSelectedMemory}
              onFocusedPhotoIdChange={handleFocusedPhotoIdChange}
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
      
      {/* Gesture Control Module — v0.3: navigation paused when modal is open */}
      <GestureController
        currentMode={mode}
        onModeChange={setMode}
        onHandPosition={handleHandPosition}
        onTwoHandsDetected={handleTwoHandsDetected}
        gestureNavigationEnabled={gestureNavigationEnabled}
      />
      
      {/* v0.3: Memory Detail Modal — replaces old two-hand photo overlay */}
      <MemoryModal
        memory={selectedMemory}
        onClose={() => setSelectedMemory(null)}
      />
      
      {/* v0.3: Small hint when two hands are focusing a photo */}
      {twoHandsDetected && focusedPhotoId && !selectedMemory && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 pointer-events-none animate-fade-in">
          <div className="bg-black/60 backdrop-blur-sm border border-[#D4AF37]/30 rounded-full px-5 py-2">
            <p className="text-[#D4AF37]/80 font-serif text-sm tracking-wide">
              已聚焦一段回忆，点击照片查看详情
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
