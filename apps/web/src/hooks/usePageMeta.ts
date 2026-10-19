import { useEffect } from 'react';
const defaultDescription =
  "Considered clothing. Lasting style. Discover VELORA's collection of thoughtfully crafted fashion and everyday essentials.";
export function usePageMeta(title: string, description?: string): void {
  useEffect(() => {
    document.title = `${title} — VELORA`;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', description || defaultDescription);
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = `${location.origin}${location.pathname}`;
  }, [title, description]);
}
