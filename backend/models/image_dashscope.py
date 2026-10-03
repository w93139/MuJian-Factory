import logging
import os
import time
import uuid

from dashscope.aigc.image_generation import ImageGeneration

from config import Config
from models.image_processor import ImageProcessor
from usage import reserve_usage


class DashScopeClient:
    def __init__(self, api_key=None, base_url=None):
        self.api_key = api_key or Config.DASHSCOPE_API_KEY
        # 默认使用中国（北京）地域 API，如果参数或 config.yaml 未设置则使用默认地址
        self.base_url = base_url or Config.DASHSCOPE_BASE_URL
        self.image_processor = ImageProcessor()

    def generate_image(self, prompt, model="wan2.7-image", size="1024*1024", n=1, session_id=None, save_dir=None):
        """
        Text to Image generation using DashScope
        """
        try:
            if not self.api_key:
                raise RuntimeError("DASHSCOPE_API_KEY 未配置")
            messages = [{"role": "user", "content": [{"text": prompt}]}]
            reserve_usage(model, images=n)
            response = ImageGeneration.call(
                model=model,
                api_key=self.api_key,
                base_address=self.base_url,
                messages=messages,
                n=n,
                size=size,
                watermark=False,
            )

            if response.status_code == 200:
                results = []
                try:
                    # 标准 ImageGeneration 返回结果解析
                    if response.output and response.output.choices:
                        for item in response.output.choices:
                            if 'message' in item and 'content' in item['message']:
                                results.append(item['message']['content'][0]['image'])
                except Exception as e:
                    raise RuntimeError(f"万相图片结果解析失败: {e}") from e
                
                if not results:
                    raise RuntimeError("万相图片生成成功但没有返回图片")

                # Check if we should download
                if save_dir:
                    os.makedirs(save_dir, exist_ok=True)
                    local_files = []
                    for i, url in enumerate(results):
                        file_name = f"ds_{session_id if session_id else 'nosess'}_{int(time.time())}_{i}_{uuid.uuid4().hex[:6]}.png"
                        file_path = os.path.join(save_dir, file_name)
                        if not self.image_processor.download_image(url, file_path, proxies=Config.requests_proxies("dashscope")):
                            raise RuntimeError(f"万相图片下载失败: {url}")
                        local_files.append(file_path)
                    return local_files
                
                return results
            else:
                raise RuntimeError(
                    f"万相图片生成失败: status={response.status_code}, code={response.code}, message={response.message}"
                )
        except Exception:
            logging.exception("万相图片生成失败")
            raise

    def edit_image(self, prompt, image_urls, model="wan2.7-image", size="1920*1080", n=1, session_id=None, save_dir=None):
        """
        Image editing/compositing using DashScope ImageGeneration
        """
        # Prepare content
        content_list = []
        for img_url in image_urls:
            content_list.append({"image": img_url})
        content_list.append({"text": prompt})

        messages = [
            {
                "role": "user",
                "content": content_list
            }
        ]

        try:
            if not self.api_key:
                raise RuntimeError("DASHSCOPE_API_KEY 未配置")
            # Use ImageGeneration.call with messages, same as generate_image
            reserve_usage(model, images=n)
            response = ImageGeneration.call(
                model=model,
                api_key=self.api_key,
                base_address=self.base_url,
                messages=messages,
                n=n,
                size=size,
                watermark=False,
            )

            if response.status_code == 200:
                results = []
                try:
                    # 标准 ImageGeneration 返回结果解析
                    if response.output and response.output.choices:
                        for item in response.output.choices:
                            # 简化解析逻辑以处理多张图片的返回结构
                            if isinstance(item, dict):
                                if 'image' in item: # 部分新模型直接返回 {'image': 'url', 'finish_reason': ...}
                                     results.append(item['image'])
                                elif 'url' in item:
                                     results.append(item['url'])
                                elif 'message' in item and 'content' in item['message']: # 兼容 Message 结构
                                    content = item['message']['content']
                                    if isinstance(content, list):
                                        for c in content:
                                            if isinstance(c, dict) and 'image' in c:
                                                results.append(c['image'])
                except Exception as e:
                    raise RuntimeError(f"万相图片结果解析失败: {e}") from e

                if not results:
                    raise RuntimeError("万相图片编辑成功但没有返回图片")

                # Check if we should download
                if save_dir:
                    os.makedirs(save_dir, exist_ok=True)
                    local_files = []
                    for i, url in enumerate(results):
                        file_name = f"ds_{session_id if session_id else 'nosess'}_{int(time.time())}_{i}_{uuid.uuid4().hex[:6]}.png"
                        file_path = os.path.join(save_dir, file_name)
                        if not self.image_processor.download_image(url, file_path, proxies=Config.requests_proxies("dashscope")):
                            raise RuntimeError(f"万相图片下载失败: {url}")
                        local_files.append(file_path)
                    return local_files

                return results
            else:
                raise RuntimeError(
                    f"万相图片编辑失败: status={response.status_code}, code={response.code}, message={response.message}"
                )
        except Exception:
            logging.exception("万相图片编辑失败")
            raise


if __name__ == "__main__":
    import sys

    from config import Config

    print("=== DashScope 图片生成可用性测试 ===")
    MODELS=["wan2.6-t2i", "wan2.7-image", "wan2.7-image-pro"]
    save_dir = "code/result/image/test_avail"
    api_key = Config.DASHSCOPE_API_KEY
    base_url = Config.DASHSCOPE_BASE_URL
    if not api_key:
        print("✗ DASHSCOPE_API_KEY 未设置，跳过")
        sys.exit(1)
    print(f"  Base URL: {base_url}")
    client = DashScopeClient(api_key=api_key, base_url=base_url)

    # 文生图
    print("\n=== 文生图测试 ===")
    prompt = "一只橘猫躺在阳光下的窗台上，水彩画风格"
    for model in MODELS:
        print(f"\nPrompt: {prompt}")
        print(f"model: {model}")
        os.makedirs(save_dir, exist_ok=True)
        t0 = time.time()
        try:
            paths = client.generate_image(
                prompt=prompt, model=model,
                size="1024*1024", save_dir=save_dir,
            )
            elapsed = time.time() - t0
            if paths:
                print(f"✓ 生成 {len(paths)} 张图片 ({elapsed:.1f}s): {paths}")
            else:
                print(f"✗ 返回空列表 ({elapsed:.1f}s)")
        except Exception as e:
            print(f"✗ 失败: {e}")
            sys.exit(1)

    # 图生图
    print("\n=== 图生图测试 ===")
    img_path = "code/result/image/test_avail/test_input.png"
    prompt = "在这张图片的基础上，添加一些飞舞的樱花花瓣，绘制为水彩画风格"
    for model in MODELS:
        print(f"\nPrompt: {prompt}")
        print(f"model: {model}")
        os.makedirs(save_dir, exist_ok=True)
        t0 = time.time()
        try:
            paths = client.edit_image(
                prompt=prompt, image_urls=[img_path], model=model,
                size="1024*1024", save_dir=save_dir,
            )
            elapsed = time.time() - t0
            if paths:
                print(f"✓ 生成 {len(paths)} 张图片 ({elapsed:.1f}s): {paths}")
            else:
                print(f"✗ 返回空列表 ({elapsed:.1f}s)")
        except Exception as e:
            print(f"✗ 失败: {e}")
            sys.exit(1)
