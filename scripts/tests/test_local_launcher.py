"""Launcher checks use disposable folders and never start real app services."""
import importlib.util
import os
import plistlib
import subprocess
from pathlib import Path
from unittest.mock import MagicMock

import pytest

SPEC = importlib.util.spec_from_file_location('mujian_local_launcher', Path(__file__).parents[1] / 'local_launcher.py')
launcher = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(launcher)


def result(code=0, stdout='', stderr=''):
    return subprocess.CompletedProcess([], code, stdout, stderr)


@pytest.fixture
def app(tmp_path):
    return launcher.Launcher(tmp_path / 'project with spaces')


def test_repeated_launch_only_opens_browser(monkeypatch, app):
    monkeypatch.setattr(app, 'existing', lambda _: True)
    wait, start, definition, commands = MagicMock(), MagicMock(), MagicMock(), MagicMock(return_value=result())
    monkeypatch.setattr(app, 'wait', wait)
    monkeypatch.setattr(app, 'start', start)
    monkeypatch.setattr(app, 'definition', definition)
    monkeypatch.setattr(launcher, 'run', commands)
    app.start_all()
    assert [call.args[0] for call in wait.call_args_list] == ['backend', 'frontend']
    start.assert_not_called()
    definition.assert_not_called()
    commands.assert_called_once_with(['/usr/bin/open', launcher.URL])


def test_missing_frontend_dependency_does_not_start_backend(monkeypatch, app):
    monkeypatch.setattr(app, 'existing', lambda _: False)
    def definition(name):
        if name == 'frontend':
            raise launcher.LaunchError('缺少前端依赖')
        return {}
    monkeypatch.setattr(app, 'definition', definition)
    start = MagicMock()
    monkeypatch.setattr(app, 'start', start)
    with pytest.raises(launcher.LaunchError, match='前端依赖'):
        app.start_all()
    start.assert_not_called()


def test_backend_ready_before_frontend_and_no_open_mode(monkeypatch, app):
    events = []
    monkeypatch.setattr(app, 'existing', lambda _: False)
    monkeypatch.setattr(app, 'definition', lambda name: {'service': name})
    monkeypatch.setattr(app, 'start', lambda name, plan: events.append(('start', name)))
    monkeypatch.setattr(app, 'wait', lambda name: events.append(('ready', name)))
    commands = MagicMock()
    monkeypatch.setattr(launcher, 'run', commands)
    app.start_all(open_browser=False)
    assert events == [('start', 'backend'), ('ready', 'backend'), ('start', 'frontend'), ('ready', 'frontend')]
    commands.assert_not_called()


def test_unknown_port_owner_is_never_killed(monkeypatch, app, tmp_path):
    monkeypatch.setattr(launcher, 'port_open', lambda _: True)
    monkeypatch.setattr(launcher, 'listener_cwds', lambda _: {tmp_path / 'other project'})
    commands = MagicMock()
    monkeypatch.setattr(launcher, 'run', commands)
    with pytest.raises(launcher.LaunchError, match='其他程序'):
        app.start_all()
    commands.assert_not_called()


def test_foreign_project_cannot_win_port_race_with_healthy_response(monkeypatch, app, tmp_path):
    monkeypatch.setattr(app, 'healthy', lambda _: True)
    monkeypatch.setattr(launcher, 'port_open', lambda _: True)
    monkeypatch.setattr(launcher, 'listener_cwds', lambda _: {tmp_path / 'another MuJian/frontend'})
    with pytest.raises(launcher.LaunchError, match='其他程序'):
        app.wait('frontend')


def test_definition_uses_absolute_commands_and_no_credentials(monkeypatch, app):
    python = app.root / 'backend/.venv/bin/python'
    python.parent.mkdir(parents=True)
    python.write_text('test')
    python.chmod(0o700)
    node = app.root / 'node with spaces/bin/node'
    monkeypatch.setattr(launcher, 'node_executable', lambda: node)
    monkeypatch.setattr(launcher, 'run', MagicMock(return_value=result()))
    monkeypatch.setenv('DASHSCOPE_API_KEY', 'do-not-copy-secret')
    cli = app.root / 'frontend/node_modules/next/dist/bin/next'
    cli.parent.mkdir(parents=True)
    cli.write_text('test')
    backend = app.definition('backend')
    front = app.definition('frontend')
    assert backend['ProgramArguments'][0] == str(python)
    assert front['ProgramArguments'][:2] == [str(node), str(cli)]
    assert front['EnvironmentVariables']['NEXT_PUBLIC_MUJIAN_LEGACY'] == '0'
    assert backend['KeepAlive'] is False
    assert 'do-not-copy-secret' not in plistlib.dumps(backend).decode()
    assert 'DASHSCOPE_API_KEY' not in backend['EnvironmentVariables']


def test_finder_can_find_nvm_without_shell_path(monkeypatch, tmp_path):
    home = tmp_path / 'home'
    node = home / '.nvm/versions/node/v24.19.0/bin/node'
    node.parent.mkdir(parents=True)
    node.write_text('test')
    node.chmod(0o700)
    monkeypatch.setattr(launcher.shutil, 'which', lambda _: None)
    monkeypatch.setattr(launcher.Path, 'home', lambda: home)
    monkeypatch.setattr(launcher, 'run', lambda _: result(stdout='v24.19.0\n'))
    assert launcher.node_executable() == node


def test_launchctl_only_replaces_own_registered_label(monkeypatch, app):
    calls = []
    def run(args):
        calls.append(args)
        return result()
    monkeypatch.setattr(launcher, 'run', run)
    app.start('backend', {'Label': app.labels['backend']})
    assert calls == [
        ['/bin/launchctl', 'print', app.target('backend')],
        ['/bin/launchctl', 'bootout', app.target('backend')],
        ['/bin/launchctl', 'bootstrap', app.domain, str(app.runtime / 'backend.plist')],
    ]
    assert (app.runtime / 'backend.plist').stat().st_mode & 0o777 == 0o600


def test_failed_service_explains_reason_without_waiting_90s(monkeypatch, app):
    app.started.add('frontend')
    monkeypatch.setattr(app, 'healthy', lambda _: False)
    monkeypatch.setattr(launcher, 'run', lambda _: result(stdout='state = not running\nlast exit code = 1'))
    with pytest.raises(launcher.LaunchError, match='提前退出.*1'):
        app.wait('frontend')


def test_frontend_health_uses_proxy_not_nonexistent_health_route(monkeypatch, app):
    urls = []
    def request(url):
        urls.append(url)
        return '幕间'.encode() if url == launcher.URL else b'{"models":[{}]}'
    monkeypatch.setattr(launcher, 'request', request)
    assert app.healthy('frontend')
    assert urls == [launcher.URL, launcher.URL + 'api/models?model_type=tts']


def test_missing_backend_environment_reports_fix(app):
    with pytest.raises(launcher.LaunchError, match='uv sync'):
        app.definition('backend')


def test_error_writes_diagnostic_log(app):
    app.failure(launcher.LaunchError('端口占用'))
    assert '端口占用' in (app.runtime / 'launcher.log').read_text()
    assert not (app.root / 'backend/code').exists()


@pytest.mark.skipif(not Path('/bin/zsh').exists(), reason='macOS zsh wrapper')
def test_command_wrapper_has_valid_zsh_syntax():
    path = Path(__file__).resolve().parents[2] / '启动幕间.command'
    assert os.access(path, os.X_OK)
    assert subprocess.run(['/bin/zsh', '-n', str(path)], capture_output=True).returncode == 0
