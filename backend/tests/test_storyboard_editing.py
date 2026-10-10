"""Real in-process persistence tests, with temporary sessions and no model calls."""

import copy
import json
import threading

import pytest
from fastapi import HTTPException

from api.routers import workflow
from core.orchestrator import WorkflowEngine, WorkflowState
from core.storyboard_editing import StoryboardConflictError, normalize_storyboard


def engine_at(path):
    engine = object.__new__(WorkflowEngine)
    engine.sessions = {}
    engine._session_dir = str(path)
    engine._state_lock = threading.RLock()
    engine._stop_events = {}
    engine._active_sessions = set()
    engine._background_tasks = set()
    return engine


@pytest.fixture
def saved(tmp_path):
    engine = engine_at(tmp_path)
    state = WorkflowState('editing-test')
    state.artifacts = {
        'storyboard': {
            'unknown_top': {'keep': True},
            'episodes': [
                {'episode_number': 1, 'episode_title': 'one', 'production_notes': 'keep', 'segments': [
                    {'segment_id': 'seg_01_01', 'segment_number': 1, 'location': 'room', 'unknown_segment': {'keep': True}, 'total_duration': 7, 'shots': [
                        {'shot_number': 1, 'duration': 3, 'shot_type': '全景', 'content': 'first', 'unknown_shot': 'keep'},
                        {'shot_number': 2, 'duration': 4, 'shot_type': '近景', 'content': 'second'},
                    ]},
                    {'segment_id': 'seg_01_02', 'shots': [{'shot_id': 'stable-existing', 'duration': 4, 'content': 'removed later'}]},
                ]},
                {'episode_number': 2, 'segments': [{'segment_id': 'seg_02_01', 'shots': [{'duration': 5, 'content': 'third'}]}]},
            ],
        },
        'reference_generation': {'scenes': [
            {'id': 'seg_01_01', 'selected': 'selected-old.png', 'versions': ['older.png', 'selected-old.png'], 'custom': 'keep'},
            {'id': 'seg_01_02', 'selected': 'deleted.png', 'versions': ['deleted.png']},
        ]},
        'video_generation': {'clips': [
            {'id': 'seg_01_01', 'selected': 'v1.mp4', 'versions': ['v1.mp4', 'v2.mp4'], 'custom': 'keep'},
            {'id': 'seg_01_02', 'selected': 'deleted.mp4', 'versions': ['deleted.mp4']},
        ]},
    }
    engine.sessions[state.session_id] = state
    engine.save_session_to_disk(state.session_id)
    return engine, state, tmp_path


def test_snapshot_adds_stable_ids_without_mutating_original_file(saved):
    engine, state, path = saved
    before = (path / 'editing-test.json').read_bytes()
    snapshot = engine.get_artifact_snapshot(state.session_id, 'storyboard')
    assert snapshot['episodes'][0]['episode_id'] == 'episode_1'
    assert snapshot['episodes'][0]['segments'][0]['shots'][0]['shot_id'] == 'seg_01_01_shot_1'
    assert snapshot['episodes'][0]['segments'][1]['shots'][0]['shot_id'] == 'stable-existing'
    assert 'episode_id' not in state.artifacts['storyboard']['episodes'][0]
    assert (path / 'editing-test.json').read_bytes() == before
    assert engine.get_status_snapshot(state.session_id)['artifacts']['storyboard'] == snapshot


