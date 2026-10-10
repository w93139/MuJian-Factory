'use client';

import React, { useState, useRef, useEffect } from 'react';
import { RefreshCw, ChevronLeft, ChevronRight, Loader, AlertCircle, ZoomIn, ImagePlus, Edit2, Save, X, Upload } from 'lucide-react';
import type { StageViewProps } from './types';
import { assetUrl, assetVersionLabel } from './utils';
import { patchStageArtifact, uploadArtifactImage } from '@/lib/workflowApi';
import StageActions from './StageActions';
import StageProgress from './StageProgress';
import ImageLightbox from './ImageLightbox';
import ErrorDetails from '@/components/ErrorDetails';

/* ─── 类型 ─── */
interface SceneItem {
  id: string;             // shot_001_01, shot_001_02, ...
  name: string;           // 场景1-镜头1
  index?: number;         // 全局编号
  description: string;    // 视觉提示词
  selected: string;       // 当前选中的文件路径
  versions: string[];     // 所有历史版本路径
  status?: 'pending' | 'done' | 'failed' | 'running';
  error?: string;
}

/* ─── 水平滚动图片画廊 ─── */
function ImageGallery({
  versions,
  selected,
  onSelect,
  showPlaceholder,
  disabled = false,
}: {
  versions: string[];
  selected: string;
  onSelect: (path: string) => void;
  showPlaceholder?: boolean;
  disabled?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === 'left' ? -260 : 260, behavior: 'smooth' });
  };

  if (!versions.length) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-xs">
        暂无图片
      </div>
    );
  }

  return (
    <div className="relative group">
      {versions.length > 1 && (
        <>
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white/90 shadow border border-gray-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white/90 shadow border border-gray-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </>
      )}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide py-1 px-1"
        style={{ scrollbarWidth: 'none' }}
      >
        {versions.map((path, i) => {
          const isSelected = path === selected;
          return (
            <div
              key={path}
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-label={`选择版本 ${i + 1}`}
              aria-pressed={isSelected}
              aria-disabled={disabled}
              onClick={() => { if (!disabled) onSelect(path); }}
              onKeyDown={event => {
                if (event.target === event.currentTarget && !disabled && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault();
                  onSelect(path);
                }
              }}
              className={`flex-shrink-0 cursor-pointer rounded-lg overflow-hidden transition-all ${
                isSelected
                  ? 'ring-3 ring-emerald-500 shadow-lg shadow-emerald-200'
                  : 'ring-1 ring-gray-200 hover:ring-gray-300 hover:shadow-md'
              }`}
            >
              <div className="relative group/img">
                <img
                  src={assetUrl(path)}
                  alt={`v${i + 1}`}
                  className="h-32 w-auto object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(i); }}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity hover:bg-black/60"
                  title="放大查看"
                >
                  <ZoomIn className="w-3 h-3 text-white" />
                </button>
              </div>
              <div className={`text-center text-[10px] py-0.5 ${
                isSelected ? 'bg-emerald-500 text-white font-medium' : 'bg-gray-50 text-gray-400'
              }`}>
                {assetVersionLabel(path, i)}
              </div>
            </div>
          );
        })}
        {showPlaceholder && (
          <div className="flex-shrink-0 flex items-center justify-center h-32 aspect-video bg-gray-50 rounded-lg border border-dashed border-gray-200">
            <div className="flex items-center gap-2 text-gray-400 text-xs">
              <Loader className="w-4 h-4 animate-spin" />
              <span>生成中...</span>
            </div>
          </div>
        )}
      </div>
      {lightboxIndex !== null && (
        <ImageLightbox
          images={versions}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}

/* ─── 场景行 ─── */
function SceneRow({
  scene,
  canEdit,
  editDesc,
  onDescChange,
  onRegenerate,
  onSelectVersion,
  onSavePrompt,
  isStageRunning,
  isRegenerating,
  isEditing,
  onToggleEdit,
  getSelected,
  allowMissingGenerate,
  onCancelEdit,
  onUploadImage,
  isUploading,
  isSaving,
  isSelecting,
}: {
  scene: SceneItem;
  canEdit: boolean;
  editDesc: string;
  onDescChange: (val: string) => void;
  onRegenerate: () => void;
  onSelectVersion: (path: string) => void;
  onSavePrompt: () => void;
  isStageRunning?: boolean;
  isRegenerating?: boolean;
  isEditing?: boolean;
  onToggleEdit?: () => void;
  getSelected: (scene: SceneItem) => string;
  allowMissingGenerate?: boolean;
  onCancelEdit?: () => void;
  onUploadImage: (file: File) => void;
  isUploading?: boolean;
  isSaving?: boolean;
  isSelecting?: boolean;
}) {
  const isRunning = scene.status === 'running' || isRegenerating;
  const isPending = scene.status === 'pending';
  const isFailed = scene.status === 'failed' && !isRegenerating;
  const hasImage = Boolean(getSelected(scene)) || scene.versions.length > 0;
  const canGenerateMissing = Boolean(allowMissingGenerate) && !hasImage && !isRunning && !isRegenerating;
  const canShowRegenerate = !isRunning && !isPending && (hasImage || isFailed || canGenerateMissing);
  const hasChanges = editDesc !== scene.description;

  return (
    <div className={`flex flex-col xl:flex-row border rounded-xl overflow-hidden bg-white ${
      isFailed ? 'border-red-200' : 'border-gray-200'
    }`}>
      {/* 左侧: 提示词 */}
      <div className="w-full xl:w-80 xl:flex-shrink-0 p-4 border-b xl:border-b-0 xl:border-r border-gray-100 flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          <span className="flex items-center justify-center h-6 px-1.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex-shrink-0 whitespace-nowrap">
            {scene.index ?? scene.id.replace('Scene_', '')}
          </span>
          <span className="text-sm font-semibold text-gray-800 truncate">{scene.name || (scene as any).title || `片段 ${scene.index}`}</span>
          {isPending && (
            <span className="text-[10px] bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded">等待中</span>
          )}
          {isRunning && (
            <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">
              <Loader className="w-2.5 h-2.5 animate-spin" />生成中
            </span>
          )}
          {isFailed && (
            <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded">失败</span>
          )}
          {/* 编辑/保存按钮 */}
          {canEdit && !isStageRunning && (
            isEditing ? (
              <div className="ml-auto flex gap-1">
                <button
                  onClick={onCancelEdit}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100"
                >
                  <X className="w-3 h-3" />取消
                </button>
                <button
                  onClick={onSavePrompt}
                  disabled={!hasChanges || isSaving}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                    hasChanges
                      ? 'text-white bg-emerald-500 hover:bg-emerald-600'
                      : 'text-gray-400 bg-gray-100 cursor-not-allowed'
                  }`}
                >
                  <Save className="w-3 h-3" />
                  {isSaving ? '保存中' : '保存'}
                </button>
              </div>
            ) : (
              <button
                onClick={onToggleEdit}
                className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                <Edit2 className="w-3 h-3" />
                编辑
              </button>
            )
          )}
        </div>
        {isFailed && <ErrorDetails error={scene.error} className="mb-3" />}
        {isEditing ? (
          <textarea
            value={editDesc}
            onChange={e => onDescChange(e.target.value)}
            rows={5}
            className="h-[120px] text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-300"
          />
        ) : (
          <div className="h-[120px] overflow-y-auto pr-1 custom-scrollbar">
            <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{scene.description}</p>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {canShowRegenerate && (
            <button
              onClick={onRegenerate}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isFailed
                  ? 'text-red-600 bg-red-50 hover:bg-red-100'
                  : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
              }`}
            >
              <RefreshCw className="w-3 h-3" />
              {isFailed ? '点击重试' : hasImage ? '重新生成' : '生成'}
            </button>
          )}
          <label className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            isUploading
              ? 'text-gray-400 bg-gray-100 cursor-wait'
              : 'text-gray-600 bg-gray-100 hover:bg-gray-200 cursor-pointer'
          }`}>
            {isUploading ? <Loader className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            {isUploading ? '上传中...' : '上传照片'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={isUploading}
              onChange={e => {
                const file = e.target.files?.[0];
                e.currentTarget.value = '';
                if (file) onUploadImage(file);
              }}
            />
          </label>
        </div>
      </div>

      {/* 右侧: 图片画廊 / 占位 */}
      <div className="flex-1 min-w-0 p-3 flex items-center">
        {isRunning && !hasImage ? (
          <div className="flex items-center justify-center h-32 aspect-video bg-gray-50 rounded-lg border border-dashed border-gray-200">
            <div className="flex items-center gap-2 text-gray-400 text-xs">
              <Loader className="w-4 h-4 animate-spin" />
              <span>正在生成...</span>
            </div>
          </div>
        ) : !hasImage ? (
          <div className="flex items-center justify-center h-32 aspect-video bg-gray-50/60 rounded-lg border border-dashed border-gray-200">
            <div className="flex flex-col items-center gap-1 text-gray-400 text-xs">
              {isFailed ? (
                <>
              <AlertCircle className="w-4 h-4" />
                  <span>生成失败</span>
                  {!isRunning && (
                    <button
                      onClick={onRegenerate}
                      disabled={isRegenerating}
                      className="mt-1 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:text-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      点击重试
                    </button>
                  )}
                </>
              ) : (
                <>
                  <ImagePlus className="w-4 h-4" />
                  <span>{isPending ? '等待生成...' : '暂无图片'}</span>
                  {canGenerateMissing && (
                    <button
                      onClick={onRegenerate}
                      disabled={isRegenerating}
                      className="mt-1 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors disabled:text-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      生成
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="relative w-full">
            <ImageGallery
              versions={scene.versions}
              selected={getSelected(scene)}
              onSelect={onSelectVersion}
              disabled={isSelecting || isStageRunning}
              showPlaceholder={isRunning}
            />
            {isFailed && (
              <button
                onClick={onRegenerate}
                className="absolute top-1 right-1 z-10 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-white bg-red-500/80 hover:bg-red-600 shadow transition-colors"
              >
                <RefreshCw className="w-2.5 h-2.5" />
                重试
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── 主组件 ─── */
export default function ReferenceStage({ state, sessionId, onConfirm, onIntervene, onRegenerate, onUpdateArtifact, showConfirm, isRunning, hasPendingItems, hasNextStageStarted, scriptArtifact }: StageViewProps) {
  const [editDescs, setEditDescs] = useState<Record<string, string>>({});
  const [selectedVersions, setSelectedVersions] = useState<Record<string, string>>({});
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set());
  const regenerationStartCounts = useRef<Record<string, number>>({});
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});
  const selectingRef = useRef(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set());

  // 提取剧集标题映射
  const episodeTitleMap = React.useMemo(() => {
    const map: Record<number, string> = {};
    if (scriptArtifact?.episodes) {
      scriptArtifact.episodes.forEach((ep: any) => {
        // 关键修复：这里的字段名应该是 episode_number 和 act_title
        const epNum = ep.episode_number || ep.episode;
        const epTitle = ep.act_title || ep.title;
        if (epNum) {
          map[Number(epNum)] = epTitle || '';
        }
      });
    }
    return map;
  }, [scriptArtifact]);

  const getSelected = (scene: SceneItem) => selectedVersions[scene.id] || scene.selected;

  // 兼容旧格式: scene_images: {Scene_1: "path"} → scenes: [{id, ...}]
  const scenes: SceneItem[] = (() => {
    if (state.artifact?.scenes?.length) return state.artifact.scenes;
    if (state.artifact?.scene_images) {
      const si = state.artifact.scene_images as Record<string, string>;
      return Object.entries(si)
        .sort(([a], [b]) => {
          const na = parseInt(a.replace(/\D/g, '')) || 0;
          const nb = parseInt(b.replace(/\D/g, '')) || 0;
          return na - nb;
        })
        .map(([id, path]) => ({
          id,
          name: `场景 ${id.replace('Scene_', '')}`,
          description: '',
          selected: path,
          versions: [path],
          status: 'done' as const,
        }));
    }
    return [];
  })();

  const canEdit = state.status === 'waiting' || state.status === 'completed';

  // 当场景数据变化时，初始化编辑描述
  useEffect(() => {
    if (scenes.length > 0) {
      setEditDescs(prev => {
        const next: Record<string, string> = {};
        scenes.forEach(s => { next[s.id] = prev[s.id] ?? s.description; });
        return next;
      });
    }
  }, [scenes]);

  // 当对应片段新增版本或失败时，仅清除该片段的重新生成状态，支持多个任务并行。
  useEffect(() => {
    if (regeneratingIds.size === 0) return;
    setRegeneratingIds(prev => {
      let changed = false;
      const next = new Set(prev);
      for (const id of prev) {
        const scene = scenes.find(item => item.id === id);
        if (!scene) continue;
        const startCount = regenerationStartCounts.current[id] ?? 0;
        if ((scene.versions?.length || 0) > startCount || scene.status === 'failed') {
          next.delete(id);
          delete regenerationStartCounts.current[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [scenes, regeneratingIds.size]);

  const hasScenes = scenes.length > 0;

  // 保存单个提示词到后端 JSON
  const handleSavePrompt = async (sceneId: string) => {
    const newPrompt = editDescs[sceneId];
    if (!newPrompt) return;

    if (selectingRef.current || savingIds.has(sceneId)) return;
    setSaveErrors(prev => ({ ...prev, [sceneId]: '' }));
    setSavingIds(prev => new Set(prev).add(sceneId));
    try {
      await patchStageArtifact(sessionId, 'reference_generation', {
        segments: scenes.map(s => ({
          segment_id: s.id,
          visual_prompt: s.id === sceneId ? newPrompt : s.description
        }))
      });
      // 保存成功后关闭编辑模式
      setEditingIds(prev => {
        const next = new Set(prev);
        next.delete(sceneId);
        return next;
      });
      // 更新本地状态，使用保存后的值
      setEditDescs(prev => ({ ...prev, [sceneId]: newPrompt }));
      // 同步更新 artifact 以便后续阶段能获取最新的提示词
      if (onUpdateArtifact && state.artifact?.scenes) {
        const updatedScenes = state.artifact.scenes.map((s: SceneItem) =>
          s.id === sceneId ? { ...s, description: newPrompt } : s
        );
        onUpdateArtifact({ scenes: updatedScenes });
      }
    } catch (error) {
      setSaveErrors(prev => ({ ...prev, [sceneId]: error instanceof Error ? error.message : '保存提示词失败，请重试' }));
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(sceneId);
        return next;
      });
    }
  };

  // 切换编辑模式
  const handleToggleEdit = (sceneId: string) => {
    setEditingIds(prev => {
      const next = new Set(prev);
      if (next.has(sceneId)) {
        next.delete(sceneId);
      } else {
        next.add(sceneId);
      }
      return next;
    });
  };

  const handleCancelEdit = (sceneId: string) => {
    setSaveErrors(prev => ({ ...prev, [sceneId]: '' }));
    const scene = scenes.find(item => item.id === sceneId);
    setEditDescs(prev => ({ ...prev, [sceneId]: scene?.description || '' }));
    setEditingIds(prev => {
      const next = new Set(prev);
      next.delete(sceneId);
      return next;
    });
  };

  const handleUploadImage = async (sceneId: string, file: File) => {
    setUploadingIds(prev => new Set(prev).add(sceneId));
    try {
      const result = await uploadArtifactImage(sessionId, 'reference_generation', 'scenes', sceneId, file);
      if (result.artifact?.scenes) {
        onUpdateArtifact?.({ scenes: result.artifact.scenes });
      }
      setSelectedVersions(prev => ({ ...prev, [sceneId]: result.path }));
    } catch (error) {
      console.error('上传图片失败:', error);
    } finally {
      setUploadingIds(prev => {
        const next = new Set(prev);
        next.delete(sceneId);
        return next;
      });
    }
  };

  const handleRegenerate = (sceneId: string) => {
    const scene = scenes.find(item => item.id === sceneId);
    regenerationStartCounts.current[sceneId] = scene?.versions?.length || 0;
    setRegeneratingIds(prev => {
      const next = new Set(prev);
      next.add(sceneId);
      return next;
    });
    onIntervene({ regenerate_scenes: [sceneId] });
  };

  const handleSelectVersion = async (sceneId: string, path: string) => {
    if (selectingRef.current || savingIds.size > 0 || isRunning) return;
    selectingRef.current = true;
    setIsSelecting(true);
    setSaveErrors(prev => ({ ...prev, [sceneId]: '' }));
    try {
      // The backend merges by stable item ID; never send other items' stale selections.
      const result = await patchStageArtifact(sessionId, 'reference_generation', {
        scenes: [{ id: sceneId, selected: path }],
      }) as { status: string; artifact?: Record<string, unknown> };
      if (result.artifact) onUpdateArtifact?.(result.artifact);
      setSelectedVersions(prev => ({ ...prev, [sceneId]: path }));
    } catch (error) {
      setSaveErrors(prev => ({ ...prev, [sceneId]: error instanceof Error ? error.message : '保存素材版本失败，请重试' }));
    } finally {
      selectingRef.current = false;
      setIsSelecting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-gray-800">参考图生成</h2>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          基于角色/场景素材 + 分镜视觉描述，使用图生图生成场景参考图
        </p>

        {/* 运行中 */}
        {state.status === 'running' && (
          <StageProgress message={state.progressMessage} fallback="正在生成参考图..." progress={state.progress} color="emerald" />
        )}

        {isSelecting && <p role="status" className="mb-3 text-sm text-gray-500">正在保存素材版本</p>}

        {state.error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-4 rounded-xl mb-4">{state.error}</div>
        )}

        {/* ═══ 场景列表 ═══ */}
        {hasScenes && (
          <div className="space-y-10">
            {(() => {
              // 按剧集分组
              const episodes: Record<number, SceneItem[]> = {};
              scenes.forEach(s => {
                const ep = (s as any).episode || 1;
                if (!episodes[ep]) episodes[ep] = [];
                episodes[ep].push(s);
              });

              return Object.keys(episodes).sort((a, b) => Number(a) - Number(b)).map(epNum => {
                const epScenes = episodes[Number(epNum)];
                const fallbackTitle = (epScenes[0] as any).episode_title || `第 ${epNum} 集`;
                const scriptTitle = episodeTitleMap[Number(epNum)];
                const episodeTitle = scriptTitle ? `第 ${epNum} 集：${scriptTitle}` : fallbackTitle;
                
                return (
                  <div key={epNum} className="space-y-4">
                    <div className="flex items-center justify-between py-2 px-1 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                        <h3 className="text-base font-bold text-gray-800">{episodeTitle}</h3>
                      </div>
                      <span className="text-[11px] text-emerald-600 font-medium bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 italic">
                        {epScenes.length} 个片段
                      </span>
                    </div>

                    <div className="space-y-4">
                      {epScenes.map(scene => (
                        <div key={scene.id} className="relative">
                          {saveErrors[scene.id] && (
                            <div role="alert" className="mb-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
                              {saveErrors[scene.id]}。修改尚未保存，请重试。
                            </div>
                          )}
                          <SceneRow
                            scene={scene}
                            editDesc={editDescs[scene.id] ?? scene.description}
                            onDescChange={(val) => setEditDescs(prev => ({ ...prev, [scene.id]: val }))}
                            onSavePrompt={() => handleSavePrompt(scene.id)}
                            onRegenerate={() => handleRegenerate(scene.id)}
                            onSelectVersion={(path) => handleSelectVersion(scene.id, path)}
                            isStageRunning={state.status === 'running'}
                            isRegenerating={regeneratingIds.has(scene.id)}
                            isEditing={editingIds.has(scene.id)}
                            onToggleEdit={() => handleToggleEdit(scene.id)}
                            onCancelEdit={() => handleCancelEdit(scene.id)}
                            canEdit={canEdit}
                            getSelected={getSelected}
                            allowMissingGenerate={state.status !== 'pending'}
                            onUploadImage={file => handleUploadImage(scene.id, file)}
                            isUploading={uploadingIds.has(scene.id)}
                            isSaving={savingIds.has(scene.id) || isSelecting}
                            isSelecting={isSelecting || savingIds.size > 0}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* 如果有 artifact 数据（即使 status 是 pending），也显示内容 */}
        {!hasScenes && state.status === 'pending' && (
          <div className="text-center text-gray-400 text-sm py-20">等待上一阶段完成...</div>
        )}
      </div>

      {/* 底部操作栏 */}
      <StageActions
        status={state.status}
        onConfirm={onConfirm}
        showConfirm={showConfirm}
        onRegenerate={onRegenerate}
        stageId="reference_generation"
        hasPendingItems={hasPendingItems}
        hasNextStageStarted={hasNextStageStarted}
        isRunning={isRunning || isSelecting || savingIds.size > 0}
      />
    </div>
  );
}
