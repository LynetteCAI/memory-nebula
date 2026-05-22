import React from 'react';
import type { TutorialStepId } from '../types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GestureDemoProps {
  step: TutorialStepId;
  completed?: boolean;
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Captions per step
// ---------------------------------------------------------------------------

const CAPTIONS: Record<string, string> = {
  camera: '把手放进摄像头画面',
  fist: '握拳，收回记忆核心',
  openPalm: '张开手掌，释放星云',
  openPalmOrbit: '保持张手，画圈探索视角',
  pinch: '拇指食指捏合，其余三指展开',
  twoHandSpread: '展开双手，整理成时间流',
  chronoSwipe: '左右挥手，浏览时间流',
  twoHandGather: '合拢双手，回到星云',
  done: '你已经准备好开始探索',
};

// ---------------------------------------------------------------------------
// Sub-components for each step
// ---------------------------------------------------------------------------

/** Camera: hand enters a frame, scanning dots pulse */
const CameraDemo: React.FC<{ completed: boolean }> = ({ completed }) => (
  <div className="gesture-demo-camera relative w-full h-full flex items-center justify-center">
    {/* Camera frame */}
    <div className={`absolute inset-2 rounded-lg border-2 transition-all duration-500 ${
      completed ? 'border-[#D4AF37] shadow-[0_0_15px_rgba(212,175,55,0.4)]' : 'border-[#D4AF37]/30'
    }`}>
      {/* Top-left corner */}
      <div className="absolute -top-[2px] -left-[2px] w-4 h-4 border-t-2 border-l-2 border-[#D4AF37]/60" />
      {/* Top-right corner */}
      <div className="absolute -top-[2px] -right-[2px] w-4 h-4 border-t-2 border-r-2 border-[#D4AF37]/60" />
      {/* Bottom-left corner */}
      <div className="absolute -bottom-[2px] -left-[2px] w-4 h-4 border-b-2 border-l-2 border-[#D4AF37]/60" />
      {/* Bottom-right corner */}
      <div className="absolute -bottom-[2px] -right-[2px] w-4 h-4 border-b-2 border-r-2 border-[#D4AF37]/60" />
      {/* Scanning line */}
      <div className="absolute left-1 right-1 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/40 to-transparent"
        style={{ animation: 'gesture-demo-camera-scan 2s ease-in-out infinite' }} />
    </div>
    {/* Hand dots entering from bottom */}
    <div className="flex items-center justify-center gap-1"
      style={{ animation: 'gesture-demo-camera-hand 2.5s ease-out infinite' }}>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i}
          className={`w-2 h-2 rounded-full transition-colors duration-300 ${
            completed ? 'bg-[#D4AF37]' : 'bg-[#D4AF37]/60'
          }`}
          style={{ animationDelay: `${i * 0.12}s` }}
        />
      ))}
    </div>
  </div>
);

/** Fist: fingertip dots converge to palm */
const FistDemo: React.FC<{ completed: boolean }> = ({ completed }) => (
  <div className="relative w-full h-full flex items-center justify-center">
    {/* Central palm / core */}
    <div className={`w-5 h-5 rounded-full transition-all duration-500 z-10 ${
      completed
        ? 'bg-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.6)]'
        : 'bg-[#D4AF37]/30 shadow-[0_0_8px_rgba(212,175,55,0.15)]'
    }`} />
    {/* Dust particles converging */}
    {!completed && (
      <>
        <div className="absolute w-1 h-1 rounded-full bg-[#D4AF37]/20"
          style={{ top: '10%', left: '20%', animation: 'gesture-demo-fist-in 1.5s ease-in-out infinite alternate' }} />
        <div className="absolute w-1 h-1 rounded-full bg-[#D4AF37]/15"
          style={{ top: '15%', right: '25%', animation: 'gesture-demo-fist-in 1.8s ease-in-out infinite alternate', animationDelay: '0.3s' }} />
        <div className="absolute w-1 h-1 rounded-full bg-[#D4AF37]/20"
          style={{ bottom: '20%', left: '15%', animation: 'gesture-demo-fist-in 1.6s ease-in-out infinite alternate', animationDelay: '0.5s' }} />
        <div className="absolute w-1 h-1 rounded-full bg-[#D4AF37]/15"
          style={{ bottom: '15%', right: '20%', animation: 'gesture-demo-fist-in 1.7s ease-in-out infinite alternate', animationDelay: '0.2s' }} />
      </>
    )}
  </div>
);

