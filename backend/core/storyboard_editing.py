"""Lossless storyboard editing at the API boundary; media stays segment-scoped."""

import copy
import math
import re
from typing import Any


class StoryboardConflictError(ValueError):
    """The editor's snapshot no longer matches the saved storyboard."""


def _objects(value: Any, field: str) -> list[dict]:
    if not isinstance(value, list) or any(not isinstance(item, dict) for item in value):
        raise ValueError(f"{field} 必须为对象数组")
    return value


def _identifier(item: dict, key: str, fallback: str) -> str:
    value = item.get(key) or item.get("id") or fallback
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{key} 必须为非空字符串")
    item[key] = value
    return value


def normalize_storyboard(artifact: Any) -> dict:
    """Add canonical episodes and stable IDs without mutating or discarding source data."""
    if not isinstance(artifact, dict):
        raise ValueError("分镜产物必须为对象")
    result = copy.deepcopy(artifact)
    source = result
    if not any(key in source for key in ("episodes", "segments", "shots")):
        if isinstance(source.get("payload"), dict):
            source = source["payload"]
    if "episodes" in source:
        episodes = copy.deepcopy(_objects(source["episodes"], "episodes"))
    else:
        segments = copy.deepcopy(_objects(source.get("segments", []), "segments"))
        if not segments and "shots" in source:
            # Older flat shots used shot_id for the corresponding media item.
            grouped: dict[str, dict] = {}
            for index, shot in enumerate(_objects(source["shots"], "shots"), 1):
                segment_id = shot.get("segment_id") or shot.get("shot_id") or shot.get("id") or f"legacy_segment_{index}"
                segment = grouped.setdefault(segment_id, {
                    "segment_id": segment_id,
                    "episode_number": shot.get("episode_number", 1),
                    "segment_number": shot.get("scene_number", index),
                    "shots": [],
                })
                segment["shots"].append(copy.deepcopy(shot))
            segments = list(grouped.values())
        grouped_episodes: dict[Any, dict] = {}
        for segment in segments:
            episode_key = segment.get("episode_id") or segment.get("episode_number", 1)
            episode = grouped_episodes.setdefault(episode_key, {
                "episode_number": segment.get("episode_number", 1), "segments": [],
                **({"episode_id": segment["episode_id"]} if segment.get("episode_id") else {}),
            })
            episode["segments"].append(segment)
        episodes = list(grouped_episodes.values())
    seen: dict[str, set] = {"episode_id": set(), "segment_id": set(), "shot_id": set()}
    for ep_index, episode in enumerate(episodes, 1):
        ep_id = _identifier(episode, "episode_id", f"episode_{episode.get('episode_number', ep_index)}")
        episode.setdefault("episode_number", ep_index)
        for seg_index, segment in enumerate(_objects(episode.get("segments", []), "segments"), 1):
            seg_id = _identifier(segment, "segment_id", f"{ep_id}_segment_{seg_index}")
            # The containing episode is authoritative, including after a move.
            segment["episode_number"] = episode["episode_number"]
            if "episode_id" in segment:
                segment["episode_id"] = ep_id
            segment.setdefault("segment_number", seg_index)
            for shot_index, shot in enumerate(_objects(segment.get("shots", []), "shots"), 1):
                _identifier(shot, "shot_id", f"{seg_id}_shot_{shot_index}")
                shot.setdefault("shot_number", shot_index)
                if shot["shot_id"] in seen["shot_id"]:
                    raise ValueError("shot_id 不能重复")
                seen["shot_id"].add(shot["shot_id"])
            segment.setdefault("shots", [])
            durations = [shot.get("duration") for shot in segment["shots"]]
            if durations and "total_duration" not in segment and all(
                isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value > 0
                for value in durations
            ):
                segment["total_duration"] = sum(durations)
            if seg_id in seen["segment_id"]:
                raise ValueError("segment_id 不能重复")
            seen["segment_id"].add(seg_id)
        episode.setdefault("segments", [])
        if ep_id in seen["episode_id"]:
            raise ValueError("episode_id 不能重复")
        seen["episode_id"].add(ep_id)
    result["episodes"] = episodes
    return result


