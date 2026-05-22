import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { TutorialStepId, TutorialGestureState } from '../types';
import { GestureDemo } from './GestureDemo';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How long a gesture must be held steadily before the step is considered complete */
const STEP_HOLD_MS = 500;

interface StepDef {
  id: TutorialStepId;
  title: string;
  description: string;
  hint?: string;
}

const STEPS: StepDef[] = [
  {
    id: 'camera',
    title: '让星云看见你的手',
    description: '把一只手放到摄像头前，保持在画面中。',
    hint: '如果没有看到摄像头画面，请允许浏览器访问摄像头。',
  },
  {
    id: 'fist',
    title: '握拳，收拢记忆核心',
    description: '握紧拳头，可以把星云收回核心；当你打开一段回忆时，也可以用握拳关闭它。',
  },
  {
    id: 'openPalm',
    title: '张开手掌，释放记忆星云',
    description: '张开手掌，像把回忆从核心中释放出来。',
  },
  {
    id: 'openPalmOrbit',
    title: '张开手掌画一个圈，环绕探索星云',
    description: '保持张开手掌，在摄像头前缓慢画一个圈，学习从不同角度探索照片。',
  },
  {
    id: 'pinch',
    title: '捏合手指，取出一段回忆',
    description: '用大拇指和食指捏合，其余三根手指自然展开。',
  },
  {
    id: 'twoHandSpread',
    title: '展开双手，整理成时间流',
    description: '将双手从中间向两侧展开，把散落的回忆整理成时间长河。',
  },
  {
    id: 'chronoSwipe',
    title: '左右挥手，浏览时间流',
    description: '在时间流中，向左或向右扫动手掌，切换上一段或下一段回忆。',
  },
  {
    id: 'twoHandGather',
    title: '合拢双手，回到记忆星云',
    description: '将双手从两侧向中间合拢，让时间流重新回到星云。',
  },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GestureOnboardingProps {
  open: boolean;
  tutorialGestureState: TutorialGestureState;
  onComplete: (dontShowAgain: boolean) => void;
  onSkip: (dontShowAgain: boolean) => void;
  /** v0.6.5: Report current step to parent for step-specific gesture detection */
  onStepChange?: (step: TutorialStepId | undefined) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const GestureOnboarding: React.FC<GestureOnboardingProps> = ({
  open,
  tutorialGestureState,
  onComplete,
  onSkip,
  onStepChange,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  // Once a step is completed, it stays in this set forever (locked).
  const [completedSteps, setCompletedSteps] = useState<Set<TutorialStepId>>(new Set());
  const [holdProgress, setHoldProgress] = useState(0);

  const holdStartRef = useRef(0);
  const prevStepRef = useRef(currentStepIndex);

  const totalSteps = STEPS.length;
  const isDone = currentStepIndex >= totalSteps;
  const currentStep = isDone ? null : STEPS[currentStepIndex];
  // Whether the current step has already been completed (locked).
  const isStepCompleted = currentStep ? completedSteps.has(currentStep.id) : false;

  // Reset everything when onboarding opens
  useEffect(() => {
    if (open) {
      setCurrentStepIndex(0);
      setCompletedSteps(new Set());
      setHoldProgress(0);
      holdStartRef.current = 0;
    }
  }, [open]);

  // ------------------------------------------------------------------
  // Check step completion from gesture state (pure, no side-effects)
  // ------------------------------------------------------------------
  const checkStepComplete = useCallback((state: TutorialGestureState, step: TutorialStepId): boolean => {
    switch (step) {
      case 'camera':
        return state.handDetected === true;
      case 'fist':
        return state.fistDetected === true;
      case 'openPalm':
        return state.openPalmDetected === true;
      case 'openPalmOrbit':
        return state.openPalmOrbitProgress >= 1;
      case 'pinch':
        return state.pinchDetected === true;
      case 'twoHandSpread':
        return state.twoHandSpreadProgress >= 1;
      case 'chronoSwipe':
        return state.chronoSwipeLeftDetected === true && state.chronoSwipeRightDetected === true;
      case 'twoHandGather':
        return state.twoHandGatherProgress >= 1;
      default:
        return false;
    }
  }, []);

  // ------------------------------------------------------------------
  // Get 0..1 progress for the step's progress bar
  // ------------------------------------------------------------------
  const getStepProgress = useCallback((state: TutorialGestureState, step: TutorialStepId): number => {
    switch (step) {
      case 'camera':
        return state.handDetected ? 1 : 0;
      case 'fist':
        return state.fistDetected ? 1 : 0;
      case 'openPalm':
        return state.openPalmDetected ? 1 : 0;
      case 'openPalmOrbit':
        return state.openPalmOrbitProgress;
      case 'pinch':
        return state.pinchDetected ? 1 : (state.rawPinch ? 0.5 : 0);
      case 'twoHandSpread':
        return state.twoHandSpreadProgress;
      case 'chronoSwipe':
        return state.chronoSwipeProgress;
      case 'twoHandGather':
        return state.twoHandGatherProgress;
      default:
        return 0;
    }
  }, []);

  // ------------------------------------------------------------------
  // Monitor gesture state → track hold progress & mark step complete
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!open || isDone || !currentStep || isStepCompleted) return;

    const stepId = currentStep.id;
    const isMet = checkStepComplete(tutorialGestureState, stepId);

    // For openPalmOrbit, twoHandSpread, chronoSwipe, and twoHandGather, use direct progress from state (no extra hold needed)
    if (stepId === 'openPalmOrbit' || stepId === 'twoHandSpread' || stepId === 'chronoSwipe' || stepId === 'twoHandGather') {
      const p = getStepProgress(tutorialGestureState, stepId);
      setHoldProgress(p);
      if (p >= 1) {
        // Mark completed — locked, won't revert
        setCompletedSteps((prev) => new Set(prev).add(stepId));
        setHoldProgress(1);
        holdStartRef.current = 0;
      }
      return;
    }

    // For camera/fist/openPalm/pinch: need steady hold time
    if (isMet) {
      const now = performance.now();
      if (holdStartRef.current === 0) {
        holdStartRef.current = now;
      }
      const elapsed = now - holdStartRef.current;
      const progress = Math.min(1, elapsed / STEP_HOLD_MS);
      setHoldProgress(progress);

      if (elapsed >= STEP_HOLD_MS) {
        setCompletedSteps((prev) => new Set(prev).add(stepId));
        setHoldProgress(1);
        holdStartRef.current = 0;
      }
    } else {
      holdStartRef.current = 0;
      setHoldProgress(0);
    }
  }, [tutorialGestureState, open, isDone, currentStep, isStepCompleted, checkStepComplete, getStepProgress]);

  // Track step changes
  useEffect(() => {
    prevStepRef.current = currentStepIndex;
  }, [currentStepIndex]);

  // v0.6.5: Report step changes to parent (for GestureController detection logic)
  useEffect(() => {
    onStepChange?.(currentStep?.id);
  }, [currentStepIndex, onStepChange]);

  // ------------------------------------------------------------------
  // Callbacks
  // ------------------------------------------------------------------
  const handleSkip = () => onSkip(dontShowAgain);
  const handleComplete = () => onComplete(dontShowAgain);
  const handleNext = () => {
    if (currentStep) {
      setCompletedSteps((prev) => new Set(prev).add(currentStep.id));
    }
    setCurrentStepIndex((prev) => prev + 1);
    holdStartRef.current = 0;
    setHoldProgress(0);
  };

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip(dontShowAgain);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dontShowAgain, onSkip]);

  if (!open) return null;

  // ------------------------------------------------------------------
  // Pinch feedback text
  // ------------------------------------------------------------------
  const getPinchFeedback = (): string | null => {
    if (currentStep?.id !== 'pinch') return null;
    const s = tutorialGestureState;
    if (s.pinchDetected) return '捏合成功！保持住...';
    if (s.rawPinch && !s.pinchPostureOk) return '保持中指、无名指和小指展开，会更容易识别。';
    if (s.rawPinch && s.pinchPostureOk) return '捏合正确，继续保持...';
    if (s.pinchRatio !== undefined && s.pinchRatio < 0.8 && s.pinchRatio >= 0.5) return '让大拇指和食指再靠近一点。';
    return null;
  };

  const pinchFeedback = getPinchFeedback();

  // ------------------------------------------------------------------
  // Hand animation for current step
  // ------------------------------------------------------------------
  const renderHandAnimation = () => {
    if (isDone) return null;
    const sid = currentStep!.id;

    switch (sid) {
      case 'camera':
        return (
          <div className="flex items-center justify-center gap-1.5 h-16">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-3 h-3 rounded-full bg-[#D4AF37]/40 animate-pulse"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        );

      case 'fist':
        return (
          <div className="flex items-center justify-center h-16">
            <div className="w-10 h-10 rounded-full border-2 border-[#D4AF37]/50 bg-[#D4AF37]/20 animate-pulse" />
          </div>
        );

      case 'openPalm':
        return (
          <div className="flex items-center justify-center gap-2 h-16">
            {[0, 1, 2, 3, 4].map((i) => {
              const angle = (i - 2) * 25;
              const dist = 18 + i * 4;
              return (
                <div
                  key={i}
                  className="w-3 h-3 rounded-full bg-[#D4AF37]/60 animate-pulse"
                  style={{
                    transform: `translate(${Math.sin((angle * Math.PI) / 180) * dist}px, ${-Math.cos((angle * Math.PI) / 180) * dist}px)`,
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              );
            })}
          </div>
        );

      case 'openPalmOrbit':
        return (
          <div className="flex items-center justify-center h-16 relative">
            {/* Orbiting dot */}
            <div className="w-2 h-2 rounded-full bg-[#D4AF37]/80 absolute"
              style={{
                animation: 'tutorialOrbit 2.5s linear infinite',
              }}
            />
            {/* Orbit ring */}
            <div className="w-14 h-14 rounded-full border border-[#D4AF37]/20 absolute" />
            <style>{`
              @keyframes tutorialOrbit {
                0% { transform: translate(0, -28px); }
                25% { transform: translate(28px, 0); }
                50% { transform: translate(0, 28px); }
                75% { transform: translate(-28px, 0); }
                100% { transform: translate(0, -28px); }
              }
            `}</style>
          </div>
        );

      case 'pinch':
        return (
          <div className="flex items-center justify-center gap-3 h-16">
            <div
              className="w-4 h-4 rounded-full bg-[#D4AF37]/60 transition-all duration-300"
              style={tutorialGestureState.rawPinch ? { transform: 'translateX(6px)' } : { transform: 'translateX(0)' }}
            />
            <div
              className="w-4 h-4 rounded-full bg-[#D4AF37]/60 transition-all duration-300"
              style={tutorialGestureState.rawPinch ? { transform: 'translateX(-6px)' } : { transform: 'translateX(0)' }}
            />
          </div>
        );

      case 'twoHandSpread':
        return (
          <div className="flex items-center justify-center gap-6 h-16 relative">
            <div
              className="w-8 h-8 rounded-full border-2 border-[#D4AF37]/50 bg-[#D4AF37]/10 transition-all duration-500"
              style={tutorialGestureState.twoHandsDetected
                ? { transform: `translateX(${-12 - tutorialGestureState.twoHandSpreadProgress * 20}px)` }
                : {}}
            />
            <div
              className="w-8 h-8 rounded-full border-2 border-[#D4AF37]/50 bg-[#D4AF37]/10 transition-all duration-500"
              style={tutorialGestureState.twoHandsDetected
                ? { transform: `translateX(${12 + tutorialGestureState.twoHandSpreadProgress * 20}px)` }
                : {}}
            />
          </div>
        );

      case 'chronoSwipe':
        return (
          <div className="flex items-center justify-center h-16 relative">
            <div
              className="w-8 h-8 rounded-full border-2 border-[#D4AF37]/50 bg-[#D4AF37]/10 transition-all duration-300"
              style={{
                animation: 'tutorialSwipe 1.8s ease-in-out infinite',
              }}
            />
            <style>{`
              @keyframes tutorialSwipe {
                0%, 100% { transform: translateX(-30px); opacity: 0.4; }
                25% { transform: translateX(0); opacity: 1; }
                50% { transform: translateX(30px); opacity: 0.4; }
                75% { transform: translateX(0); opacity: 1; }
              }
            `}</style>
          </div>
        );

      case 'twoHandGather':
        return (
          <div className="flex items-center justify-center gap-6 h-16 relative">
            <div
              className="w-8 h-8 rounded-full border-2 border-[#D4AF37]/50 bg-[#D4AF37]/10 transition-all duration-500"
              style={tutorialGestureState.twoHandsDetected
                ? { transform: `translateX(${12 - tutorialGestureState.twoHandGatherProgress * 20}px)` }
                : { transform: 'translateX(-20px)' }}
            />
            <div
              className="w-8 h-8 rounded-full border-2 border-[#D4AF37]/50 bg-[#D4AF37]/10 transition-all duration-500"
              style={tutorialGestureState.twoHandsDetected
                ? { transform: `translateX(${-12 + tutorialGestureState.twoHandGatherProgress * 20}px)` }
                : { transform: 'translateX(20px)' }}
            />
          </div>
        );

      default:
        return null;
    }
  };

  // ------------------------------------------------------------------
  // Progress: once step is completed, always show 100%
  // ------------------------------------------------------------------
  const displayProgress = isStepCompleted ? 1 : (holdProgress > 0 ? holdProgress : getStepProgress(tutorialGestureState, currentStep?.id ?? 'camera'));

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-auto">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

      {/* Card */}
      <div className={`relative z-10 w-[min(90vw,480px)] max-h-[85vh] overflow-y-auto
        bg-black/80 backdrop-blur-xl
        border ${isStepCompleted ? 'border-[#D4AF37]/60' : 'border-[#D4AF37]/30'}
        shadow-[0_0_60px_rgba(212,175,55,0.1)]
        px-8 py-8
        flex flex-col items-center gap-5
        animate-fade-in`}>

        {/* Gold decorative line top */}
        <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/40 to-transparent" />

        {/* Done page */}
        {isDone ? (
          <>
            {/* Gesture demo completion animation */}
            <GestureDemo step="done" completed />

            <h2 className="text-xl font-serif text-[#D4AF37] tracking-wider text-center">
              你已经学会主要手势
            </h2>
            <p className="text-[#F5E6BF]/50 font-serif text-sm tracking-wider text-center leading-relaxed">
              现在你已学会全部 8 个手势，可以进入记忆星云，开始探索。
            </p>

            <div className="flex flex-col items-center gap-3 w-full mt-2">
              <label className="flex items-center gap-2 text-[#D4AF37]/50 font-serif text-xs tracking-wider cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                  className="w-3.5 h-3.5 border-[#D4AF37]/40 bg-transparent rounded accent-[#D4AF37]"
                />
                不再提醒
              </label>
              <button
                onClick={handleComplete}
                className="w-full py-3 border border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37] font-serif text-sm tracking-[0.15em] hover:bg-[#D4AF37]/20 hover:shadow-[0_0_30px_rgba(212,175,55,0.2)] transition-all duration-300"
              >
                开始探索
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Step indicator */}
            <div className="flex items-center gap-2">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    i < currentStepIndex
                      ? 'bg-[#D4AF37]'
                      : i === currentStepIndex
                        ? 'bg-[#D4AF37] animate-pulse'
                        : 'bg-[#D4AF37]/20'
                  }`}
                />
              ))}
            </div>
            <p className="text-[#D4AF37]/40 font-serif text-[10px] tracking-[0.15em]">
              {currentStepIndex + 1} / {totalSteps}
            </p>

            {/* Title */}
            <h2 className="text-lg font-serif text-[#D4AF37] tracking-wider text-center leading-snug">
              {currentStep!.title}
            </h2>

            {/* Description */}
            <p className="text-[#F5E6BF]/55 font-serif text-sm tracking-wider text-center leading-relaxed">
              {currentStep!.description}
            </p>

            {/* Gesture demo animation */}
            <GestureDemo step={currentStep!.id} completed={isStepCompleted} compact />

            {/* Progress bar — locked at 100% when completed */}
            <div className="w-full h-1 bg-[#D4AF37]/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-150 ${
                  isStepCompleted
                    ? 'bg-[#D4AF37] w-full'
                    : 'bg-gradient-to-r from-[#D4AF37]/60 to-[#E8C860]/80'
                }`}
                style={isStepCompleted ? {} : { width: `${Math.round(displayProgress * 100)}%` }}
              />
            </div>

            {/* Real-time feedback */}
            <div className="min-h-[2rem] flex flex-col items-center gap-1">
              {isStepCompleted ? (
                <>
                  <p className="text-[#D4AF37] font-serif text-sm tracking-wider animate-fade-in">
                    ✓ 成功！你已经完成这个动作。
                  </p>
                  <p className="text-[#D4AF37]/40 font-serif text-[10px] tracking-wider">
                    点击下方的"下一步"继续
                  </p>
                </>
              ) : (
                <>
                  {currentStep?.id === 'openPalmOrbit' && (
                    <div className="flex flex-col gap-1 w-full px-2">
                      <p className="text-[#D4AF37]/60 font-serif text-[10px] tracking-wider text-center">
                        请保持张开手掌画一个圈
                      </p>
                      <div className="flex items-center justify-center gap-3 text-[10px] font-mono">
                        <span className={tutorialGestureState.openPalmOrbitVisitedQuadrants >= 1 ? 'text-[#D4AF37]' : 'text-[#D4AF37]/30'}>
                          ↕ {Math.round(tutorialGestureState.openPalmOrbitPathLength * 100)}%
                        </span>
                        <span className={tutorialGestureState.openPalmOrbitVisitedQuadrants >= 3 ? 'text-[#D4AF37]' : 'text-[#D4AF37]/30'}>
                          ◇ {tutorialGestureState.openPalmOrbitVisitedQuadrants}/3方向
                        </span>
                      </div>
                    </div>
                  )}
                  {currentStep?.id === 'chronoSwipe' && (
                    <div className="flex flex-col gap-1.5 w-full px-2">
                      <div className={`flex items-center gap-2 text-xs font-serif tracking-wider ${
                        tutorialGestureState.chronoSwipeLeftDetected
                          ? 'text-[#D4AF37]'
                          : 'text-[#D4AF37]/40'
                      }`}>
                        <span>{tutorialGestureState.chronoSwipeLeftDetected ? '✓' : '○'}</span>
                        <span>向左扫</span>
                      </div>
                      <div className={`flex items-center gap-2 text-xs font-serif tracking-wider ${
                        tutorialGestureState.chronoSwipeRightDetected
                          ? 'text-[#D4AF37]'
                          : 'text-[#D4AF37]/40'
                      }`}>
                        <span>{tutorialGestureState.chronoSwipeRightDetected ? '✓' : '○'}</span>
                        <span>向右扫</span>
                      </div>
                    </div>
                  )}
                  {pinchFeedback && (
                    <p className="text-[#D4AF37]/60 font-serif text-xs tracking-wider text-center">
                      {pinchFeedback}
                    </p>
                  )}
                  {currentStep!.hint && (
                    <p className="text-[#F5E6BF]/30 font-serif text-[10px] tracking-wider text-center">
                      {currentStep!.hint}
                    </p>
                  )}
                  <p className="text-[#D4AF37]/30 font-serif text-[10px] tracking-wider text-center">
                    {tutorialGestureState.handDetected
                      ? (tutorialGestureState.twoHandsDetected ? '检测到双手' : `检测到手 | 手势: ${tutorialGestureState.rawGesture ?? '...'}`)
                      : '等待检测到手...'}
                  </p>
                </>
              )}
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-3 w-full mt-1">
              <label className="flex items-center gap-1.5 text-[#D4AF37]/40 font-serif text-[10px] tracking-wider cursor-pointer select-none whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                  className="w-3 h-3 border-[#D4AF37]/30 bg-transparent rounded accent-[#D4AF37]"
                />
                不再提醒
              </label>
              <div className="flex-1" />
              <button
                onClick={handleSkip}
                className="px-4 py-2 border border-[#D4AF37]/20 text-[#D4AF37]/40 font-serif text-xs tracking-wider hover:border-[#D4AF37]/40 hover:text-[#D4AF37]/70 transition-all duration-300"
              >
                跳过
              </button>

              {isStepCompleted ? (
                <button
                  onClick={handleNext}
                  className="px-5 py-2 border border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37] font-serif text-xs tracking-wider hover:bg-[#D4AF37]/20 hover:shadow-[0_0_20px_rgba(212,175,55,0.2)] transition-all duration-300"
                >
                  下一步
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="px-4 py-2 border border-[#D4AF37]/30 text-[#D4AF37]/40 font-serif text-xs tracking-wider hover:border-[#D4AF37]/60 hover:text-[#D4AF37]/60 transition-all duration-300"
                >
                  跳过此步
                </button>
              )}
            </div>
          </>
        )}

        {/* Gold decorative line bottom */}
        <div className="absolute bottom-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/40 to-transparent" />
      </div>
    </div>
  );
};
