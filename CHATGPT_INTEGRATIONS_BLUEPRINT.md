# ChatGPT Integrations Blueprint

This document describes the new ChatGPT-style integration hub for the Atlantean / Quadra-Seer system.

## What is scaffolded

### Backend
- `atlantean_core/integration_hub.py`
  - Central registry for ChatGPT-like integrations.
  - Includes descriptors for:
    - `web_search`
    - `file_analysis`
    - `code_interpreter`
    - `image_generation`
    - `speech_to_text`
    - `text_to_speech`
    - `gmail`
    - `google_calendar`
    - `google_contacts`
    - `automations`
    - `persistent_memory`
    - `github_connector`
  - Each integration currently uses a stub runner placeholder.

### Backend API
- `GET /api/atlantean/integrations`
  - Returns the currently registered integration descriptors.
- `POST /api/atlantean/integrations/run`
  - Executes a named integration with a generic payload.
  - Returns a scaffolded stub result.

### Frontend
- `services/integrationService.ts`
  - Lists available integrations.
  - Calls backend `/integrations/run` to invoke a registered integration.

## What still needs production implementation

### Backend implementation
- Replace `_stub_runner` placeholders with real integration runners.
- Implement actual integration adapters for:
  - Web search / browsing (e.g. Google Search, Bing, or browser API)
  - File analysis (extract, summarize, and classify attachments)
  - Code interpreter sandbox (safe execution environment with resource limits)
  - Image generation (OpenAI image API, Stable Diffusion, etc.)
  - Speech-to-text (cloud STT service or local model)
  - Text-to-speech (cloud TTS or local model)
  - Gmail connector (OAuth2 + Gmail API)
  - Google Calendar (OAuth2 + Calendar API)
  - Google Contacts (OAuth2 + People API)
  - Automations/reminders (task scheduler and persisted reminders)
  - Persistent memory store (secure key-value user memory)
  - GitHub connector (GitHub OAuth + repo access)
- Add authentication and OAuth token storage for sensitive connectors.
- Ensure integrations are enabled/disabled consistently across environments.

### Frontend implementation
- Create UI components for:
  - Integration browser / hub
  - Integration detail + invocation panels
  - Results and execution logs
- Add error handling and loading states for integration execution.
- Persist integration preferences and enablement options.
- Surface integration capability metadata in the chat UI.

### Security and production readiness
- Add OAuth token management for Google/Gmail/GitHub.
- Harden sandbox execution for code interpreter.
- Validate all payloads before executing integrations.
- Add audit logging for integration runs.
- Add rate limiting and authorization checks.

## Correct implementation order

1. Wire backend integration registry and API endpoints.
2. Build frontend listing and invocation helpers.
3. Add UI for integration discovery and execution.
4. Implement one integration at a time with proper auth.
5. Add end-to-end tests for each integration flow.
6. Harden sandboxing, token storage, and rate limiting.

## Notes
- The current implementation is a scaffold. The integration hub exists, but all integrations are placeholders.
- This blueprint is intentionally backend-first: the backend should declare capabilities before the frontend binds UI to them.
- Once real integrations are added, the registry can be extended dynamically rather than hardcoded.