def _merge_node(current: dict, incoming: dict, child_key: str | None = None, id_key: str | None = None) -> dict:
    merged = copy.deepcopy(current)
    for key, value in incoming.items():
        if key == child_key:
            previous = {item[id_key]: item for item in current.get(key, [])}
            next_child = "segments" if key == "episodes" else "shots" if key == "segments" else None
            next_id = "segment_id" if key == "episodes" else "shot_id" if key == "segments" else None
            merged[key] = [_merge_node(previous.get(item[id_key], {}), item, next_child, next_id) for item in value]
        elif isinstance(value, dict) and isinstance(current.get(key), dict):
            merged[key] = _merge_node(current[key], value)
        else:
            merged[key] = copy.deepcopy(value)
    return merged


def _duration(value: Any, field: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
        raise ValueError(f"{field} 必须为大于零的有限数字")
    return value


def edit_storyboard(current: Any, body: dict) -> dict:
    before = normalize_storyboard(current or {})
    if "expected_storyboard" in body and normalize_storyboard(body["expected_storyboard"] or {}) != before:
        raise StoryboardConflictError("分镜已被其他操作修改，请刷新后重试")
    incoming = {key: copy.deepcopy(value) for key, value in body.items() if key not in {"expected_storyboard", "new_shot_ids"}}
    if not any(key in incoming for key in ("episodes", "segments", "shots", "payload")):
        raise ValueError("缺少分镜 episodes、segments 或 shots")
    # Canonical episodes take precedence over compatibility aliases.
    normalized = normalize_storyboard(incoming)
    result = _merge_node(before, normalized, "episodes", "episode_id")
    old_segments = {segment["segment_id"]: segment for episode in before["episodes"] for segment in episode["segments"]}
    old_ids = {
        "episode_id": {episode["episode_id"] for episode in before["episodes"]},
        "segment_id": set(old_segments),
        "shot_id": {shot["shot_id"] for segment in old_segments.values() for shot in segment["shots"]},
    }
    for episode in result["episodes"]:
        for node, key in [(episode, "episode_id")] + [
            (segment, "segment_id") for segment in episode["segments"]
        ] + [(shot, "shot_id") for segment in episode["segments"] for shot in segment["shots"]]:
            if node[key] not in old_ids[key] and not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,127}", node[key]):
                raise ValueError(f"新增 {key} 只能包含字母、数字、下划线、点和短横线")
        for segment in episode["segments"]:
            for shot in segment["shots"]:
                if "duration" in shot:
                    _duration(shot["duration"], "镜头时长")
                shot.pop("is_new", None)
            previous = old_segments.get(segment["segment_id"], {})
            if segment["shots"] and (segment["shots"] != previous.get("shots") or "total_duration" not in segment):
                durations = [shot.get("duration") for shot in segment["shots"]]
                if all(duration is not None for duration in durations):
                    segment["total_duration"] = sum(durations)
            if "total_duration" in segment:
                _duration(segment["total_duration"], "片段时长")
            segment.pop("is_new", None)
    _sync_aliases(result, before)
    return result


def _alias_nodes(value: list, key: str) -> list:
    normalized = normalize_storyboard({key: value})
    if key == "episodes":
        return normalized["episodes"]
    segments = [segment for episode in normalized["episodes"] for segment in episode["segments"]]
    return segments if key == "segments" else [shot for segment in segments for shot in segment["shots"]]


def _merge_alias(previous: list, current: list, canonical: list, key: str) -> list:
    """Match nodes across the whole alias tree, including cross-parent moves."""
    ids = {"episodes": "episode_id", "segments": "segment_id", "shots": "shot_id"}
    children = {"episodes": "segments", "segments": "shots"}
    indexed: dict[str, dict[str, dict]] = {level: {} for level in ids}

    def index_nodes(nodes: list, level: str) -> None:
        child = children.get(level)
        for node in nodes:
            identifier = node[ids[level]]
            properties = {name: value for name, value in node.items() if name != child}
            indexed[level][identifier] = _merge_node(indexed[level].get(identifier, {}), properties)
            if child:
                index_nodes(node.get(child, []), child)

    def merge_nodes(nodes: list, level: str) -> list:
        child = children.get(level)
        merged = []
        for node in nodes:
            properties = {name: value for name, value in node.items() if name != child}
            result = _merge_node(indexed[level].get(node[ids[level]], {}), properties)
            if child:
                result[child] = merge_nodes(node.get(child, []), child)
            merged.append(result)
        return merged

    index_nodes(_alias_nodes(previous, key), key)
    index_nodes(_alias_nodes(current, key), key)
    return merge_nodes(canonical, key)


