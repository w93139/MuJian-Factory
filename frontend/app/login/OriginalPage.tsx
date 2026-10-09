'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loginWithInvite, loginWithPassword } from '@/lib/authApi';
import { useAuth } from '@/components/AuthProvider';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loading: authLoading, role, public_mode, refresh } = useAuth();
  const linkCode = searchParams.get('code') || '';
  const expired = searchParams.get('expired') === '1';
  const [mode, setMode] = useState<'guest' | 'admin'>('guest');
  const [code, setCode] = useState(linkCode);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const attemptedCode = useRef('');

  useEffect(() => {
    if (!authLoading && (!public_mode || role !== 'anonymous')) router.replace('/');
  }, [authLoading, public_mode, role, router]);

  useEffect(() => {
    if (authLoading || !public_mode || role !== 'anonymous' || !linkCode || attemptedCode.current === linkCode) return;
    attemptedCode.current = linkCode;
    setSubmitting(true);
    loginWithInvite(linkCode).then(refresh).then(() => router.replace('/')).catch(cause => {
      setError(cause instanceof Error ? cause.message : '邀请码登录失败');
    }).finally(() => setSubmitting(false));
  }, [authLoading, linkCode, public_mode, refresh, role, router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      if (mode === 'guest') await loginWithInvite(code.trim());
      else await loginWithPassword(password);
      await refresh();
      router.replace('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登录失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-7 flex items-center gap-3">
          <img src="/logo.png" alt="幕间" className="h-11 w-11 rounded-xl object-contain" />
          <div><h1 className="text-xl font-semibold text-gray-900">幕间</h1><p className="text-xs text-gray-500">面试演示入口</p></div>
        </div>
        <div className="mb-5 grid grid-cols-2 rounded-xl bg-gray-100 p-1 text-sm">
          <button type="button" onClick={() => { setMode('guest'); setError(''); }}
            className={`rounded-lg px-2 py-2 ${mode === 'guest' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>面试官邀请码</button>
          <button type="button" onClick={() => { setMode('admin'); setError(''); }}
            className={`rounded-lg px-2 py-2 ${mode === 'admin' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>管理员登录</button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {expired && !error && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">邀请码已失效或已过期，请重新登录。</p>}
          <label className="block text-sm text-gray-600">
            {mode === 'guest' ? '邀请码' : '管理员密码'}
            <input autoFocus type={mode === 'guest' ? 'text' : 'password'} required
              value={mode === 'guest' ? code : password}
              onChange={event => mode === 'guest' ? setCode(event.target.value) : setPassword(event.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 px-3 outline-none focus:border-blue-400" />
          </label>
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={submitting || authLoading}
            className="h-11 w-full rounded-xl bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {submitting ? '正在登录…' : '进入幕间'}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense fallback={null}><LoginForm /></Suspense>;
}
