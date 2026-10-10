import { Suspense } from 'react';
import LivePage from '@/live/Page';
import OriginalPage from './OriginalPage';
import { ConceptPage } from '@/concepts/App';
export default function Page() {
  return process.env.NEXT_PUBLIC_MUJIAN_CONCEPT ? <Suspense fallback={<p>正在打开幕间…</p>}><ConceptPage /></Suspense> : process.env.NEXT_PUBLIC_MUJIAN_LEGACY === "1" ? <OriginalPage /> : <Suspense fallback={<p>正在打开幕间</p>}><LivePage /></Suspense>;
}
