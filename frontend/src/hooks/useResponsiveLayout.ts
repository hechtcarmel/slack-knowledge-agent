import { useState, useEffect, useCallback } from 'react';

export interface ResponsiveBreakpoints {
  mobile: number;
  tablet: number;
  desktop: number;
}

export interface ResponsiveLayoutState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenWidth: number;
  screenHeight: number;
  orientation: 'portrait' | 'landscape';
}

const DEFAULT_BREAKPOINTS: ResponsiveBreakpoints = {
  mobile: 768,
  tablet: 1024,
  desktop: 1280,
};

/**
 * Custom hook for managing responsive layout behavior
 * Provides screen size detection, orientation, and mobile/desktop state management
 */
export function useResponsiveLayout(
  breakpoints: ResponsiveBreakpoints = DEFAULT_BREAKPOINTS
) {
  // Mobile sidebar state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Screen size state
  const [layoutState, setLayoutState] = useState<ResponsiveLayoutState>(() => {
    if (typeof window === 'undefined') {
      // SSR fallback
      return {
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        screenWidth: 1024,
        screenHeight: 768,
        orientation: 'landscape',
      };
    }

    const width = window.innerWidth;
    const height = window.innerHeight;

    return {
      isMobile: width < breakpoints.mobile,
      isTablet: width >= breakpoints.mobile && width < breakpoints.desktop,
      isDesktop: width >= breakpoints.desktop,
      screenWidth: width,
      screenHeight: height,
      orientation: width > height ? 'landscape' : 'portrait',
    };
  });

  // Update layout state when window resizes
  useEffect(() => {
    const updateLayoutState = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      setLayoutState({
        isMobile: width < breakpoints.mobile,
        isTablet: width >= breakpoints.mobile && width < breakpoints.desktop,
        isDesktop: width >= breakpoints.desktop,
        screenWidth: width,
        screenHeight: height,
        orientation: width > height ? 'landscape' : 'portrait',
      });
    };

    // Debounce resize events
    let timeoutId: number;
    const debouncedUpdateLayoutState = () => {
      clearTimeout(timeoutId);
      timeoutId = window.setTimeout(updateLayoutState, 150);
    };

    window.addEventListener('resize', debouncedUpdateLayoutState);
    window.addEventListener('orientationchange', debouncedUpdateLayoutState);

    return () => {
      window.removeEventListener('resize', debouncedUpdateLayoutState);
      window.removeEventListener(
        'orientationchange',
        debouncedUpdateLayoutState
      );
      clearTimeout(timeoutId);
    };
  }, [breakpoints]);

  // Auto-close mobile sidebar when switching to desktop
  useEffect(() => {
    if (layoutState.isDesktop && isMobileSidebarOpen) {
      setIsMobileSidebarOpen(false);
    }
  }, [layoutState.isDesktop, isMobileSidebarOpen]);

  // Toggle mobile sidebar
  const toggleMobileSidebar = useCallback(() => {
    setIsMobileSidebarOpen(prev => !prev);
  }, []);

  // Close mobile sidebar
  const closeMobileSidebar = useCallback(() => {
    setIsMobileSidebarOpen(false);
  }, []);

  // Open mobile sidebar
  const openMobileSidebar = useCallback(() => {
    setIsMobileSidebarOpen(true);
  }, []);

  // Handle mobile sidebar action (auto-close after actions on mobile)
  const handleMobileAction = useCallback(
    (callback?: () => void) => {
      callback?.();

      // Auto-close sidebar on mobile after actions
      if (layoutState.isMobile) {
        setTimeout(() => {
          setIsMobileSidebarOpen(false);
        }, 300); // Small delay for better UX
      }
    },
    [layoutState.isMobile]
  );

  // Check if we should show mobile UI patterns
  const shouldUseMobileUI = layoutState.isMobile;

  // Check if we should show tablet-specific UI patterns
  const shouldUseTabletUI = layoutState.isTablet;

  // Check if we should show desktop UI patterns
  const shouldUseDesktopUI = layoutState.isDesktop;

  return {
    // Layout state
    ...layoutState,

    // Mobile sidebar state
    isMobileSidebarOpen,

    // Actions
    toggleMobileSidebar,
    closeMobileSidebar,
    openMobileSidebar,
    handleMobileAction,

    // UI pattern helpers
    shouldUseMobileUI,
    shouldUseTabletUI,
    shouldUseDesktopUI,

    // Breakpoint values for components that need them
    breakpoints,
  };
}
