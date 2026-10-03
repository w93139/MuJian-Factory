'use client';

import { useMemo } from 'react';
import { assetUrl } from '@/components/stages/utils';
import ErrorDetails from '@/components/ErrorDetails';

function mediaPaths(value: unknown, paths: Set<string>) {
  if (typeof value === 'string') {
    if (/\.(?:png|jpe?g|webp|gif|mp4|webm|mp3|wav|m4a)(?:\?|$)/i.test(value)) paths.add(value);
  } else if (Array.isArray(value)) {
    value.forEach(item => mediaPaths(item, paths));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach(item => mediaPaths(item, paths));
  }
}

function errorMessages(value: unknown, messages: Set<string>) {
  if (Array.isArray(value)) {
    value.forEach(item => errorMessages(item, messages));
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (key === 'error' && typeof item === 'string' && item.trim()) messages.add(item);
      else if (item && typeof item === 'object') errorMessages(item, messages);
    }
  }
}

function mediaUrl(path: string) {
  if (/^(https?:|blob:|data:)/.test(path)) return path;
  const codePath = path.indexOf('/code/');
  if (codePath >= 0) return path.slice(codePath);
  if (path.startsWith('/result/')) return `/code${path}`;
  if (path.startsWith('result/')) return `/code/${path}`;
  return assetUrl(path);
}

export default function ReadOnlyArtifacts({ value }: { value: unknown }) {
  const paths = useMemo(() => {
    const collected = new Set<string>();
    mediaPaths(value, collected);
    return Array.from(collected);
  }, [value]);
  const errors = useMemo(() => {
    const collected = new Set<string>();
    errorMessages(value, collected);
    return Array.from(collected);
  }, [value]);

  if (!value) return <p className="text-sm text-gray-400">该阶段暂无产物。</p>;
  return (
    <div className="space-y-5">
      {errors.map(error => <ErrorDetails key={error} error={error} />)}
      {paths.length > 0 && <div className="grid gap-4 md:grid-cols-2">
        {paths.map(path => /\.(?:mp4|webm)(?:\?|$)/i.test(path) ? (
          <video key={path} controls src={mediaUrl(path)} className="w-full rounded-xl bg-black" />
        ) : /\.(?:mp3|wav|m4a)(?:\?|$)/i.test(path) ? (
          <audio key={path} controls src={mediaUrl(path)} className="w-full" />
        ) : (
          <img key={path} src={mediaUrl(path)} alt="生成产物" className="max-h-96 w-full rounded-xl bg-gray-50 object-contain" />
        ))}
      </div>}
      <details className="rounded-xl border border-gray-200 bg-gray-50 p-4" open={paths.length === 0}>
        <summary className="cursor-pointer text-sm font-medium text-gray-600">查看内容详情</summary>
        <pre className="mt-3 max-h-[60vh] overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-gray-700">
          {JSON.stringify(value, null, 2)}
        </pre>
      </details>
    </div>
  );
}