def _sync_aliases(artifact: dict, previous: dict) -> None:
    """Keep source aliases useful for older readers, retaining their unknown properties."""
    segments = [segment for episode in artifact["episodes"] for segment in episode["segments"]]
    shots = [
        {**shot, "segment_id": segment["segment_id"], "episode_number": episode["episode_number"]}
        for episode in artifact["episodes"] for segment in episode["segments"] for shot in segment["shots"]
    ]
    aliases = {"episodes": artifact["episodes"], "segments": segments, "shots": shots}
    for key in ("segments", "shots"):
        if key in artifact:
            artifact[key] = _merge_alias(previous.get(key, []), artifact[key], aliases[key], key)
    if isinstance(artifact.get("payload"), dict):
        payload = artifact["payload"]
        old_payload = previous.get("payload") if isinstance(previous.get("payload"), dict) else {}
        if any(key in payload for key in aliases):
            for key, canonical in aliases.items():
                if key == "episodes" or key in payload:
                    payload[key] = _merge_alias(old_payload.get(key, []), payload.get(key, []), canonical, key)


def reconcile_storyboard_media(artifacts: dict, storyboard: dict, previous_storyboard: Any = None) -> None:
    """Expose new segments and archive removed media without losing any selections."""
    segments = [segment for episode in storyboard["episodes"] for segment in episode["segments"]]
    active_ids = {segment["segment_id"] for segment in segments}
    old_segments = {
        segment["segment_id"]: segment
        for episode in normalize_storyboard(previous_storyboard or {})["episodes"] for segment in episode["segments"]
    }
    for stage, key in (("reference_generation", "scenes"), ("video_generation", "clips")):
        artifact = artifacts.setdefault(stage, {})
        if not isinstance(artifact, dict):
            raise ValueError(f"{stage} 产物格式无法无损更新")
        wrapped = artifact.get("payload")
        source = wrapped if key not in artifact and isinstance(wrapped, dict) and key in wrapped else artifact
        old_items = _objects(source.get(key, []), key)
        orphan_key = f"orphaned_{key}"
        archived = _objects(artifact.get(orphan_key, []), orphan_key)
        previous = {item.get("id"): item for item in archived + old_items}
        artifact[orphan_key] = [copy.deepcopy(item) for item in previous.values() if item.get("id") not in active_ids]
        items = []
        for index, segment in enumerate(segments, 1):
            segment_id = segment["segment_id"]
            item = copy.deepcopy(previous.get(segment_id, {
                "id": segment_id, "selected": "", "versions": [], "status": "pending",
            }))
            item["index"] = segment.get("segment_number", index)
            item["episode"] = segment.get("episode_number", 1)
            item.setdefault("name", f"第{item['episode']}集-片段{item['index']}")
            description = " ".join(str(shot.get("plot") or shot.get("content") or shot.get("description") or "") for shot in segment["shots"]).strip()
            if stage == "video_generation":
                if not item.get("description") or segment["shots"] != old_segments.get(segment_id, {}).get("shots"):
                    # VideoDirectorAgent consumes clips.description before the storyboard.
                    # Preserve its 分镜列表 format, including each shot's timing/framing.
                    item["description"] = "分镜列表：" + "".join(
                        f"\n分镜{shot_index}：[{shot.get('duration', 5)}秒] "
                        f"{shot.get('shot_type', '')} "
                        f"{shot.get('plot') or shot.get('content') or shot.get('description') or ''}"
                        for shot_index, shot in enumerate(segment["shots"], 1)
                    )
                item["duration"] = segment.get("total_duration", item.get("duration", 10))
            else:
                item["description"] = segment.get("visual_prompt") or description
            items.append(item)
        artifact[key] = items
        if isinstance(wrapped, dict) and key in wrapped:
            wrapped[key] = copy.deepcopy(items)


def preserve_media_history(current: Any, incoming: Any) -> Any:
    """Agent previews/results must not erase media detached by a storyboard edit."""
    if not isinstance(current, dict) or not isinstance(incoming, dict):
        return incoming
    result = copy.deepcopy(incoming)
    for key in ("orphaned_scenes", "orphaned_clips"):
        if key in current:
            result[key] = copy.deepcopy(current[key])
    return result
