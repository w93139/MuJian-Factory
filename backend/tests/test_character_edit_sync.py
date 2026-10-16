"""Editing metadata uses the existing synchronizer without running any agent."""
import copy
import threading

import pytest

from core.orchestrator import WorkflowEngine, WorkflowStage, WorkflowState


def engine_at(path):
    engine = object.__new__(WorkflowEngine)
    engine.sessions = {}
    engine._session_dir = str(path)
    engine._state_lock = threading.RLock()
    engine._active_sessions = set()
    return engine


@pytest.fixture
def saved(tmp_path):
    engine = engine_at(tmp_path)
    state = WorkflowState('roles')
    state.current_stage = WorkflowStage.STORYBOARD
    state.artifacts = {
        'script_generation': {
            'episodes': [{'episode_number': 1, 'content': 'keep narrative'}],
            'characters': [{'character_id': 'c1', 'name': '旅人', 'description': 'old', 'custom': 'keep'}],
            'settings': [{'setting_id': 's1', 'name': '车站', 'description': 'old setting'}],
        },
        'character_design': {
            'characters': [
                {'id': 'c1', 'name': '旅人', 'description': 'old', 'selected': 'v1.png', 'versions': ['v1.png', 'v2.png'], 'custom': 'keep'},
                {'id': 'c2', 'name': '路人', 'description': 'untouched', 'selected': '', 'versions': []},
            ],
            'settings': [{'id': 's1', 'name': '车站', 'description': 'old setting', 'selected': 's1.png', 'versions': ['s1.png']}],
        },
    }
    engine.sessions[state.session_id] = state
    engine.save_session_to_disk(state.session_id)
    return engine, state, tmp_path


@pytest.mark.parametrize('description', ['新角色描述', ''])
def test_description_patch_syncs_script_preserving_media_and_waiting(saved, description):
    engine, state, path = saved
    before = copy.deepcopy(state.artifacts)
    result = engine.update_artifact('roles', 'character_design', {
        'characters': [{'id': 'c1', 'description': description}],
        'settings': [{'id': 's1', 'description': description}],
    })
    assert result['status_map']['character_design'] == 'waiting'
    assert state.current_stage == WorkflowStage.STORYBOARD
    script = state.artifacts['script_generation']
    assert script['characters'][0]['description'] == description
    assert script['settings'][0]['description'] == description
    assert script['episodes'] == before['script_generation']['episodes']
    assert script['characters'][0]['custom'] == 'keep'
    for key in ('selected', 'versions', 'custom'):
        assert result['artifact']['characters'][0][key] == before['character_design']['characters'][0][key]
    assert result['artifact']['characters'][1] == before['character_design']['characters'][1]
    loaded = engine_at(path).get_state('roles')
    assert loaded.artifacts == state.artifacts
    assert loaded.current_stage == WorkflowStage.STORYBOARD


def test_partial_selection_does_not_overwrite_other_cards(saved):
    engine, state, _ = saved
    engine.update_artifact('roles', 'character_design', {'characters': [{'id': 'c1', 'selected': 'v2.png'}]})
    engine.update_artifact('roles', 'character_design', {'settings': [{'id': 's1', 'description': 'new'}]})
    assert state.artifacts['character_design']['characters'][0]['selected'] == 'v2.png'
    assert state.artifacts['script_generation']['settings'][0]['description'] == 'new'


def test_failed_save_rolls_back_both_stages_and_status(saved, monkeypatch):
    engine, state, path = saved
    artifacts, statuses = copy.deepcopy(state.artifacts), copy.deepcopy(state.status)
    disk = (path / 'roles.json').read_bytes()
    def fail(*args):
        raise OSError('disk full')
    monkeypatch.setattr(engine, 'save_session_to_disk', fail)
    with pytest.raises(OSError):
        engine.update_artifact('roles', 'character_design', {'characters': [{'id': 'c1', 'description': 'must roll back'}]})
    assert state.artifacts == artifacts
    assert state.status == statuses
    assert state.current_stage == WorkflowStage.STORYBOARD
    assert (path / 'roles.json').read_bytes() == disk


def test_selection_or_other_card_edit_does_not_overwrite_newer_script_metadata(saved):
    engine, state, _ = saved
    script = state.artifacts['script_generation']
    script['characters'][0]['description'] = 'newer script edit'
    script['characters'][0]['name'] = 'newer name'
    script['settings'][0]['description'] = 'newer setting edit'
    engine.update_artifact('roles', 'character_design', {'characters': [{'id': 'c1', 'selected': 'v2.png'}]})
    assert script['characters'][0]['description'] == 'newer script edit'
    assert script['characters'][0]['name'] == 'newer name'
    assert script['settings'][0]['description'] == 'newer setting edit'
    engine.update_artifact('roles', 'character_design', {'characters': [{'id': 'c1', 'description': 'explicit change'}]})
    assert script['characters'][0]['description'] == 'explicit change'
    assert script['characters'][0]['name'] == 'newer name'
    assert script['settings'][0]['description'] == 'newer setting edit'