/** OpenPalm: dots spread from center */
const OpenPalmDemo: React.FC<{ completed: boolean }> = ({ completed }) => (
  <div className="relative w-full h-full flex items-center justify-center">
    {/* Palm center */}
    <div className={`w-4 h-4 rounded-full transition-all duration-500 z-10 ${
      completed ? 'bg-[#D4AF37] shadow-[0_0_15px_rgba(212,175,55,0.5)]' : 'bg-[#D4AF37]/30'
    }`} />
    {/* Spreading dots (fingertips) */}
    {[0, 1, 2, 3, 4].map(i => {
      const angle = (i - 2) * 22;
      const dist = completed ? 22 + i * 4 : 0;
      return (
        <div key={i}
          className={`w-[5px] h-[5px] rounded-full absolute transition-all duration-700 ${
            completed ? 'bg-[#D4AF37]' : 'bg-[#D4AF37]/50'
          }`}
          style={{
            transform: completed
              ? `translate(${Math.sin(angle * Math.PI / 180) * dist}px, ${-Math.cos(angle * Math.PI / 180) * dist}px)`
              : 'translate(0, 0)',
            transitionDelay: `${i * 0.08}s`,
            opacity: completed ? 1 : 0.5,
          }}
        />
      );
    })}
    {/* Expansion ring */}
    {completed && (
      <div className="absolute w-20 h-20 rounded-full border border-[#D4AF37]/30 animate-pulse" />
    )}
  </div>
);

/** OpenPalmOrbit: hand with spread dots orbiting */
const OrbitDemo: React.FC<{ completed: boolean }> = ({ completed }) => (
  <div className="relative w-full h-full flex items-center justify-center">
    {/* Orbit trail ring */}
    <div className="absolute w-[72px] h-[72px] rounded-full border border-dashed border-[#D4AF37]/20" />
    {/* Orbiting hand group */}
    <div className="absolute flex items-center justify-center"
      style={{
        animation: completed ? 'none' : 'gesture-demo-orbit 3s linear infinite',
        transform: completed ? 'rotate(0deg) translateX(28px)' : undefined,
      }}>
      {/* Palm */}
      <div className={`w-3 h-3 rounded-full transition-colors ${
        completed ? 'bg-[#D4AF37]' : 'bg-[#D4AF37]/50'
      }`} />
      {/* Extended fingertips */}
      {[0, 1, 2, 3, 4].map(i => {
        const a = (i - 2) * 20;
        const d = 10 + i * 2;
        return (
          <div key={i}
            className={`w-[3px] h-[3px] rounded-full absolute transition-colors ${
              completed ? 'bg-[#D4AF37]' : 'bg-[#D4AF37]/40'
            }`}
            style={{
              transform: `translate(${Math.sin(a * Math.PI / 180) * d}px, ${-Math.cos(a * Math.PI / 180) * d}px)`,
            }}
          />
        );
      })}
    </div>
    {/* Direction arrows on orbit */}
    <div className="absolute text-[#D4AF37]/20 text-[8px] font-mono"
      style={{ top: '2px', left: '50%', transform: 'translateX(-50%)' }}>⟳</div>
  </div>
);

/** Pinch: thumb+index close, others extended */
const PinchDemo: React.FC<{ completed: boolean }> = ({ completed }) => (
  <div className="relative w-full h-full flex items-center justify-center gap-1">
    {/* Thumb (dot 0) */}
    <div className={`w-2 h-2 rounded-full transition-all duration-500 ${
      completed ? 'bg-[#D4AF37] shadow-[0_0_8px_rgba(212,175,55,0.6)]' : 'bg-[#D4AF37]/60'
    }`}
      style={{ animation: completed ? 'none' : 'gesture-demo-pinch-close 2s ease-in-out infinite' }} />
    {/* Index (dot 1) */}
    <div className={`w-2 h-2 rounded-full transition-all duration-500 ${
      completed ? 'bg-[#D4AF37] shadow-[0_0_8px_rgba(212,175,55,0.6)]' : 'bg-[#D4AF37]/60'
    }`}
      style={{ animation: completed ? 'none' : 'gesture-demo-pinch-close 2s ease-in-out infinite', animationDelay: '0.1s' }} />
    {/* Middle (dot 2) - stays spread */}
    <div className={`w-1.5 h-1.5 rounded-full transition-colors ${
      completed ? 'bg-[#D4AF37]/60' : 'bg-[#D4AF37]/30'
    }`} style={{ marginTop: '-8px' }} />
    {/* Ring (dot 3) - stays spread */}
    <div className={`w-1.5 h-1.5 rounded-full transition-colors ${
      completed ? 'bg-[#D4AF37]/60' : 'bg-[#D4AF37]/30'
    }`} style={{ marginTop: '-12px' }} />
    {/* Pinky (dot 4) - stays spread */}
    <div className={`w-1.5 h-1.5 rounded-full transition-colors ${
      completed ? 'bg-[#D4AF37]/60' : 'bg-[#D4AF37]/30'
    }`} style={{ marginTop: '-10px' }} />
    {/* Small photo card that appears on success */}
    {completed && (
      <div className="absolute -bottom-1 w-6 h-4 bg-[#D4AF37]/20 rounded-sm border border-[#D4AF37]/40 animate-fade-in"
        style={{ animation: 'gesture-demo-float 2s ease-in-out infinite' }} />
    )}
  </div>
);

