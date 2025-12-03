'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bus, MapPin, Clock, LogOut, RefreshCw, Navigation, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { authApi, studentApi } from '@/lib/api';
import dynamic from 'next/dynamic';

// Dynamically import the multi-bus map component
const MultiBusMap = dynamic(() => import('@/components/map/MultiBusMap'), { 
  ssr: false,
  loading: () => (
    <div className="h-[500px] bg-gray-100 flex items-center justify-center">
      <p className="text-gray-500">Loading map...</p>
    </div>
  )
});

// Haversine formula to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(distanceKm) {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

export default function StudentBusTrackerPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [buses, setBuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [selectedBuses, setSelectedBuses] = useState(new Set()); // Empty = show all
  const [showFilter, setShowFilter] = useState(false);

  const fetchBusPositions = useCallback(async () => {
    try {
      const data = await studentApi.getAllBusPositions();
      setBuses(data.buses || []);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to fetch bus positions:', err);
    }
  }, []);

  useEffect(() => {
    async function init() {
      const currentUser = authApi.getUser();
      
      if (!currentUser) {
        router.push('/login');
        return;
      }

      setUser(currentUser);

      try {
        await fetchBusPositions();
      } catch (err) {
        console.error('Failed to load buses:', err);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [router, fetchBusPositions]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchBusPositions();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchBusPositions]);

  // Get user's location
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationError('Geolocation not supported');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setLocationError('');
      },
      (err) => {
        console.error('Geolocation error:', err);
        setLocationError(err.code === 1 ? 'Location denied' : 'Location error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const handleLogout = () => {
    authApi.logout();
  };

  const toggleBusFilter = (busId) => {
    const newSelected = new Set(selectedBuses);
    if (newSelected.has(busId)) {
      newSelected.delete(busId);
    } else {
      newSelected.add(busId);
    }
    setSelectedBuses(newSelected);
  };

  const selectAllBuses = () => {
    setSelectedBuses(new Set());
  };

  const clearAllBuses = () => {
    setSelectedBuses(new Set(buses.map(b => b.busId)));
  };

  // Filter buses based on selection (empty = show all)
  const visibleBuses = selectedBuses.size === 0 
    ? buses 
    : buses.filter(b => selectedBuses.has(b.busId));

  // Calculate distances for visible buses
  const busesWithDistance = visibleBuses.map(bus => {
    if (userLocation && bus.position) {
      const dist = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        bus.position.lat,
        bus.position.lng
      );
      return { ...bus, distance: dist };
    }
    return { ...bus, distance: null };
  }).sort((a, b) => {
    if (a.distance === null) return 1;
    if (b.distance === null) return -1;
    return a.distance - b.distance;
  });

  const activeBusCount = buses.filter(b => b.position).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading buses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bus className="h-6 w-6 text-orange-500" />
            <div>
              <h1 className="font-bold bg-gradient-to-r from-green-600 to-green-400 bg-clip-text text-transparent">Bus Tracker</h1>
              <p className="text-xs text-muted-foreground">Welcome, {user?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchBusPositions}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto p-4 space-y-4">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-2xl font-bold">{buses.length}</p>
              <p className="text-xs text-muted-foreground">Total Buses</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-2xl font-bold text-green-600">{activeBusCount}</p>
              <p className="text-xs text-muted-foreground">Active Now</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-2xl font-bold">{lastRefresh?.toLocaleTimeString() || '-'}</p>
              <p className="text-xs text-muted-foreground">Last Update</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter Section */}
        <Card>
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filter Buses
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAllBuses}>
                  Show All
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowFilter(!showFilter)}>
                  {showFilter ? 'Hide' : 'Select'}
                </Button>
              </div>
            </div>
          </CardHeader>
          {showFilter && (
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2">
                {buses.map(bus => {
                  const isSelected = selectedBuses.size === 0 || selectedBuses.has(bus.busId);
                  const hasPosition = !!bus.position;
                  return (
                    <button
                      key={bus.busId}
                      onClick={() => toggleBusFilter(bus.busId)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                        isSelected
                          ? hasPosition
                            ? 'bg-green-100 border-green-500 text-green-700'
                            : 'bg-gray-100 border-gray-400 text-gray-600'
                          : 'bg-white border-gray-200 text-gray-400'
                      }`}
                    >
                      {bus.busNo}
                      {hasPosition && isSelected && <span className="ml-1">●</span>}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {selectedBuses.size === 0 
                  ? `Showing all ${buses.length} buses` 
                  : `Showing ${visibleBuses.length} of ${buses.length} buses`}
              </p>
            </CardContent>
          )}
        </Card>

        {/* Map */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Live Bus Locations
              {locationError && (
                <Badge variant="warning" className="ml-2 text-xs">{locationError}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <MultiBusMap
              buses={busesWithDistance}
              userLocation={userLocation}
              height="500px"
            />
          </CardContent>
        </Card>

        {/* Bus List */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Navigation className="h-4 w-4" />
              Bus Distances
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-64 overflow-y-auto">
              {busesWithDistance.map(bus => (
                <div 
                  key={bus.busId}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${bus.position ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <div>
                      <p className="font-medium">Bus {bus.busNo}</p>
                      <p className="text-xs text-muted-foreground">
                        {bus.position 
                          ? `Updated: ${new Date(bus.position.timestamp).toLocaleTimeString()}`
                          : 'No position data'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {bus.distance !== null ? (
                      <p className="font-semibold text-blue-600">{formatDistance(bus.distance)}</p>
                    ) : (
                      <p className="text-muted-foreground">-</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Location updates automatically every 5 seconds
        </p>
      </main>
    </div>
  );
}