def test_edit_multiple_episodes_shots_and_reload_keeps_unknown_fields_and_versions(saved):
    engine, state, path = saved
    snapshot = engine.get_artifact_snapshot(state.session_id, 'storyboard')
    episodes = copy.deepcopy(snapshot['episodes'])
    segment = episodes[0]['segments'][0]
    segment['shots'][0]['duration'] = 6
    segment['shots'][0]['content'] = 'changed'
    segment['shots'].append({'shot_id': 'new-shot', 'duration': 2, 'shot_type': '特写', 'content': 'new'})
    del segment['unknown_segment']
    del segment['shots'][0]['unknown_shot']
    del episodes[0]['production_notes']
    result = engine.update_artifact(state.session_id, 'storyboard', {'episodes': episodes, 'expected_storyboard': snapshot})
    assert result['status'] == 'ok'
    assert result['artifact']['episodes'][1] == snapshot['episodes'][1]
    assert result['artifact']['episodes'][0]['production_notes'] == 'keep'
    updated_segment = result['artifact']['episodes'][0]['segments'][0]
    assert updated_segment['unknown_segment'] == {'keep': True}
    assert updated_segment['shots'][0]['unknown_shot'] == 'keep'
    assert updated_segment['total_duration'] == 12
    assert len(updated_segment['shots']) == 3
    assert result['artifact']['unknown_top'] == {'keep': True}
    loaded = engine_at(path).get_state(state.session_id)
    assert loaded.artifacts['storyboard'] == result['artifact']
    assert loaded.artifacts['reference_generation']['scenes'][0]['selected'] == 'selected-old.png'
    clip = loaded.artifacts['video_generation']['clips'][0]
    assert clip['selected'] == 'v1.mp4'
    assert clip['versions'] == ['v1.mp4', 'v2.mp4']
    assert clip['custom'] == 'keep'
    assert clip['duration'] == 12
    assert clip['description'] == '分镜列表：\n分镜1：[6秒] 全景 changed\n分镜2：[4秒] 近景 second\n分镜3：[2秒] 特写 new'
    assert 'expected_storyboard' not in loaded.artifacts['storyboard']


def test_add_delete_and_restore_segment_keeps_media_history(saved):
    engine, state, _ = saved
    snapshot = engine.get_artifact_snapshot(state.session_id, 'storyboard')
    episodes = copy.deepcopy(snapshot['episodes'])
    removed = episodes[0]['segments'].pop()
    episodes[0]['segments'].append({'segment_id': 'new-segment', 'shots': [{'shot_id': 'new', 'duration': 4, 'content': 'new'}]})
    result = engine.update_artifact(state.session_id, 'storyboard', {'episodes': episodes, 'expected_storyboard': snapshot})
    for stage, key in [('reference_generation', 'scenes'), ('video_generation', 'clips')]:
        artifact = state.artifacts[stage]
        assert 'seg_01_02' not in [item['id'] for item in artifact[key]]
        assert artifact[f'orphaned_{key}'][0]['id'] == 'seg_01_02'
        assert artifact[f'orphaned_{key}'][0]['selected']
        new = next(item for item in artifact[key] if item['id'] == 'new-segment')
        assert new['status'] == 'pending' and new['versions'] == []
    episodes = result['artifact']['episodes']
    episodes[0]['segments'].append(removed)
    engine.update_artifact(state.session_id, 'storyboard', {'episodes': episodes})
    assert next(item for item in state.artifacts['video_generation']['clips'] if item['id'] == 'seg_01_02')['selected'] == 'deleted.mp4'
    assert state.artifacts['video_generation']['orphaned_clips'] == []


def test_stale_snapshot_rejected_without_touching_other_edits(saved):
    engine, state, path = saved
    old_raw = copy.deepcopy(state.artifacts['storyboard'])
    snapshot = engine.get_artifact_snapshot(state.session_id, 'storyboard')
    episodes = copy.deepcopy(snapshot['episodes'])
    episodes[0]['episode_title'] = 'edited'
    engine.update_artifact(state.session_id, 'storyboard', {'episodes': episodes, 'expected_storyboard': old_raw})
    before = copy.deepcopy(state.artifacts)
    disk = (path / 'editing-test.json').read_bytes()
    with pytest.raises(StoryboardConflictError):
        engine.update_artifact(state.session_id, 'storyboard', {'episodes': snapshot['episodes'], 'expected_storyboard': snapshot})
    assert state.artifacts == before
    assert (path / 'editing-test.json').read_bytes() == disk


