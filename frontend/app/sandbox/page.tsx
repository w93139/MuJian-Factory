'use client';

import { Suspense } from 'react';
import Sandbox from '@/components/Sandbox/Sandbox';
import ReadOnlyHistory from '@/components/ReadOnlyHistory';
import { useAuth } from '@/components/AuthProvider';

export default function SandboxPage() {
  const { canEdit } = useAuth();
  return (
    <Suspense fallback={<div className="p-8">加载中...</div>}>
      {canEdit ? <Sandbox /> : <ReadOnlyHistory title="临时工作台历史" />}
    </Suspense>
  );
}
