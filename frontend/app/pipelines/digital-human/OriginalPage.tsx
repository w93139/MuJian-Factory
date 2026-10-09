'use client';

import { Suspense } from 'react';
import PipelinePage from '@/components/pipelines/PipelinePage';
import ReadOnlyHistory from '@/components/ReadOnlyHistory';
import { useAuth } from '@/components/AuthProvider';

export default function DigitalHumanPipelinePage() {
  const { canEdit } = useAuth();
  return (
    <Suspense fallback={null}>
      {canEdit ? <PipelinePage
        pipeline="digital_human"
        title="数字人口播"
        subtitle="基于人物图片和文案生成数字人口播视频"
      /> : <ReadOnlyHistory title="数字人口播历史" pipeline="digital_human" />}
    </Suspense>
  );
}