/** TwoHandSpread: two hands moving apart */
const TwoHandSpreadDemo: React.FC<{ completed: boolean }> = ({ completed }) => (
  <div className="relative w-full h-full flex items-center justify-center">
    {/* Left hand */}
    <div className="absolute flex items-center justify-center"
      style={{ animation: completed ? 'none' : 'gesture-demo-spread-left 2.5s ease-in-out infinite' }}>
      <div className={`w-3 h-3 rounded-full transition-colors ${
        completed ? 'bg-[#D4AF37] shadow-[0_0_8px_rgba(212,175,55,0.5)]' : 'bg-[#D4AF37]/40'
      }`} />
    </div>
    {/* Center photo dots transforming into line */}
    <div className="flex items-center gap-0.5">
      {[0, 1, 2].map(i => (
        <div key={i}
          className={`w-1.5 h-2 rounded-sm transition-all duration-500 ${
            completed ? 'bg-[#D4AF37]/60' : 'bg-[#D4AF37]/15'
          }`}
          style={{
            transform: completed ? 'translateY(0)' : `translateY(${(i - 1) * 6}px)`,
            transitionDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
    {/* Right hand */}
    <div className="absolute flex items-center justify-center"
      style={{ animation: completed ? 'none' : 'gesture-demo-spread-right 2.5s ease-in-out infinite' }}>
      <div className={`w-3 h-3 rounded-full transition-colors ${
        completed ? 'bg-[#D4AF37] shadow-[0_0_8px_rgba(212,175,55,0.5)]' : 'bg-[#D4AF37]/40'
      }`} />
    </div>
    {/* Spread arrows */}
    {completed && (
      <>
        <div className="absolute text-[#D4AF37]/30 text-[8px]" style={{ left: '12px' }}>←</div>
        <div className="absolute text-[#D4AF37]/30 text-[8px]" style={{ right: '12px' }}>→</div>
      </>
    )}
  </div>
);

/** ChronoSwipe: hand sliding left-right */
const ChronoSwipeDemo: React.FC<{ completed: boolean }> = ({ completed }) => (
  <div className="relative w-full h-full flex items-center justify-center">
    {/* Photo cards */}
    <div className="flex items-center gap-2">
      {[-1, 0, 1].map(i => (
        <div key={i}
          className={`w-4 h-5 rounded-sm border transition-all duration-500 ${
            completed
              ? 'border-[#D4AF37]/50 bg-[#D4AF37]/15'
              : i === 0
                ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10'
                : 'border-[#D4AF37]/15 bg-[#D4AF37]/5'
          }`}
          style={{
            opacity: completed ? 0.6 : (i === 0 ? 1 : 0.4),
            transform: completed ? 'scale(1)' : `scale(${i === 0 ? 1 : 0.85})`,
          }}
        />
      ))}
    </div>
    {/* Swiping hand */}
    <div className="absolute flex items-center justify-center gap-0.5"
      style={{ animation: completed ? 'none' : 'gesture-demo-swipe 2.2s ease-in-out infinite' }}>
      <div className={`w-2 h-2 rounded-full transition-colors ${
        completed ? 'bg-[#D4AF37]' : 'bg-[#D4AF37]/60'
      }`} />
      <div className={`w-1.5 h-1.5 rounded-full transition-colors ${
        completed ? 'bg-[#D4AF37]/50' : 'bg-[#D4AF37]/30'
      }`} />
      <div className={`w-1.5 h-1.5 rounded-full transition-colors ${
        completed ? 'bg-[#D4AF37]/50' : 'bg-[#D4AF37]/30'
      }`} />
    </div>
    {/* Direction arrows */}
    <div className="absolute flex w-full justify-between px-2 text-[#D4AF37]/20 text-[7px]">
      <span>←</span>
      <span>→</span>
    </div>
  </div>
);

/** TwoHandGather: two hands moving together */
const TwoHandGatherDemo: React.FC<{ completed: boolean }> = ({ completed }) => (
  <div className="relative w-full h-full flex items-center justify-center">
    {/* Timeline line */}
    <div className={`absolute h-px w-3/4 bg-gradient-to-r from-transparent via-[#D4AF37]/30 to-transparent transition-opacity ${
      completed ? 'opacity-30' : 'opacity-100'
    }`} />
    {/* Left hand */}
    <div className="absolute flex items-center justify-center"
      style={{ animation: completed ? 'none' : 'gesture-demo-gather-left 2.5s ease-in-out infinite' }}>
      <div className={`w-3 h-3 rounded-full transition-colors ${
        completed ? 'bg-[#D4AF37] shadow-[0_0_8px_rgba(212,175,55,0.5)]' : 'bg-[#D4AF37]/40'
      }`} />
    </div>
    {/* Central nebula core */}
    <div className={`w-4 h-4 rounded-full transition-all duration-500 ${
      completed
        ? 'bg-[#D4AF37] shadow-[0_0_15px_rgba(212,175,55,0.6)] scale-110'
        : 'bg-[#D4AF37]/15 scale-75'
    }`} />
    {/* Right hand */}
    <div className="absolute flex items-center justify-center"
      style={{ animation: completed ? 'none' : 'gesture-demo-gather-right 2.5s ease-in-out infinite' }}>
      <div className={`w-3 h-3 rounded-full transition-colors ${
        completed ? 'bg-[#D4AF37] shadow-[0_0_8px_rgba(212,175,55,0.5)]' : 'bg-[#D4AF37]/40'
      }`} />
    </div>
    {/* Gather arrows */}
    {completed && (
      <>
        <div className="absolute text-[#D4AF37]/30 text-[8px]" style={{ left: '14px' }}>→</div>
        <div className="absolute text-[#D4AF37]/30 text-[8px]" style={{ right: '14px' }}>←</div>
      </>
    )}
  </div>
);

/** Done: checkmark with floating elements */
const DoneDemo: React.FC = () => (
  <div className="relative w-full h-full flex items-center justify-center">
    {/* Floating orbs */}
    {[0, 1, 2].map(i => (
      <div key={i}
        className="absolute w-1.5 h-1.5 rounded-full bg-[#D4AF37]/20"
        style={{
          animation: 'gesture-demo-float 2.5s ease-in-out infinite',
          animationDelay: `${i * 0.3}s`,
          left: `${30 + i * 20}%`,
          top: `${20 + (i % 2) * 40}%`,
        }}
      />
    ))}
    {/* Checkmark circle */}
    <div className="w-10 h-10 rounded-full border-2 border-[#D4AF37] flex items-center justify-center"
      style={{ animation: 'gesture-demo-glow 2s ease-in-out infinite' }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 13l4 4L19 7"
          style={{
            strokeDasharray: 30,
            strokeDashoffset: 0,
            animation: 'gesture-demo-check 1s ease-out forwards',
          }}
        />
      </svg>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Step → component mapping
// ---------------------------------------------------------------------------

const STEP_COMPONENTS: Record<string, React.FC<{ completed: boolean }>> = {
  camera: CameraDemo,
  fist: FistDemo,
  openPalm: OpenPalmDemo,
  openPalmOrbit: OrbitDemo,
  pinch: PinchDemo,
  twoHandSpread: TwoHandSpreadDemo,
  chronoSwipe: ChronoSwipeDemo,
  twoHandGather: TwoHandGatherDemo,
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const GestureDemo: React.FC<GestureDemoProps> = ({
  step,
  completed = false,
  compact = false,
}) => {
  const DemoComponent = step === 'done' ? DoneDemo : STEP_COMPONENTS[step];
  const caption = step === 'done' ? CAPTIONS.done : (completed ? '已完成 ✓' : CAPTIONS[step] ?? '');

  return (
    <div className={`gesture-demo-container relative flex flex-col items-center gap-2 select-none ${
      compact ? 'w-24' : 'w-full max-w-[180px]'
    }`}>
      {/* Animation stage */}
      <div className={`gesture-demo-stage relative w-full aspect-square rounded-lg overflow-hidden transition-all duration-500 ${
        completed
          ? 'border border-[#D4AF37]/60 shadow-[0_0_20px_rgba(212,175,55,0.2)]'
          : 'border border-[#D4AF37]/15'
      }`}
        style={{
          background: 'radial-gradient(ellipse at center, rgba(212,175,55,0.03) 0%, rgba(0,0,0,0.4) 100%)',
        }}>
        {/* Background stars */}
        <div className="absolute inset-0 overflow-hidden opacity-30">
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i}
              className="absolute w-[1px] h-[1px] bg-[#D4AF37]/40 rounded-full"
              style={{
                left: `${10 + i * 17}%`,
                top: `${8 + (i * 13) % 80}%`,
              }}
            />
          ))}
        </div>

        {/* Step-specific animation */}
        {DemoComponent && <DemoComponent completed={completed} />}

        {/* Success glow overlay */}
        {completed && (
          <div className="absolute inset-0 bg-gradient-to-t from-[#D4AF37]/5 to-transparent pointer-events-none" />
        )}
      </div>

      {/* Caption */}
      <div className={`gesture-demo-caption text-center font-serif text-[10px] tracking-wider transition-colors duration-300 leading-tight ${
        completed ? 'text-[#D4AF37]' : 'text-[#D4AF37]/50'
      }`}>
        {caption}
      </div>
    </div>
  );
};
