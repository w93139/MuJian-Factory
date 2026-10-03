'use client';

import { Suspense } from 'react';
import PipelinePage from '@/components/pipelines/PipelinePage';
import ReadOnlyHistory from '@/components/ReadOnlyHistory';
import { useAuth } from '@/components/AuthProvider';

export default function StandardPipelinePage() {
  const { canEdit } = useAuth();
  return (
    <Suspense fallback={null}>
      {canEdit ? <PipelinePage
        pipeline="standard"
        title="文艺短视频"
        subtitle="输入创作灵感或完整文案，生成图片拼接或动态视频短片"
      /> : <ReadOnlyHistory title="文艺短视频历史" pipeline="standard" />}
    </Suspense>
  );
}
