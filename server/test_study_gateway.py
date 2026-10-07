"""Gateway contract/isolation tests. Test doubles do not assess the real LLM."""
import json
from pathlib import Path
import sys
import threading
import time
from datetime import datetime
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parent))
from study_gateway import AccessStore, create_app
import study_gateway
from tutor.config import Settings
from tutor.service import TutorService
from tutor.provider import ProviderError
from tests.doubles import TestProvider, TestEmbeddings


@pytest.fixture
def setup(tmp_path):
    settings = Settings(_env_file=None, data_dir=tmp_path / 'tutor', corpus_path=Path('corpus/demo.json'),
                        embedding_model='test-only-hash', embedding_revision='test-v1')
    service = TutorService(settings, TestProvider(), TestEmbeddings())
    service.retriever.ingest()
    access = AccessStore(tmp_path / 'access.sqlite3', 'teacher-test-' * 4)
    with TestClient(create_app(service, access)) as client:
        teacher = client.post('/api/tutor/login', json={'code': 'teacher-test-' * 4}).json()['token']
        yield client, service, access, {'Authorization': f'Bearer {teacher}'}


def enroll(client, teacher, label='A001', is_test=False):
    response = client.post('/api/tutor/research/participants', headers=teacher, json={'label': label, 'is_test': is_test})
    assert response.status_code == 201
    record = response.json()
    token = client.post('/api/tutor/login', json={'code': record['code']}).json()['token']
    return {'Authorization': f'Bearer {token}'}, record


def start(client, headers, problem_id='arr-01'):
    response = client.post('/api/tutor/sessions', headers=headers, json={'problem_id': problem_id, 'focus_confirmed': True})
    assert response.status_code == 201, response.text
    return response.json()['id']


def test_requires_access_and_never_mounts_original_api(setup):
    client, _, _, _ = setup
    for path in ['/api/tutor/problems', '/api/tutor/sessions', '/api/tutor/profile', '/api/tutor/research/export']:
        assert client.get(path).status_code == 401
    for path in ['/students', '/health', '/docs', '/openapi.json', '/api/tutor/students']:
        assert client.get(path).status_code == 404
    assert client.post('/api/tutor/login', json={'code': 'wrong'}).status_code == 401


def test_owner_is_bound_to_token_not_request_body(setup):
    client, _, _, teacher = setup
    a, record_a = enroll(client, teacher)
    b, _ = enroll(client, teacher, 'B002')
    session = start(client, a)
    assert client.get(f'/api/tutor/sessions/{session}', headers=b).status_code == 404
    assert client.post(f'/api/tutor/sessions/{session}/attempts', headers=b, json={'message': 'Hola'}).status_code == 404
    assert client.post(f'/api/tutor/sessions/{session}/resume', headers=b, json={'focus_confirmed': True}).status_code == 404
    assert client.post(f'/api/tutor/sessions/{session}/finish', headers=b, json={'outcome': 'completed'}).status_code == 404
    assert client.post('/api/tutor/sessions', headers=b, json={'problem_id': 'arr-01', 'student_id': record_a['student_id']}).status_code == 422
    assert client.get('/api/tutor/research/participants', headers=a).status_code == 403
    assert client.get('/api/tutor/research/export', headers=a).status_code == 403
    assert client.get('/api/tutor/sessions', headers=teacher).status_code == 403


def test_real_service_contract_history_profile_export(setup):
    client, _, _, teacher = setup
    student, _ = enroll(client, teacher)
    enroll(client, teacher, 'QA', is_test=True)
    session = start(client, student)
    response = client.post(f'/api/tutor/sessions/{session}/attempts', headers=student, json={'message': '¿Qué salida solicita el problema?', 'need': 'comprension'})
    assert response.status_code == 200, response.text
    assert response.json()['sources']
    history = client.get(f'/api/tutor/sessions/{session}', headers=student).json()
    assert history['interactions'][0]['response'] == response.json()
    assert 'trace' not in history['interactions'][0]
    assert client.get('/api/tutor/profile', headers=student).status_code == 200
    assert client.get('/api/tutor/recommendations', headers=student).status_code == 200
    result = client.get('/api/tutor/research/export', headers=teacher).json()
    assert len(result['participants']) == 1
    assert result['participants'][0]['sessions'][0]['id'] == session
    assert 'code_hash' not in json.dumps(result)
    assert 'token_hash' not in json.dumps(result)
    catalog = client.get('/api/tutor/problems', headers=student).json()
    assert len(catalog) == 12
    assert not {'reference_cpp','tests','guidance','explanation'}.intersection(catalog[0])


