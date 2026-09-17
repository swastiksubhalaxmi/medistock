import axios from 'axios';

const getBaseUrl = () => {
  const rawUrl = import.meta.env.VITE_API_BASE_URL || '/api';
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  if (trimmed === '/api' || trimmed.endsWith('/api')) {
    return trimmed;
  }
  return `${trimmed}/api`;
};

// Create an Axios instance pointing to the proxied back-end URL
const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Inject JWT token into headers if logged in
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle errors globally (e.g. 401 / 403 authorization failures)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status } = error.response;
      if (status === 401) {
        // Clear local storage and redirect to login if session expires
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
