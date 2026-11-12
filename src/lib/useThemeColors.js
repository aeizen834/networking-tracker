import { useEffect, useState } from 'react';

// Recharts draws SVG with color props, so read our CSS color tokens from the
// page and re-read them whenever light/dark mode changes.
const TOKENS = ['--series-1', '--series-2', '--series-neutral', '--surface-1', '--text-secondary', '--text-muted', '--grid'];

function read() {
  const cs = getComputedStyle(document.documentElement);
  return Object.fromEntries(TOKENS.map((t) => [t.slice(2), cs.getPropertyValue(t).trim()]));
}

export function useThemeColors() {
  const [colors, setColors] = useState(read);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setColors(read());
    mq.addEventListener('change', update);
    // claude.ai's theme toggle sets data-theme on <html>
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      mq.removeEventListener('change', update);
      observer.disconnect();
    };
  }, []);
  return colors;
}