def test_revocation_logout_and_expiry(setup):
    client, _, access, teacher = setup
    student, record = enroll(client, teacher)
    assert client.post('/api/tutor/logout', headers=student).status_code == 200
    assert client.get('/api/tutor/me', headers=student).status_code == 401
    token = client.post('/api/tutor/login', json={'code': record['code']}).json()['token']
    headers = {'Authorization': f'Bearer {token}'}
    with access.connect() as db:
        db.execute("UPDATE access_sessions SET expires=0 WHERE role='student'")
    assert client.get('/api/tutor/me', headers=headers).status_code == 401
    token = client.post('/api/tutor/login', json={'code': record['code']}).json()['token']
    assert client.post(f"/api/tutor/research/participants/{record['student_id']}/revoke", headers=teacher).status_code == 200
    assert client.get('/api/tutor/me', headers={'Authorization': f'Bearer {token}'}).status_code == 401
    assert client.post('/api/tutor/login', json={'code': record['code']}).status_code == 401


def test_failure_is_persisted_and_never_replaced_with_demo(setup):
    client, service, _, teacher = setup
    student, _ = enroll(client, teacher)
    session = start(client, student)
    class Broken:
        def generate(self, *args):
            raise ProviderError('private upstream URL or body', 'timeout')
    service.provider = Broken()
    result = client.post(f'/api/tutor/sessions/{session}/attempts', headers=student, json={'message': '¿Qué salida se solicita?'})
    assert result.status_code == 503
    assert 'private upstream' not in result.text
    history = client.get(f'/api/tutor/sessions/{session}', headers=student).json()
    assert history['interactions'][0]['status'] == 'failed'
    assert history['interactions'][0]['response'] is None
    assert history['measurement']['status'] == 'active'
    assert client.post(f'/api/tutor/sessions/{session}/finish', headers=student, json={'outcome': 'stopped'}).status_code == 200


def test_bounded_payload_and_browser_headers(setup):
    client, _, _, teacher = setup
    assert client.post('/api/tutor/login', content=b'x'*65537).status_code == 413
    assert client.post('/api/tutor/login', json={'code': 'x'*201}).status_code == 422
    response = client.get('/api/tutor/me', headers=teacher)
    assert response.headers['Cache-Control'] == 'no-store'
    assert "frame-ancestors 'none'" in response.headers['Content-Security-Policy']
    assert response.headers['X-Content-Type-Options'] == 'nosniff'


def test_restart_reuses_access_and_hashed_credentials(setup):
    client, _, access, teacher = setup
    _, record = enroll(client, teacher)
    reloaded = AccessStore(access.path, 'teacher-test-' * 4)
    result = reloaded.login(record['code'])
    assert reloaded.authenticate(result['token'])['student_id'] == record['student_id']
    with access.connect() as db:
        persisted = str([tuple(row) for row in db.execute('SELECT * FROM participants')])
    assert record['code'] not in persisted


def test_second_turn_gets_busy_instead_of_unbounded_queue(setup):
    client, service, _, teacher = setup
    a, _ = enroll(client, teacher)
    b, _ = enroll(client, teacher, 'B')
    first, second = start(client, a), start(client, b)
    original = service.turn
    entered, release = threading.Event(), threading.Event()
    def delayed(*args):
        entered.set()
        assert release.wait(10)
        return original(*args)
    service.turn = delayed
    result = []
    thread = threading.Thread(target=lambda: result.append(client.post(f'/api/tutor/sessions/{first}/attempts', headers=a, json={'message': 'Mi código tiene error', 'need': 'depuracion'})))
    thread.start()
    try:
        assert entered.wait(10)
        blocked = client.post(f'/api/tutor/sessions/{second}/attempts', headers=b, json={'message': 'Hola'})
        assert blocked.status_code == 429
        assert client.get(f'/api/tutor/sessions/{second}', headers=b).json()['interactions'] == []
        assert client.post(f'/api/tutor/sessions/{first}/finish', headers=a, json={'outcome': 'completed'}).status_code == 409
    finally:
        release.set(); thread.join(10)
    assert result[0].status_code == 200
    assert client.post(f'/api/tutor/sessions/{first}/finish', headers=a, json={'outcome': 'completed'}).status_code == 200


def test_login_throttle(setup):
    client, _, _, _ = setup
    for _ in range(59):
        assert client.post('/api/tutor/login', json={'code': 'bad'}).status_code == 401
    assert client.post('/api/tutor/login', json={'code': 'bad'}).status_code == 429


