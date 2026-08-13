"use client";

import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

/**
 * One drag sensor configuration, shared by every sortable list in the app.
 *
 * Three decisions are baked in, each of which was a real defect before:
 *
 * `PointerSensor` handles mouse, touch and pen through a single code path.
 * A mouse-only sensor ignores stylus input; a touch-only sensor ignores a
 * trackpad. Installed on a touch-screen laptop or a tablet, the app needs both,
 * and PointerSensor is the one API that covers them.
 *
 * The 8px activation distance is what separates a tap from a drag. Without it
 * the sensor claims the very first `pointerdown` on a handle, so a plain tap
 * registers as a zero-length drag and — worse — a scroll gesture that happens
 * to begin on a row never scrolls the list at all. Eight pixels of travel is
 * the industry-standard threshold: below it the gesture is still a tap.
 *
 * The keyboard sensor is not a nicety. It is the only way to reorder a list
 * without a pointing device, and the only path that works with a screen reader.
 *
 * Handles must additionally carry `touch-none` (`touch-action: none`) so the
 * browser hands the gesture to us rather than scrolling the page out from
 * underneath it.
 */
export function useSortableSensors() {
  return useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
}
