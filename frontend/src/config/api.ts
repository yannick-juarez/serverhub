const normalizeOrigin = (origin: string) => origin.replace(/\/+$/, '');

const normalizeBasePath = (basePath: string) => {
  const withLeadingSlash = basePath.startsWith('/') ? basePath : `/${basePath}`;
  return withLeadingSlash.replace(/\/+$/, '');
};

const resolveApiOrigin = () => {
  const fromEnv = (import.meta.env.VITE_API_ORIGIN as string | undefined)?.trim();
  if (fromEnv) {
    const normalized = normalizeOrigin(fromEnv);

    // In dev, if the app is not opened on localhost but API origin points to localhost,
    // prefer relative /api and let Vite proxy forward requests to backend.
    if (
      import.meta.env.DEV &&
      typeof window !== 'undefined' &&
      !['localhost', '127.0.0.1'].includes(window.location.hostname) &&
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalized)
    ) {
      return '';
    }

    return normalized;
  }
  // Default to relative path (/api) for reverse proxy and Vite proxy setups.
  return '';
};

const resolveApiBasePath = () => {
  const fromEnv = (import.meta.env.VITE_API_BASE_PATH as string | undefined)?.trim();
  if (fromEnv) {
    return normalizeBasePath(fromEnv);
  }
  return '/api';
};

const API_BASE_URL = `${resolveApiOrigin()}${resolveApiBasePath()}`;

export const apiBaseUrl = API_BASE_URL;

export const apiUrl = (path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};
