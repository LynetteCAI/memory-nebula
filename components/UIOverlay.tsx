import React from 'react';
import { TreeMode } from '../types';

interface UIOverlayProps {
  mode: TreeMode;
  onToggle: () => void;
  /** v0.3.4: Open memory manager panel */
  onManageMemories: () => void;
  /** v0.3.4: Number of saved memories */
  memoryCount: number;
  isSharedView: boolean;
}

export const UIOverlay: React.FC<UIOverlayProps> = ({ mode, onToggle, onManageMemories, memoryCount, isSharedView }) => {
  const isFormed = mode === TreeMode.FORMED;

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
          <button
            onClick={onManageMemories}
            className="group px-6 py-3 border-2 border-[#D4AF37] bg-black/70 backdrop-blur-md overflow-hidden transition-all duration-500 hover:shadow-[0_0_30px_#D4AF37] hover:border-[#fff] hover:bg-[#D4AF37]/20"
          >
            <span className="relative z-10 font-serif text-base md:text-lg text-[#D4AF37] tracking-[0.1em] group-hover:text-white transition-colors whitespace-nowrap">
              {memoryCount > 0 ? `管理回忆 · ${memoryCount}` : '上传回忆照片'}
            </span>
          </button>
        )}
      </div>

      {/* Decorative Corners */}
      <div className="absolute top-8 left-8 w-16 h-16 border-t-2 border-l-2 border-[#D4AF37] opacity-50"></div>
      <div className="absolute top-8 right-8 w-16 h-16 border-t-2 border-r-2 border-[#D4AF37] opacity-50"></div>
      <div className="absolute bottom-8 left-8 w-16 h-16 border-b-2 border-l-2 border-[#D4AF37] opacity-50"></div>
      <div className="absolute bottom-8 right-8 w-16 h-16 border-b-2 border-r-2 border-[#D4AF37] opacity-50"></div>

      {/* v0.3: Gesture & interaction hints */}
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
    </div>
  );
};