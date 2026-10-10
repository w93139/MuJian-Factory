import { expect, test } from '@playwright/test';

// Real login; synthetic stage data and injected PATCH failures exercise UI error handling.
// No generation requests or paid providers are involved.
for (const [stage, collection, heading, status] of [
  ['reference_generation', 'scenes', '参考图生成', 409],
  ['video_generation', 'clips', '视频生成', 500],
] as const) {
  test(`${heading}保存失败保留草稿，成功重试才结束编辑`, async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: '管理员登录' }).click();
    await page.getByRole('textbox', { name: '管理员密码' }).fill('e2e-admin-password');
    await page.getByRole('button', { name: '进入幕间' }).click();
    await expect(page).toHaveURL('/');

    const item = { id: 'seg_01_01', name: '错误回归片段', description: '原提示词', versions: [], selected: '', status: 'done' };
    await page.route('**/api/project/e2e-showcase/status', async route => {
      const response = await route.fetch();
      const snapshot = await response.json();
      snapshot.artifacts[stage] = { [collection]: [item] };
      await route.fulfill({ response, json: snapshot });
    });
    const submitted: Record<string, unknown>[] = [];
    await page.route(`**/api/project/e2e-showcase/artifact/${stage}`, async route => {
      if (route.request().method() !== 'PATCH') return route.continue();
      submitted.push(route.request().postDataJSON());
      await route.fulfill({
        status: submitted.length === 1 ? status : 200,
        json: submitted.length === 1 ? { detail: '测试保存被拒绝' } : { status: 'ok' },
      });
    });
    await page.goto(`/?session=e2e-showcase&stage=${stage}`);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await page.getByRole('button', { name: '编辑', exact: true }).click();
    const draft = page.locator('textarea');
    await draft.fill('必须保留的未保存草稿');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    const error = page.locator('[role="alert"]').filter({ hasText: '测试保存被拒绝' });
    await expect(error).toContainText(`HTTP ${status}`);
    await expect(error).toContainText('修改尚未保存');
    await expect(draft).toHaveValue('必须保留的未保存草稿');
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(draft).toHaveCount(0);
    await expect(error).toHaveCount(0);
    expect(submitted).toHaveLength(2);
    expect(submitted[1]).toEqual(submitted[0]);
    expect(JSON.stringify(submitted[0])).toContain('必须保留的未保存草稿');
  });
}

for (const [stage, collection, heading] of [
  ['reference_generation', 'scenes', '参考图生成'],
  ['video_generation', 'clips', '视频生成'],
] as const) {
  test(`${heading}延迟选版串行保存且失败不改变原选择`, async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: '管理员登录' }).click();
    await page.getByRole('textbox', { name: '管理员密码' }).fill('e2e-admin-password');
    await page.getByRole('button', { name: '进入幕间' }).click();
    await expect(page).toHaveURL('/');

    // Synthetic media and PATCH responses test the UI only; no model calls occur.
    const extension = stage === 'reference_generation' ? 'png' : 'mp4';
    await page.route('**/selection-test/**', route => route.fulfill({
      path: extension === 'png' ? 'e2e/fixtures/image.png' : 'e2e/fixtures/video.mp4',
      contentType: extension === 'png' ? 'image/png' : 'video/mp4',
    }));
    const items = ['seg_01_01', 'seg_01_02'].map((id, index) => ({
      id, name: `选版片段 ${index + 1}`, description: `保留提示词 ${index + 1}`,
      versions: [`/selection-test/${id}-v1.${extension}`, `/selection-test/${id}-v2.${extension}`],
      selected: `/selection-test/${id}-v1.${extension}`, status: 'done', custom_metadata: id,
    }));
    await page.route('**/api/project/e2e-showcase/status', async route => {
      const response = await route.fetch();
      const snapshot = await response.json();
      snapshot.artifacts[stage] = { [collection]: items };
      await route.fulfill({ response, json: snapshot });
    });
    const submitted: Record<string, unknown>[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>(resolve => { releaseFirst = resolve; });
    await page.route(`**/api/project/e2e-showcase/artifact/${stage}`, async route => {
      if (route.request().method() !== 'PATCH') return route.continue();
      const body = route.request().postDataJSON();
      submitted.push(body);
      if (submitted.length === 1) await firstGate;
      if (submitted.length === 2) {
        await route.fulfill({ status: 500, json: { detail: '测试选版被拒绝' } });
        return;
      }
      for (const patch of body[collection]) {
        const item = items.find(value => value.id === patch.id);
        if (item) item.selected = patch.selected;
      }
      await route.fulfill({ json: { status: 'ok', artifact: { [collection]: items } } });
    });
    await page.goto(`/?session=e2e-showcase&stage=${stage}`);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    const originals = page.getByRole('button', { name: '选择版本 1', exact: true });
    const alternatives = page.getByRole('button', { name: '选择版本 2', exact: true });
    await alternatives.nth(0).click();
    await expect(page.getByRole('status')).toContainText('正在保存素材版本');
    await expect(originals.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await expect(alternatives.nth(1)).toHaveAttribute('aria-disabled', 'true');
    // Force-click also reaches the handler guard; a pending save must not send a stale request.
    await alternatives.nth(1).click({ force: true });
    expect(submitted).toHaveLength(1);
    releaseFirst();
    await expect(alternatives.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await expect(alternatives.nth(1)).toHaveAttribute('aria-disabled', 'false');

    await alternatives.nth(1).click();
    await expect(page.getByRole('alert').filter({ hasText: '测试选版被拒绝' })).toContainText('HTTP 500');
    await expect(originals.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(alternatives.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await alternatives.nth(1).click();
    await expect(alternatives.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('alert').filter({ hasText: '测试选版被拒绝' })).toHaveCount(0);
    expect(submitted).toEqual([
      { [collection]: [{ id: items[0].id, selected: items[0].versions[1] }] },
      { [collection]: [{ id: items[1].id, selected: items[1].versions[1] }] },
      { [collection]: [{ id: items[1].id, selected: items[1].versions[1] }] },
    ]);
    await page.reload();
    await expect(alternatives.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await expect(alternatives.nth(1)).toHaveAttribute('aria-pressed', 'true');
    expect(items.map(item => item.custom_metadata)).toEqual(['seg_01_01', 'seg_01_02']);
    expect(items.map(item => item.versions.length)).toEqual([2, 2]);
  });
}