def test_background_turn_is_owned_idempotent_and_persisted(setup):
    client, _, _, teacher = setup
    a, _ = enroll(client, teacher)
    b, _ = enroll(client, teacher, 'B')
    session = start(client, a)
    payload = {'request_id': 'integration-job-0001', 'message': 'Mi código tiene error', 'need': 'depuracion'}
    endpoint = f'/api/tutor/sessions/{session}/turns'
    started = client.post(endpoint, headers=a, json=payload)
    assert started.status_code == 202
    for _ in range(100):
        result = client.get('/api/tutor/jobs/integration-job-0001', headers=a).json()
        if result['status'] != 'running':
            break
        time.sleep(.01)
    assert result['status'] == 'completed'
    assert result['response']['message']
    assert client.get('/api/tutor/jobs/integration-job-0001', headers=b).status_code == 404
    assert client.post(endpoint, headers=a, json=payload).json()['status'] == 'completed'
    assert len(client.get(f'/api/tutor/sessions/{session}', headers=a).json()['interactions']) == 1
    assert client.post(endpoint, headers=a, json=dict(payload, message='otra')).status_code == 409


@pytest.mark.parametrize('confirmation', [None, False, 1, 'true'])
def test_focus_confirmation_is_required_and_strict(setup, confirmation):
    client, service, _, teacher = setup
    student, record = enroll(client, teacher)
    body = {'problem_id': 'arr-01'}
    if confirmation is not None:
        body['focus_confirmed'] = confirmation
    assert client.post('/api/tutor/sessions', headers=student, json=body).status_code == 422
    assert service.store.sessions(record['student_id']) == []


def test_single_active_problem_and_same_problem_recovery(setup):
    client, service, _, teacher = setup
    student, record = enroll(client, teacher)
    first = start(client, student)
    assert start(client, student) == first
    blocked = client.post('/api/tutor/sessions', headers=student, json={'problem_id': 'arr-02', 'focus_confirmed': True})
    assert blocked.status_code == 409
    assert len(service.store.sessions(record['student_id'])) == 1
    assert client.post(f'/api/tutor/sessions/{first}/finish', headers=student, json={'outcome': 'stopped'}).status_code == 200
    assert start(client, student, 'arr-02') != first


def test_simultaneous_starts_recover_one_session(setup):
    client, service, _, teacher = setup
    student, record = enroll(client, teacher)
    barrier = threading.Barrier(3)
    results = []
    def open_problem():
        barrier.wait(timeout=10)
        results.append(client.post('/api/tutor/sessions', headers=student, json={'problem_id': 'arr-01', 'focus_confirmed': True}))
    threads = [threading.Thread(target=open_problem) for _ in range(2)]
    for thread in threads:
        thread.start()
    barrier.wait(timeout=10)
    for thread in threads:
        thread.join(10)
        assert not thread.is_alive()
    assert [r.status_code for r in results] == [201, 201]
    assert results[0].json()['id'] == results[1].json()['id']
    assert len(service.store.sessions(record['student_id'])) == 1


def test_measurement_survives_reload_restart_and_freezes_on_finish(setup, monkeypatch):
    client, service, access, teacher = setup
    student, record = enroll(client, teacher)
    clock = [time.time()]
    monkeypatch.setattr(study_gateway, 'time', SimpleNamespace(time=lambda: clock[0], monotonic=time.monotonic))
    session = start(client, student)
    endpoint = f'/api/tutor/sessions/{session}'
    initial = client.get(endpoint, headers=student).json()['measurement']
    assert initial['elapsed_seconds'] == 0
    assert initial['started_at'] == initial['focus_confirmed_at'] == initial['server_now']
    assert datetime.fromisoformat(initial['started_at']).utcoffset().total_seconds() == 0
    assert initial['status'] == 'active' and initial['ended_at'] is None
    clock[0] += 75.25
    measured = client.get('/api/tutor/sessions', headers=student).json()[0]['measurement']
    assert measured['elapsed_seconds'] == 75.25
    reloaded_access = AccessStore(access.path, 'teacher-test-' * 4)
    reloaded_service = TutorService(service.settings, TestProvider(), TestEmbeddings())
    with TestClient(create_app(reloaded_service, reloaded_access)) as restarted:
        loaded = restarted.get(endpoint, headers=student).json()['measurement']
        assert loaded == measured
        assert start(restarted, student) == session
        clock[0] += 44.75
        finished = restarted.post(endpoint + '/finish', headers=student, json={'outcome': 'completed'})
        assert finished.status_code == 200
        frozen = finished.json()['measurement']
        assert frozen['elapsed_seconds'] == 120
        assert frozen['status'] == 'finished' and frozen['outcome'] == 'completed'
        clock[0] += 60
        repeated = restarted.post(endpoint + '/finish', headers=student, json={'outcome': 'stopped'}).json()['measurement']
        assert repeated['elapsed_seconds'] == 120
        assert repeated['ended_at'] == frozen['ended_at']
        assert repeated['outcome'] == 'completed'
        assert restarted.post(endpoint + '/resume', headers=student, json={'focus_confirmed': True}).status_code == 409
        assert restarted.post(endpoint + '/attempts', headers=student, json={'message': 'Hola'}).status_code == 409
        assert restarted.post(endpoint + '/turns', headers=student, json={'request_id': 'finished-job-0001', 'message': 'Hola'}).status_code == 409
        report = restarted.get('/api/tutor/research/export', headers=teacher).json()
        assert report['schema_version'] == 2
        assert report['measurement_semantics']['includes_background_time'] is True
        assert report['measurement_semantics']['includes_tutor_wait'] is True
        assert report['participants'][0]['sessions'][0]['measurement'] == repeated
        assert reloaded_service.store.session(record['student_id'], session)['interactions'] == []


