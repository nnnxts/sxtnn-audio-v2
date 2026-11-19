import { useEffect } from 'react';

/** Force le thème sombre "studio" sur les pages SXTNN DISTRO, puis restaure le thème de l'utilisateur. */
export function useForcedDarkTheme() {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.getAttribute('data-theme') || 'oled';
    const prevCover = root.getAttribute('data-cover') || 'rounded';
    const prevDensity = root.getAttribute('data-density') || 'comfortable';
    root.setAttribute('data-force-theme', '1');
    root.setAttribute('data-theme', 'oled');
    root.setAttribute('data-cover', 'rounded');
    root.setAttribute('data-density', 'comfortable');
    return () => {
      root.removeAttribute('data-force-theme');
      root.setAttribute('data-theme', previous);
      root.setAttribute('data-cover', prevCover);
      root.setAttribute('data-density', prevDensity);
    };
  }, []);
}
