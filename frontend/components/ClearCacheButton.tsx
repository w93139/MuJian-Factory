'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { clearTempCache } from '@/lib/workflowApi';

export default function ClearCacheButton() {
  const { canEdit } = useAuth();
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  if (!canEdit) return null;
  const clear = async () => {
    setClearing(true);
    setMessage('');
    setError('');
    try {
      const result = await clearTempCache();
      if (result.errors?.length) {
        setError(`已清理 ${result.deleted} 项，部分缓存清理失败，请重试`);
      } else {
        setMessage(`缓存已清空，删除 ${result.deleted} 项，释放 ${Number(result.freed_mb || 0).toFixed(2)} MB`);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '清空缓存失败，请重试');
    } finally {
      setClearing(false);
    }
  };
  return <div className="mt-4 flex flex-wrap justify-center items-center gap-3 text-sm">
    <button type="button" disabled={clearing} onClick={() => void clear()} className="rounded-lg border px-3 py-2 disabled:opacity-50">
      {clearing ? '正在清理…' : '清空缓存'}
    </button>
    {message && <p role="status">{message}</p>}
    {error && <p role="alert" className="text-red-500">{error}</p>}
  </div>;
}
