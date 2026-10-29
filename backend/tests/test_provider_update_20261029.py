"""Offline contract checks: no provider credentials or historical files used."""
from contextlib import contextmanager
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

import usage
from models.config_model import get_model_config, get_models_by_type, model_type_capabilities
from models.video_params import validate_video_inputs
from pipelines import tts


@contextmanager
def free_request(*args, **kwargs):
    yield


def test_new_models_have_correct_menu_and_reject_wrong_media():
    assert 'doubao-seed-2-1-lite-260915' in {m['id'] for m in get_models_by_type('vlm')}
    assert 'qwen-audio-3.1-tts-plus' in {m['id'] for m in get_models_by_type('tts')}
    image = get_model_config('qwen-image-3.0')
    assert model_type_capabilities('i2i', image)['adapter_resolutions'] == ['1K', '2K']
    assert 'digital_human' not in get_model_config('happyhorse-1.1-r2v')['capabilities']['adapter_ability_types']
    with pytest.raises(ValueError, match='voice_reference'):
        validate_video_inputs('happyhorse-1.1-r2v', reference_audio_path='audio.mp3')
    with pytest.raises(ValueError, match='9'):
        validate_video_inputs('happyhorse-1.1-r2v', reference_image_paths=[str(i) for i in range(10)])


def test_qwen_image_uses_multimodal_sdk_and_charges_first_reference(monkeypatch):
    from models import image_dashscope
    multimodal, old = MagicMock(), MagicMock()
    multimodal.return_value = SimpleNamespace(status_code=200, output=SimpleNamespace(choices=[
        {'message': {'content': [{'image': 'https://media.test/image.png'}]}}
    ]))
    monkeypatch.setattr(image_dashscope.MultiModalConversation, 'call', multimodal)
    monkeypatch.setattr(image_dashscope.ImageGeneration, 'call', old)
    ledger = MagicMock(side_effect=free_request)
    monkeypatch.setattr(image_dashscope, 'billable_request', ledger)
    client = image_dashscope.DashScopeClient(api_key='test')
    assert client.edit_image('edit', ['https://media.test/ref.png'], model='qwen-image-3.0', size='1024*1024')
    assert ledger.call_args.kwargs['input_images'] == 1
    assert multimodal.call_args.kwargs['messages'][0]['content'][0] == {'image': 'https://media.test/ref.png'}
    old.assert_not_called()


def test_qwen_image_size_and_reference_limit_before_provider(monkeypatch, tmp_path):
    from models.image_client import ImageClient
    client = ImageClient()
    generate = MagicMock(return_value=[str(tmp_path/'image.png')])
    monkeypatch.setattr(client.dashscope_client, 'generate_image', generate)
    assert client.generate_image('hello', model='qwen-image-3.0', video_ratio='1:1', resolution='2K', save_dir=str(tmp_path))
    assert generate.call_args.kwargs['size'] == '2048*2048'
    with pytest.raises(ValueError, match='3 张'):
        client.generate_image('edit', model='qwen-image-3.0', image_paths=['x']*4, save_dir=str(tmp_path))
    with pytest.raises(ValueError, match='像素'):
        client.generate_image('hello', model='qwen-image-3.0', resolution='4096*4096', save_dir=str(tmp_path))
    assert generate.call_count == 1


def test_qwen_input_image_budget_includes_first_image():
    # 0.50 Pro output + three inputs at 0.02, including the first one.
    assert usage.reserve_usage('qwen-image-3.0-pro', images=1, input_images=3) == Decimal('0.56')


def test_seedance_25_first_frame_preserves_aspect_adaptive(monkeypatch, tmp_path):
    from models import video_seedance
    image = tmp_path/'frame.png'
    image.write_bytes(b'image')
    post = MagicMock(return_value=SimpleNamespace(ok=True, json=lambda: {'id': 'test-task'}))
    monkeypatch.setattr(video_seedance.requests, 'post', post)
    client = video_seedance.SeedanceVideoClient(api_key='test')
    assert client._submit_task('scene', str(image), 'doubao-seedance-2-5-260628', 20, ratio='16:9') == 'test-task'
    body = post.call_args.kwargs['json']
    assert body['ratio'] == 'adaptive'
    assert body['content'][1]['role'] == 'first_frame'
    assert body['duration'] == 20


@pytest.mark.parametrize('scheme', ['http', 'https'])
def test_paid_tts_http_and_atomic_download(monkeypatch, tmp_path, scheme):
    monkeypatch.setattr(tts.Config, 'DASHSCOPE_API_KEY', 'test')
    post = MagicMock(return_value=SimpleNamespace(ok=True, json=lambda: {'output': {'audio': {'url': f'{scheme}://media.test/audio.mp3'}}}))
    get = MagicMock(return_value=SimpleNamespace(ok=True, content=b'mp3-audio'))
    ledger = MagicMock(side_effect=free_request)
    monkeypatch.setattr(tts.requests, 'post', post)
    monkeypatch.setattr(tts.requests, 'get', get)
    monkeypatch.setattr(tts, 'billable_request', ledger)
    output = tmp_path/'audio.mp3'
    tts._generate_dashscope_tts('你好A。', str(output), 'xunanchuan_v3.1', 1.0, 'qwen-audio-3.1-tts-plus')
    assert post.call_args.kwargs['json']['input'] == {'text': '你好A。', 'voice': 'xunanchuan_v3.1', 'format': 'mp3', 'sample_rate': 24000, 'rate': 1.0}
    assert post.call_args.args[0].endswith('/services/audio/tts/SpeechSynthesizer')
    assert ledger.call_args.kwargs['input_tokens'] == 8
    assert output.read_bytes() == b'mp3-audio'
    assert not list(tmp_path.glob('*.tmp'))
    with pytest.raises(ValueError, match='音色'):
        tts._generate_dashscope_tts('你好', str(output), 'zh-CN-YunjianNeural', 1, 'qwen-audio-3.1-tts-plus')
    assert post.call_count == 1


def test_tts_budget_rejects_before_network(monkeypatch, tmp_path):
    monkeypatch.setattr(tts.Config, 'DASHSCOPE_API_KEY', 'test')
    monkeypatch.setenv('MUJIAN_DAILY_BUDGET_CNY', '0')
    post = MagicMock()
    monkeypatch.setattr(tts.requests, 'post', post)
    with pytest.raises(usage.BudgetExceeded):
        tts._generate_dashscope_tts('你好', str(tmp_path/'a.mp3'), 'xunanchuan_v3.1', 1, 'qwen-audio-3.1-tts-plus')
    post.assert_not_called()


def test_ark_text_model_disables_thinking_in_ark_format(monkeypatch):
    from models import chat_client
    sdk = MagicMock()
    sdk.chat.completions.create.return_value = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content='完成'))])
    monkeypatch.setattr(chat_client, 'OpenAI', MagicMock(return_value=sdk))
    monkeypatch.setattr(chat_client.Config, 'ARK_API_KEY', 'test')
    monkeypatch.setattr(chat_client, 'billable_request', free_request)
    assert chat_client.ChatClient().query('剧本', 'doubao-seed-2-1-lite-260915') == '完成'
    assert sdk.chat.completions.create.call_args.kwargs['extra_body'] == {'thinking': {'type': 'disabled'}}
