import axios from 'axios';

const envUrl = import.meta.env.VITE_API_URL;
// If VITE_API_URL is unset, empty, or points to internal docker service 'api:5000',
// use empty string '' so browser requests go to current origin (e.g. http://localhost:5173/api/...)
// which Vite proxy forwards to backend container!
const isDockerInternal = typeof envUrl === 'string' && (envUrl.includes('api:') || envUrl.includes('//api'));
const baseURL = (envUrl && !isDockerInternal) ? envUrl : '';

const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const url = config.url || '';
  const isPortalApi = url.startsWith('/api/portal');
  
  // Never leak customer portal token to internal administrative routes!
  const token = isPortalApi
    ? (localStorage.getItem('urban_portal_token') || localStorage.getItem('urban_token'))
    : localStorage.getItem('urban_token');

  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';

    if (status === 401 || status === 403) {
      if (!url.includes('/login') && !url.includes('/accept-invite')) {
        const isPortal = url.startsWith('/api/portal') || window.location.pathname.startsWith('/portal');
        if (isPortal) {
          localStorage.removeItem('urban_portal_token');
          localStorage.removeItem('urban_portal_user');
          if (!window.location.pathname.includes('/login')) {
            window.location.href = '/login?portal=customer';
          }
        } else {
          localStorage.removeItem('urban_token');
          localStorage.removeItem('urban_logged_in');
          localStorage.removeItem('urban_user');
          if (!window.location.pathname.startsWith('/login') && window.location.pathname !== '/') {
            window.location.href = '/login';
          }
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
