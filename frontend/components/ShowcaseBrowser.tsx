'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchSessions, getProjectStatus } from '@/lib/workflowApi';
import ReadOnlyArtifacts from '@/components/ReadOnlyArtifacts';

const STAGES = [
  ['script_generation', '剧本'],
  ['character_design', '角色'],
  ['storyboard', '分镜'],
  ['reference_generation', '参考图'],
  ['video_generation', '视频'],
  ['post_production', '成片'],
] as const;

type SessionSummary = { id: string; title?: string; idea?: string; date?: number; status?: Record<string, string> };
type SessionDetail = { artifacts?: Record<string, unknown>; status?: Record<string, string>; error?: string | null };

export default function ShowcaseBrowser() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [loaded, setLoaded] = useState<{ id: string; detail: SessionDetail } | null>(null);
  const [stage, setStage] = useState<string>(STAGES[0][0]);
  const [listError, setListError] = useState('');
  const [detailError, setDetailError] = useState<{ id: string; message: string } | null>(null);

  useEffect(() => {
    fetchSessions().then(setSessions).catch(cause => setListError(cause instanceof Error ? cause.message : '示例列表加载失败'));
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    getProjectStatus(sessionId).then(status => {
      setLoaded({ id: sessionId, detail: status as SessionDetail });
      setStage(STAGES[0][0]);
      setDetailError(null);
    }).catch(cause => setDetailError({ id: sessionId, message: cause instanceof Error ? cause.message : '示例加载失败' }));
  }, [sessionId]);

  const detail = loaded?.id === sessionId ? loaded.detail : null;
  const currentError = detailError?.id === sessionId ? detailError.message : '';
  const selected = sessions?.find(item => item.id === sessionId);
  return (
    <div className="min-h-screen bg-gray-50 px-5 py-8 md:px-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-semibold text-gray-900">示例作品</h1>
        <p className="mt-2 text-sm text-gray-500">从剧本、角色、分镜和参考图，一路查看视频片段与最终成片。</p>
        {listError && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-600">{listError}</p>}
        {!sessionId ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {sessions?.map(item => (
              <button key={item.id} type="button" onClick={() => router.push(`/?session=${encodeURIComponent(item.id)}`)}
                className="rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm hover:border-blue-200">
                <h2 className="font-medium text-gray-800">{item.title || item.idea || '未命名作品'}</h2>
                <p className="mt-2 text-xs text-gray-400">{item.date ? new Date(item.date * 1000).toLocaleDateString('zh-CN') : ''}</p>
              </button>
            ))}
            {!sessions && !listError && <p role="status" className="rounded-2xl border border-dashed border-gray-200 p-8 text-sm text-gray-500">正在加载示例作品…</p>}
            {sessions?.length === 0 && <p className="rounded-2xl border border-dashed border-gray-200 p-8 text-sm text-gray-500">目前还没有公开示例作品，请稍后再来查看。</p>}
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <button type="button" onClick={() => router.push('/')} className="text-sm text-blue-600">← 返回示例列表</button>
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-gray-800">{selected?.title || selected?.idea || '示例作品'}</h2>
              {!detail && !currentError && <p role="status" className="mt-5 text-sm text-gray-500">正在加载作品的六阶段产物…</p>}
              {currentError && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-600">{currentError}</p>}
              {detail && <>
              <div className="mt-5 flex flex-wrap gap-2">
                {STAGES.map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setStage(id)}
                    className={`rounded-lg px-3 py-2 text-sm ${stage === id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {label}{detail?.status?.[id] === 'completed' ? ' ✓' : ''}
                  </button>
                ))}
              </div>
              {detail?.error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">{detail.error}</p>}
              <div className="mt-6"><ReadOnlyArtifacts value={detail?.artifacts?.[stage]} /></div>
              </>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
