import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
const screenshots = path.resolve(__dirname, "../../screenshots");
const stages = [
  "script_generation",
  "character_design",
  "storyboard",
  "reference_generation",
  "video_generation",
  "post_production",
];
async function ready(page: Page, url = "/") {
  await page.goto(url);
  await expect(page.locator(".concept[data-variant]")).toBeVisible();
  await expect(page.locator(".loading-state")).toHaveCount(0);
}
async function scenario(page: Page, label: string) {
  await page.locator(".scenario-menu summary").click();
  await page
    .locator(".scenario-menu")
    .getByRole("button", { name: label, exact: true })
    .click();
}

test("入口隔离、全部页面、媒体与三视口截图", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page);
  await expect(page.locator(".concept")).toHaveAttribute(
    "data-variant",
    info.project.name,
  );
  const routes = [
    ["home", "/"],
    ["script", "/?session=demo-orbit&stage=script_generation"],
    ["characters", "/?session=demo-orbit&stage=character_design"],
    ["storyboard", "/?session=demo-orbit&stage=storyboard"],
    ["references", "/?session=demo-orbit&stage=reference_generation"],
    ["videos", "/?session=demo-orbit&stage=video_generation"],
    ["final", "/?session=demo-orbit&stage=post_production"],
    ["standard", "/pipelines/standard?task=demo-standard"],
    ["action", "/pipelines/action-transfer?task=demo-action"],
    ["human", "/pipelines/digital-human?task=demo-human"],
    ["sandbox", "/sandbox?task=demo-sandbox"],
    ["settings", "/settings"],
    ["login", "/login"],
  ];
  for (const [name, url] of routes) {
    await ready(page, url);
    await expect(page.locator("main")).toBeVisible();
    const media = await page
      .locator("main img")
      .evaluateAll((imgs) =>
        imgs.every(
          (i) =>
            (i as HTMLImageElement).complete &&
            (i as HTMLImageElement).naturalWidth > 0,
        ),
      );
    expect(media).toBeTruthy();
    await page.screenshot({
      path: path.join(
        screenshots,
        info.project.name + "-" + name + "-desktop.png",
      ),
      fullPage: true,
    });
  }
  for (const [label, width, height] of [
    ["laptop", 1024, 768],
    ["mobile", 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    for (const [name, url] of routes) {
      await ready(page, url);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBeTruthy();
      await page.screenshot({
        path: path.join(
          screenshots,
          info.project.name + "-" + name + "-" + label + ".png",
        ),
        fullPage: true,
      });
    }
  }
  expect(errors).toEqual([]);
});

