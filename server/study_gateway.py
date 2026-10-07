"""Authenticated, same-origin study gateway for the existing tesis-pc service.

Run with the Python environment belonging to tesis-pc; no provider credentials
are copied into this project. The unauthenticated tutor.api is never mounted.
"""
from __future__ import annotations

import hashlib
import json
import secrets
import sqlite3
import threading
import time
from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager, contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field, StrictBool, field_validator

from tutor.models import Attempt, PublicProblem, SessionHead, SessionView, ProfileView, RecommendationView, TurnResponse
from tutor.provider import ProviderError
from tutor.retrieval import IndexUnavailable

ROOT = Path(__file__).resolve().parents[1]


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


class AccessStore:
    def __init__(self, path: Path, teacher_code: str):
        if len(teacher_code) < 32:
            raise ValueError('El código docente debe tener al menos 32 caracteres.')
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        self.teacher_hash = digest(teacher_code)
        with self.connect() as db:
            db.executescript('''
                CREATE TABLE IF NOT EXISTS participants (
                    student_id TEXT PRIMARY KEY, label TEXT NOT NULL,
                    code_hash TEXT UNIQUE NOT NULL, is_test INTEGER NOT NULL,
                    revoked INTEGER NOT NULL DEFAULT 0);
                CREATE TABLE IF NOT EXISTS access_sessions (
                    token_hash TEXT PRIMARY KEY, role TEXT NOT NULL,
                    student_id TEXT, expires REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS turn_jobs (
                    id TEXT PRIMARY KEY, student_id TEXT NOT NULL, session_id TEXT NOT NULL,
                    payload_hash TEXT NOT NULL, status TEXT NOT NULL, response TEXT, error TEXT);
                CREATE TABLE IF NOT EXISTS session_measurements (
                    session_id TEXT PRIMARY KEY, student_id TEXT NOT NULL,
                    started_at REAL NOT NULL, focus_confirmed_at REAL NOT NULL,
                    ended_at REAL, outcome TEXT CHECK(outcome IN ('completed', 'stopped')),
                    CHECK((ended_at IS NULL AND outcome IS NULL) OR
                          (ended_at IS NOT NULL AND outcome IS NOT NULL)));
                CREATE UNIQUE INDEX IF NOT EXISTS one_active_problem
                    ON session_measurements(student_id) WHERE ended_at IS NULL;
            ''')

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=30)
        db.row_factory = sqlite3.Row
        try:
            with db:
                yield db
        finally:
            db.close()

    def login(self, code):
        hashed = digest(code)
        role, student_id = 'teacher', None
        with self.connect() as db:
            if not secrets.compare_digest(hashed, self.teacher_hash):
                row = db.execute('SELECT student_id FROM participants WHERE code_hash=? AND revoked=0', (hashed,)).fetchone()
                if not row:
                    raise HTTPException(401, 'Código de acceso incorrecto o revocado.')
                role, student_id = 'student', row['student_id']
            token = secrets.token_urlsafe(32)
            db.execute('DELETE FROM access_sessions WHERE expires < ?', (time.time(),))
            db.execute('INSERT INTO access_sessions VALUES (?,?,?,?)', (digest(token), role, student_id, time.time()+8*3600))
        return dict(token=token, role=role, student_id=student_id)

    def authenticate(self, token):
        with self.connect() as db:
            row = db.execute('SELECT * FROM access_sessions WHERE token_hash=? AND expires>?', (digest(token), time.time())).fetchone()
            if not row:
                raise HTTPException(401, 'Tu acceso venció. Vuelve a ingresar con tu código.')
            if row['role'] == 'student' and not db.execute('SELECT 1 FROM participants WHERE student_id=? AND revoked=0', (row['student_id'],)).fetchone():
                raise HTTPException(401, 'Acceso revocado.')
            return dict(row)


