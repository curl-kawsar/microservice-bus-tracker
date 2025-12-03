'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bus, Users, MapPin, Activity, Gauge, Fuel, Route, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AdminLayout from '@/components/layout/AdminLayout';
import { busApi, studentsApi, trackingApi, analyticsApi } from '@/lib/api';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalBuses: 0,
    activeBuses: 0,
    totalStudents: 0,
    totalDistanceToday: 0,
  });
  const [buses, setBuses] = useState([]);
  const [busPositions, setBusPositions] = useState({});
  const [busStats, setBusStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [busData, studentData] = await Promise.all([
          busApi.getAll(),
          studentsApi.getAll().catch(() => ({ students: [] })),
        ]);

        const busList = busData.buses || [];
        setBuses(busList);
        
        // Fetch positions and stats for each bus
        const positions = {};
        const statsData = {};
        let totalDistance = 0;

        await Promise.all(
          busList.map(async (bus) => {
            try {
              // Get current position
              const posData = await trackingApi.getCurrentPosition(bus.id).catch(() => null);
              if (posData?.position) {
                positions[bus.id] = posData.position;
              }

              // Get today's stats
              const today = new Date().toISOString().split('T')[0];
              const statsRes = await analyticsApi.getDailyStats(bus.id, today, today).catch(() => null);
              if (statsRes?.stats?.[0]) {
                statsData[bus.id] = statsRes.stats[0];
                totalDistance += statsRes.stats[0].totalDistanceKm || 0;
              }
            } catch (err) {
              console.error(`Failed to fetch data for bus ${bus.id}:`, err);
            }
          })
        );

        setBusPositions(positions);
        setBusStats(statsData);
        setStats({
          totalBuses: busList.length,
          activeBuses: busList.filter(b => b.isActive).length,
          totalStudents: studentData.students?.length || 0,
          totalDistanceToday: Math.round(totalDistance * 100) / 100,
        });
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();

    // Refresh positions every 10 seconds
    const interval = setInterval(async () => {
      try {
        const busData = await busApi.getAll();
        const positions = {};
        await Promise.all(
          (busData.buses || []).map(async (bus) => {
            const posData = await trackingApi.getCurrentPosition(bus.id).catch(() => null);
            if (posData?.position) {
              positions[bus.id] = posData.position;
            }
          })
        );
        setBusPositions(positions);
      } catch (err) {
        console.error('Failed to refresh positions:', err);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="text-muted-foreground">Overview of your bus tracking system</p>
        </div>

        {/* Stats cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Buses</CardTitle>
              <Bus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalBuses}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Buses</CardTitle>
              <Activity className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeBuses}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalStudents}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Distance Today</CardTitle>
              <Route className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalDistanceToday} km</div>
            </CardContent>
          </Card>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-4">
          <Link href="/admin/buses/new">
            <Button>
              <Bus className="h-4 w-4 mr-2" />
              Add New Bus
            </Button>
          </Link>
          <Link href="/admin/students/import">
            <Button variant="outline">
              <Users className="h-4 w-4 mr-2" />
              Import Students
            </Button>
          </Link>
        </div>

        {/* Bus Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Live Bus Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Loading bus data...</p>
              </div>
            ) : buses.length === 0 ? (
              <div className="text-center py-8">
                <Bus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No buses added yet.</p>
                <Link href="/admin/buses/new">
                  <Button className="mt-4">Add Your First Bus</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {buses.map((bus) => {
                  const position = busPositions[bus.id];
                  const dailyStats = busStats[bus.id];
                  const hasPosition = !!position;
                  const lastUpdate = position?.timestamp 
                    ? new Date(position.timestamp)
                    : null;
                  const isRecent = lastUpdate && (Date.now() - lastUpdate.getTime()) < 300000; // 5 min

                  return (
                    <div 
                      key={bus.id} 
                      className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {/* Bus Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${isRecent ? 'bg-green-500 animate-pulse' : hasPosition ? 'bg-yellow-500' : 'bg-gray-300'}`} />
                          <div>
                            <p className="font-semibold text-lg">Bus {bus.busNo}</p>
                            <p className="text-xs text-muted-foreground">
                              Device: {bus.deviceId || 'N/A'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={isRecent ? 'success' : hasPosition ? 'warning' : 'secondary'}>
                            {isRecent ? 'Live' : hasPosition ? 'Stale' : 'Offline'}
                          </Badge>
                          <Link href={`/admin/buses/${bus.id}`}>
                            <Button variant="outline" size="sm">View Details</Button>
                          </Link>
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-3">
                        <div className="flex items-center gap-2">
                          <Gauge className="h-4 w-4 text-blue-500" />
                          <div>
                            <p className="text-xs text-muted-foreground">Speed</p>
                            <p className="font-medium">{position?.speedKmh ?? 0} km/h</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-green-500" />
                          <div>
                            <p className="text-xs text-muted-foreground">Position</p>
                            <p className="font-medium text-xs">
                              {position ? `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}` : 'N/A'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Route className="h-4 w-4 text-purple-500" />
                          <div>
                            <p className="text-xs text-muted-foreground">Today</p>
                            <p className="font-medium">{dailyStats?.totalDistanceKm?.toFixed(1) ?? 0} km</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Fuel className="h-4 w-4 text-orange-500" />
                          <div>
                            <p className="text-xs text-muted-foreground">Fuel Est.</p>
                            <p className="font-medium">{dailyStats?.predictedFuelUsedLiters?.toFixed(1) ?? 0} L</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="text-xs text-muted-foreground">Last Update</p>
                            <p className="font-medium text-xs">
                              {lastUpdate ? lastUpdate.toLocaleTimeString() : 'N/A'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
