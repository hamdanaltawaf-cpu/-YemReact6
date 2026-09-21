'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { legacyInformationDestination } from '@/lib/information';

/** HTTP redirects preserve #fragments, but the server never receives them. */
export function LegacyInformationLink() {
  const router = useRouter();
  useEffect(() => {
    const follow = () => {
      const destination = legacyInformationDestination(window.location.hash);
      if (destination) router.replace(destination);
    };
    follow();
    window.addEventListener('hashchange', follow);
    return () => window.removeEventListener('hashchange', follow);
  }, [router]);
  return null;
}
