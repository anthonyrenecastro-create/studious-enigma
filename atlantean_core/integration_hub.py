from __future__ import annotations

import ast
import base64
import hashlib
import html
import json
import os
import re
import resource
import shutil
import subprocess
import sys
import textwrap
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List


class IntegrationCapability(str, Enum):
    WEB_SEARCH = 'web_search'
    FILE_ANALYSIS = 'file_analysis'
    CODE_INTERPRETER = 'code_interpreter'
    IMAGE_GENERATION = 'image_generation'
    SPEECH_TO_TEXT = 'speech_to_text'
    TEXT_TO_SPEECH = 'text_to_speech'
    GMAIL = 'gmail'
    GOOGLE_CALENDAR = 'google_calendar'
    GOOGLE_CONTACTS = 'google_contacts'
    AUTOMATIONS = 'automations'
    PERSISTENT_MEMORY = 'persistent_memory'
    GITHUB = 'github'


@dataclass
class IntegrationDescriptor:
    integration_id: str
    name: str
    capability: IntegrationCapability
    description: str
    enabled: bool = True
    category: str = 'general'
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class IntegrationResult:
    success: bool
    integration_id: str
    message: str
    payload: Dict[str, Any] = field(default_factory=dict)
    result: Dict[str, Any] = field(default_factory=dict)


PYTHON_IMPORT_ALLOWLIST = {
    'math',
    'statistics',
    'random',
    'datetime',
    'json',
    're',
    'itertools',
    'collections',
    'functools',
    'decimal',
    'fractions',
    'string',
    'typing',
}

JAVASCRIPT_IMPORT_ALLOWLIST = {
    'crypto',
}

PYTHON_BLOCK_PATTERNS = [
    re.compile(r'__import__\s*\('),
    re.compile(r'\beval\s*\('),
    re.compile(r'\bexec\s*\('),
    re.compile(r'\bopen\s*\('),
    re.compile(r'\bcompile\s*\('),
    re.compile(r'\bglobals\s*\('),
    re.compile(r'\blocals\s*\('),
    re.compile(r'\bvars\s*\('),
    re.compile(r'\bbreakpoint\s*\('),
]

JAVASCRIPT_BLOCK_PATTERNS = [
    re.compile(r'\bchild_process\b'),
    re.compile(r'\bprocess\.'),
    re.compile(r'\bglobal\.'),
    re.compile(r'\beval\s*\('),
    re.compile(r'\bFunction\s*\('),
    re.compile(r'\bfetch\s*\('),
    re.compile(r'\brequire\s*\(\s*[\"\'](?:fs|net|http|https|os|worker_threads|vm|cluster|dns|dgram)[\"\']\s*\)'),
]

SANDBOX_PROFILES: Dict[str, Dict[str, int]] = {
    'python': {
        'timeout_seconds': 6,
        'cpu_seconds': 2,
        'memory_mb': 256,
        'max_output_chars': 12000,
        'max_code_chars': 12000,
    },
    'javascript': {
        'timeout_seconds': 6,
        'cpu_seconds': 2,
        'memory_mb': 192,
        'max_output_chars': 12000,
        'max_code_chars': 12000,
    },
}


