'use client';

import { useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';

export default function Providers({ children }: { children: React.ReactNode }) {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return <>{children}</>;
}