def test_legacy_session_has_no_invented_time_and_needs_confirmation(setup, monkeypatch):
    client, service, _, teacher = setup
    student, record = enroll(client, teacher)
    legacy = service.start_session(record['student_id'], 'arr-01')['id']
    endpoint = f'/api/tutor/sessions/{legacy}'
    assert client.get(endpoint, headers=student).json()['measurement'] is None
    assert client.get('/api/tutor/sessions', headers=student).json()[0]['measurement'] is None
    assert client.get('/api/tutor/research/export', headers=teacher).json()['participants'][0]['sessions'][0]['measurement'] is None
    assert client.post(endpoint + '/attempts', headers=student, json={'message': 'Hola'}).status_code == 409
    assert client.post(endpoint + '/turns', headers=student, json={'request_id': 'legacy-job-00001', 'message': 'Hola'}).status_code == 409
    assert client.post(endpoint + '/finish', headers=student, json={'outcome': 'stopped'}).status_code == 409
    for body in [{}, {'focus_confirmed': False}, {'focus_confirmed': 1}]:
        assert client.post(endpoint + '/resume', headers=student, json=body).status_code == 422
    other = start(client, student, 'arr-02')
    assert client.post(endpoint + '/resume', headers=student, json={'focus_confirmed': True}).status_code == 409
    assert client.post(f'/api/tutor/sessions/{other}/finish', headers=student, json={'outcome': 'stopped'}).status_code == 200
    clock = [time.time() + 100]
    monkeypatch.setattr(study_gateway, 'time', SimpleNamespace(time=lambda: clock[0], monotonic=time.monotonic))
    resumed = client.post(endpoint + '/resume', headers=student, json={'focus_confirmed': True})
    assert resumed.status_code == 200
    measurement = resumed.json()['measurement']
    assert measurement['elapsed_seconds'] == 0
    clock[0] += 8
    retry = client.post(endpoint + '/resume', headers=student, json={'focus_confirmed': True}).json()['measurement']
    assert retry['started_at'] == measurement['started_at']
    assert retry['elapsed_seconds'] == 8
    assert client.post(endpoint + '/attempts', headers=student, json={'message': 'Mi código tiene error', 'need': 'depuracion'}).status_code == 200


def test_background_turn_prevents_finish_until_failure_is_recorded(setup):
    client, service, _, teacher = setup
    student, _ = enroll(client, teacher)
    session = start(client, student)
    endpoint = f'/api/tutor/sessions/{session}'
    entered, release = threading.Event(), threading.Event()
    def fail_later(*args):
        entered.set()
        assert release.wait(10)
        raise RuntimeError('private failure detail')
    service.turn = fail_later
    payload = {'request_id': 'failure-job-00001', 'message': 'Hola'}
    try:
        assert client.post(endpoint + '/turns', headers=student, json=payload).status_code == 202
        assert entered.wait(10)
        assert client.post(endpoint + '/finish', headers=student, json={'outcome': 'stopped'}).status_code == 409
        assert client.get(endpoint, headers=student).json()['measurement']['status'] == 'active'
    finally:
        release.set()
    for _ in range(100):
        job = client.get('/api/tutor/jobs/failure-job-00001', headers=student).json()
        if job['status'] != 'running':
            break
        time.sleep(.01)
    assert job['status'] == 'failed'
    assert 'private failure' not in json.dumps(job)
    assert client.post(endpoint + '/finish', headers=student, json={'outcome': 'stopped'}).status_code == 200