class IntegrationHub:
    def __init__(self):
        self._registry: Dict[str, IntegrationDescriptor] = {}
        self._runners: Dict[str, Callable[[Dict[str, Any]], IntegrationResult]] = {}
        self._storage_dir = Path(os.getenv('ATLANTEAN_INTEGRATION_STORAGE_DIR', 'db/integrations'))
        self._storage_dir.mkdir(parents=True, exist_ok=True)
        self._register_default_integrations()

    def _register(self, descriptor: IntegrationDescriptor, runner: Callable[[Dict[str, Any]], IntegrationResult]) -> None:
        self._registry[descriptor.integration_id] = descriptor
        self._runners[descriptor.integration_id] = runner

    def _register_default_integrations(self) -> None:
        self._register(
            IntegrationDescriptor(
                integration_id='web_search',
                name='Web Search',
                capability=IntegrationCapability.WEB_SEARCH,
                description='Search the web and retrieve relevant results for user queries.',
                category='search',
            ),
            self._web_search_runner,
        )

        self._register(
            IntegrationDescriptor(
                integration_id='file_analysis',
                name='File Analysis',
                capability=IntegrationCapability.FILE_ANALYSIS,
                description='Analyze attached files and return summaries, extracted insights, or structured data.',
                category='analysis',
            ),
            self._file_analysis_runner,
        )

        self._register(
            IntegrationDescriptor(
                integration_id='code_interpreter',
                name='Code Interpreter',
                capability=IntegrationCapability.CODE_INTERPRETER,
                description='Execute code snippets in a sandboxed environment and return results.',
                category='execution',
            ),
            self._code_interpreter_runner,
        )

        self._register(
            IntegrationDescriptor(
                integration_id='image_generation',
                name='Image Generation',
                capability=IntegrationCapability.IMAGE_GENERATION,
                description='Generate images from text prompts.',
                category='visual',
            ),
            self._image_generation_runner,
        )

        self._register(
            IntegrationDescriptor(
                integration_id='speech_to_text',
                name='Speech to Text',
                capability=IntegrationCapability.SPEECH_TO_TEXT,
                description='Transcribe audio into text.',
                category='speech',
            ),
            self._speech_to_text_runner,
        )

        self._register(
            IntegrationDescriptor(
                integration_id='text_to_speech',
                name='Text to Speech',
                capability=IntegrationCapability.TEXT_TO_SPEECH,
                description='Synthesize spoken audio from text.',
                category='speech',
            ),
            self._text_to_speech_runner,
        )

        self._register(
            IntegrationDescriptor(
                integration_id='gmail',
                name='Gmail Connector',
                capability=IntegrationCapability.GMAIL,
                description='Send and read Gmail messages via authenticated Google APIs.',
                category='productivity',
            ),
            self._gmail_runner,
        )

        self._register(
            IntegrationDescriptor(
                integration_id='google_calendar',
                name='Google Calendar',
                capability=IntegrationCapability.GOOGLE_CALENDAR,
                description='Create and manage calendar events.',
                category='productivity',
            ),
            self._google_calendar_runner,
        )

        self._register(
            IntegrationDescriptor(
                integration_id='google_contacts',
                name='Google Contacts',
                capability=IntegrationCapability.GOOGLE_CONTACTS,
                description='Lookup and manage Google Contacts information.',
                category='productivity',
            ),
            self._google_contacts_runner,
        )

        self._register(
            IntegrationDescriptor(
                integration_id='automations',
                name='Automations & Reminders',
                capability=IntegrationCapability.AUTOMATIONS,
                description='Schedule reminders, notifications, and automation workflows.',
                category='workflow',
            ),
            self._automations_runner,
        )

        self._register(
            IntegrationDescriptor(
                integration_id='persistent_memory',
                name='Persistent Memory',
                capability=IntegrationCapability.PERSISTENT_MEMORY,
                description='Store and recall persistent user memory across sessions.',
                category='memory',
            ),
            self._persistent_memory_runner,
        )

        self._register(
            IntegrationDescriptor(
                integration_id='github_connector',
                name='GitHub Connector',
                capability=IntegrationCapability.GITHUB,
                description='Inspect repositories, issues and pull requests from GitHub.',
                category='developer',
            ),
            self._github_runner,
        )

    def _load_store(self, name: str, default: Any) -> Any:
        path = self._storage_dir / f'{name}.json'
        if not path.exists():
            return default
        try:
            with path.open('r', encoding='utf-8') as handle:
                return json.load(handle)
        except Exception:
            return default

    def _save_store(self, name: str, data: Any) -> None:
        path = self._storage_dir / f'{name}.json'
        with path.open('w', encoding='utf-8') as handle:
            json.dump(data, handle, indent=2)

    def _web_search_runner(self, payload: Dict[str, Any]) -> IntegrationResult:
        query = str(payload.get('query') or payload.get('prompt') or '').strip()
        if not query:
            return IntegrationResult(False, 'web_search', 'Missing query text.', payload, {})

        encoded = urllib.parse.quote(query)
        url = f'https://api.duckduckgo.com/?q={encoded}&format=json&no_redirect=1&no_html=1'
        try:
            with urllib.request.urlopen(url, timeout=12) as response:
                data = json.loads(response.read().decode('utf-8'))
        except Exception as exc:
            return IntegrationResult(False, 'web_search', f'Web search failed: {type(exc).__name__}', payload, {})

        answer = data.get('AbstractText') or data.get('Answer') or ''
        source = data.get('AbstractSource') or 'DuckDuckGo'
        results = data.get('Results') if isinstance(data.get('Results'), list) else []
        first_url = results[0].get('FirstURL') if results and isinstance(results[0], dict) else ''
        source_url = data.get('AbstractURL') or first_url
        related = []
        for item in (data.get('RelatedTopics') or [])[:5]:
            if isinstance(item, dict) and item.get('Text'):
                related.append({'text': item.get('Text'), 'url': item.get('FirstURL')})
            elif isinstance(item, dict) and isinstance(item.get('Topics'), list):
                for sub in item.get('Topics')[:3]:
                    if isinstance(sub, dict) and sub.get('Text'):
                        related.append({'text': sub.get('Text'), 'url': sub.get('FirstURL')})
        related = related[:6]

        return IntegrationResult(
            success=bool(answer or related),
            integration_id='web_search',
            message='Web search completed.' if (answer or related) else 'No direct web search results found.',
            payload={'query': query},
            result={
                'query': query,
                'answer': answer,
                'source': source,
                'source_url': source_url,
                'related_results': related,
            },
        )

    def _speech_to_text_runner(self, payload: Dict[str, Any]) -> IntegrationResult:
        provided_text = str(payload.get('text') or '').strip()
        if provided_text:
            return IntegrationResult(True, 'speech_to_text', 'Used provided text transcript.', payload, {
                'transcript': provided_text,
                'confidence': 1.0,
                'mode': 'provided_text',
            })

        audio_b64 = str(payload.get('audio_base64') or '').strip()
        if audio_b64:
            approx_bytes = int(len(audio_b64) * 0.75)
            return IntegrationResult(True, 'speech_to_text', 'Audio received; local transcription provider not configured.', payload, {
                'transcript': '',
                'confidence': 0.0,
                'mode': 'audio_received_no_transcriber',
                'audio_bytes_estimate': approx_bytes,
                'next_step': 'Configure external STT provider or send text directly in payload.text.',
            })

        return IntegrationResult(False, 'speech_to_text', 'Provide payload.text or payload.audio_base64.', payload, {})

    def _text_to_speech_runner(self, payload: Dict[str, Any]) -> IntegrationResult:
        text = str(payload.get('text') or payload.get('prompt') or '').strip()
        voice = str(payload.get('voice') or 'alloy').strip()
        if not text:
            return IntegrationResult(False, 'text_to_speech', 'Missing text to synthesize.', payload, {})

        ssml = f"<speak><voice name=\"{html.escape(voice)}\">{html.escape(text[:1200])}</voice></speak>"
        return IntegrationResult(True, 'text_to_speech', 'Generated speech synthesis plan.', payload, {
            'voice': voice,
            'character_count': len(text),
            'ssml': ssml,
            'audio_ready': False,
            'next_step': 'Attach a TTS provider key to generate playable audio bytes.',
        })

    def _gmail_runner(self, payload: Dict[str, Any]) -> IntegrationResult:
        action = str(payload.get('action') or 'draft').strip().lower()
        drafts = self._load_store('gmail_drafts', [])

        if action == 'draft':
            draft = {
                'id': f'draft-{int(time.time() * 1000)}',
                'to': payload.get('to') or '',
                'subject': payload.get('subject') or 'No subject',
                'body': payload.get('body') or payload.get('prompt') or '',
                'created_at': datetime.now(timezone.utc).isoformat(),
            }
            drafts.insert(0, draft)
            self._save_store('gmail_drafts', drafts[:100])
            return IntegrationResult(True, 'gmail', 'Email draft created locally.', payload, {
                'draft': draft,
                'draft_count': len(drafts),
                'mode': 'local_draft',
            })

        if action == 'list_drafts':
            return IntegrationResult(True, 'gmail', 'Fetched local drafts.', payload, {
                'drafts': drafts[:25],
                'count': len(drafts),
                'mode': 'local_draft_store',
            })

        return IntegrationResult(False, 'gmail', 'Unsupported Gmail action. Use draft or list_drafts.', payload, {})

    def _google_calendar_runner(self, payload: Dict[str, Any]) -> IntegrationResult:
        action = str(payload.get('action') or 'create_event').strip().lower()
        events = self._load_store('calendar_events', [])

        if action == 'create_event':
            start_iso = str(payload.get('start') or (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat())
            end_iso = str(payload.get('end') or (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat())
            event = {
                'id': f'evt-{int(time.time() * 1000)}',
                'title': payload.get('title') or payload.get('prompt') or 'Untitled event',
                'start': start_iso,
                'end': end_iso,
                'location': payload.get('location') or '',
                'notes': payload.get('notes') or '',
                'created_at': datetime.now(timezone.utc).isoformat(),
            }
            events.insert(0, event)
            self._save_store('calendar_events', events[:200])
            return IntegrationResult(True, 'google_calendar', 'Calendar event created locally.', payload, {
                'event': event,
                'event_count': len(events),
                'mode': 'local_calendar_store',
            })

        if action == 'list_events':
            return IntegrationResult(True, 'google_calendar', 'Fetched local events.', payload, {
                'events': events[:25],
                'count': len(events),
                'mode': 'local_calendar_store',
            })

        return IntegrationResult(False, 'google_calendar', 'Unsupported action. Use create_event or list_events.', payload, {})

    def _google_contacts_runner(self, payload: Dict[str, Any]) -> IntegrationResult:
        action = str(payload.get('action') or 'search').strip().lower()
        contacts = self._load_store('contacts', [])

        if action == 'add':
            contact = {
                'id': f'ct-{int(time.time() * 1000)}',
                'name': payload.get('name') or 'Unnamed',
                'email': payload.get('email') or '',
                'phone': payload.get('phone') or '',
                'notes': payload.get('notes') or '',
            }
            contacts.insert(0, contact)
            self._save_store('contacts', contacts[:500])
            return IntegrationResult(True, 'google_contacts', 'Contact added locally.', payload, {
                'contact': contact,
                'count': len(contacts),
                'mode': 'local_contact_store',
            })

        query = str(payload.get('query') or payload.get('prompt') or '').strip().lower()
        if action == 'search' and query:
            matches = [c for c in contacts if query in json.dumps(c).lower()][:20]
            return IntegrationResult(True, 'google_contacts', f'Found {len(matches)} contact(s).', payload, {
                'matches': matches,
                'query': query,
                'mode': 'local_contact_store',
            })

        if action == 'list' or (action == 'search' and not query):
            return IntegrationResult(True, 'google_contacts', 'Fetched contacts.', payload, {
                'contacts': contacts[:50],
                'count': len(contacts),
                'mode': 'local_contact_store',
            })

        return IntegrationResult(False, 'google_contacts', 'Unsupported action. Use add, search, or list.', payload, {})

    def _automations_runner(self, payload: Dict[str, Any]) -> IntegrationResult:
        action = str(payload.get('action') or 'create').strip().lower()
        reminders = self._load_store('automations', [])

        if action == 'create':
            reminder = {
                'id': f'rm-{int(time.time() * 1000)}',
                'title': payload.get('title') or payload.get('prompt') or 'Untitled reminder',
                'due_at': payload.get('due_at') or (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
                'status': 'pending',
                'created_at': datetime.now(timezone.utc).isoformat(),
            }
            reminders.insert(0, reminder)
            self._save_store('automations', reminders[:500])
            return IntegrationResult(True, 'automations', 'Reminder created.', payload, {
                'reminder': reminder,
                'count': len(reminders),
            })

        if action == 'complete':
            reminder_id = str(payload.get('id') or '').strip()
            updated = False
            for item in reminders:
                if item.get('id') == reminder_id:
                    item['status'] = 'completed'
                    item['completed_at'] = datetime.now(timezone.utc).isoformat()
                    updated = True
                    break
            self._save_store('automations', reminders)
            return IntegrationResult(updated, 'automations', 'Reminder completed.' if updated else 'Reminder id not found.', payload, {
                'id': reminder_id,
                'updated': updated,
            })

        if action == 'list':
            return IntegrationResult(True, 'automations', 'Fetched reminders.', payload, {
                'reminders': reminders[:50],
                'count': len(reminders),
            })

        return IntegrationResult(False, 'automations', 'Unsupported action. Use create, complete, or list.', payload, {})

    def _persistent_memory_runner(self, payload: Dict[str, Any]) -> IntegrationResult:
        action = str(payload.get('action') or 'save').strip().lower()
        records = self._load_store('persistent_memory', [])

        if action == 'save':
            text = str(payload.get('text') or payload.get('content') or payload.get('prompt') or '').strip()
            if not text:
                return IntegrationResult(False, 'persistent_memory', 'Missing text/content to save.', payload, {})
            record = {
                'id': f'mem-{int(time.time() * 1000)}',
                'text': text[:4000],
                'tags': payload.get('tags') if isinstance(payload.get('tags'), list) else [],
                'created_at': datetime.now(timezone.utc).isoformat(),
            }
            records.insert(0, record)
            self._save_store('persistent_memory', records[:1000])
            return IntegrationResult(True, 'persistent_memory', 'Memory saved.', payload, {
                'record': record,
                'count': len(records),
            })

        if action == 'search':
            query = str(payload.get('query') or payload.get('prompt') or '').strip().lower()
            matches = [r for r in records if query and query in r.get('text', '').lower()][:25]
            return IntegrationResult(True, 'persistent_memory', f'Found {len(matches)} matching memory item(s).', payload, {
                'query': query,
                'matches': matches,
            })

        if action == 'list':
            return IntegrationResult(True, 'persistent_memory', 'Fetched memory records.', payload, {
                'records': records[:50],
                'count': len(records),
            })

        return IntegrationResult(False, 'persistent_memory', 'Unsupported action. Use save, search, or list.', payload, {})

    def _github_runner(self, payload: Dict[str, Any]) -> IntegrationResult:
        query = str(payload.get('query') or payload.get('prompt') or 'stars:>100 language:python').strip()
        search_type = str(payload.get('search_type') or 'repositories').strip().lower()
        token = (os.getenv('GITHUB_TOKEN') or '').strip()

        endpoint_map = {
            'repositories': 'repositories',
            'issues': 'issues',
            'users': 'users',
            'code': 'code',
        }
        kind = endpoint_map.get(search_type, 'repositories')
        url = f'https://api.github.com/search/{kind}?q={urllib.parse.quote(query)}&per_page=10'
        headers = {
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'atlantean-integration-hub',
        }
        if token:
            headers['Authorization'] = f'Bearer {token}'

        req = urllib.request.Request(url, method='GET', headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                data = json.loads(response.read().decode('utf-8'))
        except urllib.error.HTTPError as exc:
            return IntegrationResult(False, 'github_connector', f'GitHub API error: {exc.code}', payload, {})
        except Exception as exc:
            return IntegrationResult(False, 'github_connector', f'GitHub search failed: {type(exc).__name__}', payload, {})

        items = data.get('items') or []
        compact = []
        for item in items[:10]:
            compact.append({
                'name': item.get('full_name') or item.get('name') or item.get('title'),
                'url': item.get('html_url'),
                'description': item.get('description') or item.get('body', '')[:180],
                'score': item.get('score'),
            })

        return IntegrationResult(True, 'github_connector', f'GitHub {kind} search completed.', payload, {
            'search_type': kind,
            'query': query,
            'total_count': data.get('total_count', 0),
            'results': compact,
            'authenticated': bool(token),
        })

    def _stub_runner(self, payload: Dict[str, Any]) -> IntegrationResult:
        return IntegrationResult(
            success=False,
            integration_id='stub',
            message='This integration is scaffolded and requires production implementation.',
            payload=payload,
            result={},
        )

    def _file_analysis_runner(self, payload: Dict[str, Any]) -> IntegrationResult:
        files = payload.get('files', [])
        prompt = str(payload.get('prompt', '') or '').strip()

        if not isinstance(files, list) or len(files) == 0:
            return IntegrationResult(
                success=False,
                integration_id='file_analysis',
                message='No files were attached for analysis.',
                payload=payload,
                result={},
            )

        file_summaries: List[str] = []
        file_metadata: List[Dict[str, Any]] = []

        for raw_file in files[:10]:
            if not isinstance(raw_file, dict):
                continue

            name = str(raw_file.get('name', 'unnamed'))
            type_name = str(raw_file.get('type', 'application/octet-stream'))
            extracted_text = str(raw_file.get('extractedText', '') or raw_file.get('extracted_text', '') or '').strip()
            file_metadata.append({
                'name': name,
                'type': type_name,
                'has_extracted_text': bool(extracted_text),
            })

            if extracted_text:
                snippet = extracted_text[:1200]
                file_summaries.append(
                    f"File: {name} ({type_name})\n\n{snippet}"
                )
            else:
                file_summaries.append(
                    f"File: {name} ({type_name})\n\n[No extracted text available or binary content.]"
                )

        summary_text = '\n\n'.join(file_summaries)
        highlighted_prompt = prompt or 'Analyze the attached documents and summarize key points.'
        analysis_summary = (
            f"Analyzed {len(file_metadata)} file(s). Prompt: {highlighted_prompt}\n\n"
            f"Summary of attachments:\n{summary_text}"
        )

        return IntegrationResult(
            success=True,
            integration_id='file_analysis',
            message='File analysis completed successfully.',
            payload={
                'prompt': highlighted_prompt,
                'files': file_metadata,
            },
            result={
                'summary': analysis_summary,
                'files': file_metadata,
            },
        )

    def _extract_js_modules(self, code: str) -> List[str]:
        modules = set()
        for match in re.finditer(r"require\s*\(\s*['\"]([^'\"]+)['\"]\s*\)", code):
            modules.add(match.group(1).split('/')[0])
        for match in re.finditer(r"import\s+(?:[^'\"]+\s+from\s+)?['\"]([^'\"]+)['\"]", code):
            modules.add(match.group(1).split('/')[0])
        return sorted(modules)

    def _validate_python_code(self, code: str) -> tuple[bool, str, List[str]]:
        for pattern in PYTHON_BLOCK_PATTERNS:
            if pattern.search(code):
                return False, 'Blocked Python construct detected by guardrail policy.', []

        try:
            tree = ast.parse(code)
        except SyntaxError as exc:
            return False, f'Python syntax error: {exc}', []

        imported_roots: List[str] = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imported_roots.append(alias.name.split('.')[0])
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    imported_roots.append(node.module.split('.')[0])

        unique_imports = sorted(set(imported_roots))
        disallowed = [name for name in unique_imports if name not in PYTHON_IMPORT_ALLOWLIST]
        if disallowed:
            return False, f'Disallowed Python imports: {", ".join(disallowed)}', unique_imports

        return True, 'ok', unique_imports

    def _validate_javascript_code(self, code: str) -> tuple[bool, str, List[str]]:
        for pattern in JAVASCRIPT_BLOCK_PATTERNS:
            if pattern.search(code):
                return False, 'Blocked JavaScript construct detected by guardrail policy.', []

        modules = self._extract_js_modules(code)
        disallowed = [name for name in modules if name and name not in JAVASCRIPT_IMPORT_ALLOWLIST]
        if disallowed:
            return False, f'Disallowed JavaScript imports: {", ".join(disallowed)}', modules

        return True, 'ok', modules

    def _sandbox_preexec(self, cpu_seconds: int, memory_mb: int) -> Callable[[], None]:
        def _apply_limits() -> None:
            # Linux-only resource caps for subprocess isolation.
            resource.setrlimit(resource.RLIMIT_CPU, (cpu_seconds, cpu_seconds + 1))
            memory_bytes = memory_mb * 1024 * 1024
            resource.setrlimit(resource.RLIMIT_AS, (memory_bytes, memory_bytes))
            resource.setrlimit(resource.RLIMIT_DATA, (memory_bytes, memory_bytes))
            resource.setrlimit(resource.RLIMIT_FSIZE, (2 * 1024 * 1024, 2 * 1024 * 1024))
            resource.setrlimit(resource.RLIMIT_NOFILE, (64, 64))

        return _apply_limits

    def _code_interpreter_runner(self, payload: Dict[str, Any]) -> IntegrationResult:
        code = str(payload.get('code', '') or '').strip()
        prompt = str(payload.get('prompt', '') or '').strip()
        language = str(payload.get('language', 'python') or 'python').strip().lower()

        if not code:
            return IntegrationResult(
                success=False,
                integration_id='code_interpreter',
                message='No code provided. Paste code and try again.',
                payload=payload,
                result={},
            )

        normalized_language = 'python' if language in ('python', 'py') else 'javascript' if language in ('javascript', 'js', 'node') else language
        profile = SANDBOX_PROFILES.get(normalized_language)
        if profile is None:
            return IntegrationResult(
                success=False,
                integration_id='code_interpreter',
                message=f'Unsupported language "{language}". Use python or javascript.',
                payload=payload,
                result={'language': language},
            )

        if len(code) > profile['max_code_chars']:
            return IntegrationResult(
                success=False,
                integration_id='code_interpreter',
                message=f'Code exceeds size limit ({profile["max_code_chars"]} chars).',
                payload={'prompt': prompt, 'language': normalized_language},
                result={},
            )

        if normalized_language == 'python':
            valid, reason, imported = self._validate_python_code(code)
        else:
            valid, reason, imported = self._validate_javascript_code(code)

        if not valid:
            return IntegrationResult(
                success=False,
                integration_id='code_interpreter',
                message=f'Execution blocked by guardrails: {reason}',
                payload={'prompt': prompt, 'language': normalized_language},
                result={'imported_modules': imported},
            )

        started = time.time()
        timeout_seconds = profile['timeout_seconds']

        if normalized_language == 'python':
            command = [sys.executable, '-I', '-S', '-c', code]
            runtime = 'python'
        else:
            node = shutil.which('node')
            if not node:
                return IntegrationResult(
                    success=False,
                    integration_id='code_interpreter',
                    message='Node.js is not available in this runtime for JavaScript execution.',
                    payload=payload,
                    result={'language': normalized_language},
                )
            command = [node, '--disallow-code-generation-from-strings', '-e', code]
            runtime = 'node'

        run_kwargs: Dict[str, Any] = {
            'capture_output': True,
            'text': True,
            'timeout': timeout_seconds,
            'check': False,
            'stdin': subprocess.DEVNULL,
            'env': {
                'PATH': os.getenv('PATH', ''),
                'PYTHONNOUSERSITE': '1',
            },
        }
        if os.name != 'nt':
            run_kwargs['preexec_fn'] = self._sandbox_preexec(profile['cpu_seconds'], profile['memory_mb'])

        try:
            proc = subprocess.run(command, **run_kwargs)
            duration_ms = int((time.time() - started) * 1000)
            stdout = (proc.stdout or '').strip()
            stderr = (proc.stderr or '').strip()

            # Keep payloads bounded for UI rendering.
            stdout = stdout[:profile['max_output_chars']]
            stderr = stderr[:profile['max_output_chars']]

            ok = proc.returncode == 0
            return IntegrationResult(
                success=ok,
                integration_id='code_interpreter',
                message='Code executed successfully.' if ok else 'Code execution finished with errors.',
                payload={
                    'prompt': prompt,
                    'language': normalized_language,
                    'runtime': runtime,
                    'sandbox_profile': normalized_language,
                },
                result={
                    'exit_code': proc.returncode,
                    'duration_ms': duration_ms,
                    'stdout': stdout,
                    'stderr': stderr,
                    'timed_out': False,
                    'imported_modules': imported,
                },
            )
        except subprocess.TimeoutExpired as exc:
            duration_ms = int((time.time() - started) * 1000)
            return IntegrationResult(
                success=False,
                integration_id='code_interpreter',
                message=f'Execution timed out after {timeout_seconds}s.',
                payload={
                    'prompt': prompt,
                    'language': normalized_language,
                },
                result={
                    'exit_code': None,
                    'duration_ms': duration_ms,
                    'stdout': (exc.stdout or '')[:profile['max_output_chars']],
                    'stderr': (exc.stderr or '')[:profile['max_output_chars']],
                    'timed_out': True,
                    'imported_modules': imported,
                },
            )

    def _render_svg_fallback(self, prompt: str, ref_count: int, provider_errors: List[str]) -> IntegrationResult:
        digest = hashlib.sha256(prompt.encode('utf-8')).hexdigest()
        color_a = f'#{digest[:6]}'
        color_b = f'#{digest[6:12]}'
        color_c = f'#{digest[12:18]}'
        prompt_safe = html.escape(prompt[:140])

        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="{color_a}"/>
      <stop offset="50%" stop-color="{color_b}"/>
      <stop offset="100%" stop-color="{color_c}"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#g)"/>
  <g fill="rgba(255,255,255,0.15)">
    <circle cx="190" cy="220" r="120"/>
    <circle cx="760" cy="360" r="180"/>
    <circle cx="520" cy="760" r="220"/>
  </g>
  <rect x="72" y="760" width="880" height="192" rx="24" fill="rgba(0,0,0,0.45)"/>
  <text x="100" y="830" fill="#ffffff" font-family="monospace" font-size="28">Image Studio Fallback Render</text>
  <text x="100" y="880" fill="#e5e7eb" font-family="monospace" font-size="20">{prompt_safe}</text>
</svg>'''

        image_data_url = 'data:image/svg+xml;base64,' + base64.b64encode(svg.encode('utf-8')).decode('ascii')

        return IntegrationResult(
            success=True,
            integration_id='image_generation',
            message='Image generated using SVG fallback renderer.',
            payload={
                'prompt': prompt,
                'reference_image_count': ref_count,
                'provider_errors': provider_errors[:5],
            },
            result={
                'image_data_url': image_data_url,
                'mime_type': 'image/svg+xml',
                'width': 1024,
                'height': 1024,
                'prompt': prompt,
                'render_mode': 'procedural_svg_fallback',
            },
        )

    @staticmethod
    def _mask_key(raw_key: str) -> str:
        key = (raw_key or '').strip()
        if len(key) <= 8:
            return '***'
        return f'{key[:4]}...{key[-4:]}'

    @staticmethod
    def _http_error_message(exc: urllib.error.HTTPError) -> str:
        try:
            body = exc.read().decode('utf-8', errors='replace')
            if body:
                return f'HTTP {exc.code}: {body[:400]}'
        except Exception:
            pass
        return f'HTTP {exc.code}: {exc.reason}'

    def _test_openai_image_model(self, api_key: str, model: str, prompt: str) -> Dict[str, Any]:
        request_body = {
            'model': model,
            'prompt': prompt,
            'size': '256x256',
            'response_format': 'b64_json',
        }
        data = json.dumps(request_body).encode('utf-8')
        req = urllib.request.Request(
            'https://api.openai.com/v1/images/generations',
            method='POST',
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {api_key}',
            },
            data=data,
        )

        started = time.time()
        with urllib.request.urlopen(req, timeout=45) as response:
            payload = json.loads(response.read().decode('utf-8'))
        latency_ms = int((time.time() - started) * 1000)

        items = payload.get('data') or []
        has_image = bool(items and isinstance(items, list) and items[0].get('b64_json'))
        return {
            'provider': 'openai',
            'model': model,
            'valid': has_image,
            'latency_ms': latency_ms,
            'detail': 'Image payload returned.' if has_image else 'No image payload in response.',
        }

    def _test_gemini_image_model(self, api_key: str, model: str, prompt: str) -> Dict[str, Any]:
        url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}'
        request_payload = {
            'contents': [{
                'parts': [{'text': prompt}],
            }],
            'generationConfig': {
                'responseModalities': ['TEXT', 'IMAGE'],
            },
        }

        req = urllib.request.Request(
            url,
            method='POST',
            headers={'Content-Type': 'application/json'},
            data=json.dumps(request_payload).encode('utf-8'),
        )

        started = time.time()
        with urllib.request.urlopen(req, timeout=45) as response:
            payload = json.loads(response.read().decode('utf-8'))
        latency_ms = int((time.time() - started) * 1000)

        has_image = False
        candidates = payload.get('candidates') or []
        for candidate in candidates:
            parts = ((candidate.get('content') or {}).get('parts') or [])
            for part in parts:
                inline_data = part.get('inlineData') or part.get('inline_data')
                if inline_data and inline_data.get('data'):
                    has_image = True
                    break
            if has_image:
                break

        return {
            'provider': 'gemini',
            'model': model,
            'valid': has_image,
            'latency_ms': latency_ms,
            'detail': 'Image payload returned.' if has_image else 'No inline image payload in response.',
        }

    def self_test_image_providers(self, prompt: str | None = None) -> Dict[str, Any]:
        test_prompt = (prompt or '').strip() or 'Generate a minimal test image for provider diagnostics.'

        openai_key = (os.getenv('OPENAI_API_KEY') or '').strip()
        openai_models = []
        configured_openai_model = (os.getenv('OPENAI_IMAGE_MODEL') or '').strip()
        if configured_openai_model:
            openai_models.append(configured_openai_model)
        if 'gpt-image-1' not in openai_models:
            openai_models.append('gpt-image-1')

        gemini_key = (os.getenv('GEMINI_API_KEY') or os.getenv('VITE_GEMINI_API_KEY') or '').strip()
        gemini_models: List[str] = []
        configured_gemini_model = (os.getenv('GEMINI_IMAGE_MODEL') or '').strip()
        if configured_gemini_model:
            gemini_models.append(configured_gemini_model)
        for candidate in [
            'gemini-2.5-flash-image-preview',
            'gemini-2.0-flash-preview-image-generation',
            'gemini-2.0-flash-exp-image-generation',
        ]:
            if candidate not in gemini_models:
                gemini_models.append(candidate)

        openai_results: List[Dict[str, Any]] = []
        if openai_key:
            for model in openai_models:
                try:
                    openai_results.append(self._test_openai_image_model(openai_key, model, test_prompt))
                except urllib.error.HTTPError as exc:
                    openai_results.append({
                        'provider': 'openai',
                        'model': model,
                        'valid': False,
                        'detail': self._http_error_message(exc),
                    })
                except urllib.error.URLError as exc:
                    openai_results.append({
                        'provider': 'openai',
                        'model': model,
                        'valid': False,
                        'detail': f'Network error: {str(exc.reason)[:240]}',
                    })
                except Exception as exc:
                    openai_results.append({
                        'provider': 'openai',
                        'model': model,
                        'valid': False,
                        'detail': f'{type(exc).__name__}: {str(exc)[:240]}',
                    })
        else:
            openai_results.append({
                'provider': 'openai',
                'model': configured_openai_model or 'gpt-image-1',
                'valid': False,
                'detail': 'OPENAI_API_KEY not configured.',
            })

        gemini_results: List[Dict[str, Any]] = []
        if gemini_key:
            for model in gemini_models:
                try:
                    gemini_results.append(self._test_gemini_image_model(gemini_key, model, test_prompt))
                except urllib.error.HTTPError as exc:
                    gemini_results.append({
                        'provider': 'gemini',
                        'model': model,
                        'valid': False,
                        'detail': self._http_error_message(exc),
                    })
                except urllib.error.URLError as exc:
                    gemini_results.append({
                        'provider': 'gemini',
                        'model': model,
                        'valid': False,
                        'detail': f'Network error: {str(exc.reason)[:240]}',
                    })
                except Exception as exc:
                    gemini_results.append({
                        'provider': 'gemini',
                        'model': model,
                        'valid': False,
                        'detail': f'{type(exc).__name__}: {str(exc)[:240]}',
                    })
        else:
            gemini_results.append({
                'provider': 'gemini',
                'model': configured_gemini_model or 'gemini-2.5-flash-image-preview',
                'valid': False,
                'detail': 'GEMINI_API_KEY/VITE_GEMINI_API_KEY not configured.',
            })

        valid_openai = [row for row in openai_results if row.get('valid')]
        valid_gemini = [row for row in gemini_results if row.get('valid')]

        return {
            'success': True,
            'message': 'Image provider self-test completed.',
            'test_prompt': test_prompt,
            'providers': {
                'openai': {
                    'key_configured': bool(openai_key),
                    'key_hint': self._mask_key(openai_key) if openai_key else None,
                    'models_tested': openai_models,
                    'results': openai_results,
                    'valid_model_count': len(valid_openai),
                    'best_valid_model': (valid_openai[0].get('model') if valid_openai else None),
                },
                'gemini': {
                    'key_configured': bool(gemini_key),
                    'key_hint': self._mask_key(gemini_key) if gemini_key else None,
                    'models_tested': gemini_models,
                    'results': gemini_results,
                    'valid_model_count': len(valid_gemini),
                    'best_valid_model': (valid_gemini[0].get('model') if valid_gemini else None),
                },
            },
        }

    def _openai_image_generation(self, prompt: str) -> Dict[str, Any] | None:
        api_key = (os.getenv('OPENAI_API_KEY') or '').strip()
        if not api_key:
            return None

        model = (os.getenv('OPENAI_IMAGE_MODEL') or 'gpt-image-1').strip()
        request_body = {
            'model': model,
            'prompt': prompt,
            'size': '1024x1024',
            'response_format': 'b64_json',
        }
        data = json.dumps(request_body).encode('utf-8')
        req = urllib.request.Request(
            'https://api.openai.com/v1/images/generations',
            method='POST',
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {api_key}',
            },
            data=data,
        )

        with urllib.request.urlopen(req, timeout=45) as response:
            payload = json.loads(response.read().decode('utf-8'))

        items = payload.get('data') or []
        if not items or not isinstance(items, list):
            return None
        b64_data = items[0].get('b64_json')
        if not b64_data:
            return None

        return {
            'image_data_url': f'data:image/png;base64,{b64_data}',
            'mime_type': 'image/png',
            'width': 1024,
            'height': 1024,
            'render_mode': 'openai_image_api',
            'provider': 'openai',
            'model': model,
        }

    def _gemini_image_generation(self, prompt: str) -> Dict[str, Any] | None:
        api_key = (os.getenv('GEMINI_API_KEY') or os.getenv('VITE_GEMINI_API_KEY') or '').strip()
        if not api_key:
            return None

        configured = (os.getenv('GEMINI_IMAGE_MODEL') or '').strip()
        model_candidates = [
            configured,
            'gemini-2.5-flash-image-preview',
            'gemini-2.0-flash-preview-image-generation',
            'gemini-2.0-flash-exp-image-generation',
        ]

        for model in [candidate for candidate in model_candidates if candidate]:
            url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}'
            request_payload = {
                'contents': [{
                    'parts': [{'text': prompt}],
                }],
                'generationConfig': {
                    'responseModalities': ['TEXT', 'IMAGE'],
                },
            }

            req = urllib.request.Request(
                url,
                method='POST',
                headers={'Content-Type': 'application/json'},
                data=json.dumps(request_payload).encode('utf-8'),
            )

            try:
                with urllib.request.urlopen(req, timeout=45) as response:
                    payload = json.loads(response.read().decode('utf-8'))
            except urllib.error.HTTPError as exc:
                if exc.code in (400, 404):
                    continue
                raise

            candidates = payload.get('candidates') or []
            for candidate in candidates:
                parts = ((candidate.get('content') or {}).get('parts') or [])
                for part in parts:
                    inline_data = part.get('inlineData') or part.get('inline_data')
                    if not inline_data:
                        continue
                    b64_data = inline_data.get('data')
                    mime_type = inline_data.get('mimeType') or inline_data.get('mime_type') or 'image/png'
                    if not b64_data:
                        continue
                    return {
                        'image_data_url': f'data:{mime_type};base64,{b64_data}',
                        'mime_type': mime_type,
                        'width': 1024,
                        'height': 1024,
                        'render_mode': 'gemini_generate_content',
                        'provider': 'gemini',
                        'model': model,
                    }
        return None

    def _image_generation_runner(self, payload: Dict[str, Any]) -> IntegrationResult:
        prompt = str(payload.get('prompt', '') or '').strip()
        refs = payload.get('reference_images', [])
        ref_count = len(refs) if isinstance(refs, list) else 0

        if not prompt:
            return IntegrationResult(
                success=False,
                integration_id='image_generation',
                message='Image prompt is required.',
                payload=payload,
                result={},
            )

        provider_errors: List[str] = []

        for provider_name, provider_func in (
            ('openai', self._openai_image_generation),
            ('gemini', self._gemini_image_generation),
        ):
            try:
                generated = provider_func(prompt)
                if generated:
                    return IntegrationResult(
                        success=True,
                        integration_id='image_generation',
                        message=f'Image generated successfully via {provider_name}.',
                        payload={
                            'prompt': prompt,
                            'reference_image_count': ref_count,
                            'provider_errors': provider_errors,
                        },
                        result={
                            **generated,
                            'prompt': prompt,
                        },
                    )
            except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
                provider_errors.append(f'{provider_name}: {str(exc)[:200]}')
            except Exception as exc:
                provider_errors.append(f'{provider_name}: {type(exc).__name__}: {str(exc)[:180]}')

        return self._render_svg_fallback(prompt, ref_count, provider_errors)

    def list_integrations(self) -> List[Dict[str, Any]]:
        return [asdict(entry) for entry in self._registry.values()]

    def run_integration(self, integration_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        runner = self._runners.get(integration_id)
        if runner is None:
            return {
                'success': False,
                'integration_id': integration_id,
                'message': f'Integration "{integration_id}" not found.',
                'payload': payload,
                'result': {},
            }

        result = runner(payload)
        return asdict(result)
