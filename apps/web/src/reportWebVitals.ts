export function reportWebVitals(onPerfEntry?: () => void) {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    // biome-ignore lint/nursery/noFloatingPromises: code from create-tanstack-app
    import("web-vitals").then(({ onCLS, onINP, onFCP, onLCP, onTTFB }) => {
      onCLS(onPerfEntry);
      onINP(onPerfEntry);
      onFCP(onPerfEntry);
      onLCP(onPerfEntry);
      onTTFB(onPerfEntry);
    });
  }
}
