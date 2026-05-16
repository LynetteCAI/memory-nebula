import React, { useEffect, useCallback, useState } from 'react';
import { MemoryPhoto, MemoryType } from '../types';

// ---------------------------------------------------------------------------
// 中文类型标签
// ---------------------------------------------------------------------------
const typeLabels: Record<MemoryType, string> = {
  travel: '旅行',
  food: '美食',
  movie: '电影',
  daily: '日常',
  anniversary: '纪念日',
  other: '回忆',
};

const typeColors: Record<MemoryType, string> = {
  travel: 'bg-blue-900/60 text-blue-200 border-blue-400/40',
  food: 'bg-red-900/60 text-red-200 border-red-400/40',
  movie: 'bg-purple-900/60 text-purple-200 border-purple-400/40',
  daily: 'bg-emerald-900/60 text-emerald-200 border-emerald-400/40',
  anniversary: 'bg-amber-900/60 text-amber-200 border-amber-400/40',
  other: 'bg-slate-800/60 text-slate-300 border-slate-500/40',
};

// ---------------------------------------------------------------------------
//  Props
// ---------------------------------------------------------------------------
interface MemoryModalProps {
  memory: MemoryPhoto | null;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
//  Component
// ---------------------------------------------------------------------------
export const MemoryModal: React.FC<MemoryModalProps> = ({ memory, onClose }) => {
  const [closing, setClosing] = useState(false);

  // Trigger close animation then actually close
  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 180);
  }, [onClose]);

  // ESC key to close
  useEffect(() => {
    if (!memory) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [memory, handleClose]);

  if (!memory) return null;

  const type = memory.type || 'other';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => {
        // Close only when clicking the backdrop itself
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/70 backdrop-blur-md ${
          closing ? 'opacity-0 transition-opacity duration-200' : 'animate-modal-backdrop'
        }`}
      />

      {/* Card Container */}
      <div
        className={`relative z-10 flex flex-col md:flex-row gap-6 md:gap-10 p-4 ${
          closing ? 'animate-modal-card-out' : 'animate-modal-card-in'
        }`}
        style={{ maxWidth: 'min(92vw, 820px)', maxHeight: '90vh' }}
      >
        {/* ── Polaroid-style Photo ── */}
        <div className="flex-shrink-0 flex flex-col items-center">
          <div
            className="relative bg-[#faf8f5] p-3 pb-10 shadow-2xl"
            style={{
              width: 'min(70vw, 360px)',
              boxShadow: '0 0 60px rgba(212, 175, 55, 0.15), 0 4px 30px rgba(0,0,0,0.5)',
            }}
          >
            {/* Gold border accent */}
            <div className="absolute inset-1 border border-[#D4AF37]/30 pointer-events-none" />

            {/* Gold clip */}
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-10 h-5 bg-gradient-to-b from-[#D4AF37] to-[#B8962E] rounded-sm shadow-md z-10" />

            {/* Photo */}
            <div className="relative overflow-hidden bg-gray-200" style={{ aspectRatio: '1/1' }}>
              <img
                src={memory.url}
                alt={memory.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback if image fails to load
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>

            {/* "Memory" bottom text */}
            <div className="text-center mt-3 font-serif text-gray-500 text-sm tracking-wider select-none">
              Memory
            </div>
          </div>
        </div>

        {/* ── Text Content ── */}
        <div className="flex flex-col justify-center min-w-0 overflow-y-auto">
          {/* Type tag */}
          <div className="mb-2">
            <span
              className={`inline-block px-3 py-0.5 rounded-full text-xs font-serif tracking-wider border ${typeColors[type]}`}
            >
              {typeLabels[type]}
            </span>
          </div>

          {/* Title */}
          <h2 className="text-2xl md:text-3xl font-serif text-[#F5E6BF] mb-2 tracking-wide">
            {memory.title}
          </h2>

          {/* Date + Location row */}
          {(memory.date || memory.location) && (
            <div className="flex flex-wrap items-center gap-2 mb-3 text-sm text-[#D4AF37]/70 font-serif">
              {memory.date && (
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {memory.date}
                </span>
              )}
              {memory.location && (
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {memory.location}
                </span>
              )}
            </div>
          )}

          {/* Description — a single evocative line */}
          {memory.description && (
            <p className="text-[#F5E6BF]/80 font-serif text-base md:text-lg italic mb-4 leading-relaxed">
              &ldquo;{memory.description}&rdquo;
            </p>
          )}

          {/* Divider */}
          <div className="w-16 h-px bg-gradient-to-r from-[#D4AF37]/60 to-transparent mb-4" />

          {/* Story — the main text */}
          {memory.story && (
            <div className="text-[#C8C0D0]/80 font-serif text-sm md:text-base leading-relaxed max-h-[40vh] md:max-h-[50vh] overflow-y-auto pr-1">
              {memory.story}
            </div>
          )}
        </div>
      </div>

      {/* Close button (X) — always visible, outside card flow */}
      <button
        onClick={handleClose}
        className="absolute top-6 right-6 z-20 w-10 h-10 flex items-center justify-center text-[#D4AF37]/60 hover:text-[#D4AF37] transition-colors duration-200"
        aria-label="关闭"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};
