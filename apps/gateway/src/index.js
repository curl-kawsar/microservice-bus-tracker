import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// Service URLs
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:4001';
const BUS_SERVICE_URL = process.env.BUS_SERVICE_URL || 'http://localhost:4002';
const TRACKING_SERVICE_URL = process.env.TRACKING_SERVICE_URL || 'http://localhost:4003';
const ANALYTICS_SERVICE_URL = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:4004';

// CORS middleware
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check
app.get('/health', (c) => c.json({ status: 'ok', service: 'gateway' }));

// Helper function to verify JWT token
async function verifyToken(token) {
  try {
    const response = await fetch(`${AUTH_SERVICE_URL}/auth/verify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.valid ? data.user : null;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

// Authentication middleware
async function authMiddleware(c, next) {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);
  const user = await verifyToken(token);

  if (!user) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  c.set('user', user);
  return next();
}

// Role check middleware
function requireRole(...roles) {
  return async (c, next) => {
    const user = c.get('user');
    if (!user || !roles.includes(user.role)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    return next();
  };
}

// Proxy helper function
async function proxyRequest(c, targetUrl) {
  try {
    const url = new URL(c.req.url);
    const targetPath = url.pathname + url.search;
    const fullUrl = `${targetUrl}${targetPath.replace(/^\/api/, '')}`;

    const headers = new Headers();
    for (const [key, value] of c.req.raw.headers.entries()) {
      if (key.toLowerCase() !== 'host') {
        headers.set(key, value);
      }
    }

    const method = c.req.method;
    let body = null;

    if (method !== 'GET' && method !== 'HEAD') {
      const contentType = c.req.header('content-type') || '';
      
      if (contentType.includes('multipart/form-data')) {
        // For file uploads, pass through the raw request
        body = await c.req.raw.arrayBuffer();
      } else {
        try {
          body = await c.req.text();
        } catch (e) {
          // No body
        }
      }
    }

    const response = await fetch(fullUrl, {
      method,
      headers,
      body,
    });

    const responseData = await response.text();
    
    return new Response(responseData, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      },
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return c.json({ error: 'Service unavailable' }, 503);
  }
}

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

// Auth routes - login and verify
app.post('/api/auth/login', async (c) => {
  return proxyRequest(c, AUTH_SERVICE_URL);
});

app.post('/api/auth/verify', async (c) => {
  return proxyRequest(c, AUTH_SERVICE_URL);
});

// GPS ingest endpoint (for trackers, no auth)
app.post('/api/tracking/ingest', async (c) => {
  return proxyRequest(c, TRACKING_SERVICE_URL);
});

// ============================================
// ADMIN ROUTES
// ============================================

// Admin buses routes - LIST and CREATE first
app.get('/api/admin/buses', authMiddleware, requireRole('ADMIN'), async (c) => {
  return proxyRequest(c, BUS_SERVICE_URL);
});

app.post('/api/admin/buses', authMiddleware, requireRole('ADMIN'), async (c) => {
  return proxyRequest(c, BUS_SERVICE_URL);
});

// Admin analytics routes - SPECIFIC paths before generic :id
app.get('/api/admin/buses/:id/daily-stats', authMiddleware, requireRole('ADMIN'), async (c) => {
  return proxyRequest(c, ANALYTICS_SERVICE_URL);
});

app.get('/api/admin/buses/:id/summary', authMiddleware, requireRole('ADMIN'), async (c) => {
  return proxyRequest(c, ANALYTICS_SERVICE_URL);
});

// Admin route history - SPECIFIC paths before generic :id
app.get('/api/admin/buses/:id/history', authMiddleware, requireRole('ADMIN'), async (c) => {
  const { id } = c.req.param();
  const url = new URL(c.req.url);
  const queryString = url.search;
  
  try {
    const response = await fetch(`${TRACKING_SERVICE_URL}/buses/${id}/history${queryString}`);
    const data = await response.json();
    return c.json(data, response.status);
  } catch (error) {
    console.error('Failed to fetch route history:', error);
    return c.json({ error: 'Failed to fetch route history' }, 500);
  }
});

app.get('/api/admin/buses/:id/today-path', authMiddleware, requireRole('ADMIN'), async (c) => {
  const { id } = c.req.param();
  
  try {
    const response = await fetch(`${TRACKING_SERVICE_URL}/buses/${id}/today-path`);
    const data = await response.json();
    return c.json(data, response.status);
  } catch (error) {
    console.error('Failed to fetch today path:', error);
    return c.json({ error: 'Failed to fetch today path' }, 500);
  }
});

// Admin buses routes - GENERIC :id routes LAST
app.get('/api/admin/buses/:id', authMiddleware, requireRole('ADMIN'), async (c) => {
  return proxyRequest(c, BUS_SERVICE_URL);
});

app.put('/api/admin/buses/:id', authMiddleware, requireRole('ADMIN'), async (c) => {
  return proxyRequest(c, BUS_SERVICE_URL);
});

app.delete('/api/admin/buses/:id', authMiddleware, requireRole('ADMIN'), async (c) => {
  return proxyRequest(c, BUS_SERVICE_URL);
});

// Admin students routes
app.get('/api/admin/students', authMiddleware, requireRole('ADMIN'), async (c) => {
  return proxyRequest(c, AUTH_SERVICE_URL);
});

app.post('/api/admin/students/import', authMiddleware, requireRole('ADMIN'), async (c) => {
  return proxyRequest(c, AUTH_SERVICE_URL);
});

app.delete('/api/admin/students/:id', authMiddleware, requireRole('ADMIN'), async (c) => {
  return proxyRequest(c, AUTH_SERVICE_URL);
});

// ============================================
// STUDENT ROUTES
// ============================================

// Student can get all buses
app.get('/api/student/buses', authMiddleware, requireRole('STUDENT', 'ADMIN'), async (c) => {
  try {
    const response = await fetch(`${BUS_SERVICE_URL}/admin/buses`);
    const data = await response.json();
    return c.json(data, response.status);
  } catch (error) {
    console.error('Failed to fetch buses:', error);
    return c.json({ error: 'Failed to fetch buses' }, 500);
  }
});

// Student can get position for any bus
app.get('/api/student/buses/:id/position', authMiddleware, requireRole('STUDENT', 'ADMIN'), async (c) => {
  const { id } = c.req.param();
  try {
    const response = await fetch(`${TRACKING_SERVICE_URL}/buses/${id}/current-position`);
    const data = await response.json();
    return c.json(data, response.status);
  } catch (error) {
    console.error('Failed to fetch position:', error);
    return c.json({ error: 'Failed to fetch position' }, 500);
  }
});

// Student can get all bus positions at once
app.get('/api/student/buses/positions', authMiddleware, requireRole('STUDENT', 'ADMIN'), async (c) => {
  try {
    // First get all buses
    const busResponse = await fetch(`${BUS_SERVICE_URL}/admin/buses`);
    const busData = await busResponse.json();
    const buses = busData.buses || [];

    // Fetch positions for all buses in parallel
    const positions = await Promise.all(
      buses.map(async (bus) => {
        try {
          const posResponse = await fetch(`${TRACKING_SERVICE_URL}/buses/${bus.id}/current-position`);
          if (posResponse.ok) {
            const posData = await posResponse.json();
            return {
              busId: bus.id,
              busNo: bus.busNo,
              deviceId: bus.deviceId,
              isActive: bus.isActive,
              position: posData.position,
            };
          }
          return {
            busId: bus.id,
            busNo: bus.busNo,
            deviceId: bus.deviceId,
            isActive: bus.isActive,
            position: null,
          };
        } catch {
          return {
            busId: bus.id,
            busNo: bus.busNo,
            deviceId: bus.deviceId,
            isActive: bus.isActive,
            position: null,
          };
        }
      })
    );

    return c.json({ buses: positions });
  } catch (error) {
    console.error('Failed to fetch bus positions:', error);
    return c.json({ error: 'Failed to fetch bus positions' }, 500);
  }
});

// ============================================
// SHARED AUTHENTICATED ROUTES
// ============================================

// Bus position routes (both admin and student can access)
app.get('/api/buses/:id/current-position', authMiddleware, async (c) => {
  return proxyRequest(c, TRACKING_SERVICE_URL);
});

app.get('/api/buses/:id/today-path', authMiddleware, async (c) => {
  return proxyRequest(c, TRACKING_SERVICE_URL);
});

app.get('/api/buses/:id/history', authMiddleware, async (c) => {
  return proxyRequest(c, TRACKING_SERVICE_URL);
});

// ============================================
// AUTH ROUTES (get users)
// ============================================

app.get('/api/auth/users', authMiddleware, requireRole('ADMIN'), async (c) => {
  return proxyRequest(c, AUTH_SERVICE_URL);
});

app.put('/api/auth/users/:id/assign-bus', authMiddleware, requireRole('ADMIN'), async (c) => {
  return proxyRequest(c, AUTH_SERVICE_URL);
});

// Fallback
app.all('*', (c) => {
  return c.json({ error: 'Not found' }, 404);
});

const port = 4000;
console.log(`Gateway running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
