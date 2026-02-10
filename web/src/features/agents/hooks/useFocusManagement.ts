import { useEffect } from 'react';
import { useLocation } from "../adapters";

/**
 * Custom hook to manage focus after route changes
 * This ensures trackpad navigation works properly in the SPA
 */
export function useFocusManagement() {
  const location = useLocation();

  useEffect(() => {
    // Small delay to ensure DOM has updated after route change
    const timeoutId = setTimeout(() => {
      // Remove focus from any currently focused element to prevent blue outline
      if (document.activeElement && document.activeElement !== document.body) {
        (document.activeElement as HTMLElement).blur();
      }

      // Focus the document body to ensure trackpad gestures work
      // This gives the page focus without showing a visible outline
      document.body.focus();

      // Ensure the page is scrolled to top on route change
      window.scrollTo(0, 0);
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [location.pathname]);

  // Handle initial page load and page refresh
  useEffect(() => {
    const handlePageLoad = () => {
      // Remove any existing focus to prevent blue outline
      if (document.activeElement && document.activeElement !== document.body) {
        (document.activeElement as HTMLElement).blur();
      }

      // Focus the body for trackpad navigation
      document.body.focus();
    };

    // Handle both initial load and page refresh
    if (document.readyState === 'complete') {
      handlePageLoad();
    } else {
      window.addEventListener('load', handlePageLoad);
      document.addEventListener('DOMContentLoaded', handlePageLoad);
      return () => {
        window.removeEventListener('load', handlePageLoad);
        document.removeEventListener('DOMContentLoaded', handlePageLoad);
      };
    }
  }, []);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      // Small delay to ensure the route has changed
      setTimeout(() => {
        if (document.activeElement && document.activeElement !== document.body) {
          (document.activeElement as HTMLElement).blur();
        }
        document.body.focus();
      }, 50);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
}
