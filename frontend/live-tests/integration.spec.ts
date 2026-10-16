import { test, expect, type Page } from "@playwright/test";
async function admin(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "管理员登录", exact: true }).click();
  await page.getByLabel("管理员密码").fill("e2e-admin-password");
  await page.getByRole("button", { name: "进入幕间" }).click();
  await expect(page).toHaveURL("/");
}
const url = "/?session=live-edit&stage=storyboard";
test("真实API：多集多镜头编辑保存刷新与片段素材版本保持", async ({ page }) => {
  await admin(page);
  await page.goto(url);
  await expect(page.getByTestId("storyboard-episode")).toHaveCount(2);
  await expect(page.getByTestId("storyboard-shot")).toHaveCount(3);
  await page.getByRole("button", { name: "修改", exact: true }).click();
  const first = page.locator('[data-segment-id="seg_01_01"]');
  await first
    .getByLabel("镜头 1 描述", { exact: true })
    .fill("真实接口已修改第一镜");
  await first.getByLabel("镜头 1 时长", { exact: true }).fill("6");
  await first.getByRole("button", { name: "插入新分镜点" }).click();
  await first.getByLabel("镜头 3 描述", { exact: true }).fill("新增第三镜");
  await page.getByRole("button", { name: "保存", exact: true }).first().click();
  await expect(
    page.getByRole("button", { name: "修改", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("storyboard-shot")).toHaveCount(4);
  await expect(
    page.getByText("真实接口已修改第一镜", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("远方第三镜", { exact: true })).toBeVisible();
  const snapshot = await (
    await page.request.get("/api/project/live-edit/status")
  ).json();
  expect(
    snapshot.artifacts.storyboard.episodes[0].segments[0].shots[0].custom_shot,
  ).toBe("keep");
  expect(snapshot.artifacts.storyboard.custom_top.keep).toBe(true);
  expect(snapshot.artifacts.storyboard.episodes[0].segments[0].shots[0].plot).toBe("真实接口已修改第一镜");
  expect(snapshot.artifacts.video_generation.clips.find((item: any) => item.id === "seg_01_01").description).toContain("真实接口已修改第一镜");
  expect(
    snapshot.artifacts.storyboard.episodes[0].segments[0].total_duration,
  ).toBe(15);
  expect(
    snapshot.artifacts.reference_generation.scenes.find(
      (x: any) => x.id === "seg_01_01",
    ).versions,
  ).toHaveLength(2);
  await page.goto("/?session=live-edit&stage=reference_generation");
  const version = page.getByRole("button", { name: "选择版本 2", exact: true }).first();
  await version.click();
  await expect(version).toHaveAttribute("aria-pressed", "true");
  await expect(version.getByRole("img")).toHaveAttribute("src", /version=2/);
  await page.reload();
  await expect(version).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "编辑", exact: true }).first().click();
  await page.locator("textarea").first().fill("真实参考图提示词");
  // 描述必须显式保存，失焦不能替用户提交。
  await page.getByRole("heading", { name: "参考图生成", exact: true }).click();
  const beforeSave = await (await page.request.get("/api/project/live-edit/status")).json();
  expect(beforeSave.artifacts.storyboard.episodes[0].segments[0].visual_prompt).not.toBe("真实参考图提示词");
  await page.getByRole("button", { name: "保存", exact: true }).first().click();
  await expect(page.locator("textarea")).toHaveCount(0);
  const saved = await (
    await page.request.get("/api/project/live-edit/status")
  ).json();
  expect(saved.artifacts.reference_generation.scenes[0].description).toBe(
    "真实参考图提示词",
  );
  expect(saved.artifacts.reference_generation.scenes[0].visual_prompt).toBe("真实参考图提示词");
  expect(saved.artifacts.storyboard.episodes[0].segments[0].visual_prompt).toBe(
    "真实参考图提示词",
  );
});
test("真实API：并发冲突保留草稿并显示后端错误", async ({ page }) => {
  await admin(page);
  await page.goto(url);
  await page.getByRole("button", { name: "修改", exact: true }).click();
  const first = page.locator('[data-segment-id="seg_01_01"]');
  await first.getByLabel("镜头 1 描述", { exact: true }).fill("本地未保存草稿");
  const a = await (
    await page.request.get("/api/project/live-edit/artifact/storyboard")
  ).json();
  a.artifact.episodes[1].episode_title = "另一窗口更新";
  expect(
    (
      await page.request.patch("/api/project/live-edit/artifact/storyboard", {
        data: {
          episodes: a.artifact.episodes,
          expected_storyboard: { ...a.artifact, episodes: undefined },
        },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await page.request.patch("/api/project/live-edit/artifact/storyboard", {
        data: { episodes: a.artifact.episodes },
      })
    ).ok(),
  ).toBeTruthy();
  await page.getByRole("button", { name: "保存", exact: true }).first().click();
  await expect(page.getByRole("alert").first()).toContainText(
    "分镜已被其他操作修改",
  );
  await expect(first.getByLabel("镜头 1 描述", { exact: true })).toHaveValue(
    "本地未保存草稿",
  );
});
test("真实API：确认和舍弃服务端续写草稿，无模型调用", async ({ page }) => {
  await admin(page);
  await page.goto("/?session=live-continue&stage=script_generation");
  await page.getByRole("button", { name: "保存新剧集", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /^第 3 集：/ }),
  ).toBeVisible();
  // 同页切换验证其他阶段已同步刷新，不能靠整页重载补救旧缓存。
  await page.getByRole("button", { name: "分镜", exact: true }).click();
  await expect(page.getByTestId("storyboard-episode")).toHaveCount(3);
  await expect(page.getByTestId("storyboard-episode").nth(2)).toContainText("第 3 集");
  await page.getByRole("button", { name: "剧本", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /^第 3 集：/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "保存新剧集", exact: true }),
  ).toHaveCount(0);
  await page.goto("/?session=live-discard&stage=script_generation");
  await page.getByRole("button", { name: "删除新剧集", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "删除新剧集", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByText("已经存在的续写草稿", { exact: true }),
  ).toHaveCount(0);
});
test("真实API：访客分镜只读、媒体可读、写入403", async ({ page }) => {
  await page.goto("/login?code=E2EDEMO2");
  await expect(page).toHaveURL("/");
  await page.goto(url);
  await page.getByRole("button", { name: /^分镜/ }).click();
  await expect(page.locator("pre")).toContainText("远方第三镜");
  await expect(page.getByRole("button", { name: "修改", exact: true })).toHaveCount(0);
  expect((await page.request.patch("/api/project/live-edit/artifact/storyboard", {
    data: { episodes: [] },
  })).status()).toBe(403);
  await page.getByRole("button", { name: /^参考图/ }).click();
  await expect(page.getByRole("img", { name: "生成产物" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "编辑", exact: true })).toHaveCount(0);
  expect((await page.request.get("/code/result/image/e2e-showcase/image.png")).ok()).toBeTruthy();
  await page.goto("/?session=e2e-private&stage=storyboard");
  await expect(page.getByRole("alert")).toBeVisible();
  expect((await page.request.get("/api/project/e2e-private/status")).status()).toBe(404);
});

test("真实API：剧集和片段增删保存，不更换原有素材ID", async ({ page }) => {
  await admin(page);
  await page.goto("/?session=live-add&stage=storyboard");
  await page.getByRole("button", { name: "修改", exact: true }).click();
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  const jsonEditor = page.locator("textarea");
  const episodes = JSON.parse(await jsonEditor.inputValue());
  episodes.push({
    episode_id: "test-episode-3", episode_number: 3, episode_title: "第三集",
    segments: [{ segment_id: "test-segment-3", segment_number: 1, episode_number: 3,
      shots: [{ shot_id: "test-shot-3", shot_number: 1, shot_type: "近景", duration: 3, content: "第三集新镜头" }] }],
  });
  await jsonEditor.fill(JSON.stringify(episodes));
  await page.getByRole("button", { name: "保存", exact: true }).first().click();
  await expect(
    page.getByRole("button", { name: "修改", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("storyboard-episode")).toHaveCount(3);
  const a = await (
    await page.request.get("/api/project/live-add/status")
  ).json();
  const seg = a.artifacts.storyboard.episodes[2].segments[0];
  expect(
    a.artifacts.video_generation.clips.find((x: any) => x.id === seg.segment_id)
      .episode,
  ).toBe(3);
  await page.getByRole("button", { name: "修改", exact: true }).click();
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  const updatedEpisodes = JSON.parse(await jsonEditor.inputValue());
  await jsonEditor.fill(JSON.stringify(updatedEpisodes.filter((ep: any) => ep.episode_number !== 3)));
  await page.getByRole("button", { name: "保存", exact: true }).first().click();
  await expect(
    page.getByRole("button", { name: "修改", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("storyboard-episode")).toHaveCount(2);
  const b = await (
    await page.request.get("/api/project/live-add/status")
  ).json();
  expect(
    b.artifacts.video_generation.orphaned_clips.find(
      (x: any) => x.id === seg.segment_id,
    ),
  ).toBeTruthy();
  expect(b.artifacts.reference_generation.scenes[0].id).toBe("seg_01_01");
});
test("真实API：缺少模型配置的生成请求显示失败，不伪报成功", async ({
  page,
}) => {
  await admin(page);
  // 仅将该浏览器看到的默认配置置空，执行与错误事件仍来自真实隔离后端。
  await page.route("**/api/config", async route => {
    const response = await route.fetch();
    const body = await response.json();
    body.config.models = {};
    await route.fulfill({ response, json: body });
  });
  await page.goto("/?session=live-add&stage=script_generation");
  await page.getByRole("button", { name: "重新生成", exact: true }).click();
  await expect(page.locator("#main-content")).toContainText(
    "Missing required model configuration",
  );
  await expect(page.locator("#main-content")).not.toContainText("操作已完成");
});

test("正式首页与分镜在桌面和移动视口可用", async ({ page }) => {
  await admin(page);
  await page.getByRole("button", { name: "暂停主视觉动效" }).click();
  await expect(
    page.getByRole("button", { name: "播放主视觉动效" }),
  ).toBeVisible();
  await page.screenshot({
    path: "../.local-artifacts/home-live.png",
    fullPage: true,
  });
  await page.goto("/?session=live-add&stage=storyboard");
  await expect(page.getByTestId("storyboard-shot")).toHaveCount(3);
  await page.screenshot({
    path: "../.local-artifacts/storyboard-live.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "修改", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "../.local-artifacts/storyboard-mobile.png",
    fullPage: true,
  });
});


test("介入 SSE 失败显示错误并解除运行状态，不调用模型", async ({ page }) => {
  await admin(page);
  await page.goto("/?session=live-edit&stage=script_generation");
  await expect(page.getByRole("button", { name: "修改", exact: true })).toBeVisible();
  let intercepted = false;
  await page.route("**/api/project/live-edit/intervene", async route => {
    intercepted = true;
    expect(route.request().postDataJSON().stage).toBe("script_generation");
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: '{"type":"error","content":"隔离测试：介入保存失败"}\n',
    });
  });
  await page.getByRole("button", { name: "修改", exact: true }).click();
  // 保留原结构编辑和保存按钮，失败由真实流解析路径处理。
  await page.getByRole("button", { name: "保存修改", exact: true }).click();
  await expect(page.locator("#main-content")).toContainText("隔离测试：介入保存失败");
  expect(intercepted).toBeTruthy();
  await expect(page.getByRole("button", { name: "重新生成", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: /停止/ })).toHaveCount(0);
});
