"""Unified text model interface."""

from config import Config
from models.chat_client import ChatClient


class LLM:
    def __init__(self):
        self.chat_client = ChatClient()

    @staticmethod
    def full_to_half(text):
        if not isinstance(text, str):
            return text
        translation = {0x3000: 0x0020}
        translation.update({code: code - 65248 for code in range(65281, 65375)})
        return text.translate(translation)

    def query(self, prompt, image_urls=None, model=None, safe_content=True, task_id=None, web_search=False):
        del task_id
        model = model or Config.LLM_MODEL
        if not model:
            raise ValueError("未配置默认文本模型，请显式传入 model")
        if safe_content:
            prompt = self.full_to_half(prompt)
        result = self.chat_client.query(
            prompt=prompt,
            image_urls=image_urls,
            model=model,
            web_search=web_search,
        )
        if safe_content:
            result = self.full_to_half(result)
        return "\n".join(line for line in result.splitlines() if line.strip())
