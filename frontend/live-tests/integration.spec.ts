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
  await page.getByRole("button", { name: "编辑分镜", exact: true }).click();
  const first = page.locator('[data-segment-id="seg_01_01"]');
  await first
    .getByLabel("镜头 1 描述", { exact: true })
    .fill("真实接口已修改第一镜");
  await first.getByLabel("镜头 1 时长", { exact: true }).fill("6");
  await first.getByRole("button", { name: "添加镜头到片段 1" }).click();
  await first.getByLabel("镜头 3 描述", { exact: true }).fill("新增第三镜");
  await page.getByRole("button", { name: "保存分镜", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "编辑分镜", exact: true }),
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
  expect(
    snapshot.artifacts.storyboard.episodes[0].segments[0].total_duration,
  ).toBe(13);
  expect(
    snapshot.artifacts.reference_generation.scenes.find(
      (x: any) => x.id === "seg_01_01",
    ).versions,
  ).toHaveLength(2);
  await page.goto("/?session=live-edit&stage=reference_generation");
  const card = page.locator('[data-asset-id="seg_01_01"]');
  await card.getByLabel("窗边参考图 素材版本").selectOption({ index: 2 });
  await expect(card.getByRole("img")).toHaveAttribute("src", /version=2/);
  await page.reload();
  await expect(card.getByLabel("窗边参考图 素材版本")).toHaveValue(/version=2/);
  await card.getByLabel("窗边参考图 描述").fill("真实参考图提示词");
  await page.getByRole("heading", { name: "片段参考图" }).click();
  await expect(page.getByText("操作已完成")).toBeVisible();
  const saved = await (
    await page.request.get("/api/project/live-edit/status")
  ).json();
  expect(saved.artifacts.reference_generation.scenes[0].visual_prompt).toBe(
    "真实参考图提示词",
  );
  expect(saved.artifacts.storyboard.episodes[0].segments[0].visual_prompt).toBe(
    "真实参考图提示词",
  );
});
test("真实API：并发冲突保留草稿并显示后端错误", async ({ page }) => {
  await admin(page);
  await page.goto(url);
  await page.getByRole("button", { name: "编辑分镜", exact: true }).click();
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
  await page.getByRole("button", { name: "保存分镜", exact: true }).click();
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
  await page.getByRole("button", { name: "确认续写", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "第 3 集", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "第 3 集", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "确认续写", exact: true }),
  ).toHaveCount(0);
  await page.goto("/?session=live-discard&stage=script_generation");
  await page.getByRole("button", { name: "舍弃续写", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "舍弃续写", exact: true }),
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
  await expect(page.getByTestId("storyboard-episode")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "编辑分镜", exact: true }),
  ).toHaveCount(0);
  expect(
    (
      await page.request.patch("/api/project/live-edit/artifact/storyboard", {
        data: { episodes: [] },
      })
    ).status(),
  ).toBe(403);
  await page.goto("/?session=live-edit&stage=reference_generation");
  const card = page.locator('[data-asset-id="seg_01_01"]');
  await expect(card.getByRole("combobox")).toBeDisabled();
  await expect(card.getByRole("img")).toBeVisible();
  expect(
    (await page.request.get("/code/result/image/e2e-showcase/image.png")).ok(),
  ).toBeTruthy();
  await page.goto("/?session=e2e-private&stage=storyboard");
  await expect(page.locator(".live-error")).toContainText("404");
});

test("真实API：剧集和片段增删保存，不更换原有素材ID", async ({ page }) => {
  await admin(page);
  await page.goto("/?session=live-add&stage=storyboard");
  await page.getByRole("button", { name: "编辑分镜", exact: true }).click();
  await page.getByRole("button", { name: "添加剧集", exact: true }).click();
  await page
    .getByRole("button", { name: "添加片段到第 3 集", exact: true })
    .click();
  const ep = page.getByTestId("storyboard-episode").nth(2);
  await ep.getByLabel("镜头 1 描述", { exact: true }).fill("第三集新镜头");
  await page.getByRole("button", { name: "保存分镜", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "编辑分镜", exact: true }),
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
  await page.getByRole("button", { name: "编辑分镜", exact: true }).click();
  await page.getByRole("button", { name: "删除第 3 集", exact: true }).click();
  await page.getByRole("button", { name: "保存分镜", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "编辑分镜", exact: true }),
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
  await page.goto("/?session=live-add&stage=script_generation");
  await page.getByRole("button", { name: "继续生成剧本", exact: true }).click();
  await expect(page.locator(".live-error").first()).toContainText(
    "Missing required model configuration",
  );
  await expect(page.locator(".live-status")).not.toContainText("操作已完成");
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
    page.getByRole("button", { name: "编辑分镜", exact: true }),
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
