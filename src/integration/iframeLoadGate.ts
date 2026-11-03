/** Remembers load across React effect setup/cleanup (including StrictMode). */
export function iframeLoadGate() {
  let loaded = false;
  let send: (() => void) | null = null;
  return {
    isLoaded: () => loaded,
    onLoad() { loaded = true; send?.(); },
    connect(callback: () => void) {
      send = callback;
      if (loaded) callback();
      return () => { if (send === callback) send = null; };
    },
  };
}
