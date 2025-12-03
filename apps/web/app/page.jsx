'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const user = authApi.getUser();
    
    if (!user) {
      router.push('/login');
      return;
    }

    // Redirect based on role
    if (user.role === 'ADMIN') {
      router.push('/admin/dashboard');
    } else {
      router.push('/student/my-bus');
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  );
}