test("手动六阶段：创建、确认、继续、成片和下载", async ({ page }) => {
  await ready(page);
  await page
    .getByRole("textbox", { name: "故事创意" })
    .fill("一个宇航员寻找故乡的故事");
  await page.getByText("模型与高级选项", { exact: true }).click();
  await page.getByLabel("自动推进六阶段").uncheck();
  await page.getByRole("button", { name: "完成设置", exact: true }).click();
  await page.getByRole("button", { name: "创建项目", exact: true }).click();
  await expect(page).toHaveURL(/session=project-/);
  await expect(page.locator(".stage-status-row")).toContainText("待确认", {
    timeout: 12000,
  });
  await page.getByRole("button", { name: "确认并继续", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("请先确认故事方向");
  await expect(page).toHaveURL(/stage=script_generation/);
  await page.getByRole("button", { name: "确认故事方向", exact: true }).click();
  await page.getByRole("button", { name: "编辑剧本", exact: true }).click();
  await page
    .getByLabel("第 1 集剧本", { exact: true })
    .fill("测试保存的剧本：一封信，让旅程有了新的方向。");
  await page.getByRole("button", { name: "保存剧本", exact: true }).click();
  await expect(page.locator(".script-text")).toContainText("测试保存的剧本");
  for (let i = 0; i < 5; i++) {
    await expect(page.locator(".stage-status-row")).toContainText("待确认", {
      timeout: 12000,
    });
    await page.getByRole("button", { name: "确认并继续", exact: true }).click();
    await expect(page).toHaveURL(new RegExp("stage=" + stages[i + 1]));
  }
  await expect(page.locator(".stage-status-row")).toContainText("已完成", {
    timeout: 12000,
  });
  const video = page.locator(".final-film video");
  await expect(video).toBeVisible();
  await expect
    .poll(() => video.evaluate((v) => (v as HTMLVideoElement).readyState))
    .toBeGreaterThan(0);
  const duration = await video.evaluate(
    (v) => (v as HTMLVideoElement).duration,
  );
  expect(duration).toBeCloseTo(30, 0);
  await video.evaluate((v) => (v as HTMLVideoElement).play());
  await expect
    .poll(() => video.evaluate((v) => (v as HTMLVideoElement).currentTime))
    .toBeGreaterThan(0);
  const dl = page.waitForEvent("download");
  await page.getByRole("link", { name: "下载本集示例" }).click();
  expect((await dl).suggestedFilename()).toContain("幕间");
  await page.reload();
  await expect(page.locator(".final-film")).toBeVisible();
});

test("快速演示保持约30秒、1集、720P并自动完成", async ({ page }) => {
  await ready(page);
  await page.getByRole("textbox", { name: "故事创意" }).fill("快速演示故事");
  await page.getByRole("button", { name: "快速演示", exact: true }).click();
  await expect(page).toHaveURL(/session=project-/);
  await expect(page.locator(".project-page-head")).toContainText("720P");
  await expect(page.locator(".project-page-head")).toContainText("1 集");
  await expect(page.locator(".project-page-head .status")).toContainText(
    "已完成",
    { timeout: 35000 },
  );
  await page.locator(".stage-navigation button").last().click();
  await expect(page.locator(".final-film")).toBeVisible();
});

test("分镜编辑、素材版本、上传与局部生成保持数据", async ({ page }) => {
  await ready(page, "/?session=demo-orbit&stage=storyboard");
  await page.getByRole("button", { name: "编辑镜头 1", exact: true }).click();
  await page.getByLabel("镜头描述").fill("保存后的镜头描述");
  await page.getByRole("button", { name: "保存分镜", exact: true }).click();
  await page.reload();
  await expect(page.locator(".shot-row").first()).toContainText(
    "保存后的镜头描述",
  );
  await ready(page, "/?session=demo-orbit&stage=character_design");
  await page
    .getByRole("button", { name: "选择 林遥 版本 2", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "选择 林遥 版本 2", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const card = page
    .locator(".asset-card")
    .filter({ has: page.getByRole("heading", { name: "林遥", exact: true }) });
  await card.getByText("上传替换素材", { exact: true }).click();
  await card
    .getByLabel("上传 林遥", { exact: true })
    .setInputFiles(path.resolve(__dirname, "../public/ui/inspiration-ink.png"));
  await expect(card.locator(".asset-versions button")).toHaveCount(3);
  await expect(card.locator(".asset-versions button").last()).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await card.getByRole("button", { name: "局部重生成", exact: true }).click();
  await expect(card).toHaveClass(/is-running/);
  await expect(card).not.toHaveClass(/is-running/, { timeout: 10000 });
  await expect(card.locator(".asset-versions button")).toHaveCount(4);
  await expect(card.locator(".asset-versions button").nth(2)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.reload();
  await expect(card.locator(".asset-versions button")).toHaveCount(4);
});

test("停止保留内容，失败重试，空状态与任务跳转", async ({ page }) => {
  await ready(page);
  await scenario(page, "生成中");
  await expect(page.locator(".progress-panel")).toBeVisible();
  await page.getByRole("button", { name: "停止执行", exact: true }).click();
  await expect(page.locator(".stage-status-row")).toContainText("已停止");
  await expect(page.locator(".asset-card")).toHaveCount(4);
  await page.getByRole("button", { name: "继续执行", exact: true }).click();
  await expect(page.locator(".stage-status-row")).toContainText("待确认", {
    timeout: 12000,
  });
  await scenario(page, "失败恢复");
  await expect(page.locator(".error-panel[role=alert]")).toContainText(
    "生成中断",
  );
  await page.getByRole("button", { name: "重试阶段", exact: true }).click();
  await expect(page.locator(".stage-status-row")).toContainText("待确认", {
    timeout: 12000,
  });
  await page.getByRole("button", { name: /^任务/ }).click();
  await page.locator(".task-drawer").getByRole("link").first().click();
  await expect(page).toHaveURL(/session=demo-orbit/);
  await scenario(page, "空内容");
  await expect(
    page.getByRole("heading", { name: "你的第一部作品，从这里开始" }),
  ).toBeVisible();
});

test("三流水线分别校验素材与提交字段", async ({ page }) => {
  for (const [route, , pipeline] of [
    ["standard", "视频文案", "standard"],
    ["action-transfer", "动作提示词", "action_transfer"],
    ["digital-human", "口播文案", "digital_human"],
  ]) {
    await ready(page, "/pipelines/" + route);
    await page.getByRole("button", { name: "开始演示", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("请先填写");
    await page
      .getByRole("button", { name: "使用示例素材", exact: true })
      .click();
    if (pipeline === "standard") {
      await page.getByText("配音与字幕设置", { exact: true }).click();
      await page.getByLabel("启用字幕模板").check();
      await page.getByLabel("字幕模板", { exact: true }).selectOption("paper");
    }
    await page.getByRole("button", { name: "开始演示", exact: true }).click();
    await expect(page).toHaveURL(/task=task-/);
    await expect(page.locator(".result-panel .status")).toContainText(
      "已完成",
      { timeout: 12000 },
    );
    await page.getByText("查看任务输入", { exact: true }).click();
    const data = JSON.parse(
      await page.locator(".result-panel pre").innerText(),
    );
    if (pipeline === "standard") {
      expect(data.enable_subtitles).toBe(true);
      expect(data.subtitle_template).toBe("paper");
    } else if (pipeline === "action_transfer") {
      expect(data.image_path).toBeTruthy();
      expect(data.video_path).toBeTruthy();
    } else {
      expect(data.character_image_path).toBeTruthy();
      expect(data.goods_text).toBeTruthy();
    }
    await expect(page.locator(".result-output video")).toBeVisible();
  }
});

test("五类沙盒按能力切换并保存结果", async ({ page }) => {
  for (const tool of ["文字生成", "图片理解", "文生图", "图生图", "视频生成"]) {
    await ready(page, "/sandbox");
    await page.getByRole("tab", { name: tool }).click();
    await page
      .getByRole("button", { name: "使用示例素材", exact: true })
      .click();
    await page.getByRole("button", { name: "开始演示", exact: true }).click();
    await expect(page.locator(".result-panel .status")).toContainText(
      "已完成",
      { timeout: 12000 },
    );
    if (tool === "文字生成" || tool === "图片理解")
      await expect(page.locator(".text-result")).toBeVisible();
    else if (tool === "视频生成")
      await expect(page.locator(".result-output video")).toBeVisible();
    else await expect(page.locator(".result-output img")).toBeVisible();
    await page.reload();
    await expect(page.locator(".result-panel .status")).toContainText("已完成");
  }
});

test("管理员、邀请码、私有内容隐藏与失效反馈", async ({ page }) => {
  await ready(page, "/settings");
  await page.getByRole("button", { name: "邀请码与用量", exact: true }).click();
  await page.getByLabel("备注", { exact: true }).fill("回归访客");
  await page.getByRole("button", { name: "生成邀请码", exact: true }).click();
  const row = page.locator(".invite-row").filter({ hasText: "回归访客" });
  const code = await row.locator("code").innerText();
  await ready(page, "/login");
  await page.getByLabel("邀请码", { exact: true }).fill(code);
  await page.getByRole("button", { name: "进入幕间", exact: true }).click();
  await expect(page.locator(".readonly-banner")).toBeVisible();
  await expect(page.getByText("未公开的火星草稿")).toHaveCount(0);
  await ready(page, "/?session=demo-private");
  await expect(
    page.getByRole("heading", { name: "作品不存在或尚未开放" }),
  ).toBeVisible();
  for (const url of [
    "/?session=demo-orbit&stage=character_design",
    "/sandbox",
    "/pipelines/standard",
    "/pipelines/action-transfer",
    "/pipelines/digital-human",
  ]) {
    await ready(page, url);
    await expect(
      page.locator(
        'main .stage-action-bar, main .asset-actions, main .small-upload, main .tool-form, main button[aria-label^="删除"]',
      ),
    ).toHaveCount(0);
  }
  await ready(page, "/settings");
  await expect(
    page.getByRole("heading", { name: "此页面仅管理员可用" }),
  ).toBeVisible();
  await ready(page, "/login");
  await page.getByRole("button", { name: "管理员演示", exact: true }).click();
  await page.getByLabel("演示密码", { exact: true }).fill("MUJIAN");
  await page.getByRole("button", { name: "进入幕间", exact: true }).click();
  await ready(page, "/settings");
  await page.getByRole("button", { name: "邀请码与用量", exact: true }).click();
  await page
    .locator(".invite-row")
    .filter({ hasText: "回归访客" })
    .getByRole("button", { name: "作废", exact: true })
    .click();
  await ready(page, "/login");
  await page.getByLabel("邀请码", { exact: true }).fill(code);
  await page.getByRole("button", { name: "进入幕间", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("邀请码无效或已过期");
});

test("设置保存、刷新恢复及新项目默认值", async ({ page }) => {
  await ready(page, "/settings");
  await page.getByLabel("默认画幅", { exact: true }).selectOption("9:16");
  await page.getByLabel("默认视觉风格", { exact: true }).selectOption("ink");
  await page.getByRole("button", { name: "保存设置", exact: true }).click();
  await page.reload();
  await expect(page.getByLabel("默认画幅", { exact: true })).toHaveValue(
    "9:16",
  );
  await ready(page);
  await page.locator(".composer-toolbar .parameter-trigger").first().click();
  await expect(page.getByLabel("画幅", { exact: true })).toHaveValue("9:16");
  await expect(page.getByLabel("风格", { exact: true })).toHaveValue("ink");
});

test("键盘焦点、减少动态效果与模态预览", async ({ page }) => {
  await ready(page, "/?session=demo-orbit&stage=character_design");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page.evaluate(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "放大 林遥", exact: true }).focus();
  await expect(
    page.getByRole("button", { name: "放大 林遥", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "关闭预览", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "关闭预览", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "放大 林遥", exact: true }),
  ).toBeFocused();
});

test("多集与续写按集派生分镜素材和成片", async ({ page }) => {
  test.setTimeout(65000);
  await ready(page);
  await page.getByRole("textbox", { name: "故事创意" }).fill("三集的太空来信");
  await page.getByText("模型与高级选项", { exact: true }).click();
  await page.getByLabel("剧集数量", { exact: true }).fill("3");
  await page.getByRole("button", { name: "完成设置", exact: true }).click();
  await page.getByRole("button", { name: "创建项目", exact: true }).click();
  await expect(page.locator(".project-page-head")).toContainText("3 集");
  await expect(page.locator(".project-page-head .status")).toContainText(
    "已完成",
    { timeout: 35000 },
  );
  await page.locator(".stage-navigation button").last().click();
  await expect(page.locator(".final-film")).toHaveCount(3);
  await page.locator(".stage-navigation button").nth(2).click();
  await page
    .locator(".episode-tabs")
    .getByRole("button", { name: /第 3 集/ })
    .click();
  await expect(page.locator(".shot-row")).toHaveCount(4);
  await page.locator(".stage-navigation button").first().click();
  await page.getByText("续写下一集", { exact: true }).click();
  await page
    .getByLabel("续写想法", { exact: true })
    .fill("人物终于找到了回家的路");
  await page
    .getByRole("button", { name: "生成续写草稿（模拟）", exact: true })
    .click();
  await page.getByRole("button", { name: "确认续写", exact: true }).click();
  await expect(page.locator(".project-page-head")).toContainText("4 集");
  await page.locator(".stage-navigation button").last().click();
  await page.getByRole("button", { name: "重新执行阶段", exact: true }).click();
  await expect(page.locator(".stage-status-row")).toContainText("已完成", {
    timeout: 12000,
  });
  await expect(page.locator(".final-film")).toHaveCount(4);
});

test("保存默认偏好与沙盒配置完整进入任务输入", async ({ page }) => {
  await ready(page, "/settings");
  await page.getByLabel("允许素材并行", { exact: true }).uncheck();
  await page.getByLabel("默认联网参考", { exact: true }).check();
  await page.getByRole("button", { name: "保存设置", exact: true }).click();
  await ready(page);
  await page.getByText("模型与高级选项", { exact: true }).click();
  await expect(
    page.getByLabel("允许素材并行", { exact: true }),
  ).not.toBeChecked();
  await expect(
    page.getByLabel("联网参考（模拟）", { exact: true }),
  ).toBeChecked();
  for (const tool of ["文生图", "图生图", "视频生成"]) {
    await ready(page, "/sandbox");
    await page.getByRole("tab", { name: tool }).click();
    await page
      .getByRole("button", { name: "使用示例素材", exact: true })
      .click();
    await page.getByRole("button", { name: "生成参数", exact: true }).click();
    await page.getByLabel("画幅", { exact: true }).selectOption("9:16");
    await page.getByLabel("分辨率", { exact: true }).selectOption("1080P");
    await page.getByRole("button", { name: "完成设置", exact: true }).click();
    await page.getByRole("button", { name: "开始演示", exact: true }).click();
    await expect(page.locator(".result-panel .status")).toContainText(
      "已完成",
      { timeout: 12000 },
    );
    await page.getByText("查看任务输入", { exact: true }).click();
    const input = JSON.parse(
      await page.locator(".result-panel pre").innerText(),
    );
    expect(input.ratio).toBe("9:16");
    expect(input.resolution).toBe("1080P");
  }
});

test("六种演示场景的实际截图与错误反馈", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [key, label] of [
    ["success", "完整作品"],
    ["running", "生成中"],
    ["waiting", "待确认"],
    ["error", "失败恢复"],
    ["stopped", "已停止"],
    ["empty", "空内容"],
  ]) {
    await ready(page);
    await scenario(page, label);
    if (key === "running")
      await expect(page.locator(".progress-panel")).toBeVisible();
    if (key === "error")
      await expect(page.locator(".error-panel")).toBeVisible();
    await page.screenshot({
      path: path.join(
        screenshots,
        info.project.name + "-state-" + key + "-desktop.png",
      ),
      fullPage: true,
    });
  }
});

test("存储不可用时不伪报持久化成功", async ({ page }) => {
  await ready(page, "/?session=demo-orbit&stage=character_design");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("演示存储不可用", "QuotaExceededError");
    };
  });
  await page
    .getByRole("button", { name: "选择 林遥 版本 2", exact: true })
    .click();
  await expect(page.locator(".save-mark")).toContainText("仅本页暂存");
  await expect(page.getByRole("status")).toContainText("本地存储不可用");
  await expect(
    page.getByRole("button", { name: "选择 林遥 版本 2", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("文本导入进入创作输入并可创建项目", async ({ page }) => {
  await ready(page);
  await page.getByText("模型与高级选项", { exact: true }).click();
  await page.getByLabel("导入故事文本", { exact: true }).setInputFiles({
    name: "story.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("一封来自太空的信，带回了故乡的声音。"),
  });
  await expect(page.getByRole("textbox", { name: "故事创意" })).toHaveValue(
    "一封来自太空的信，带回了故乡的声音。",
  );
  await page.getByRole("button", { name: "完成设置", exact: true }).click();
  await page.getByRole("button", { name: "创建项目", exact: true }).click();
  await expect(page).toHaveURL(/session=project-/);
  await expect(page.locator(".project-page-head h1")).toContainText(
    "一封来自太空的信",
  );
});

test("参考布局的新操作：输入浮层、素材墙、画布与故事板", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page);
  await page.locator(".composer-toolbar .parameter-trigger").first().click();
  await page.getByLabel("画幅", { exact: true }).selectOption("9:16");
  await page.keyboard.press("Escape");
  await expect(page.locator(".parameter-panel")).toHaveCount(0);
  await expect(
    page.locator(".composer-toolbar .parameter-trigger").first(),
  ).toBeFocused();
  await expect(
    page.locator(".composer-toolbar .parameter-trigger").first(),
  ).toContainText("9:16");
  if (info.project.name === "director") {
    await page.getByRole("button", { name: "猫的远行" }).click();
    await expect(page.getByRole("textbox", { name: "故事创意" })).toHaveValue(
      "一只猫决定搭上开往春天的列车。",
    );
  } else if (info.project.name === "guided") {
    await expect(page.locator(".rb-masonry .item-wrapper")).toHaveCount(6);
    await expect(
      page.getByRole("link", { name: "猫的远行", exact: true }),
    ).toHaveAttribute("href", "/?session=demo-cat&stage=character_design");
    await page.getByRole("button", { name: "图像", exact: true }).click();
    await expect(
      page.getByRole("link", { name: "猫的远行", exact: true }),
    ).toHaveAttribute("href", "/?session=demo-cat&stage=character_design");
    await page.getByRole("button", { name: "视频", exact: true }).click();
    await expect(page.locator(".rb-masonry .item-wrapper")).toHaveCount(2);
    await page.getByRole("link", { name: "星际来信", exact: true }).click();
    await expect(page).toHaveURL(/stage=reference_generation/);
  } else {
    await ready(page, "/?session=demo-orbit&stage=storyboard");
    const initialZoom = Number(
      (await page.locator(".zoom-readout").innerText()).replace("%", ""),
    );
    await page.getByRole("button", { name: "放大画布", exact: true }).click();
    expect(
      Number(
        (await page.locator(".zoom-readout").innerText()).replace("%", ""),
      ),
    ).toBe(initialZoom + 10);
    await page.getByRole("button", { name: "缩小画布", exact: true }).click();
    expect(
      Number(
        (await page.locator(".zoom-readout").innerText()).replace("%", ""),
      ),
    ).toBe(initialZoom);
    const canvas = page.locator(".canvas-viewport");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("missing canvas");
    await page.getByRole("button", { name: "放大画布", exact: true }).click();
    await page.getByRole("button", { name: "放大画布", exact: true }).click();
    await page.getByRole("button", { name: "放大画布", exact: true }).click();
    await page.mouse.move(box.x + 280, box.y + 20);
    await page.mouse.down();
    await page.mouse.move(box.x + 60, box.y + 20);
    await page.mouse.up();
    expect(await canvas.evaluate((e) => e.scrollLeft)).toBeGreaterThan(0);
    await page.getByRole("button", { name: "适应画布", exact: true }).click();
    expect(await canvas.evaluate((e) => e.scrollLeft)).toBe(0);
    await page.getByRole("button", { name: "故事板", exact: true }).click();
    await expect(page.locator(".linked-storyboard .board-column")).toHaveCount(
      3,
    );
    await expect(page.locator(".board-text")).toHaveCount(4);
    await expect(
      page.locator(".board-column").nth(2).locator("video"),
    ).toHaveCount(4);
    await page
      .getByRole("button", {
        name: "故事板选择 片段 1 参考图 版本 2",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", {
        name: "故事板选择 片段 1 参考图 版本 2",
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await page
      .locator(".board-column")
      .nth(1)
      .locator(".board-image")
      .nth(3)
      .getByRole("button", { name: "查看版本", exact: true })
      .click();
    await expect(page).toHaveURL(
      /stage=reference_generation&segment=segment-4/,
    );
    await expect(page.locator(".asset-card.linked-focus")).toContainText(
      "片段 4",
    );
    await expect(page.locator(".stage-content .asset-versions")).toHaveCount(4);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "工作流画布", exact: true }).click();
    await page.getByRole("button", { name: "适应画布", exact: true }).click();
    expect(
      await page
        .locator(".canvas-viewport")
        .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
    ).toBe(true);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("button", { name: "故事板", exact: true }).click();
    await page.screenshot({
      path: path.join(screenshots, "gallery-linked-storyboard-desktop.png"),
      fullPage: true,
    });
  }
});
