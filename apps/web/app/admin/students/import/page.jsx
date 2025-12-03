'use client';

import { useEffect, useState, useRef } from 'react';
import { Upload, Users, Trash2, Bus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import AdminLayout from '@/components/layout/AdminLayout';
import { studentsApi, busApi } from '@/lib/api';

export default function StudentsImportPage() {
  const fileInputRef = useRef(null);
  const [students, setStudents] = useState([]);
  const [buses, setBuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [studentData, busData] = await Promise.all([
        studentsApi.getAll().catch(() => ({ students: [] })),
        busApi.getAll().catch(() => ({ buses: [] })),
      ]);
      setStudents(studentData.students || []);
      setBuses(busData.buses || []);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setMessage({ type: 'error', text: 'Please upload an Excel file (.xlsx or .xls)' });
      return;
    }

    setUploading(true);
    setMessage({ type: '', text: '' });

    try {
      const result = await studentsApi.import(file);
      setMessage({ 
        type: 'success', 
        text: result.message || `Import completed. Created: ${result.results?.created || 0}, Updated: ${result.results?.updated || 0}` 
      });
      fetchData(); // Refresh list
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Import failed' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  async function handleDelete(id) {
    if (!confirm('Are you sure you want to delete this student?')) return;

    try {
      await studentsApi.delete(id);
      setStudents(students.filter(s => s._id !== id));
      setMessage({ type: 'success', text: 'Student deleted' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to delete student' });
    }
  }

  async function handleAssignBus(studentId, busId) {
    try {
      await studentsApi.assignBus(studentId, busId || null);
      fetchData(); // Refresh to get updated assignments
      setMessage({ type: 'success', text: 'Bus assignment updated' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to assign bus' });
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Student Management</h2>
          <p className="text-muted-foreground">Import students from Excel and assign buses</p>
        </div>

        {/* Message */}
        {message.text && (
          <div className={`p-4 rounded-md ${
            message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
          }`}>
            {message.text}
          </div>
        )}

        {/* Upload card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import Students
            </CardTitle>
            <CardDescription>
              Upload an Excel file with columns: studentId, name
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                id="excel-upload"
              />
              <Button 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : 'Choose Excel File'}
              </Button>
              <p className="text-sm text-muted-foreground">
                Default password for imported students: <code className="bg-gray-100 px-1 rounded">baiustbus123#</code>
              </p>
            </div>

            <div className="mt-4 p-4 bg-gray-50 rounded-md">
              <p className="text-sm font-medium mb-2">Excel Format Example:</p>
              <table className="text-sm border">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border px-3 py-1">studentId</th>
                    <th className="border px-3 py-1">name</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border px-3 py-1">STU001</td>
                    <td className="border px-3 py-1">John Doe</td>
                  </tr>
                  <tr>
                    <td className="border px-3 py-1">STU002</td>
                    <td className="border px-3 py-1">Jane Smith</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Students list */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Students ({students.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : students.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No students imported yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Assigned Bus</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student._id}>
                      <TableCell className="font-medium">{student.username}</TableCell>
                      <TableCell>{student.name}</TableCell>
                      <TableCell>
                        <select
                          value={student.assignedBusId || ''}
                          onChange={(e) => handleAssignBus(student._id, e.target.value)}
                          className="border rounded px-2 py-1 text-sm"
                        >
                          <option value="">Not Assigned</option>
                          {buses.map((bus) => (
                            <option key={bus.id} value={bus.id}>
                              Bus {bus.busNo}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        {new Date(student.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDelete(student._id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
