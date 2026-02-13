export type StatusBarDensity = "full" | "compact" | "minimal";

const STATUSBAR_MINIMAL_BREAKPOINT = 900;
const STATUSBAR_COMPACT_BREAKPOINT = 1500;

export function getStatusBarDensity(width: number): StatusBarDensity {
  if (width <= STATUSBAR_MINIMAL_BREAKPOINT) {
    return "minimal";
  }
  if (width <= STATUSBAR_COMPACT_BREAKPOINT) {
    return "compact";
  }
  return "full";
}

export function computeVisibleMenuCount(
  itemWidths: number[],
  availableWidth: number,
  overflowButtonWidth: number
): number {
  if (itemWidths.length === 0 || availableWidth <= 0) {
    return 0;
  }

  const totalWidth = itemWidths.reduce((sum, width) => sum + Math.max(0, width), 0);
  if (totalWidth <= availableWidth) {
    return itemWidths.length;
  }

  let used = 0;
  let visible = 0;

  for (let index = 0; index < itemWidths.length; index += 1) {
    const width = Math.max(0, itemWidths[index]);
    const nextUsed = used + width;
    const remainingItems = itemWidths.length - (index + 1);
    const needsOverflow = remainingItems > 0;
    const budget = availableWidth - (needsOverflow ? overflowButtonWidth : 0);

    if (nextUsed > budget) {
      break;
    }

    used = nextUsed;
    visible += 1;
  }

  return Math.max(0, Math.min(visible, itemWidths.length));
}
