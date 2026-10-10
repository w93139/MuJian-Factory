from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SandboxRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SandboxLLMRequest(SandboxRequest):
    model: str
    prompt: str
    temperature: Optional[float] = None
    web_search: Optional[bool] = False

    @field_validator("temperature")
    @classmethod
    def unsupported_temperature(cls, value):
        if value is not None:
            raise ValueError("当前文本接口尚不支持创意强度参数")
        return value


class SandboxVLMRequest(SandboxRequest):
    model: str
    prompt: str
    images: List[str]


class SandboxT2IRequest(SandboxRequest):
    model: str
    prompt: str
    style: Optional[str] = None
    ratio: Optional[str] = None
    resolution: Optional[str] = None

    @field_validator("style")
    @classmethod
    def unsupported_style(cls, value):
        if value:
            raise ValueError("当前沙盒不支持独立风格参数，请将风格写入提示词")
        return value


class SandboxI2IRequest(SandboxRequest):
    model: str
    prompt: str
    image: str
    ratio: Optional[str] = None
    resolution: Optional[str] = None


class SandboxVideoRequest(SandboxRequest):
    model: str
    prompt: str
    image: Optional[str] = None
    ratio: Optional[str] = None
    resolution: Optional[str] = None
    duration: Optional[int] = Field(default=None, ge=1, le=60)
