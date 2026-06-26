from __future__ import annotations

from dataclasses import asdict, dataclass, field
from enum import Enum
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


class IntegrationHub:
    def __init__(self):
        self._registry: Dict[str, IntegrationDescriptor] = {}
        self._runners: Dict[str, Callable[[Dict[str, Any]], IntegrationResult]] = {}
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
            self._stub_runner,
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
            self._stub_runner,
        )

        self._register(
            IntegrationDescriptor(
                integration_id='image_generation',
                name='Image Generation',
                capability=IntegrationCapability.IMAGE_GENERATION,
                description='Generate images from text prompts.',
                category='visual',
            ),
            self._stub_runner,
        )

        self._register(
            IntegrationDescriptor(
                integration_id='speech_to_text',
                name='Speech to Text',
                capability=IntegrationCapability.SPEECH_TO_TEXT,
                description='Transcribe audio into text.',
                category='speech',
            ),
            self._stub_runner,
        )

        self._register(
            IntegrationDescriptor(
                integration_id='text_to_speech',
                name='Text to Speech',
                capability=IntegrationCapability.TEXT_TO_SPEECH,
                description='Synthesize spoken audio from text.',
                category='speech',
            ),
            self._stub_runner,
        )

        self._register(
            IntegrationDescriptor(
                integration_id='gmail',
                name='Gmail Connector',
                capability=IntegrationCapability.GMAIL,
                description='Send and read Gmail messages via authenticated Google APIs.',
                category='productivity',
            ),
            self._stub_runner,
        )

        self._register(
            IntegrationDescriptor(
                integration_id='google_calendar',
                name='Google Calendar',
                capability=IntegrationCapability.GOOGLE_CALENDAR,
                description='Create and manage calendar events.',
                category='productivity',
            ),
            self._stub_runner,
        )

        self._register(
            IntegrationDescriptor(
                integration_id='google_contacts',
                name='Google Contacts',
                capability=IntegrationCapability.GOOGLE_CONTACTS,
                description='Lookup and manage Google Contacts information.',
                category='productivity',
            ),
            self._stub_runner,
        )

        self._register(
            IntegrationDescriptor(
                integration_id='automations',
                name='Automations & Reminders',
                capability=IntegrationCapability.AUTOMATIONS,
                description='Schedule reminders, notifications, and automation workflows.',
                category='workflow',
            ),
            self._stub_runner,
        )

        self._register(
            IntegrationDescriptor(
                integration_id='persistent_memory',
                name='Persistent Memory',
                capability=IntegrationCapability.PERSISTENT_MEMORY,
                description='Store and recall persistent user memory across sessions.',
                category='memory',
            ),
            self._stub_runner,
        )

        self._register(
            IntegrationDescriptor(
                integration_id='github_connector',
                name='GitHub Connector',
                capability=IntegrationCapability.GITHUB,
                description='Inspect repositories, issues and pull requests from GitHub.',
                category='developer',
            ),
            self._stub_runner,
        )

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
