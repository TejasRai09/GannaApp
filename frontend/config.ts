// frontend/config.ts
export const API_BASE = (() => {
    // prefer explicit environment variable (works in build / dev)
    if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
    try {
      if ((window as any).env && (window as any).env.REACT_APP_API_URL) return (window as any).env.REACT_APP_API_URL;
    } catch (e) {}
    // fallback: use same hostname as page but use port 4000 for backend
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:4000`;
  })();
  