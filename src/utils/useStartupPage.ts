import { useEffect } from 'react';

/**
 * Resets the root font-size to the original 16px on startup/onboarding pages,
 * counteracting the global 15% text scale applied via --font-size in theme.css.
 */
export function useStartupPage() {
  useEffect(() => {
    document.documentElement.style.fontSize = '16px';
    return () => {
      document.documentElement.style.fontSize = '';
    };
  }, []);
}
