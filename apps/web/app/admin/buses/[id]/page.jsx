'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Bus, MapPin, Gauge, Fuel, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminLayout from '@/components/layout/AdminLayout';
import BusMap from '@/components/map/BusMap';
import { busApi, trackingApi, analyticsApi } from '@/lib/api';

export default function BusDetailPage() {
  const params = useParams();
  const busId = params.id;

  const [bus, setBus] = useState(null);
  const [position, setPosition] = useState(null);
  const [path, setPath] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [busData, positionData, pathData] = await Promise.all([
        busApi.getById(busId),
        trackingApi.getCurrentPosition(busId).catch(() => null),
        trackingApi.getTodayPath(busId).catch(() => ({ positions: [] })),
      ]);

      setBus(busData.bus);
      if (positionData?.position) {
        setPosition(positionData.position);
      }
      setPath(pathData.positions || []);
    } catch (err) {
      setError('Failed to load bus data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [busId]);

  const fetchStats = useCallback(async () => {
    try {
      // Get last 7 days stats
      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const data = await analyticsApi.getDailyStats(
        busId,
        weekAgo.toISOString().split('T')[0],
        today.toISOString().split('T')[0]
      );
      setStats(data.stats || []);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, [busId]);

  useEffect(() => {
    fetchData();
    fetchStats();

    // Auto-refresh position every 10 seconds
    const interval = setInterval(async () => {
      try {
        const [positionData, pathData] = await Promise.all([
          trackingApi.getCurrentPosition(busId).catch(() => null),
          trackingApi.getTodayPath(busId).catch(() => ({ positions: [] })),
        ]);
        if (positionData?.position) {
          setPosition(positionData.position);
        }
        setPath(pathData.positions || []);
      } catch (err) {
        console.error('Failed to refresh position:', err);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [busId, fetchData, fetchStats]);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  if (error || !bus) {
    return (
      <AdminLayout>
        <div className="text-center py-8">
          <p className="text-red-500">{error || 'Bus not found'}</p>
          <Link href="/admin/buses">
            <Button className="mt-4">Back to Buses</Button>
          </Link>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/admin/buses">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold">Bus {bus.busNo}</h2>
              <Badge variant={bus.isActive ? 'success' : 'secondary'}>
                {bus.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="text-muted-foreground">Device ID: {bus.deviceId || 'N/A'}</p>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Position</span>
              </div>
              <p className="text-lg font-semibold mt-1">
                {position ? `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}` : 'No data'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Speed</span>
              </div>
              <p className="text-lg font-semibold mt-1">
                {position?.speedKmh ?? 0} km/h
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Fuel className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Fuel Level</span>
              </div>
              <p className="text-lg font-semibold mt-1">
                {position?.fuelLevelPercent ?? '-'}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Last Update</span>
              </div>
              <p className="text-lg font-semibold mt-1">
                {position?.timestamp 
                  ? new Date(position.timestamp).toLocaleTimeString()
                  : 'N/A'
                }
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="map">
          <TabsList>
            <TabsTrigger value="map">Live Map</TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
          </TabsList>

          <TabsContent value="map" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Live Location
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BusMap
                  currentPosition={position}
                  path={path}
                  busNo={bus.busNo}
                  height="500px"
                  showPath={true}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Map auto-refreshes every 10 seconds. Path shows today's journey.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Daily Statistics (Last 7 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.length === 0 ? (
                  <p className="text-muted-foreground">No statistics available yet.</p>
                ) : (
                  <div className="space-y-4">
                    {stats.map((stat) => (
                      <div key={stat.date} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{stat.date}</span>
                          <Badge variant="outline">{stat.positionCount} points</Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Distance</span>
                            <p className="font-medium">{stat.totalDistanceKm} km</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Running Time</span>
                            <p className="font-medium">{stat.totalRunningTimeMinutes} min</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Avg Speed</span>
                            <p className="font-medium">{stat.averageSpeedKmh} km/h</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Fuel Used (Est.)</span>
                            <p className="font-medium">{stat.predictedFuelUsedLiters} L</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