@pytest.mark.parametrize('shape', ['segments', 'shots', 'payload'])
def test_legacy_shapes_survive_save_with_canonical_structure(tmp_path, shape):
    engine = engine_at(tmp_path)
    state = WorkflowState('legacy')
    if shape == 'shots':
        source = {'shots': [{'shot_id': 'old-media-id', 'duration': 3, 'content': 'old', 'extra': True}]}
    else:
        source = {'segments': [{'segment_id': 'old-media-id', 'shots': [{'duration': 3, 'content': 'old', 'extra': True}], 'extra': True}]}
    if shape == 'payload':
        source = {'wrapper': True, 'payload': {**source, 'payload_extra': True}}
    state.artifacts['storyboard'] = source
    engine.sessions['legacy'] = state
    snapshot = engine.get_artifact_snapshot('legacy', 'storyboard')
    episodes = copy.deepcopy(snapshot['episodes'])
    episodes[0]['segments'][0]['shots'][0]['content'] = 'edited'
    result = engine.update_artifact('legacy', 'storyboard', {'episodes': episodes, 'expected_storyboard': snapshot})['artifact']
    assert result['episodes'][0]['segments'][0]['segment_id'] == 'old-media-id'
    assert result['episodes'][0]['segments'][0]['shots'][0]['extra'] is True
    alias = result['payload'] if shape == 'payload' else result
    assert (alias['shots'][0] if shape == 'shots' else alias['segments'][0]['shots'][0])['content'] == 'edited'
    if shape == 'payload':
        assert result['wrapper'] and alias['payload_extra']
    assert json.loads((tmp_path / 'legacy.json').read_text())['artifacts']['storyboard'] == result


@pytest.mark.parametrize('invalid', ['duplicate', 'negative', 'nan', 'list', 'running'])
def test_invalid_edits_are_atomic(saved, invalid):
    engine, state, _ = saved
    snapshot = engine.get_artifact_snapshot(state.session_id, 'storyboard')
    episodes = copy.deepcopy(snapshot['episodes'])
    if invalid == 'duplicate':
        episodes[0]['segments'].append(copy.deepcopy(episodes[0]['segments'][0]))
    elif invalid in {'negative', 'nan'}:
        episodes[0]['segments'][0]['shots'][0]['duration'] = -1 if invalid == 'negative' else float('nan')
    elif invalid == 'list':
        episodes[0]['segments'][0]['shots'] = 'invalid'
    else:
        state.status['reference_generation'] = 'running'
    before = copy.deepcopy(state.artifacts)
    with pytest.raises(ValueError):
        engine.update_artifact(state.session_id, 'storyboard', {'episodes': episodes})
    assert state.artifacts == before


@pytest.mark.asyncio
@pytest.mark.parametrize('error, status', [(StoryboardConflictError('conflict'), 409), (ValueError('invalid'), 400)])
async def test_router_exposes_real_errors(monkeypatch, error, status):
    class Engine:
        def update_artifact(self, *args):
            raise error

    class Request:
        async def json(self):
            return {'episodes': []}

    monkeypatch.setattr(workflow, 'workflow_engine', Engine())
    with pytest.raises(HTTPException) as caught:
        await workflow.update_artifact('isolated', 'storyboard', Request())
    assert caught.value.status_code == status


def test_normalization_is_deterministic(saved):
    _, state, _ = saved
    result = normalize_storyboard(state.artifacts['storyboard'])
    assert normalize_storyboard(result) == result


