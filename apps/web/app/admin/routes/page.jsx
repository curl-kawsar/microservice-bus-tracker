'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { History, Bus, Calendar, Search, MapPin, Clock, Route, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AdminLayout from '@/components/layout/AdminLayout';
import { busApi, routeHistoryApi, authApi } from '@/lib/api';
import dynamic from 'next/dynamic';

// Dynamically import the playback map
const RoutePlaybackMap = dynamic(
  () => import('@/components/map/RoutePlaybackMap'),
  { 
    ssr: false,
    loading: () => (
      <div className="h-[500px] bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500">Loading map...</p>
      </div>
    )
  }
);

export default function RouteHistoryPage() {
  const router = useRouter();
  const [buses, setBuses] = useState([]);
  const [selectedBusId, setSelectedBusId] = useState('');
  const [selectedBus, setSelectedBus] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busesLoading, setBusesLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);

  // Set default dates (today)
  useEffect(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    setDateFrom(todayStr);
    setDateTo(todayStr);
  }, []);

  // Fetch buses on mount
  useEffect(() => {
    async function fetchBuses() {
      try {
        const user = authApi.getUser();
        if (!user || user.role !== 'ADMIN') {
          router.push('/login');
          return;
        }

        const data = await busApi.getAll();
        setBuses(data.buses || []);
      } catch (err) {
        console.error('Failed to fetch buses:', err);
        setError('Failed to load buses');
      } finally {
        setBusesLoading(false);
      }
    }

    fetchBuses();
  }, [router]);

  // Calculate route statistics
  const calculateStats = (positions) => {
    if (positions.length < 2) {
      return { totalDistance: 0, duration: 0, avgSpeed: 0, maxSpeed: 0 };
    }

    let totalDistance = 0;
    let maxSpeed = 0;
    let speedSum = 0;
    let speedCount = 0;

    for (let i = 1; i < positions.length; i++) {
      const prev = positions[i - 1];
      const curr = positions[i];

      // Calculate distance using Haversine formula
      const R = 6371; // Earth's radius in km
      const dLat = (curr.lat - prev.lat) * Math.PI / 180;
      const dLon = (curr.lng - prev.lng) * Math.PI / 180;
      const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(prev.lat * Math.PI / 180) * Math.cos(curr.lat * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      totalDistance += R * c;

      // Track speed
      if (curr.speedKmh !== undefined && curr.speedKmh > 0) {
        speedSum += curr.speedKmh;
        speedCount++;
        if (curr.speedKmh > maxSpeed) {
          maxSpeed = curr.speedKmh;
        }
      }
    }

    const startTime = new Date(positions[0].timestamp);
    const endTime = new Date(positions[positions.length - 1].timestamp);
    const duration = (endTime - startTime) / 1000 / 60; // in minutes

    return {
      totalDistance: Math.round(totalDistance * 100) / 100,
      duration: Math.round(duration),
      avgSpeed: speedCount > 0 ? Math.round(speedSum / speedCount) : 0,
      maxSpeed: Math.round(maxSpeed),
    };
  };

  const handleSearch = async () => {
    if (!selectedBusId) {
      setError('Please select a bus');
      return;
    }

    if (!dateFrom || !dateTo) {
      setError('Please select date range');
      return;
    }

    setLoading(true);
    setError('');
    setPositions([]);
    setStats(null);

    try {
      // Add time to dates for proper range
      const fromDateTime = `${dateFrom}T00:00:00`;
      const toDateTime = `${dateTo}T23:59:59`;

      const data = await routeHistoryApi.getHistory(selectedBusId, fromDateTime, toDateTime);
      
      if (data.positions && data.positions.length > 0) {
        setPositions(data.positions);
        setStats(calculateStats(data.positions));
        
        // Find selected bus details
        const bus = buses.find(b => b.id === selectedBusId);
        setSelectedBus(bus);
      } else {
        setError('No route data found for the selected date range');
      }
    } catch (err) {
      console.error('Failed to fetch route history:', err);
      setError('Failed to load route history');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSelect = (days) => {
    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - days);
    
    setDateFrom(from.toISOString().split('T')[0]);
    setDateTo(today.toISOString().split('T')[0]);
  };

  const exportToGPX = () => {
    if (positions.length === 0) return;

    const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Bus Tracker">
  <trk>
    <name>Bus ${selectedBus?.busNo} Route</name>
    <trkseg>
${positions.map(p => `      <trkpt lat="${p.lat}" lon="${p.lng}">
        <time>${new Date(p.timestamp).toISOString()}</time>
      </trkpt>`).join('\n')}
    </trkseg>
  </trk>
</gpx>`;

    const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bus-${selectedBus?.busNo}-route-${dateFrom}-${dateTo}.gpx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <History className="h-6 w-6" />
            Route History & Playback
          </h2>
          <p className="text-muted-foreground">
            View and replay historical bus routes
          </p>
        </div>

        {/* Search Controls */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="h-4 w-4" />
              Search Route History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Bus Selector */}
              <div>
                <label className="text-sm font-medium mb-1 block">Bus</label>
                <select
                  value={selectedBusId}
                  onChange={(e) => setSelectedBusId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-white"
                  disabled={busesLoading}
                >
                  <option value="">Select a bus</option>
                  {buses.map(bus => (
                    <option key={bus.id} value={bus.id}>
                      Bus {bus.busNo}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date From */}
              <div>
                <label className="text-sm font-medium mb-1 block">From Date</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="text-sm font-medium mb-1 block">To Date</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>

              {/* Search Button */}
              <div className="flex items-end">
                <Button onClick={handleSearch} disabled={loading} className="w-full">
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Loading...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Search
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Quick Select Buttons */}
            <div className="flex gap-2 mt-4">
              <span className="text-sm text-muted-foreground">Quick select:</span>
              <button
                onClick={() => handleQuickSelect(0)}
                className="text-sm text-blue-600 hover:underline"
              >
                Today
              </button>
              <button
                onClick={() => handleQuickSelect(1)}
                className="text-sm text-blue-600 hover:underline"
              >
                Yesterday
              </button>
              <button
                onClick={() => handleQuickSelect(7)}
                className="text-sm text-blue-600 hover:underline"
              >
                Last 7 days
              </button>
              <button
                onClick={() => handleQuickSelect(30)}
                className="text-sm text-blue-600 hover:underline"
              >
                Last 30 days
              </button>
            </div>

            {error && (
              <p className="text-red-500 text-sm mt-4">{error}</p>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {positions.length > 0 && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="pt-4 text-center">
                  <Bus className="h-5 w-5 mx-auto text-blue-500 mb-1" />
                  <p className="text-xl font-bold">{selectedBus?.busNo}</p>
                  <p className="text-xs text-muted-foreground">Bus</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4 text-center">
                  <MapPin className="h-5 w-5 mx-auto text-green-500 mb-1" />
                  <p className="text-xl font-bold">{positions.length}</p>
                  <p className="text-xs text-muted-foreground">Points</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4 text-center">
                  <Route className="h-5 w-5 mx-auto text-purple-500 mb-1" />
                  <p className="text-xl font-bold">{stats?.totalDistance} km</p>
                  <p className="text-xs text-muted-foreground">Distance</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4 text-center">
                  <Clock className="h-5 w-5 mx-auto text-orange-500 mb-1" />
                  <p className="text-xl font-bold">{stats?.duration} min</p>
                  <p className="text-xs text-muted-foreground">Duration</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4 text-center">
                  <Calendar className="h-5 w-5 mx-auto text-gray-500 mb-1" />
                  <p className="text-xl font-bold">{stats?.maxSpeed} km/h</p>
                  <p className="text-xs text-muted-foreground">Max Speed</p>
                </CardContent>
              </Card>
            </div>

            {/* Playback Map */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Route Playback
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={exportToGPX}>
                    <Download className="h-4 w-4 mr-2" />
                    Export GPX
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <RoutePlaybackMap
                  positions={positions}
                  busNo={selectedBus?.busNo}
                  height="500px"
                />
              </CardContent>
            </Card>

            {/* Position Timeline */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Position Log
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">#</th>
                        <th className="text-left py-2 px-2">Time</th>
                        <th className="text-left py-2 px-2">Position</th>
                        <th className="text-left py-2 px-2">Speed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.slice(0, 100).map((pos, idx) => (
                        <tr key={idx} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-2 text-muted-foreground">{idx + 1}</td>
                          <td className="py-2 px-2">
                            {new Date(pos.timestamp).toLocaleTimeString()}
                          </td>
                          <td className="py-2 px-2 font-mono text-xs">
                            {pos.lat.toFixed(6)}, {pos.lng.toFixed(6)}
                          </td>
                          <td className="py-2 px-2">
                            {pos.speedKmh !== undefined ? `${pos.speedKmh} km/h` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {positions.length > 100 && (
                    <p className="text-center text-sm text-muted-foreground py-2">
                      Showing first 100 of {positions.length} positions
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Empty state */}
        {!loading && positions.length === 0 && !error && (
          <Card>
            <CardContent className="py-12 text-center">
              <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium text-lg">No Route Data</h3>
              <p className="text-muted-foreground mt-1">
                Select a bus and date range, then click Search to view route history
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
