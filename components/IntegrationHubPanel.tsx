import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { listIntegrations, runIntegration, type IntegrationDescriptor, type IntegrationRunResponse } from '../services/integrationService';
import { FileData } from '../types';
import Icon from './Icon';

const fallbackIntegrations: IntegrationDescriptor[] = [
  {
    integration_id: 'file_analysis',
    name: 'File Analysis',
    capability: 'file_analysis',
    description: 'Analyze attached files and return summaries, extracted insights, or structured data.',
    enabled: true,
    category: 'analysis',
    metadata: {},
  },
  {
    integration_id: 'image_generation',
    name: 'Image Generation',
    capability: 'image_generation',
    description: 'Generate images from text prompts.',
    enabled: true,
    category: 'visual',
    metadata: {},
  },
  {
    integration_id: 'code_interpreter',
    name: 'Code Interpreter',
    capability: 'code_interpreter',
    description: 'Execute code snippets in a sandboxed environment and return results.',
    enabled: true,
    category: 'execution',
    metadata: {},
  },
];

type IntegrationWindow = {
  key: string;
  integrationId: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  maximized: boolean;
  zIndex: number;
};

type DragState = {
  key: string;
  offsetX: number;
  offsetY: number;
};

const WINDOW_DEFAULTS: Record<string, { title: string; width: number; height: number }> = {
  file_analysis: { title: 'File Analysis', width: 440, height: 420 },
  image_generation: { title: 'Image Studio', width: 420, height: 380 },
  code_interpreter: { title: 'Code Interpreter', width: 460, height: 420 },
};

const MIN_WINDOW_WIDTH = 360;
const MIN_WINDOW_HEIGHT = 220;
const MAX_VISIBLE_WINDOWS = 8;

