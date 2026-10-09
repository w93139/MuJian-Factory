'use client';

import { Suspense } from 'react';
import PipelinePage from '@/components/pipelines/PipelinePage';
import ReadOnlyHistory from '@/components/ReadOnlyHistory';
import { useAuth } from '@/components/AuthProvider';

export default function ActionTransferPipelinePage() {
  const { canEdit } = useAuth();
  return (
    <Suspense fallback={null}>
      {canEdit ? <PipelinePage
        pipeline="action_transfer"
        title="动作迁移"
        subtitle="用参考图片和动作视频生成角色动作迁移结果"
      /> : <ReadOnlyHistory title="动作迁移历史" pipeline="action_transfer" />}
    </Suspense>
  );
}
