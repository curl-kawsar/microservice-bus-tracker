const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// Get token from localStorage
function getToken() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token');
  }
  return null;
}

// API helper with auth
async function apiRequest(endpoint, options = {}) {
  const token = getToken();
  
  const headers = {
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Don't set Content-Type for FormData (browser will set it with boundary)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Token expired or invalid
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

// Auth API
export const authApi = {
  login: async (username, password) => {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    
    if (data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    
    return data;
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  },

  getUser: () => {
    if (typeof window !== 'undefined') {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user) : null;
    }
    return null;
  },

  isAuthenticated: () => {
    return !!getToken();
  },
};

// Bus API
export const busApi = {
  getAll: () => apiRequest('/admin/buses'),
  
  getById: (id) => apiRequest(`/admin/buses/${id}`),
  
  create: (data) => apiRequest('/admin/buses', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  update: (id, data) => apiRequest(`/admin/buses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  
  delete: (id) => apiRequest(`/admin/buses/${id}`, {
    method: 'DELETE',
  }),
};

// Tracking API
export const trackingApi = {
  getCurrentPosition: (busId) => apiRequest(`/buses/${busId}/current-position`),
  
  getTodayPath: (busId) => apiRequest(`/buses/${busId}/today-path`),
  
  getHistory: (busId, from, to) => {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    return apiRequest(`/buses/${busId}/history?${params}`);
  },
};

// Route History API (Admin)
export const routeHistoryApi = {
  getHistory: (busId, from, to) => {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    return apiRequest(`/admin/buses/${busId}/history?${params}`);
  },
  
  getTodayPath: (busId) => apiRequest(`/admin/buses/${busId}/today-path`),
};

// Analytics API
export const analyticsApi = {
  getDailyStats: (busId, from, to) => {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    return apiRequest(`/admin/buses/${busId}/daily-stats?${params}`);
  },
  
  getSummary: (busId, days = 7) => {
    return apiRequest(`/admin/buses/${busId}/summary?days=${days}`);
  },
};

// Students API (Admin)
export const studentsApi = {
  getAll: () => apiRequest('/admin/students'),
  
  import: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    return apiRequest('/admin/students/import', {
      method: 'POST',
      body: formData,
    });
  },
  
  delete: (id) => apiRequest(`/admin/students/${id}`, {
    method: 'DELETE',
  }),
  
  assignBus: (userId, busId) => apiRequest(`/auth/users/${userId}/assign-bus`, {
    method: 'PUT',
    body: JSON.stringify({ busId }),
  }),
};

// Student API (for logged-in students)
export const studentApi = {
  getAllBuses: () => apiRequest('/student/buses'),
  
  getAllBusPositions: () => apiRequest('/student/buses/positions'),
  
  getBusPosition: (busId) => apiRequest(`/student/buses/${busId}/position`),
};
