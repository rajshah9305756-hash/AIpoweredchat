import { useState, useEffect } from "react";

/**
 * Breakpoint values matching Tailwind CSS defaults
 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * Get the current breakpoint based on window width
 */
function getCurrentBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINTS["2xl"]) return "2xl";
  if (width >= BREAKPOINTS.xl) return "xl";
  if (width >= BREAKPOINTS.lg) return "lg";
  if (width >= BREAKPOINTS.md) return "md";
  return "sm";
}

/**
 * Check if current screen matches a specific breakpoint or larger
 */
function isBreakpointOrLarger(width: number, breakpoint: Breakpoint): boolean {
  const breakpointValue = BREAKPOINTS[breakpoint];
  return width >= breakpointValue;
}

/**
 * Custom hook to detect screen size and breakpoints
 * 
 * @returns Object with current breakpoint and helper functions
 * 
 * @example
 * ```tsx
 * const { breakpoint, isMobile, isTablet, isDesktop, isLgDesktop } = useResponsive();
 * 
 * if (isMobile) {
 *   // Render mobile-specific UI
 * }
 * ```
 */
export function useResponsive() {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
  });

  const [breakpoint, setBreakpoint] = useState<Breakpoint>(
    typeof window !== "undefined" ? getCurrentBreakpoint(window.innerWidth) : "sm"
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
      setBreakpoint(getCurrentBreakpoint(window.innerWidth));
    };

    // Set initial values
    handleResize();

    // Add event listener
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Helper booleans for common breakpoints
  const isMobile = !isBreakpointOrLarger(windowSize.width, "md");
  const isTablet = isBreakpointOrLarger(windowSize.width, "md") && 
    !isBreakpointOrLarger(windowSize.width, "lg");
  const isDesktop = isBreakpointOrLarger(windowSize.width, "lg") && 
    !isBreakpointOrLarger(windowSize.width, "xl");
  const isLgDesktop = isBreakpointOrLarger(windowSize.width, "xl");
  
  // Specific breakpoint checks
  const isSm = !isBreakpointOrLarger(windowSize.width, "sm");
  const isMd = isBreakpointOrLarger(windowSize.width, "md");
  const isLg = isBreakpointOrLarger(windowSize.width, "lg");
  const isXl = isBreakpointOrLarger(windowSize.width, "xl");
  const is2Xl = isBreakpointOrLarger(windowSize.width, "2xl");

  return {
    // Current values
    width: windowSize.width,
    height: windowSize.height,
    breakpoint,
    
    // Boolean checks
    isSm,
    isMd,
    isLg,
    isXl,
    is2Xl,
    
    // Convenience helpers
    isMobile,    // < 768px
    isTablet,    // 768px - 1023px
    isDesktop,   // 1024px - 1279px
    isLgDesktop, // >= 1280px
    
    // Check if at least a specific breakpoint
    isAtLeast: (bp: Breakpoint) => isBreakpointOrLarger(windowSize.width, bp),
    
    // Check if smaller than a specific breakpoint
    isSmallerThan: (bp: Breakpoint) => windowSize.width < BREAKPOINTS[bp],
  };
}

/**
 * Simple hook to check if screen is mobile (< 768px)
 * More efficient than useResponsive if you only need mobile detection
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkMobile = () => {
      setIsMobile(window.innerWidth < BREAKPOINTS.md);
    };

    // Initial check
    checkMobile();

    // Add resize listener
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return !!isMobile;
}

/**
 * Hook to check if screen is tablet (768px - 1024px)
 */
export function useIsTablet() {
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkTablet = () => {
      const width = window.innerWidth;
      setIsTablet(width >= BREAKPOINTS.md && width < BREAKPOINTS.lg);
    };

    checkTablet();
    window.addEventListener("resize", checkTablet);

    return () => window.removeEventListener("resize", checkTablet);
  }, []);

  return isTablet;
}

/**
 * Hook to check if screen is desktop (>= 1024px)
 */
export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= BREAKPOINTS.lg);
    };

    checkDesktop();
    window.addEventListener("resize", checkDesktop);

    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  return isDesktop;
}
