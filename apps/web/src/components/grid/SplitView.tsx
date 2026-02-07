/**
 * SplitView - VSCode-style split panel layout component
 * Based on VSCode's SplitView implementation
 * Supports horizontal/vertical orientation, resizable views, and size constraints
 */

import {
  forwardRef,
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { type Orientation, Sash } from "./Sash";

/**
 * Layout priority for views during resize
 */
export enum LayoutPriority {
  Normal = 0,
  Low = 1,
  High = 2,
}

/**
 * Sizing strategy for adding/removing views
 */
export type Sizing =
  | { type: "distribute" }
  | { type: "split"; index: number }
  | { type: "auto"; index: number }
  | { type: "invisible"; cachedVisibleSize: number };

export namespace Sizing {
  /** Distribute space among all views */
  export const Distribute: Sizing = { type: "distribute" };

  /** Split space with a specific view */
  export function Split(index: number): Sizing {
    return { type: "split", index };
  }

  /** Auto-detect sizing strategy */
  export function Auto(index: number): Sizing {
    return { type: "auto", index };
  }

  /** View is invisible but has cached size */
  export function Invisible(cachedVisibleSize: number): Sizing {
    return { type: "invisible", cachedVisibleSize };
  }
}

/**
 * Interface for views within SplitView
 */
export interface IView {
  /** Unique identifier for the view */
  id: string;
  /** React element to render */
  element: ReactNode;
  /** Minimum size in pixels */
  minimumSize: number;
  /** Maximum size in pixels */
  maximumSize: number;
  /** Layout priority for resizing */
  priority?: LayoutPriority;
  /** Whether to use proportional layout */
  proportionalLayout?: boolean;
  /** Whether view snaps at minimum size */
  snap?: boolean;
  /** Initial size (optional, defaults to minimumSize) */
  size?: number;
  /** Whether the view is visible */
  visible?: boolean;
}

/**
 * Props for SplitView component
 */
export interface SplitViewProps {
  /** Orientation of the split */
  orientation?: Orientation;
  /** Initial size of the container */
  size?: number;
  /** Views to display */
  views?: IView[];
  /** Callback when view sizes change */
  onDidChange?: () => void;
  /** Enable proportional layout */
  proportionalLayout?: boolean;
  /** Additional class name */
  className?: string;
  /** Inline styles */
  style?: React.CSSProperties;
  /** Ref for imperative access */
  ref?: React.RefObject<SplitViewHandle | null>;
}

interface ViewState {
  view: IView;
  size: number;
  cachedVisibleSize?: number;
}

/**
 * SplitView component - one-dimensional flex-like layout with resizable views
 */
export const SplitView = forwardRef<SplitViewHandle, SplitViewProps>(function SplitView(
  {
    orientation = "vertical",
    size: containerSize = 0,
    views: propViews = [],
    onDidChange,
    proportionalLayout = true,
    className = "",
    style: containerStyle,
  },
  externalRef
) {
  const [views, setViews] = useState<ViewState[]>([]);
  const [sashes, setSashes] = useState<number[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const layoutContextRef = useRef<unknown>(undefined);
  const proportionsRef = useRef<(number | undefined)[]>([]);
  const onDidChangeRef = useRef(onDidChange);

  // Keep onDidChange ref updated
  useEffect(() => {
    onDidChangeRef.current = onDidChange;
  }, [onDidChange]);

  /**
   * Get current view sizes (for parent components to query)
   */
  const getViewSizes = useCallback(() => {
    return views.map((v) => v.size);
  }, [views]);

  // Initialize views from propViews
  useEffect(() => {
    if (propViews.length > 0) {
      const initialViews: ViewState[] = propViews.map((view) => {
        const initialSize = view.size ?? view.minimumSize;
        const visible = view.visible !== false;
        return {
          view,
          size: visible ? initialSize : 0,
          cachedVisibleSize: visible ? undefined : initialSize,
        };
      });
      setViews(initialViews);
      setSashes(
        propViews.length > 1 ? Array.from({ length: propViews.length - 1 }, (_, i) => i) : []
      );
    }
  }, [propViews]);

  /**
   * Get total content size (sum of all visible view sizes)
   */
  const contentSize = useMemo(() => {
    return views.reduce((sum, v) => sum + (v.cachedVisibleSize === undefined ? v.size : 0), 0);
  }, [views]);

  /**
   * Distribute empty space among flexible views
   */
  const distributeEmptySpace = useCallback((targetSize: number, lowPriorityIndex?: number) => {
    setViews((prevViews) => {
      const contentSize = prevViews.reduce(
        (sum, v) => sum + (v.cachedVisibleSize === undefined ? v.size : 0),
        0
      );
      let emptyDelta = targetSize - contentSize;

      // Build index array in reverse order
      let indexes = Array.from({ length: prevViews.length }, (_, i) => prevViews.length - 1 - i);

      // Sort by priority
      const lowPriorityIndexes = indexes.filter(
        (i) => prevViews[i].view.priority === LayoutPriority.Low
      );
      const highPriorityIndexes = indexes.filter(
        (i) => prevViews[i].view.priority === LayoutPriority.High
      );

      // High priority views first
      for (const index of highPriorityIndexes) {
        indexes = indexes.filter((i) => i !== index);
        indexes.unshift(index);
      }

      // Low priority views last
      for (const index of lowPriorityIndexes) {
        indexes = indexes.filter((i) => i !== index);
        indexes.push(index);
      }

      if (lowPriorityIndex !== undefined) {
        indexes = indexes.filter((i) => i !== lowPriorityIndex);
        indexes.push(lowPriorityIndex);
      }

      const newViews = [...prevViews];

      for (let i = 0; emptyDelta !== 0 && i < indexes.length; i++) {
        const index = indexes[i];
        const item = newViews[index];
        if (item.cachedVisibleSize !== undefined) continue;

        const minSize = item.view.minimumSize;
        const maxSize = item.view.maximumSize;
        const newSize = Math.max(minSize, Math.min(maxSize, item.size + emptyDelta));
        const viewDelta = newSize - item.size;

        emptyDelta -= viewDelta;
        item.size = newSize;
      }

      return newViews;
    });
  }, []);

  /**
   * Resize views based on delta
   */
  const resize = useCallback(
    (
      sashIndex: number,
      delta: number,
      lowPriorityIndexes?: number[],
      highPriorityIndexes?: number[]
    ) => {
      setViews((prevViews) => {
        const upIndexes = Array.from({ length: sashIndex + 1 }, (_, i) => sashIndex - i);
        const downIndexes = Array.from(
          { length: prevViews.length - sashIndex - 1 },
          (_, i) => sashIndex + 1 + i
        );

        // Apply priority sorting
        if (highPriorityIndexes) {
          for (const index of highPriorityIndexes) {
            if (upIndexes.includes(index)) {
              upIndexes.splice(upIndexes.indexOf(index), 1);
              upIndexes.unshift(index);
            }
            if (downIndexes.includes(index)) {
              downIndexes.splice(downIndexes.indexOf(index), 1);
              downIndexes.unshift(index);
            }
          }
        }

        if (lowPriorityIndexes) {
          for (const index of lowPriorityIndexes) {
            if (upIndexes.includes(index)) {
              upIndexes.splice(upIndexes.indexOf(index), 1);
              upIndexes.push(index);
            }
            if (downIndexes.includes(index)) {
              downIndexes.splice(downIndexes.indexOf(index), 1);
              downIndexes.push(index);
            }
          }
        }

        const newViews = [...prevViews];
        const sizes = newViews.map((v) => v.size);

        // Calculate min/max delta
        const minDeltaUp = upIndexes.reduce((sum, i) => {
          const item = newViews[i];
          return (
            sum + (item.cachedVisibleSize === undefined ? item.view.minimumSize - sizes[i] : 0)
          );
        }, 0);

        const maxDeltaUp = upIndexes.reduce((sum, i) => {
          const item = newViews[i];
          return (
            sum + (item.cachedVisibleSize === undefined ? item.view.maximumSize - sizes[i] : 0)
          );
        }, 0);

        const maxDeltaDown =
          downIndexes.length === 0
            ? Number.POSITIVE_INFINITY
            : downIndexes.reduce((sum, i) => {
                const item = newViews[i];
                return (
                  sum +
                  (item.cachedVisibleSize === undefined ? sizes[i] - item.view.minimumSize : 0)
                );
              }, 0);

        const minDeltaDown =
          downIndexes.length === 0
            ? Number.NEGATIVE_INFINITY
            : downIndexes.reduce((sum, i) => {
                const item = newViews[i];
                return (
                  sum +
                  (item.cachedVisibleSize === undefined ? sizes[i] - item.view.maximumSize : 0)
                );
              }, 0);

        const minDelta = Math.max(minDeltaUp, minDeltaDown);
        const maxDelta = Math.min(maxDeltaDown, maxDeltaUp);

        const clampedDelta = Math.max(minDelta, Math.min(maxDelta, delta));

        // Apply resize to up views
        let deltaUp = clampedDelta;
        for (const i of upIndexes) {
          const item = newViews[i];
          if (item.cachedVisibleSize !== undefined) continue;

          const minSize = item.view.minimumSize;
          const maxSize = item.view.maximumSize;
          const newSize = Math.max(minSize, Math.min(maxSize, sizes[i] + deltaUp));
          const viewDelta = newSize - sizes[i];

          deltaUp -= viewDelta;
          item.size = newSize;
        }

        // Apply resize to down views
        let deltaDown = clampedDelta;
        for (const i of downIndexes) {
          const item = newViews[i];
          if (item.cachedVisibleSize !== undefined) continue;

          const minSize = item.view.minimumSize;
          const maxSize = item.view.maximumSize;
          const newSize = Math.max(minSize, Math.min(maxSize, sizes[i] - deltaDown));
          const viewDelta = newSize - sizes[i];

          deltaDown += viewDelta;
          item.size = newSize;
        }

        return newViews;
      });

      onDidChangeRef.current?.();
    },
    [onDidChange]
  );

  /**
   * Save current proportions for proportional layout
   */
  const saveProportions = useCallback(() => {
    if (proportionalLayout && contentSize > 0) {
      proportionsRef.current = views.map((v) =>
        v.cachedVisibleSize === undefined && v.view.proportionalLayout !== false
          ? v.size / contentSize
          : undefined
      );
    }
  }, [proportionalLayout, contentSize, views]);

  /**
   * Add a view to the SplitView
   */
  const addView = useCallback(
    (view: IView, size: number | Sizing, index?: number) => {
      setViews((prevViews) => {
        const insertIndex = index ?? prevViews.length;

        let viewSize: number;
        let cachedVisibleSize: number | undefined;

        if (typeof size === "number") {
          viewSize = size;
        } else {
          switch (size.type) {
            case "split":
              viewSize = prevViews[size.index].size / 2;
              break;
            case "distribute":
              viewSize = view.minimumSize;
              break;
            case "invisible":
              viewSize = 0;
              cachedVisibleSize = size.cachedVisibleSize;
              break;
            case "auto":
              viewSize = view.minimumSize;
              break;
          }
        }

        const newViewState: ViewState = {
          view,
          size: viewSize,
          cachedVisibleSize,
        };

        const newViews = [...prevViews];
        newViews.splice(insertIndex, 0, newViewState);

        // Add sash if needed
        const newSashes =
          newViews.length > 1 ? Array.from({ length: newViews.length - 1 }, (_, i) => i) : [];

        setSashes(newSashes);

        return newViews;
      });

      onDidChangeRef.current?.();
    },
    [onDidChange]
  );

  /**
   * Remove a view from the SplitView
   */
  const removeView = useCallback(
    (index: number) => {
      setViews((prevViews) => {
        if (index < 0 || index >= prevViews.length) return prevViews;

        const newViews = prevViews.filter((_, i) => i !== index);

        // Update sashes
        const newSashes =
          newViews.length > 1 ? Array.from({ length: newViews.length - 1 }, (_, i) => i) : [];

        setSashes(newSashes);

        return newViews;
      });

      onDidChangeRef.current?.();
    },
    [onDidChange]
  );

  /**
   * Resize a specific view
   */
  const resizeView = useCallback(
    (index: number, size: number) => {
      setViews((prevViews) => {
        if (index < 0 || index >= prevViews.length) return prevViews;

        const newViews = [...prevViews];
        const item = newViews[index];
        const clampedSize = Math.max(item.view.minimumSize, Math.min(item.view.maximumSize, size));
        item.size = clampedSize;

        return newViews;
      });

      onDidChangeRef.current?.();
    },
    [onDidChange]
  );

  /**
   * Distribute view sizes equally
   */
  const distributeViewSizes = useCallback(() => {
    distributeEmptySpace(containerSize);
    saveProportions();
  }, [distributeEmptySpace, containerSize, saveProportions]);

  // Expose imperative methods via ref (must be after all method definitions)
  useImperativeHandle(
    externalRef,
    () => ({
      layout: (size: number) => {
        if (size > 0) {
          distributeEmptySpace(size);
        }
      },
      distributeViewSizes,
      addView,
      removeView,
      resizeView,
      getViewSizes,
    }),
    [distributeViewSizes, addView, removeView, resizeView, getViewSizes, distributeEmptySpace]
  );

  /**
   * Layout all views
   */
  useEffect(() => {
    if (containerSize > 0) {
      distributeEmptySpace(containerSize);
    }
  }, [containerSize, distributeEmptySpace]);

  // Save proportions when sizes change
  useEffect(() => {
    saveProportions();
  }, [saveProportions]);

  // Calculate view positions
  const viewPositions = useMemo(() => {
    let offset = 0;
    return views.map((view) => {
      const pos = offset;
      offset += view.size;
      return pos;
    });
  }, [views]);

  // Calculate sash positions
  const sashPositions = useMemo(() => {
    return sashes.map((sashIndex) => {
      let position = 0;
      for (let i = 0; i <= sashIndex; i++) {
        position += views[i]?.size ?? 0;
      }
      return position - (sashes.length > 0 ? 2 : 0); // Center the sash
    });
  }, [sashes, views]);

  /**
   * Check if sash is enabled (views can be resized)
   */
  const isSashEnabled = useCallback(
    (sashIndex: number) => {
      // Check if views on either side can be resized
      const canShrinkLeft = views[sashIndex]?.size > views[sashIndex]?.view.minimumSize;
      const canGrowLeft = views[sashIndex]?.size < views[sashIndex]?.view.maximumSize;
      const canShrinkRight = views[sashIndex + 1]?.size > views[sashIndex + 1]?.view.minimumSize;
      const canGrowRight = views[sashIndex + 1]?.size < views[sashIndex + 1]?.view.maximumSize;

      return (canShrinkLeft || canGrowLeft) && (canShrinkRight || canGrowRight);
    },
    [views]
  );

  // Render function
  const containerStyleCombined: React.CSSProperties = {
    ...containerStyle,
    position: "relative",
    display: "flex",
    flexDirection: orientation === "vertical" ? "column" : "row",
    overflow: "hidden",
  };

  return (
    <div
      ref={containerRef}
      className={`split-view split-view-${orientation} ${className}`}
      style={containerStyleCombined}
    >
      {/* Render views */}
      {views.map((viewState, index) => {
        const isVisible = viewState.cachedVisibleSize === undefined;
        if (!isVisible) return null;

        const position = viewPositions[index];
        const size = viewState.size;

        const viewStyle: React.CSSProperties = {
          position: "absolute",
          flexShrink: 0,
          overflow: "hidden",
        };

        if (orientation === "vertical") {
          viewStyle.top = `${position}px`;
          viewStyle.left = "0";
          viewStyle.right = "0";
          viewStyle.height = `${size}px`;
        } else {
          viewStyle.left = `${position}px`;
          viewStyle.top = "0";
          viewStyle.bottom = "0";
          viewStyle.width = `${size}px`;
        }

        return (
          <div key={viewState.view.id} className="split-view-view" style={viewStyle}>
            {viewState.view.element}
          </div>
        );
      })}

      {/* Render sashes */}
      {sashes.map((sashIndex) => {
        const position = sashPositions[sashIndex];
        const enabled = isSashEnabled(sashIndex);

        return (
          <Sash
            key={sashIndex}
            orientation={orientation}
            enabled={enabled}
            position={position}
            onDragStart={() => {
              // Disable pointer events on views during drag
              const viewElements = containerRef.current?.querySelectorAll(".split-view-view");
              viewElements?.forEach((el) => {
                (el as HTMLElement).style.pointerEvents = "none";
              });
            }}
            onDrag={(delta) => {
              resize(sashIndex, delta);
            }}
            onDragEnd={() => {
              // Re-enable pointer events on views
              const viewElements = containerRef.current?.querySelectorAll(".split-view-view");
              viewElements?.forEach((el) => {
                (el as HTMLElement).style.pointerEvents = "";
              });
              saveProportions();
            }}
          />
        );
      })}
    </div>
  );
});

/**
 * Hook to access SplitView methods imperatively
 */
export function useSplitView(ref: React.RefObject<SplitViewHandle>) {
  return ref.current;
}

/**
 * Handle for imperative SplitView methods
 */
export interface SplitViewHandle {
  layout: (size: number) => void;
  distributeViewSizes: () => void;
  addView: (view: IView, size: number | Sizing, index?: number) => void;
  removeView: (index: number) => void;
  resizeView: (index: number, size: number) => void;
  getViewSizes: () => number[];
}

export const MemoizedSplitView = memo(SplitView);
