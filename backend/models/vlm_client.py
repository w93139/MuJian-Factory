"""Unified vision language model interface."""

from config import Config
from models.chat_client import ChatClient


class VLM:
    def __init__(self):
        self.chat_client = ChatClient()

    def query(self, prompt, image_paths=None, model=None, session_id=None):
        del session_id
        model = model or Config.VLM_MODEL
        if not model:
            raise ValueError("未配置默认视觉理解模型，请显式传入 model")
        return self.chat_client.query(prompt=prompt, image_urls=image_paths, model=model)
