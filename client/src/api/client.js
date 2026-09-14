import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 15000
});

// Request Interceptor: Attach JWT Bearer Token & Active Branch Header
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('smartscan_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const branchId = localStorage.getItem('smartscan_branch_id');
    if (branchId) {
      config.headers['x-branch-id'] = branchId;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Extract clean data & handle global error states
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    let message = 'An unexpected network error occurred.';
    let errors = null;

    if (error.response?.data) {
      message = error.response.data.message || message;
      errors = error.response.data.errors || null;
    } else if (error.request) {
      message = 'Unable to connect to SmartScan Pay server. Check your connection.';
    }

    // Auto-logout on token expiration (except on login/register endpoints)
    if (
      error.response?.status === 401 &&
      !window.location.pathname.includes('/login') &&
      !window.location.pathname.includes('/register')
    ) {
      localStorage.removeItem('smartscan_token');
      localStorage.removeItem('smartscan_user');
      window.dispatchEvent(new Event('smartscan-unauthorized'));
    }

    const customError = new Error(message);
    customError.status = error.response?.status;
    customError.response = error.response;
    customError.data = error.response?.data;
    customError.code = error.response?.status === 404 ? 'NOT_REGISTERED' : (error.code || 'ERR_API');
    customError.errors = errors;
    customError.originalError = error;

    return Promise.reject(customError);
  }
);

export default api;
