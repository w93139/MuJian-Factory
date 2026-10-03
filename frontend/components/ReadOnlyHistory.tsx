'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import BrandHeader from '@/components/BrandHeader';
import ReadOnlyArtifacts from '@/components/ReadOnlyArtifacts';
import { fetchPipelineTasks, fetchSandboxHistory, type PipelineTask } from '@/lib/workflowApi';

type HistoryItem = { id: string; title: string; status?: string; error?: string | null; content: unknown };

export default function ReadOnlyHistory({ title, pipeline }: { title: string; pipeline?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get('task') || searchParams.get('record');
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (pipeline) {
      fetchPipelineTasks(100).then(tasks => setItems(tasks
        .filter((task: PipelineTask) => task.pipeline === pipeline)
        .map(task => ({
          id: task.task_id,
          title: String(task.output?.title || task.input?.title || task.input?.text || task.task_id),
          status: task.status,
          error: task.error,
          content: { output: task.output, artifacts: task.artifacts, input: task.input },
        }))
      )).catch(cause => setError(cause instanceof Error ? cause.message : '历史记录加载失败'));
    } else {
      fetchSandboxHistory().then(records => {
        setItems(records.map((record: Record<string, unknown>) => ({
          id: String(record.id),
          title: String((record.input as Record<string, unknown> | undefined)?.prompt || record.model || record.id),
          status: String(record.status || 'completed'),
          error: typeof record.error === 'string' ? record.error : null,
          content: { input: record.input, output: record.output },
        })));
      }).catch(cause => setError(cause instanceof Error ? cause.message : '历史记录加载失败'));
    }
  }, [pipeline]);

  const current = items.find(item => item.id === selectedId);
  return (
    <div className="min-h-screen bg-gray-50">
      <BrandHeader />
      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        <p className="mt-2 text-sm text-gray-500">展示模式下可浏览已有任务及产物。</p>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-600">{error}</p>}
        <div className="mt-6 grid gap-5 md:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-2">
            {items.map(item => <button key={item.id} type="button" onClick={() => router.push(`${pathname}?${pipeline ? 'task' : 'record'}=${encodeURIComponent(item.id)}`)}
              className={`w-full rounded-xl border bg-white p-4 text-left ${selectedId === item.id ? 'border-blue-300' : 'border-gray-200'}`}>
              <div className="truncate text-sm font-medium text-gray-700">{item.title}</div>
              <div className="mt-1 text-xs text-gray-400">{item.status || '未知状态'}</div>
            </button>)}
            {items.length === 0 && !error && <p className="rounded-xl border border-dashed border-gray-200 p-5 text-sm text-gray-400">暂无示例作品。</p>}
          </div>
          <div className="min-h-72 rounded-2xl border border-gray-200 bg-white p-5">
            {current ? <>
              <h2 className="mb-4 font-medium text-gray-800">{current.title}</h2>
              {current.error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">{current.error}</p>}
              <ReadOnlyArtifacts value={current.content} />
            </> : <p className="text-sm text-gray-400">选择一条记录查看产物。</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
