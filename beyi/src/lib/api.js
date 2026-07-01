const defaultApiBaseUrl = 'http://localhost:8000/api';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || defaultApiBaseUrl).replace(/\/$/, '');

export const buildApiUrl = (path) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

export async function fetchJson(path, options = {}) {
  // 1. Check if the current request is an auth route (like login)
  const isAuthRoute = path.includes('/auth/login/');

  // 2. Only grab the token if we are NOT trying to log in
  let token = !isAuthRoute ? (localStorage.getItem('accessToken') || localStorage.getItem('token')) : null;
  // 2. Build the headers safely
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  // 3. Inject the token if it exists (using standard JWT Bearer format)
  if (token) {
    headers['Authorization'] = `Bearer ${token}`; 
    // NOTE: If your Django backend uses Simple JWT, 'Bearer' is perfect. 
    // If you are using Django's built-in TokenAuth, change 'Bearer' to 'Token'.
  }

  let response = await fetch(buildApiUrl(path), {
    ...options,
    headers, // Use our updated headers object
  });

  // 2. 🔄 INTERCEPT EXPIRED TOKENS (If server returns 401 Unauthorized)
  if (response.status === 401 && !isAuthRoute && localStorage.getItem('refreshToken')) {
    try {
      // Send the refresh token to your Django token refresh endpoint
      const refreshResponse = await fetch(buildApiUrl('/auth/login/refresh/'), { // ⚠️ Check your exact backend URL path
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: localStorage.getItem('refreshToken') }),
      });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        
        // Save the new, valid access token to localStorage
        localStorage.setItem('accessToken', refreshData.access);
        
        // Re-assign the new token to our headers
        headers['Authorization'] = `Bearer ${refreshData.access}`;
        
        // 3. RETRY the original request with the fresh token and return it!
        response = await fetch(buildApiUrl(path), { ...options, headers });
      } else {
        // If the refresh token itself is expired/invalid, clear storage and boot to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login'; 
      }
    } catch (refreshError) {
      console.error("Silent token refresh failed:", refreshError);
    }
  }

  if (!response.ok) {
    // Try to extract a clean backend error message if available
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || errorData.message || errorMessage;
    } catch {
      const errorText = await response.text();
      if (errorText) errorMessage = errorText;
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const searchPrices = async (searchTerm) => {
  const queryParams = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : '';
  return fetchJson(`/prices/search/${queryParams}`);
};