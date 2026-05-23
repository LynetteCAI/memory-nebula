# Gesture System

The gesture system uses MediaPipe Hand Landmarker to track hand landmarks
in real-time via the device camera. Gesture recognition runs locally —
no video data is ever uploaded.

## Nebula Mode

| Gesture | Action |
|---|---|
| Fist | Collapse memory core (FORMED); close opened memory detail |
| Open palm | Release memory nebula (CHAOS) |
| Open palm + orbit (move in circle) | Rotate and explore the nebula viewpoint |
| Pinch (thumb + index finger) | Open the currently selected memory |
| Two-hand spread (hands apart) | Enter Chrono Stream |

## Chrono Stream Mode

| Gesture | Action |
|---|---|
| Swipe left | Navigate to previous memory |
| Swipe right | Navigate to next memory |
| Pinch (thumb + index finger) | Open the focused memory |
| Fist | Close opened memory detail |
| Two-hand gather (hands together) | Return to nebula mode |

## Onboarding Mode

When `tutorialMode` is active:

- MediaPipe hand detection remains running to track gesture progress.
- Real app-level actions (mode switches, memory opening) are blocked.
- The tutorial reuses the same real gesture detection logic wherever possible,
  ensuring the user practices the actual gestures they will use later.
- Progress is reported back via the `onTutorialGestureStateChange` callback.

## Implementation Details

- Gesture recognition runs inside `GestureController.tsx` (~2070 lines).
- A requestAnimationFrame loop processes each video frame through MediaPipe.
- Stabilization logic ensures gestures are held long enough before triggering.
- Cooldowns prevent accidental re-triggering.
- Debug HUD can be enabled via the `DEBUG_GESTURES` constant.

## Detection Modules (all in GestureController.tsx)

- **Fist / Open palm**: landmark angle-based classification
- **Pinch**: distance ratio between thumb tip and index finger tip
- **Swipe**: palm position history analysis over time
- **Two-hand spread**: distance between two hands increasing
- **Two-hand gather**: distance between two hands decreasing
- **Open palm orbit**: palm movement path tracking (quadrant-based)
