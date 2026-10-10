/**
 * 阶段数据工具函数
 * - 路径转 URL
 */

/** 将后端本地文件路径转换为浏览器可访问的 URL */
export function assetUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http') || path.startsWith('/') || path.startsWith('blob:') || path.startsWith('data:')) return path;
  return '/' + path;
}

export function assetVersionLabel(path: string, index: number): string {
  const file = (path || '').split('/').pop() || '';
  const uploadMatch = file.match(/_upload_(v\d+)/i);
  if (uploadMatch) return `用户上传: ${uploadMatch[1].toLowerCase()}`;
  const aiMatch = file.match(/_v(\d+)\.[^.]+$/i);
  const version = aiMatch ? `v${aiMatch[1]}` : `v${index + 1}`;
  return `AI生成: ${version}`;
}