class StrictInput(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class LoginInput(StrictInput):
    code: str = Field(min_length=1, max_length=200)


class ParticipantInput(StrictInput):
    label: str = Field(min_length=1, max_length=100)
    is_test: bool = False
    basics: list[str] = Field(default_factory=lambda: ['variables', 'bucles', 'condicionales', 'aritmetica'], max_length=30)


class FocusInput(StrictInput):
    focus_confirmed: StrictBool

    @field_validator('focus_confirmed')
    @classmethod
    def require_confirmation(cls, value):
        if not value:
            raise ValueError('Confirma que trabajarás únicamente en este problema antes de iniciar.')
        return value


class StartInput(FocusInput):
    problem_id: str = Field(min_length=1, max_length=100)


class FinishInput(StrictInput):
    outcome: Literal['completed', 'stopped']


class Measurement(StrictInput):
    started_at: str
    ended_at: str | None
    elapsed_seconds: float = Field(ge=0)
    focus_confirmed_at: str
    status: Literal['active', 'finished']
    outcome: Literal['completed', 'stopped'] | None
    server_now: str


class MeasuredSessionHead(SessionHead):
    measurement: Measurement | None


class MeasuredSessionView(SessionView):
    measurement: Measurement | None


class PendingAttempt(Attempt):
    request_id: str = Field(pattern=r'^[a-zA-Z0-9_-]{16,80}$')


def create_app(service, access: AccessStore, dist: Path | None = None):
    turn_gate = threading.Lock()
    lifecycle_gate = threading.Lock()
    active_turns = set()
    executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix='study-turn')
    login_attempts = defaultdict(deque)
    with access.connect() as db:
        db.execute("UPDATE turn_jobs SET status='failed', error=? WHERE status='running'", ('El servidor se reinició. Revisa el historial antes de reenviar.',))

    @asynccontextmanager
    async def lifespan(app):
        yield
        executor.shutdown(wait=True)
        service.close()

    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)

    @app.middleware('http')
    async def bounds_and_headers(request, call_next):
        # Streaming limit also covers requests without Content-Length.
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > 65536:
                return JSONResponse(status_code=413, content={'detail': 'La solicitud supera el tamaño permitido.'})
        request._body = bytes(body)
        response = await call_next(request)
        response.headers['Cache-Control'] = 'no-store'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['Referrer-Policy'] = 'no-referrer'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
        return response

    def identity(request: Request):
        header = request.headers.get('Authorization', '')
        if not header.startswith('Bearer '):
            raise HTTPException(401, 'Ingresa tu código de acceso.')
        return access.authenticate(header[7:])

    def student(who=Depends(identity)):
        if who['role'] != 'student':
            raise HTTPException(403, 'Esta acción corresponde a un alumno.')
        return who['student_id']

    def teacher(who=Depends(identity)):
        if who['role'] != 'teacher':
            raise HTTPException(403, 'Acceso exclusivo del investigador.')
        return who

    @app.exception_handler(KeyError)
    async def missing(request, exc):
        return JSONResponse(status_code=404, content={'detail': 'Sesión o problema inexistente para este alumno.'})

    @app.exception_handler(ProviderError)
    async def provider_failed(request, exc):
        # Provider details stay local; prompts and upstream URLs are not exposed.
        return JSONResponse(status_code=503, content={'detail': 'El tutor no pudo generar una respuesta. Tu intento quedó registrado; revisa el historial antes de reenviar.', 'code': exc.code})

    @app.exception_handler(IndexUnavailable)
    async def index_failed(request, exc):
        return JSONResponse(status_code=503, content={'detail': 'El material del tutor requiere revisión del investigador.', 'code': 'index_unavailable'})

    @app.post('/api/tutor/login')
    def login(body: LoginInput, request: Request):
        # Global cap protects the single local model host even behind a tunnel.
        # Do not trust user-supplied forwarded IP headers.
        with app.state.login_lock:
            now = time.monotonic()
            bucket = login_attempts['global']
            while bucket and bucket[0] < now-60:
                bucket.popleft()
            if len(bucket) >= 60:
                raise HTTPException(429, 'Demasiados accesos. Espera un minuto.')
            bucket.append(now)
        return access.login(body.code)

    app.state.login_lock = threading.Lock()

    @app.post('/api/tutor/logout')
    def logout(who=Depends(identity)):
        with access.connect() as db:
            db.execute('DELETE FROM access_sessions WHERE token_hash=?', (who['token_hash'],))
        return {'ok': True}

    @app.get('/api/tutor/me')
    def me(who=Depends(identity)):
        return dict(role=who['role'], student=service.store.student(who['student_id']) if who['student_id'] else None)

    @app.get('/api/tutor/health')
    def health(who=Depends(identity)):
        return dict(index_ready=service.retriever.ready(), llm_configured=service.settings.llm_provider != 'disabled' and bool(service.settings.llm_model), execution_enabled=service.settings.execution_enabled)

    @app.get('/api/tutor/problems', response_model=list[PublicProblem])
    def problems(who=Depends(identity)):
        return [p.public() for p in service.catalog.problems()]

    def measured(value):
        with access.connect() as db:
            row = db.execute('SELECT * FROM session_measurements WHERE session_id=? AND student_id=?',
                             (value['id'], value['student_id'])).fetchone()
        measurement = None
        if row:
            now = time.time()
            iso = lambda timestamp: datetime.fromtimestamp(timestamp, timezone.utc).isoformat()
            measurement = dict(started_at=iso(row['started_at']),
                ended_at=iso(row['ended_at']) if row['ended_at'] is not None else None,
                elapsed_seconds=round(max(0, (row['ended_at'] if row['ended_at'] is not None else now) - row['started_at']), 3),
                focus_confirmed_at=iso(row['focus_confirmed_at']),
                status='active' if row['ended_at'] is None else 'finished',
                outcome=row['outcome'], server_now=iso(now))
        return dict(value, measurement=measurement)

    def require_active(sid, session_id):
        # Resolve ownership first so another student's session is never disclosed.
        service.store.session(sid, session_id)
        with access.connect() as db:
            row = db.execute('SELECT ended_at FROM session_measurements WHERE session_id=? AND student_id=?',
                             (session_id, sid)).fetchone()
        if not row:
            raise HTTPException(409, 'Confirma el compromiso de trabajo e inicia la medición antes de consultar al tutor.')
        if row['ended_at'] is not None:
            raise HTTPException(409, 'Esta sesión ya terminó. Inicia una nueva sesión para trabajar en el problema.')

    def release_turn(session_id):
        with lifecycle_gate:
            active_turns.discard(session_id)
            turn_gate.release()

    @app.get('/api/tutor/sessions', response_model=list[MeasuredSessionHead])
    def sessions(sid=Depends(student)):
        return [measured(value) for value in service.store.sessions(sid)]

    @app.post('/api/tutor/sessions', response_model=MeasuredSessionHead, status_code=201)
    def start(body: StartInput, sid=Depends(student)):
        with lifecycle_gate, access.connect() as db:
            # The transaction and unique index also serialize simultaneous browser tabs.
            db.execute('BEGIN IMMEDIATE')
            active = db.execute('SELECT session_id FROM session_measurements WHERE student_id=? AND ended_at IS NULL', (sid,)).fetchone()
            if active:
                value = service.store.session(sid, active['session_id'])
                if value['problem_id'] != body.problem_id:
                    raise HTTPException(409, 'Ya tienes un problema en curso. Finaliza esa sesión antes de iniciar otro.')
                value = {key: value[key] for key in SessionHead.model_fields}
            else:
                value = service.start_session(sid, body.problem_id)
                now = time.time()
                db.execute('INSERT INTO session_measurements(session_id,student_id,started_at,focus_confirmed_at) VALUES (?,?,?,?)',
                           (value['id'], sid, now, now))
        return measured(value)

    @app.get('/api/tutor/sessions/{session_id}', response_model=MeasuredSessionView)
    def session(session_id: str, sid=Depends(student)):
        return measured(service.store.session(sid, session_id))

    @app.post('/api/tutor/sessions/{session_id}/resume', response_model=MeasuredSessionView)
    def resume(session_id: str, body: FocusInput, sid=Depends(student)):
        value = service.store.session(sid, session_id)
        with lifecycle_gate, access.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT * FROM session_measurements WHERE session_id=? AND student_id=?', (session_id, sid)).fetchone()
            if row and row['ended_at'] is not None:
                raise HTTPException(409, 'Esta sesión ya terminó. Inicia una nueva sesión para trabajar en el problema.')
            if not row:
                if db.execute('SELECT 1 FROM session_measurements WHERE student_id=? AND ended_at IS NULL', (sid,)).fetchone():
                    raise HTTPException(409, 'Ya tienes un problema en curso. Finaliza esa sesión antes de iniciar otro.')
                now = time.time()
                db.execute('INSERT INTO session_measurements(session_id,student_id,started_at,focus_confirmed_at) VALUES (?,?,?,?)',
                           (session_id, sid, now, now))
        return measured(value)

    @app.post('/api/tutor/sessions/{session_id}/finish', response_model=MeasuredSessionView)
    def finish(session_id: str, body: FinishInput, sid=Depends(student)):
        service.store.session(sid, session_id)
        with lifecycle_gate, access.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT * FROM session_measurements WHERE session_id=? AND student_id=?', (session_id, sid)).fetchone()
            if not row:
                raise HTTPException(409, 'Esta sesión aún no tiene una medición iniciada.')
            if session_id in active_turns or db.execute("SELECT 1 FROM turn_jobs WHERE session_id=? AND status='running'", (session_id,)).fetchone():
                raise HTTPException(409, 'Espera a que termine la respuesta del tutor antes de finalizar la sesión.')
            if row['ended_at'] is None:
                db.execute('UPDATE session_measurements SET ended_at=?,outcome=? WHERE session_id=?',
                           (max(time.time(), row['started_at']), body.outcome, session_id))
        return measured(service.store.session(sid, session_id))

    @app.post('/api/tutor/sessions/{session_id}/attempts', response_model=TurnResponse)
    def turn(session_id: str, body: Attempt, sid=Depends(student)):
        with lifecycle_gate:
            require_active(sid, session_id)
            if not turn_gate.acquire(blocking=False):
                raise HTTPException(429, 'El tutor está atendiendo otra consulta. Tu mensaje no fue enviado; inténtalo en unos momentos.')
            active_turns.add(session_id)
        try:
            return service.turn(sid, session_id, body)
        finally:
            release_turn(session_id)

    def job_view(row):
        return dict(id=row['id'], session_id=row['session_id'], status=row['status'],
                    response=json.loads(row['response']) if row['response'] else None, error=row['error'])

    @app.get('/api/tutor/jobs/{job_id}')
    def job(job_id: str, sid=Depends(student)):
        with access.connect() as db:
            row = db.execute('SELECT * FROM turn_jobs WHERE id=? AND student_id=?', (job_id, sid)).fetchone()
        if not row:
            raise HTTPException(404, 'Consulta no encontrada para este alumno.')
        return job_view(row)

    @app.post('/api/tutor/sessions/{session_id}/turns', status_code=202)
    def submit_turn(session_id: str, body: PendingAttempt, sid=Depends(student)):
        payload = body.model_dump(exclude={'request_id'})
        fingerprint = digest(json.dumps(payload, sort_keys=True))
        with lifecycle_gate:
            require_active(sid, session_id)
            with access.connect() as db:
                existing = db.execute('SELECT * FROM turn_jobs WHERE id=?', (body.request_id,)).fetchone()
            if existing:
                if (existing['student_id'], existing['session_id'], existing['payload_hash']) != (sid, session_id, fingerprint):
                    raise HTTPException(409, 'Identificador de consulta en conflicto.')
                return job_view(existing)
            if not turn_gate.acquire(blocking=False):
                raise HTTPException(429, 'El tutor está atendiendo otra consulta. Tu mensaje no fue enviado; inténtalo en unos momentos.')
            try:
                with access.connect() as db:
                    db.execute("INSERT INTO turn_jobs VALUES (?,?,?,?,'running',NULL,NULL)", (body.request_id, sid, session_id, fingerprint))
                active_turns.add(session_id)
            except Exception:
                turn_gate.release()
                raise

        def run():
            status, response, error = 'completed', None, None
            try:
                response = service.turn(sid, session_id, Attempt(**payload)).model_dump_json()
            except Exception:
                status = 'failed'
                error = 'El tutor no pudo completar la respuesta. Revisa el historial antes de volver a enviar.'
            finally:
                try:
                    with access.connect() as db:
                        db.execute('UPDATE turn_jobs SET status=?,response=?,error=? WHERE id=?', (status, response, error, body.request_id))
                finally:
                    release_turn(session_id)
        try:
            executor.submit(run)
        except Exception:
            try:
                with access.connect() as db:
                    db.execute("UPDATE turn_jobs SET status='failed',error=? WHERE id=?", ('El servidor no pudo iniciar la consulta. Inténtalo de nuevo.', body.request_id))
            finally:
                release_turn(session_id)
            raise
        return dict(id=body.request_id, session_id=session_id, status='running', response=None, error=None)

    @app.get('/api/tutor/profile', response_model=ProfileView)
    def profile(sid=Depends(student)):
        return service.store.profile(sid)

    @app.get('/api/tutor/recommendations', response_model=RecommendationView)
    def recommendations(goal: str | None = Query(None, max_length=100), sid=Depends(student)):
        return service.recommendations(sid, goal)

    @app.get('/api/tutor/research/participants')
    def participants(who=Depends(teacher)):
        with access.connect() as db:
            rows = db.execute('SELECT student_id,label,is_test,revoked FROM participants ORDER BY rowid DESC').fetchall()
        return [dict(row, session_count=len(service.store.sessions(row['student_id']))) for row in rows]

    @app.post('/api/tutor/research/participants', status_code=201)
    def enroll(body: ParticipantInput, who=Depends(teacher)):
        code = secrets.token_urlsafe(24)
        with access.connect() as db:
            if db.execute('SELECT 1 FROM participants WHERE label=?', (body.label,)).fetchone():
                raise HTTPException(409, 'Este código de participante ya existe; utiliza otro identificador.')
            person = service.store.create_student(body.label, body.basics)
            db.execute('INSERT INTO participants(student_id,label,code_hash,is_test) VALUES (?,?,?,?)', (person['id'], body.label, digest(code), body.is_test))
        return dict(student_id=person['id'], label=body.label, code=code, is_test=body.is_test)

    @app.post('/api/tutor/research/participants/{student_id}/revoke')
    def revoke(student_id: str, who=Depends(teacher)):
        with access.connect() as db:
            result = db.execute('UPDATE participants SET revoked=1 WHERE student_id=?', (student_id,))
            if not result.rowcount:
                raise HTTPException(404, 'Participante no encontrado.')
            db.execute('DELETE FROM access_sessions WHERE student_id=?', (student_id,))
        return {'ok': True}

    @app.get('/api/tutor/research/export')
    def export(include_tests: bool = False, who=Depends(teacher)):
        with access.connect() as db:
            rows = db.execute('SELECT student_id,label,is_test,revoked FROM participants WHERE is_test=0 OR ?=1', (int(include_tests),)).fetchall()
        return dict(schema_version=2, exported_at=time.time(), includes_tests=include_tests,
            measurement_semantics=dict(unit='seconds', basis='server_wall_clock',
                starts='explicit_focus_confirmation', ends='explicit_finish',
                includes_background_time=True, includes_tutor_wait=True,
                legacy_sessions='null_until_explicit_resume; earlier work is not timed',
                outcome='self_reported; completed does not certify a correct solution',
                focus='participant_commitment; no monitoring of other tabs or activities'),
            participants=[dict(row,
            profile=service.store.profile(row['student_id']),
            sessions=[measured(service.store.session(row['student_id'], s['id'])) for s in service.store.sessions(row['student_id'])]) for row in rows])

    # Never expose original /students or the unauthenticated backend API.
    @app.get('/')
    def entry(request: Request):
        if request.query_params.get('tutor') != '1':
            return RedirectResponse('/?tutor=1')
        from fastapi.responses import FileResponse
        if not dist or not (dist / 'index.html').exists():
            raise HTTPException(503, 'Primero compila el front-end.')
        return FileResponse(dist / 'index.html')

    if dist and (dist / 'assets').is_dir():
        app.mount('/assets', StaticFiles(directory=dist / 'assets'), name='assets')
        @app.get('/favicon.svg')
        def favicon():
            from fastapi.responses import FileResponse
            return FileResponse(dist / 'favicon.svg')
    return app


def main():
    import argparse
    import os
    import sys
    import uvicorn
    from tutor.config import Settings
    from tutor.service import TutorService

    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8010)
    parser.add_argument('--tutor-dir', type=Path, required=True)
    args = parser.parse_args()
    os.chdir(args.tutor_dir.resolve())
    runtime = ROOT / '.runtime'
    runtime.mkdir(exist_ok=True)
    teacher_file = runtime / 'teacher-access.txt'
    if not teacher_file.exists():
        with teacher_file.open('x', encoding='utf-8') as handle:
            handle.write(secrets.token_urlsafe(32))
    service = TutorService(Settings())
    access = AccessStore(runtime / 'study-access.sqlite3', teacher_file.read_text(encoding='utf-8').strip())
    print(f'Portal de sesiones: http://127.0.0.1:{args.port}/?tutor=1', flush=True)
    print(f'Código docente guardado localmente en {teacher_file}; no lo compartas con alumnos.', flush=True)
    # Bind only loopback. Publish only this gateway behind an HTTPS tunnel/proxy.
    uvicorn.run(create_app(service, access, ROOT / 'dist'), host='127.0.0.1', port=args.port, proxy_headers=False, access_log=False)


if __name__ == '__main__':
    main()