def test_failed_disk_write_rolls_back_memory_and_status(saved, monkeypatch):
    engine, state, path = saved
    before = copy.deepcopy(state.artifacts)
    statuses = copy.deepcopy(state.status)
    disk = (path / 'editing-test.json').read_bytes()
    episodes = engine.get_artifact_snapshot(state.session_id, 'storyboard')['episodes']
    episodes[0]['segments'][0]['shots'][0]['content'] = 'must not save'

    def fail(*args):
        raise OSError('disk full')

    monkeypatch.setattr(engine, 'save_session_to_disk', fail)
    with pytest.raises(OSError):
        engine.update_artifact(state.session_id, 'storyboard', {'episodes': episodes})
    assert state.artifacts == before
    assert state.status == statuses
    assert (path / 'editing-test.json').read_bytes() == disk


def test_new_ids_cannot_escape_media_directories(saved):
    engine, state, _ = saved
    episodes = engine.get_artifact_snapshot(state.session_id, 'storyboard')['episodes']
    episodes[0]['segments'].append({'segment_id': '../escape', 'shots': []})
    with pytest.raises(ValueError, match='新增 segment_id'):
        engine.update_artifact(state.session_id, 'storyboard', {'episodes': episodes})


@pytest.mark.asyncio
async def test_later_agent_run_keeps_detached_media_history(saved):
    from core.orchestrator import WorkflowStage

    engine, state, path = saved
    episodes = engine.get_artifact_snapshot(state.session_id, 'storyboard')['episodes']
    episodes[0]['segments'].pop()
    engine.update_artifact(state.session_id, 'storyboard', {'episodes': episodes})

    class Agent:
        def set_cancellation_check(self, callback):
            pass

        def set_progress_callback(self, callback):
            self.progress = callback

        async def process(self, input_data, intervention=None):
            self.progress('preview', 'preview', 20, data={'assets_preview': {'clips': []}})
            return {'payload': {'clips': []}, 'stage_completed': True}

    engine.agent_factories = {WorkflowStage.VIDEO_GENERATION: Agent}
    await engine.execute_stage(state, WorkflowStage.VIDEO_GENERATION, {}, progress_callback=lambda *args: None)
    loaded = engine_at(path).get_state(state.session_id)
    assert loaded.artifacts['video_generation']['orphaned_clips'][0]['selected'] == 'deleted.mp4'


def test_wrapped_media_keeps_selected_versions(saved):
    engine, state, _ = saved
    for stage in ('reference_generation', 'video_generation'):
        state.artifacts[stage] = {'wrapper_extra': True, 'payload': state.artifacts[stage]}
    episodes = engine.get_artifact_snapshot(state.session_id, 'storyboard')['episodes']
    engine.update_artifact(state.session_id, 'storyboard', {'episodes': episodes})
    for stage, key in [('reference_generation', 'scenes'), ('video_generation', 'clips')]:
        artifact = state.artifacts[stage]
        assert artifact['wrapper_extra'] is True
        assert artifact[key][0]['selected']
        assert len(artifact[key][0]['versions']) == 2
        assert artifact['payload'][key] == artifact[key]


def test_partial_version_selection_does_not_change_film_order(saved):
    engine, state, _ = saved
    before = [item['id'] for item in state.artifacts['video_generation']['clips']]
    engine.update_artifact(state.session_id, 'video_generation', {'clips': [{'id': 'seg_01_02', 'selected': 'deleted.mp4'}]})
    assert [item['id'] for item in state.artifacts['video_generation']['clips']] == before


def test_new_uuid_segment_keeps_its_episode_for_post_production(saved):
    engine, state, _ = saved
    episodes = engine.get_artifact_snapshot(state.session_id, 'storyboard')['episodes']
    episodes[1]['segments'].append({'segment_id': 'ca1f48ad-151a-41ca-879e-f4a785c5fab5', 'segment_number': 2, 'shots': [{'shot_id': 'new-shot', 'duration': 4, 'content': 'second episode'}]})
    engine.update_artifact(state.session_id, 'storyboard', {'episodes': episodes})
    clip = state.artifacts['video_generation']['clips'][-1]
    assert clip['episode'] == 2
    assert clip['index'] == 2


