"""Parse a JSON object or array from a model response."""

import json
import re
from typing import Any

_CODE_BLOCK = re.compile(r"```(?:json)?\s*([\s\S]*?)```", re.IGNORECASE)


def extract_json(text: str) -> Any:
    """Read nested JSON from a response, optionally wrapped in prose or a code block.

    The first valid object or array wins. JSONDecoder stops at the matching closing
    delimiter, so braces in nested values and trailing commentary are both safe.
    """
    if not isinstance(text, str):
        raise ValueError("Model response is not text")

    decoder = json.JSONDecoder()
    candidates = [match.group(1) for match in _CODE_BLOCK.finditer(text)]
    candidates.append(text)
    for candidate in candidates:
        for index, char in enumerate(candidate):
            if char not in "{[":
                continue
            try:
                value, _ = decoder.raw_decode(candidate, index)
            except json.JSONDecodeError:
                continue
            if isinstance(value, (dict, list)):
                return value
    raise ValueError("Model response did not contain a JSON object or array")