export default function IntegrationHubPanel() {
  const [integrations, setIntegrations] = useState<IntegrationDescriptor[]>(fallbackIntegrations);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [resultByWindow, setResultByWindow] = useState<Record<string, IntegrationRunResponse | null>>({});
  const [runningId, setRunningId] = useState<string | null>(null);

  const [selectedFiles, setSelectedFiles] = useState<FileData[]>([]);
  const [imageFiles, setImageFiles] = useState<FileData[]>([]);
  const [analysisPrompt, setAnalysisPrompt] = useState('Summarize the attached documents and highlight key insights.');
  const [imagePrompt, setImagePrompt] = useState('Generate a cinematic telemetry visualization of an autonomous intelligence core.');
  const [codePrompt, setCodePrompt] = useState('Run this snippet and return stdout, stderr, and execution notes.');
  const [codeInput, setCodeInput] = useState('print("Hello from Code Interpreter")');

  const [isParsingFiles, setIsParsingFiles] = useState(false);
  const [windows, setWindows] = useState<IntegrationWindow[]>([]);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [viewport, setViewport] = useState({ width: 1280, height: 720 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const integrationMap = useMemo(
    () => new Map(integrations.map((integration) => [integration.integration_id, integration])),
    [integrations]
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await listIntegrations();
        if (!cancelled) {
          setIntegrations(data);
          setLoadError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load integrations');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const syncViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };

    syncViewport();
    window.addEventListener('resize', syncViewport, { passive: true });
    return () => {
      window.removeEventListener('resize', syncViewport);
    };
  }, []);

  useEffect(() => {
    if (windows.length > 0) {
      return;
    }

    setWindows([
      {
        key: 'file_analysis-main',
        integrationId: 'file_analysis',
        title: 'File Analysis',
        x: 18,
        y: 16,
        width: WINDOW_DEFAULTS.file_analysis.width,
        height: WINDOW_DEFAULTS.file_analysis.height,
        minimized: false,
        maximized: false,
        zIndex: 2,
      },
      {
        key: 'image_generation-main',
        integrationId: 'image_generation',
        title: 'Image Studio',
        x: 220,
        y: 54,
        width: WINDOW_DEFAULTS.image_generation.width,
        height: WINDOW_DEFAULTS.image_generation.height,
        minimized: false,
        maximized: false,
        zIndex: 3,
      },
      {
        key: 'code_interpreter-main',
        integrationId: 'code_interpreter',
        title: 'Code Interpreter',
        x: 80,
        y: 172,
        width: WINDOW_DEFAULTS.code_interpreter.width,
        height: WINDOW_DEFAULTS.code_interpreter.height,
        minimized: false,
        maximized: false,
        zIndex: 4,
      },
    ]);
  }, [windows.length]);

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      if (!dragState) return;

      setWindows((prev) =>
        prev.map((windowState) => {
          if (windowState.key !== dragState.key || windowState.maximized) {
            return windowState;
          }

          const nextX = Math.max(0, Math.min(event.clientX - dragState.offsetX, Math.max(0, viewport.width - 120)));
          const nextY = Math.max(0, Math.min(event.clientY - dragState.offsetY, Math.max(0, viewport.height - 44)));
          return { ...windowState, x: nextX, y: nextY };
        })
      );
    };

    const handleUp = () => {
      if (dragState) {
        setDragState(null);
      }
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragState, viewport.height, viewport.width]);

  const bringToFront = (key: string) => {
    setWindows((prev) => {
      const top = prev.reduce((max, current) => Math.max(max, current.zIndex), 0) + 1;
      return prev.map((windowState) => (windowState.key === key ? { ...windowState, zIndex: top } : windowState));
    });
  };

  const openWindow = (integrationId: string) => {
    setWindows((prev) => {
      const existing = prev.find((windowState) => windowState.integrationId === integrationId);
      const nextZ = prev.reduce((max, current) => Math.max(max, current.zIndex), 0) + 1;

      if (existing) {
        return prev.map((windowState) =>
          windowState.key === existing.key
            ? { ...windowState, minimized: false, zIndex: nextZ }
            : windowState
        );
      }

      if (prev.length >= MAX_VISIBLE_WINDOWS) {
        return prev;
      }

      const defaults = WINDOW_DEFAULTS[integrationId] || { title: integrationId, width: 420, height: 360 };
      const offset = prev.length * 28;
      const key = `${integrationId}-${Date.now()}`;

      return [
        ...prev,
        {
          key,
          integrationId,
          title: defaults.title,
          x: 24 + offset,
          y: 22 + offset,
          width: defaults.width,
          height: defaults.height,
          minimized: false,
          maximized: false,
          zIndex: nextZ,
        },
      ];
    });
  };

  const closeWindow = (key: string) => {
    setWindows((prev) => prev.filter((windowState) => windowState.key !== key));
  };

  const toggleMinimizeWindow = (key: string) => {
    setWindows((prev) =>
      prev.map((windowState) =>
        windowState.key === key
          ? { ...windowState, minimized: !windowState.minimized, zIndex: windowState.minimized ? prev.reduce((max, current) => Math.max(max, current.zIndex), 0) + 1 : windowState.zIndex }
          : windowState
      )
    );
  };

  const toggleMaximizeWindow = (key: string) => {
    setWindows((prev) =>
      prev.map((windowState) => (windowState.key === key ? { ...windowState, maximized: !windowState.maximized, minimized: false } : windowState))
    );
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const openImagePicker = () => {
    imageInputRef.current?.click();
  };

  const handleFilesSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;

    setIsParsingFiles(true);
    const newFiles: FileData[] = [];

    try {
      const { parseFile } = await import('../utils/fileParser');

      for (let i = 0; i < files.length; i += 1) {
        try {
          const parsed = await parseFile(files[i]);
          newFiles.push(parsed);
        } catch (err) {
          console.error('File parse failed', err);
        }
      }

      setSelectedFiles((prev) => [...prev, ...newFiles]);
      setActionError(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to parse files');
    } finally {
      setIsParsingFiles(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleImageSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;

    setIsParsingFiles(true);
    const parsedImages: FileData[] = [];

    try {
      const { parseFile } = await import('../utils/fileParser');
      for (let i = 0; i < files.length; i += 1) {
        try {
          const parsed = await parseFile(files[i]);
          parsedImages.push(parsed);
        } catch (err) {
          console.error('Image parse failed', err);
        }
      }

      setImageFiles((prev) => [...prev, ...parsedImages]);
      setActionError(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to parse image files');
    } finally {
      setIsParsingFiles(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const removeImageFile = (index: number) => {
    setImageFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const runWindowIntegration = async (
    windowKey: string,
    integrationId: string,
    payload: Record<string, any>
  ) => {
    setRunningId(integrationId);
    setActionError(null);
    setResultByWindow((prev) => ({ ...prev, [windowKey]: null }));
    try {
      const response = await runIntegration(integrationId, payload);
      setResultByWindow((prev) => ({ ...prev, [windowKey]: response }));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Integration execution failed');
    } finally {
      setRunningId(null);
    }
  };

  const handleRunAnalysis = async (windowKey: string) => {
    if (selectedFiles.length === 0) {
      setActionError('Attach at least one file to run file analysis.');
      return;
    }

    await runWindowIntegration(windowKey, 'file_analysis', {
      prompt: analysisPrompt,
      files: selectedFiles.map((file) => ({
        name: file.name,
        type: file.type,
        content: file.content,
        extractedText: file.extractedText || '',
      })),
    });
  };

  const renderFileAnalysisCard = (windowKey: string) => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon name="document" className="w-4 h-4 text-[var(--color-primary)]" />
        <div>
          <div className="text-sm font-semibold text-white">File Analysis</div>
          <div className="text-[10px] text-gray-400">Upload documents and run focused analysis prompts.</div>
        </div>
      </div>

      <div className="space-y-3">
        <textarea
          id="analysis-prompt"
          name="analysis-prompt"
          value={analysisPrompt}
          onChange={(event) => setAnalysisPrompt(event.target.value)}
          rows={3}
          className="w-full rounded-2xl border border-white/10 bg-black/70 p-3 text-xs text-gray-100 placeholder:text-gray-500 focus:border-[var(--color-primary)] focus:outline-none"
          placeholder="What should the file analysis integration do?"
        />

        <div className="space-y-2">
          <button
            type="button"
            onClick={openFilePicker}
            disabled={isParsingFiles}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.25em] text-black disabled:opacity-50"
          >
            {isParsingFiles ? 'Parsing files…' : 'Attach files'}
          </button>
          <input
            ref={fileInputRef}
            id="analysis-files"
            type="file"
            name="analysis-files"
            multiple
            hidden
            onChange={handleFilesSelected}
          />
        </div>

        {selectedFiles.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-3 text-xs text-gray-200">
            <div className="font-semibold text-white">Selected files</div>
            <ul className="mt-2 space-y-2">
              {selectedFiles.map((file, idx) => (
                <li key={`${file.name}-${idx}`} className="flex items-center justify-between gap-2 rounded-2xl bg-white/5 p-2">
                  <div className="min-w-0">
                    <div className="truncate text-[11px] text-white">{file.name}</div>
                    <div className="text-[10px] text-gray-400">
                      {file.type || 'unknown type'} · {file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'size unknown'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="text-[10px] font-semibold uppercase tracking-[0.3em] text-rose-400"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            void handleRunAnalysis(windowKey);
          }}
          disabled={runningId === 'file_analysis' || isParsingFiles}
          className="w-full rounded-full bg-[var(--color-primary)] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.25em] text-black disabled:opacity-50"
        >
          {runningId === 'file_analysis' ? 'Analyzing…' : 'Run file analysis'}
        </button>
      </div>

      {resultByWindow[windowKey] && (
        <div className="rounded-xl border border-white/10 bg-black/40 p-3 text-[10px] text-gray-200">
          <div className="font-semibold text-white">{resultByWindow[windowKey]?.message}</div>
          <pre className="mt-2 max-h-28 overflow-auto rounded-md bg-black/50 p-2 text-[10px] text-gray-300">
            {JSON.stringify(resultByWindow[windowKey]?.result || resultByWindow[windowKey]?.payload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );

  const renderImageCard = (windowKey: string) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon name="sparkles" className="w-4 h-4 text-[var(--color-primary)]" />
        <div>
          <div className="text-sm font-semibold text-white">Image Prompt</div>
          <div className="text-[10px] text-gray-400">Describe the visual output before running the integration.</div>
        </div>
      </div>

      <textarea
        id="image-prompt"
        name="image-prompt"
        value={imagePrompt}
        onChange={(event) => setImagePrompt(event.target.value)}
        rows={4}
        className="w-full rounded-2xl border border-white/10 bg-black/70 p-3 text-xs text-gray-100 placeholder:text-gray-500 focus:border-[var(--color-primary)] focus:outline-none"
        placeholder="Describe style, subject, lighting, and composition..."
      />

      <div className="space-y-2">
        <button
          type="button"
          onClick={openImagePicker}
          disabled={isParsingFiles}
          className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.24em] text-white disabled:opacity-50"
        >
          {isParsingFiles ? 'Parsing…' : 'Attach image refs'}
        </button>
        <input
          ref={imageInputRef}
          id="image-refs"
          name="image-refs"
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={handleImageSelected}
        />
        {imageFiles.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-black/40 p-2 text-[10px] text-gray-300 space-y-1">
            {imageFiles.map((file, idx) => (
              <div key={`${file.name}-${idx}`} className="flex items-center justify-between gap-2">
                <span className="truncate">{file.name}</span>
                <button type="button" onClick={() => removeImageFile(idx)} className="text-rose-400">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          void runWindowIntegration(windowKey, 'image_generation', {
            prompt: imagePrompt,
            reference_images: imageFiles.map((file) => ({
              name: file.name,
              type: file.type,
              content: file.content,
            })),
          });
        }}
        disabled={runningId === 'image_generation'}
        className="w-full rounded-full bg-[var(--color-primary)] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.25em] text-black disabled:opacity-50"
      >
        {runningId === 'image_generation' ? 'Running…' : 'Run image generation'}
      </button>

      {resultByWindow[windowKey] && (
        <div className="rounded-xl border border-white/10 bg-black/40 p-3 text-[10px] text-gray-200">
          <div className="font-semibold text-white">{resultByWindow[windowKey]?.message}</div>
          {(resultByWindow[windowKey]?.result?.image_data_url || resultByWindow[windowKey]?.payload?.image_data_url) && (
            <div className="mt-2 overflow-hidden rounded-lg border border-white/10 bg-black/30 p-2">
              <img
                src={(resultByWindow[windowKey]?.result?.image_data_url || resultByWindow[windowKey]?.payload?.image_data_url) as string}
                alt="Generated integration result"
                className="max-h-56 w-full rounded-md object-contain"
              />
            </div>
          )}
          <pre className="mt-2 max-h-28 overflow-auto rounded-md bg-black/50 p-2 text-[10px] text-gray-300">
            {JSON.stringify(resultByWindow[windowKey]?.result || resultByWindow[windowKey]?.payload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );

  const renderCodeCard = (windowKey: string) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon name="code" className="w-4 h-4 text-[var(--color-primary)]" />
        <div>
          <div className="text-sm font-semibold text-white">Code Input</div>
          <div className="text-[10px] text-gray-400">Paste code and provide runtime instructions.</div>
        </div>
      </div>

      <textarea
        id="code-instructions"
        name="code-instructions"
        value={codePrompt}
        onChange={(event) => setCodePrompt(event.target.value)}
        rows={2}
        className="w-full rounded-2xl border border-white/10 bg-black/70 p-3 text-xs text-gray-100 placeholder:text-gray-500 focus:border-[var(--color-primary)] focus:outline-none"
        placeholder="How should this code be executed?"
      />

      <textarea
        id="code-input"
        name="code-input"
        value={codeInput}
        onChange={(event) => setCodeInput(event.target.value)}
        rows={8}
        className="w-full rounded-2xl border border-white/10 bg-black/70 p-3 font-mono text-xs text-gray-100 placeholder:text-gray-500 focus:border-[var(--color-primary)] focus:outline-none"
        placeholder="print('hello world')"
      />

      <button
        type="button"
        onClick={() => {
          void runWindowIntegration(windowKey, 'code_interpreter', {
            prompt: codePrompt,
            code: codeInput,
            language: 'python',
          });
        }}
        disabled={runningId === 'code_interpreter' || codeInput.trim() === ''}
        className="w-full rounded-full bg-[var(--color-primary)] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.25em] text-black disabled:opacity-50"
      >
        {runningId === 'code_interpreter' ? 'Running…' : 'Run code interpreter'}
      </button>

      {resultByWindow[windowKey] && (
        <div className="rounded-xl border border-white/10 bg-black/40 p-3 text-[10px] text-gray-200">
          <div className="font-semibold text-white">{resultByWindow[windowKey]?.message}</div>
          {(resultByWindow[windowKey]?.result?.stdout || resultByWindow[windowKey]?.result?.stderr) && (
            <div className="mt-2 space-y-2">
              <div>
                <div className="mb-1 text-[9px] uppercase tracking-[0.14em] text-gray-400">Stdout</div>
                <pre className="max-h-24 overflow-auto rounded-md bg-black/60 p-2 text-[10px] text-green-300">
                  {(resultByWindow[windowKey]?.result?.stdout as string) || '[no output]'}
                </pre>
              </div>
              <div>
                <div className="mb-1 text-[9px] uppercase tracking-[0.14em] text-gray-400">Stderr</div>
                <pre className="max-h-24 overflow-auto rounded-md bg-black/60 p-2 text-[10px] text-rose-300">
                  {(resultByWindow[windowKey]?.result?.stderr as string) || '[no errors]'}
                </pre>
              </div>
            </div>
          )}
          <pre className="mt-2 max-h-28 overflow-auto rounded-md bg-black/50 p-2 text-[10px] text-gray-300">
            {JSON.stringify(resultByWindow[windowKey]?.result || resultByWindow[windowKey]?.payload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );

  const renderGenericCard = (windowKey: string, integrationId: string, integrationName: string) => (
    <div className="space-y-3">
      <div className="text-xs text-gray-300">{integrationName}</div>
      <button
        type="button"
        onClick={() => {
          void runWindowIntegration(windowKey, integrationId, { prompt: `Invoke ${integrationName}` });
        }}
        disabled={runningId === integrationId}
        className="w-full rounded-full bg-[var(--color-primary)] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.25em] text-black disabled:opacity-50"
      >
        {runningId === integrationId ? 'Running…' : 'Run integration'}
      </button>
      {resultByWindow[windowKey] && (
        <pre className="max-h-28 overflow-auto rounded-md bg-black/50 p-2 text-[10px] text-gray-300">
          {JSON.stringify(resultByWindow[windowKey], null, 2)}
        </pre>
      )}
    </div>
  );

  return (
    <section className="h-full min-h-0 rounded-3xl border border-white/10 bg-black/50 p-4 text-sm text-gray-200 overflow-hidden">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="puzzle" className="w-4 h-4 text-[var(--color-primary)]" />
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-gray-400">Integration Hub</div>
          <div className="text-xs text-gray-500">Draggable integration windows with dedicated prompts and execution inputs.</div>
        </div>
      </div>

      {loading && <div className="text-xs text-gray-400 mb-2">Loading integrations...</div>}
      {loadError && (
        <div className="text-xs text-rose-400 mb-2">
          Unable to fetch integrations from the backend. Using local fallback integration data. {loadError}
        </div>
      )}
      {actionError && (
        <div className="text-xs text-rose-400 mb-2">
          {actionError}
        </div>
      )}

      <div className="mb-3 rounded-2xl border border-white/10 bg-black/30 p-3">
        <div className="text-[10px] uppercase tracking-[0.25em] text-gray-400">Launch Integrations</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {integrations.slice(0, 8).map((integration) => (
            <button
              key={integration.integration_id}
              type="button"
              onClick={() => openWindow(integration.integration_id)}
              disabled={!integration.enabled}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-200 hover:bg-white/10 disabled:opacity-40"
            >
              {integration.name}
            </button>
          ))}
        </div>
      </div>

      <div className="relative h-[540px] rounded-2xl border border-white/10 bg-black/40 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-xs text-gray-500">
          Integration windows now open across the full screen and can be moved anywhere in the viewport.
        </div>
      </div>

      {typeof document !== 'undefined' &&
        createPortal(
          <div className="pointer-events-none fixed inset-0 z-[60]">
            {windows.map((windowState) => {
              const integration = integrationMap.get(windowState.integrationId);
              const width = windowState.maximized
                ? `${Math.max(360, viewport.width - 24)}px`
                : `${Math.max(windowState.width, MIN_WINDOW_WIDTH)}px`;
              const height = windowState.maximized
                ? `${Math.max(240, viewport.height - 24)}px`
                : `${Math.max(windowState.minimized ? 52 : windowState.height, windowState.minimized ? 52 : MIN_WINDOW_HEIGHT)}px`;

              return (
                <div
                  key={windowState.key}
                  className="pointer-events-auto absolute rounded-2xl border border-white/15 bg-black/80 shadow-2xl backdrop-blur-sm"
                  style={{
                    left: windowState.maximized ? 12 : windowState.x,
                    top: windowState.maximized ? 12 : windowState.y,
                    width,
                    height,
                    zIndex: windowState.zIndex,
                  }}
                  onMouseDown={() => bringToFront(windowState.key)}
                >
                  <div
                    className="flex cursor-move items-center justify-between rounded-t-2xl border-b border-white/10 bg-white/5 px-3 py-2"
                    onMouseDown={(event) => {
                      if (windowState.maximized) {
                        bringToFront(windowState.key);
                        return;
                      }
                      const rect = event.currentTarget.parentElement?.getBoundingClientRect();
                      if (!rect) return;
                      bringToFront(windowState.key);
                      setDragState({
                        key: windowState.key,
                        offsetX: event.clientX - rect.left,
                        offsetY: event.clientY - rect.top,
                      });
                    }}
                  >
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white">{windowState.title}</div>
                      <div className="text-[9px] uppercase tracking-[0.14em] text-gray-500">{integration?.description || windowState.integrationId}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded bg-white/10 px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-gray-200"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleMinimizeWindow(windowState.key);
                        }}
                      >
                        {windowState.minimized ? 'Open' : 'Min'}
                      </button>
                      <button
                        type="button"
                        className="rounded bg-white/10 px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-gray-200"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleMaximizeWindow(windowState.key);
                        }}
                      >
                        {windowState.maximized ? 'Restore' : 'Expand'}
                      </button>
                      <button
                        type="button"
                        className="rounded bg-rose-500/20 px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-rose-300"
                        onClick={(event) => {
                          event.stopPropagation();
                          closeWindow(windowState.key);
                        }}
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  {!windowState.minimized && (
                    <div className="h-[calc(100%-52px)] overflow-auto p-3">
                      {windowState.integrationId === 'file_analysis' && renderFileAnalysisCard(windowState.key)}
                      {windowState.integrationId === 'image_generation' && renderImageCard(windowState.key)}
                      {windowState.integrationId === 'code_interpreter' && renderCodeCard(windowState.key)}
                      {windowState.integrationId !== 'file_analysis' &&
                        windowState.integrationId !== 'image_generation' &&
                        windowState.integrationId !== 'code_interpreter' &&
                        renderGenericCard(windowState.key, windowState.integrationId, integration?.name || windowState.title)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </section>
  );
}
