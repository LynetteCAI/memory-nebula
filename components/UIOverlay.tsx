import React from 'react';
import { TreeMode, MemoryPhoto } from '../types';

interface UIOverlayProps {
  mode: TreeMode;
  onToggle: () => void;
  /** v0.3.4: Open memory manager panel */
  onManageMemories: () => void;
  /** v0.3.4: Number of saved memories */
  memoryCount: number;
  isSharedView: boolean;
  /** v0.4: Enter Chrono Stream from CHAOS */
  onEnterChronoStream: () => void;
  /** v0.4: Exit Chrono Stream back to CHAOS */
  onExitChronoStream: () => void;
  /** v0.4: Navigate to previous memory in Chrono Stream */
  onPrevMemory: () => void;
  /** v0.4: Navigate to next memory in Chrono Stream */
  onNextMemory: () => void;
  /** v0.4: Current focus index in Chrono Stream */
  focusIndex: number;
  /** v0.4: Chrono-sorted memories for HUD display */
  chronoMemories: MemoryPhoto[];
  /** v0.4: Whether a memory modal is open */
  selectedMemory: MemoryPhoto | null;
  /** v0.6: Open gesture onboarding tutorial */
  onOpenGestureOnboarding?: () => void;
}

export const UIOverlay: React.FC<UIOverlayProps> = ({
  mode, onToggle, onManageMemories, memoryCount, isSharedView,
  onEnterChronoStream, onExitChronoStream,
  onPrevMemory, onNextMemory,
  focusIndex, chronoMemories, selectedMemory,
  onOpenGestureOnboarding,
}) => {
  const isFormed = mode === TreeMode.FORMED;
  const isChronoStream = mode === TreeMode.CHRONO_STREAM;
  const isChaos = mode === TreeMode.CHAOS;
  const currentChronoMemory = chronoMemories[focusIndex];

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-10">
      
      {/* Header */}
      <header className="absolute top-8 left-1/2 transform -translate-x-1/2 flex flex-col items-center">
        <h1 className="text-4xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] via-[#E8C860] to-[#D4AF37] font-serif drop-shadow-lg tracking-wider text-center">
          Memory Nebula
        </h1>
        <p className="text-[#F5E6BF]/60 font-serif text-sm md:text-base tracking-[0.2em] mt-2 text-center">
          记忆星云
        </p>
      </header>

      {/* Right Bottom Action Area */}
      <div className="absolute bottom-8 right-8 flex flex-col items-end gap-4 pointer-events-auto">
        {/* Shared View: Show "创建我的记忆星云" button */}
        {isSharedView && (
          <button
            onClick={() => window.location.href = window.location.origin}
            className="group px-6 py-3 border-2 border-[#D4AF37] bg-black/70 backdrop-blur-md overflow-hidden transition-all duration-500 hover:shadow-[0_0_30px_#D4AF37] hover:border-[#fff] hover:bg-[#D4AF37]/20"
          >
            <span className="relative z-10 font-serif text-base md:text-lg text-[#D4AF37] tracking-[0.1em] group-hover:text-white transition-colors whitespace-nowrap">
              创建我的记忆星云
            </span>
          </button>
        )}

        {/* Not Shared View: Show manage memories button */}
        {!isSharedView && (
          <>
            <button
              onClick={onManageMemories}
              className="group px-6 py-3 border-2 border-[#D4AF37] bg-black/70 backdrop-blur-md overflow-hidden transition-all duration-500 hover:shadow-[0_0_30px_#D4AF37] hover:border-[#fff] hover:bg-[#D4AF37]/20"
            >
              <span className="relative z-10 font-serif text-base md:text-lg text-[#D4AF37] tracking-[0.1em] group-hover:text-white transition-colors whitespace-nowrap">
                {memoryCount > 0 ? `管理回忆 · ${memoryCount}` : '上传回忆照片'}
              </span>
            </button>
            {/* v0.6: Gesture onboarding tutorial button */}
            {onOpenGestureOnboarding && (
              <button
                onClick={onOpenGestureOnboarding}
                className="group px-5 py-2 border border-[#D4AF37]/30 bg-black/60 backdrop-blur-md overflow-hidden transition-all duration-300 hover:border-[#D4AF37]/60 hover:bg-[#D4AF37]/10"
              >
                <span className="relative z-10 font-serif text-xs text-[#D4AF37]/50 tracking-[0.1em] group-hover:text-[#D4AF37]/80 transition-colors whitespace-nowrap">
                  手势教学
                </span>
              </button>
            )}
          </>
        )}
      </div>

      {/* Decorative Corners */}
      <div className="absolute top-8 left-8 w-16 h-16 border-t-2 border-l-2 border-[#D4AF37] opacity-50"></div>
      <div className="absolute top-8 right-8 w-16 h-16 border-t-2 border-r-2 border-[#D4AF37] opacity-50"></div>
      <div className="absolute bottom-8 left-8 w-16 h-16 border-b-2 border-l-2 border-[#D4AF37] opacity-50"></div>
      <div className="absolute bottom-8 right-8 w-16 h-16 border-b-2 border-r-2 border-[#D4AF37] opacity-50"></div>

      {/* v0.4: Enter Chrono Stream button — only in CHAOS */}
      {isChaos && !isSharedView && memoryCount > 0 && (
        <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-auto">
          <button
            onClick={onEnterChronoStream}
            className="group flex flex-col items-center gap-2 px-5 py-4 border border-[#D4AF37]/40 bg-black/60 backdrop-blur-md transition-all duration-500 hover:border-[#D4AF37] hover:shadow-[0_0_25px_rgba(212,175,55,0.3)] hover:bg-[#D4AF37]/10"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-[#D4AF37] group-hover:text-[#E8C860] transition-colors">
              <path strokeWidth="1.5" d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z" />
              <path strokeWidth="1.5" d="M12 6v6l4 2" />
            </svg>
            <span className="font-serif text-xs text-[#D4AF37]/70 tracking-[0.15em] group-hover:text-[#D4AF37] transition-colors">
              进入时间流
            </span>
          </button>
        </div>
      )}

      {/* v0.4: Chrono Stream HUD — bottom center */}
      {isChronoStream && chronoMemories.length > 0 && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-md border border-[#D4AF37]/30 px-6 py-4 rounded-sm">
            {/* Focus photo info */}
            <div className="flex flex-col items-center gap-1 mb-3">
              <p className="text-[#D4AF37]/60 font-serif text-[10px] tracking-[0.15em]">
                第 <span className="text-[#D4AF37] text-sm">{focusIndex + 1}</span> 段回忆 / 共 <span className="text-[#D4AF37]/80">{chronoMemories.length}</span> 段
              </p>
              {currentChronoMemory && (
                <>
                  <p className="text-[#F5E6BF] font-serif text-sm tracking-wider">
                    {currentChronoMemory.title || '未命名回忆'}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {currentChronoMemory.date && (
                      <span className="text-[#D4AF37]/50 font-serif text-[10px] tracking-wider">
                        {currentChronoMemory.date}
                      </span>
                    )}
                    {currentChronoMemory.location && (
                      <span className="text-[#D4AF37]/40 font-serif text-[10px] tracking-wider">
                        {currentChronoMemory.location}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={onPrevMemory}
                disabled={focusIndex <= 0}
                className={`px-3 py-1.5 border text-xs font-serif tracking-wider transition-all duration-300
                  ${focusIndex > 0
                    ? 'border-[#D4AF37]/40 text-[#D4AF37]/70 hover:border-[#D4AF37] hover:text-[#D4AF37] hover:bg-[#D4AF37]/10'
                    : 'border-[#D4AF37]/15 text-[#D4AF37]/20 cursor-not-allowed'
                  }`}
              >
                ◂ 上一段
              </button>
              <button
                onClick={onExitChronoStream}
                className="px-4 py-1.5 border border-[#D4AF37]/50 text-[#D4AF37]/70 font-serif text-xs tracking-wider transition-all duration-300 hover:border-[#D4AF37] hover:text-[#D4AF37] hover:bg-[#D4AF37]/10"
              >
                回到星云
              </button>
              <button
                onClick={onNextMemory}
                disabled={focusIndex >= chronoMemories.length - 1}
                className={`px-3 py-1.5 border text-xs font-serif tracking-wider transition-all duration-300
                  ${focusIndex < chronoMemories.length - 1
                    ? 'border-[#D4AF37]/40 text-[#D4AF37]/70 hover:border-[#D4AF37] hover:text-[#D4AF37] hover:bg-[#D4AF37]/10'
                    : 'border-[#D4AF37]/15 text-[#D4AF37]/20 cursor-not-allowed'
                  }`}
              >
                下一段 ▸
              </button>
            </div>

            {/* Hint */}
            <p className="text-[#F5E6BF]/20 font-serif text-[9px] tracking-wider text-center mt-2">
              左右挥手切换回忆 · 捏合打开当前照片 · 左右键 / 滚轮也可浏览
            </p>
          </div>
        </div>
      )}

      {/* v0.3: Gesture & interaction hints */}
      {!isChronoStream && (
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-none">
        <div className="flex flex-col items-center gap-1">
          {memoryCount > 0 && (
            <p className="text-[#D4AF37]/50 font-serif text-xs tracking-wider text-center">
              点击拍立得，查看这段回忆
            </p>
          )}
          <p className="text-[#F5E6BF]/30 font-serif text-[10px] tracking-wider text-center">
            张开手掌 · 释放记忆星云 &nbsp;|&nbsp; 握拳 · 收拢记忆核心
          </p>
          <p className="text-[#F5E6BF]/20 font-serif text-[10px] tracking-wider text-center">
            捏合手指 · 打开中心候选照片
          </p>
        </div>
      </div>
      )}
    </div>
  );
};