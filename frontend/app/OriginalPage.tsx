'use client';

import { Suspense } from 'react';
import WorkflowPanel from '@/components/WorkflowPanel';
import ShowcaseBrowser from '@/components/ShowcaseBrowser';
import { useAuth } from '@/components/AuthProvider';

function Loading() {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-500">加载中...</p>
      </div>
    </div>
  );
}

export default function Home() {
  const { canEdit } = useAuth();
  return (
    <Suspense fallback={<Loading />}>
      {canEdit ? <WorkflowPanel /> : <ShowcaseBrowser />}
    </Suspense>
  );
}