def test_saved_shot_timing_and_framing_reach_video_agent_prompt(saved):
    from core.agents.video_agent import VideoDirectorAgent

    engine, state, _ = saved
    episodes = engine.get_artifact_snapshot(state.session_id, 'storyboard')['episodes']
    shot = episodes[0]['segments'][0]['shots'][1]
    shot.update({'duration': 7, 'shot_type': '特写', 'content': '读取纸条'})
    result = engine.update_artifact(state.session_id, 'storyboard', {'episodes': episodes})
    segment = result['artifact']['episodes'][0]['segments'][0]
    clip = state.artifacts['video_generation']['clips'][0]
    prompt = VideoDirectorAgent()._assemble_prompt(segment, '写实', video_data=clip)
    assert '分镜1：[3秒] 全景 first' in prompt
    assert '分镜2：[7秒] 特写 读取纸条' in prompt
    assert clip['duration'] == 10


def test_title_edit_keeps_user_video_prompt_and_reference_visual_prompt(saved):
    engine, state, _ = saved
    state.artifacts['video_generation']['clips'][0]['description'] = '分镜列表：用户微调的视频提示'
    state.artifacts['reference_generation']['scenes'][0]['visual_prompt'] = '用户微调的参考画面'
    episodes = engine.get_artifact_snapshot(state.session_id, 'storyboard')['episodes']
    episodes[0]['episode_title'] = 'changed title only'
    engine.update_artifact(state.session_id, 'storyboard', {'episodes': episodes})
    assert state.artifacts['video_generation']['clips'][0]['description'] == '分镜列表：用户微调的视频提示'
    assert state.artifacts['reference_generation']['scenes'][0]['visual_prompt'] == '用户微调的参考画面'


@pytest.mark.parametrize('changed', [False, True])
def test_canonical_save_preserves_alias_only_fields_at_every_level(saved, changed):
    engine, state, path = saved
    storyboard = engine.get_artifact_snapshot(state.session_id, 'storyboard')
    segments = [segment for episode in storyboard['episodes'] for segment in episode['segments']]
    shots = [shot for segment in segments for shot in segment['shots']]
    storyboard['segments'] = copy.deepcopy(segments)
    storyboard['shots'] = copy.deepcopy(shots)
    storyboard['segments'][0]['alias_segment'] = {'preserve': True}
    storyboard['segments'][0]['shots'][0]['alias_nested_shot'] = {'preserve': True}
    storyboard['shots'][0]['alias_flat_shot'] = {'preserve': True}
    storyboard['payload'] = {
        'wrapper_extra': True,
        'episodes': copy.deepcopy(storyboard['episodes']),
        'segments': copy.deepcopy(storyboard['segments']),
        'shots': copy.deepcopy(storyboard['shots']),
    }
    storyboard['payload']['episodes'][0]['alias_episode'] = {'preserve': True}
    storyboard['payload']['episodes'][0]['segments'][0]['payload_segment'] = True
    storyboard['payload']['segments'][0]['payload_flat_segment'] = True
    storyboard['payload']['shots'][0]['payload_flat_shot'] = True
    state.artifacts['storyboard'] = storyboard
    episodes = copy.deepcopy(storyboard['episodes'])
    if changed:
        episodes[0]['segments'][0]['shots'][0]['content'] = 'edited canonical'
    result = engine.update_artifact(state.session_id, 'storyboard', {'episodes': episodes})['artifact']
    assert result['segments'][0]['alias_segment'] == {'preserve': True}
    assert result['segments'][0]['shots'][0]['alias_nested_shot'] == {'preserve': True}
    assert result['shots'][0]['alias_flat_shot'] == {'preserve': True}
    payload = result['payload']
    assert payload['wrapper_extra'] is True
    assert payload['episodes'][0]['alias_episode'] == {'preserve': True}
    assert payload['episodes'][0]['segments'][0]['payload_segment'] is True
    assert payload['segments'][0]['payload_flat_segment'] is True
    assert payload['shots'][0]['payload_flat_shot'] is True
    expected_text = 'edited canonical' if changed else 'first'
    for alias_shot in (result['segments'][0]['shots'][0], result['shots'][0], payload['episodes'][0]['segments'][0]['shots'][0], payload['segments'][0]['shots'][0], payload['shots'][0]):
        assert alias_shot['content'] == expected_text
    assert engine_at(path).get_state(state.session_id).artifacts['storyboard'] == result


