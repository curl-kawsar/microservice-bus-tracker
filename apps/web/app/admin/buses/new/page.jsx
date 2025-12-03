'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bus } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AdminLayout from '@/components/layout/AdminLayout';
import { busApi } from '@/lib/api';

export default function NewBusPage() {
  const router = useRouter();
  const [busNo, setBusNo] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await busApi.create({ busNo, deviceId });
      router.push('/admin/buses');
    } catch (err) {
      setError(err.message || 'Failed to create bus');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/buses">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold">Add New Bus</h2>
            <p className="text-muted-foreground">Register a new bus with GPS tracker</p>
          </div>
        </div>

        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bus className="h-5 w-5" />
              Bus Details
            </CardTitle>
            <CardDescription>
              Enter the bus number and tracker IP address
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="busNo">Bus Number</Label>
                <Input
                  id="busNo"
                  type="text"
                  placeholder="e.g., BUS-001"
                  value={busNo}
                  onChange={(e) => setBusNo(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="deviceId">Device ID</Label>
                <Input
                  id="deviceId"
                  type="text"
                  placeholder="e.g., bus01"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  The device ID from the GPS tracking system (e.g., bus01, bus02)
                </p>
              </div>

              <div className="flex gap-4">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Bus'}
                </Button>
                <Link href="/admin/buses">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
