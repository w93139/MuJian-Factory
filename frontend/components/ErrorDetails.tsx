'use client';

export default function ErrorDetails({ error, className = '' }: { error?: string | null; className?: string }) {
  if (!error) return null;
  return <details open={error.length <= 160} className={`rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 ${className}`}>
    <summary className="cursor-pointer font-medium">失败原因</summary>
    <p className="mt-1 whitespace-pre-wrap break-words">{error}</p>
  </details>;
}