def test_moving_existing_segment_uses_parent_episode_for_every_media_view(saved):
    engine, state, path = saved
    snapshot = engine.get_artifact_snapshot(state.session_id, 'storyboard')
    state.artifacts['storyboard']['segments'] = copy.deepcopy(snapshot['episodes'][0]['segments'])
    episodes = copy.deepcopy(snapshot['episodes'])
    moved = episodes[0]['segments'].pop(0)
    moved['episode_number'] = 1
    moved['episode_id'] = episodes[0]['episode_id']
    episodes[1]['segments'].append(moved)
    result = engine.update_artifact(state.session_id, 'storyboard', {'episodes': episodes})['artifact']
    moved = result['episodes'][1]['segments'][-1]
    assert moved['episode_number'] == 2
    assert moved['episode_id'] == episodes[1]['episode_id']
    assert next(segment for segment in result['segments'] if segment['segment_id'] == moved['segment_id'])['episode_number'] == 2
    for stage, key in [('reference_generation', 'scenes'), ('video_generation', 'clips')]:
        item = next(item for item in state.artifacts[stage][key] if item['id'] == moved['segment_id'])
        assert item['episode'] == 2
        assert len(item['versions']) == 2
        assert item['selected']
    assert engine_at(path).get_state(state.session_id).artifacts['storyboard'] == result


def test_cross_episode_segment_and_shot_moves_preserve_payload_alias_extensions(saved):
    engine, state, path = saved
    storyboard = engine.get_artifact_snapshot(state.session_id, 'storyboard')
    payload_episodes = copy.deepcopy(storyboard['episodes'])
    payload_episodes[0]['segments'][0]['alias_segment'] = {'notes': 'keep across episodes'}
    payload_episodes[0]['segments'][0]['shots'][0]['alias_shot'] = {'notes': 'keep with segment'}
    payload_episodes[0]['segments'][1]['shots'][0]['alias_moved_shot'] = {'notes': 'keep across segments'}
    storyboard['payload'] = {'episodes': payload_episodes, 'wrapper_extra': True}
    state.artifacts['storyboard'] = storyboard
    episodes = copy.deepcopy(storyboard['episodes'])
    moved_segment = episodes[0]['segments'].pop(0)
    moved_shot = episodes[0]['segments'][0]['shots'].pop(0)
    episodes[0]['segments'].pop(0)
    moved_shot['content'] = 'edited while moving'
    moved_segment['shots'].append(moved_shot)
    episodes[1]['segments'].append(moved_segment)
    result = engine.update_artifact(state.session_id, 'storyboard', {'episodes': episodes})['artifact']
    alias_segment = result['payload']['episodes'][1]['segments'][-1]
    assert alias_segment['segment_id'] == moved_segment['segment_id']
    assert alias_segment['episode_number'] == 2
    assert alias_segment['alias_segment'] == {'notes': 'keep across episodes'}
    assert alias_segment['shots'][0]['alias_shot'] == {'notes': 'keep with segment'}
    assert alias_segment['shots'][-1]['alias_moved_shot'] == {'notes': 'keep across segments'}
    assert alias_segment['shots'][-1]['content'] == 'edited while moving'
    assert result['payload']['episodes'][0]['segments'] == []
    assert result['payload']['wrapper_extra'] is True
    assert engine_at(path).get_state(state.session_id).artifacts['storyboard'] == result
