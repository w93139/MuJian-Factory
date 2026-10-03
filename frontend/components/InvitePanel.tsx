'use client';

import { useEffect, useState } from 'react';
import { createInvite, fetchDailyUsage, fetchInvites, revokeInvite, type DailyUsage, type InviteCode } from '@/lib/authApi';

export default function InvitePanel() {
  const [invites, setInvites] = useState<InviteCode[]>([]);
  const [usage, setUsage] = useState<DailyUsage | null>(null);
  const [note, setNote] = useState('');
  const [hours, setHours] = useState(72);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const reload = async () => {
    setInvites(await fetchInvites());
  };

  useEffect(() => {
    void reload().catch(cause => setError(cause instanceof Error ? cause.message : '邀请码加载失败'));
    fetchDailyUsage().then(setUsage).catch(() => {});
  }, []);

  const create = async () => {
    setBusy(true); setError('');
    try {
      await createInvite(note.trim(), hours);
      setNote('');
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '创建邀请码失败');
    } finally { setBusy(false); }
  };

  const revoke = async (code: string) => {
    setBusy(true); setError('');
    try { await revokeInvite(code); await reload(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '作废邀请码失败'); }
    finally { setBusy(false); }
  };

  const copy = async (code: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/login?code=${encodeURIComponent(code)}`);
    setCopied(code);
  };

  return <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
    <h2 className="text-sm font-semibold text-gray-800">面试官邀请码</h2>
    <p className="mt-1 text-xs text-gray-500">邀请码只授予浏览示例作品的权限。</p>
    {usage && <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
      今日估算用量 ¥{usage.total_cny}{usage.limit_cny && ` / ¥${usage.limit_cny}`}
      {usage.remaining_cny && `，剩余 ¥${usage.remaining_cny}`}
    </p>}
    <div className="mt-4 flex flex-wrap gap-2">
      <input value={note} onChange={event => setNote(event.target.value)} placeholder="备注，例如某公司面试"
        className="h-10 min-w-48 flex-1 rounded-lg border border-gray-200 px-3 text-sm" />
      <select value={hours} onChange={event => setHours(Number(event.target.value))}
        className="h-10 rounded-lg border border-gray-200 px-3 text-sm">
        <option value={24}>24 小时</option><option value={72}>72 小时</option><option value={168}>7 天</option>
      </select>
      <button type="button" disabled={busy} onClick={() => void create()}
        className="h-10 rounded-lg bg-blue-600 px-4 text-sm text-white disabled:opacity-50">生成邀请码</button>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    <div className="mt-4 space-y-2">
      {invites.map(invite => <div key={invite.code} className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-100 p-3 text-sm">
        <code className="font-semibold text-gray-800">{invite.code}</code>
        <span className="text-gray-500">{invite.note || '无备注'}</span>
        <span className="text-xs text-gray-400">{invite.expires_at ? `到期 ${new Date(invite.expires_at).toLocaleString('zh-CN')}` : ''}</span>
        {invite.revoked && <span className="text-xs text-red-500">已作废</span>}
        <div className="ml-auto flex gap-3 text-xs">
          {!invite.revoked && <button type="button" onClick={() => void copy(invite.code)} className="text-blue-600">{copied === invite.code ? '已复制' : '复制链接'}</button>}
          {!invite.revoked && <button type="button" disabled={busy} onClick={() => void revoke(invite.code)} className="text-red-600">作废</button>}
        </div>
      </div>)}
      {invites.length === 0 && <p className="text-xs text-gray-400">暂无邀请码。</p>}
    </div>
  </section>;
}
