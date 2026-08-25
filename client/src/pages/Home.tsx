import { trpc } from "@/lib/trpc";
import { 
  ArrowUpRight, Braces, Check, Copy, Download, FileCode2, 
  FolderCode, KeyRound, LayoutTemplate, Loader2, Monitor, 
  MoreHorizontal, Play, Plus, RefreshCw, Send, Settings, 
  Smartphone, Sparkles, SquarePen, TerminalSquare, X, Zap 
} from "lucide-react";
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import { useIsMobile, useIsTablet } from "@/hooks/useResponsive";

type FileItem = { path: string; language: string; content: string };
type Artifact = FileItem;
type StoredMessage = { id: string; role: "user" | "assistant"; content: string };
type Conversation = { id: string; title: string; messages: StoredMessage[]; updatedAt: number };
type Tab = "workspace" | "settings";

const starterFiles: FileItem[] = [
  { path: "index.html", language: "html", content: `<main class="landing">
  <p class="eyebrow">Designed with intention</p>
  <h1>Build the next structured idea.</h1>
  <p>A small starting point, ready for your next prompt.</p>
  <button id="action">Explore</button>
</main>` },
  { path: "styles.css", language: "css", content: `:root { color-scheme: light; }
* { box-sizing: border-box; }
body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; background: #eef9fa; color: #133349; }
.landing { min-height: 100vh; display: grid; place-content: center; gap: 1rem; padding: 2rem; background: radial-gradient(circle at 70% 22%, #65d8d055, transparent 24rem), #f7fbff; }
.eyebrow { color: #078c92; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
h1 { max-width: 10ch; margin: 0; font-size: clamp(3rem, 9vw, 6rem); line-height: .9; }
button { width: fit-content; border: 0; border-radius: 999px; padding: .8rem 1.2rem; background: #1177ab; color: white; font-weight: 700; }` },
  { path: "app.js", language: "javascript", content: `document.querySelector("#action")?.addEventListener("click", () => {
  document.querySelector("#action").textContent = "Nice work";
});` },
];

const defaultConfig = { model: "gpt-4o-mini", baseUrl: "https://api.openai.com/v1", systemPrompt: "You are a precise senior software engineer. Explain decisions clearly and provide complete, runnable code when asked.", temperature: 0.7, maxTokens: 4096 };
const store = { conversations: "ai-chat-studio-conversations", files: "ai-chat-studio-files", preferences: "ai-chat-studio-preferences" };

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(window.localStorage.getItem(key) || "") as T; } catch { return fallback; }
}

function persistLocal<T>(key: string, value: T) { window.localStorage.setItem(key, JSON.stringify(value)); }
function escapeHtml(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function highlight(code: string, language: string) {
  const escaped = escapeHtml(code);
  const keywordPattern = language === "html" ? /(&lt;\/?)([\w-]+)/g : /\b(const|let|function|return|import|from|export|class|new|if|else|for|while|async|await|true|false|null|var|display|color|background|padding|margin)\b/g;
  return language === "html" ? escaped.replace(keywordPattern, '$1<span class="text-cyan-300">$2</span>') : escaped.replace(/(".*?"|'.*?'|`.*?`)/g, '<span class="text-amber-300">$1</span>').replace(keywordPattern, '<span class="text-sky-300">$1</span>');
}
function previewDocument(files: FileItem[]) {
  const html = files.find(file => file.path.endsWith(".html"))?.content || "<main><h1>Start building</h1></main>";
  const css = files.find(file => file.path.endsWith(".css"))?.content || "";
  const js = files.find(file => /\.(js|jsx|ts|tsx)$/.test(file.path))?.content || "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body>${html}<script>${js.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
}
function downloadFile(file: FileItem) { 
  const link = document.createElement("a"); 
  link.href = URL.createObjectURL(new Blob([file.content], { type: "text/plain;charset=utf-8" })); 
  link.download = file.path; 
  link.click(); 
  URL.revokeObjectURL(link.href); 
}

// Responsive layout components
function MobileLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col h-full">{children}</div>;
}

function TabletLayout({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-3 h-full">{children}</div>;
}

function DesktopLayout({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 xl:grid-cols-[260px_minmax(340px,0.92fr)_minmax(420px,1.15fr)_minmax(330px,0.9fr)] gap-3 h-full">{children}</div>;
}

// Responsive PreviewPane
function ResponsivePreviewPane({ srcDoc, mode, setMode, onRefresh }: { 
  srcDoc: string; 
  mode: "desktop" | "mobile"; 
  setMode: (mode: "desktop" | "mobile") => void; 
  onRefresh: () => void 
}) {
  const isMobile = useIsMobile();
  
  // On mobile, default to mobile preview and hide toggle
  const showToggle = !isMobile;
  
  return (
    <section className="glass flex min-h-[400px] md:min-h-[560px] flex-col overflow-hidden rounded-2xl border border-white/85 xl:min-h-0">
      <div className="flex items-center justify-between border-b border-slate-200/75 px-3 py-2 md:px-4 md:py-3">
        <div>
          <p className="text-sm font-bold text-slate-900">Live preview</p>
          <p className="text-[10px] font-bold uppercase tracking-[.15em] text-cyan-700 hidden md:block">
            Sandboxed HTML &middot; CSS &middot; JS
          </p>
        </div>
        {showToggle && (
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            <button onClick={() => setMode("desktop")} className={`grid size-7 place-items-center rounded-md ${mode === "desktop" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400"}`} aria-label="Desktop preview">
              <Monitor className="size-3.5" />
            </button>
            <button onClick={() => setMode("mobile")} className={`grid size-7 place-items-center rounded-md ${mode === "mobile" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400"}`} aria-label="Mobile preview">
              <Smartphone className="size-3.5" />
            </button>
          </div>
        )}
      </div>
      <div className="flex flex-1 items-center justify-center overflow-auto bg-[linear-gradient(45deg,#deedf0_25%,transparent_25%),linear-gradient(-45deg,#deedf0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#deedf0_75%),linear-gradient(-45deg,transparent_75%,#deedf0_75%)] bg-[size:18px_18px] bg-[position:0_0,0_9px,9px_-9px,-9px_0px] p-3 md:p-5">
        <div className={`overflow-hidden rounded-[1.4rem] border-[7px] border-slate-950 bg-white shadow-2xl shadow-slate-900/25 transition-all duration-300 ${
          mode === "mobile" ? "h-[400px] w-[240px] md:h-[520px] md:w-[280px]" : 
          isMobile ? "h-[400px] w-full max-w-[320px]" : 
          "h-[420px] w-full max-w-[680px] rounded-xl border-[5px]"
        }`}>
          <iframe 
            title="Sandboxed project preview" 
            sandbox="allow-scripts" 
            srcDoc={srcDoc} 
            className="h-full w-full border-0 bg-white" 
          />
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-slate-200/75 bg-white/80 px-2 py-2 md:px-3 md:py-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-emerald-700">
          <span className="size-1.5 rounded-full bg-emerald-500" /> Isolated preview
        </span>
        <button onClick={onRefresh} className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-cyan-800">
          <RefreshCw className="size-3.5" /> Refresh
        </button>
      </div>
    </section>
  );
}

// Responsive CodePane
function ResponsiveCodePane({ files, activeFile, activePath, artifacts, onSelect, onUpdate, onSave, onCopy, onDownload, onAddArtifact }: { 
  files: FileItem[]; 
  activeFile: FileItem; 
  activePath: string; 
  artifacts: Artifact[]; 
  onSelect: (path: string) => void; 
  onUpdate: (content: string) => void; 
  onSave: () => void; 
  onCopy: () => void; 
  onDownload: () => void; 
  onAddArtifact: (artifact: Artifact) => void 
}) {
  const isMobile = useIsMobile();
  
  return (
    <section className="glass flex min-h-[400px] md:min-h-[560px] flex-col overflow-hidden rounded-2xl border border-white/85 xl:min-h-0">
      <div className="flex items-center justify-between border-b border-slate-200/75 px-3 py-2 md:px-4 md:py-3">
        <div className="flex items-center gap-2">
          <FolderCode className="size-4 text-cyan-700" />
          <p className="text-sm font-bold text-slate-900">Project files</p>
        </div>
        <button onClick={onSave} className="inline-flex items-center gap-1 rounded-lg bg-slate-950 px-2 py-1 text-xs font-bold text-white md:px-2.5 md:py-1.5">
          <Check className="size-3.5" /> Save
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200/75 bg-slate-50/70 px-2 pt-2">
          {files.map(file => (
            <button 
              key={file.path} 
              onClick={() => onSelect(file.path)} 
              className={`flex shrink-0 items-center gap-1.5 rounded-t-lg px-2 py-1.5 text-xs font-bold transition ${
                activePath === file.path ? "bg-slate-950 text-white" : "text-slate-500 hover:bg-white"
              }`}
            >
              <FileCode2 className="size-3.5" />
              {isMobile ? file.path.split('/').pop() : file.path}
            </button>
          ))}
        </div>
        <div className="relative min-h-0 flex-1 bg-[#102531] p-3 md:p-4">
          <div className="absolute inset-0 overflow-auto p-3 md:p-4">
            <pre 
              aria-hidden="true" 
              className="mono pointer-events-none m-0 min-h-full whitespace-pre-wrap break-words text-[12px] leading-6 text-slate-200" 
              dangerouslySetInnerHTML={{ __html: highlight(activeFile.content, activeFile.language) }} 
            />
          </div>
          <textarea 
            spellCheck={false} 
            value={activeFile.content} 
            onChange={event => onUpdate(event.target.value)} 
            className="mono relative z-10 h-full min-h-[280px] md:min-h-[320px] w-full resize-none bg-transparent text-[12px] leading-6 text-transparent caret-white outline-none selection:bg-cyan-400/30" 
            aria-label={`Edit ${activeFile.path}`} 
          />
        </div>
        <div className="flex items-center justify-between border-t border-slate-200/75 bg-white/80 px-2 py-2 md:px-3 md:py-2">
          <span className="mono text-[10px] font-medium text-slate-500">
            {activeFile.language.toUpperCase()} &middot; {activeFile.content.length} chars
          </span>
          <div className="flex gap-1">
            <button onClick={onCopy} className="grid size-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Copy code">
              <Copy className="size-3.5" />
            </button>
            <button onClick={onDownload} className="grid size-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Download code">
              <Download className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
      {artifacts.length > 0 && (
        <div className="border-t border-cyan-100 bg-cyan-50/60 p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[.14em] text-cyan-800">Extracted from latest answer</p>
          <div className="flex flex-wrap gap-2">
            {artifacts.map((artifact, index) => (
              <button 
                key={`${artifact.path}-${index}`} 
                onClick={() => onAddArtifact(artifact)} 
                className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-white px-2 py-1.5 text-xs font-bold text-cyan-800 hover:bg-cyan-100"
              >
                <Plus className="size-3" /> {artifact.path}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// Responsive ChatPane
function ResponsiveChatPane({ messages, prompt, setPrompt, focused, setFocused, pending, onSend, onOpenSettings }: { 
  messages: StoredMessage[]; 
  prompt: string; 
  setPrompt: (value: string) => void; 
  focused: boolean; 
  setFocused: (value: boolean) => void; 
  pending: boolean; 
  onSend: () => void; 
  onOpenSettings: () => void 
}) {
  const isMobile = useIsMobile();
  
  return (
    <section className="glass flex min-h-[400px] md:min-h-[560px] flex-col overflow-hidden rounded-2xl border border-white/85 xl:min-h-0">
      <div className="flex items-center justify-between border-b border-slate-200/75 px-3 py-2 md:px-4 md:py-3">
        <div>
          <p className="text-sm font-bold text-slate-900">Conversation</p>
          <p className="text-[10px] font-bold uppercase tracking-[.15em] text-cyan-700 hidden md:block">
            Bring your own backend
          </p>
        </div>
        <button onClick={onOpenSettings} className="rounded-lg px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800">
          Backend <Settings className="ml-1 inline size-3" />
        </button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-3 py-4 md:px-4 md:py-5">
        {!messages.length ? (
          <div className="grid h-full min-h-64 place-items-center text-center">
            <div>
              <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-cyan-100 text-cyan-700">
                <Sparkles className="size-5" />
              </div>
              <h2 className="mt-4 text-lg md:text-xl font-bold tracking-[-.05em] text-slate-900">
                Plan the build.
              </h2>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-500">
                {isMobile ? "Tap to start chatting" : "Describe an interface, a component, or a fix. Code fences will appear in your project rail."}
              </p>
            </div>
          </div>
        ) : (
          messages.map(message => (
            <article key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[92%] rounded-2xl px-3 py-2.5 text-sm leading-5 md:leading-6 ${message.role === "user" ? "rounded-tr-sm bg-slate-950 text-white shadow-lg shadow-slate-900/10" : "rounded-tl-sm border border-white bg-white/80 text-slate-700"}`}>
                {message.role === "assistant" ? <SimpleMarkdown content={message.content} /> : <p className="whitespace-pre-wrap">{message.content}</p>}
              </div>
            </article>
          ))
        )}
        {pending && (
          <div className="flex gap-3">
            <div className="grid size-8 place-items-center rounded-xl bg-cyan-100 text-cyan-700">
              <Sparkles className="size-4" />
            </div>
            <div className="rounded-2xl rounded-tl-sm border border-white bg-white/80 px-3 py-2.5">
              <Loader2 className="size-4 animate-spin text-cyan-700" />
            </div>
          </div>
        )}
      </div>
      <div className={`m-2 rounded-2xl border p-2 transition ${focused ? "border-cyan-400 bg-white shadow-lg shadow-cyan-900/10" : "border-slate-200 bg-white/75"}`}>
        <textarea 
          value={prompt} 
          onChange={event => setPrompt(event.target.value)} 
          onFocus={() => setFocused(true)} 
          onBlur={() => setFocused(false)} 
          onKeyDown={event => { 
            if (event.key === "Enter" && !event.shiftKey) { 
              event.preventDefault(); 
              onSend(); 
            } 
          }} 
          placeholder={isMobile ? "Type your message..." : "Ask for a landing page, a refactor, or a new feature..."} 
          rows={isMobile ? 2 : 3} 
          className="w-full resize-none border-0 bg-transparent px-2 py-1 text-sm text-slate-800 outline-none placeholder:text-slate-400"
        />
        <div className="flex items-center justify-between px-1 pb-1">
          <span className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-400 hidden md:block">
            Enter to send &middot; Shift+Enter for line break
          </span>
          <button 
            onClick={onSend} 
            disabled={!prompt.trim() || pending} 
            className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-700 px-3 py-2 text-xs font-bold text-white shadow-md shadow-cyan-900/15 transition hover:bg-cyan-800 disabled:opacity-40"
          >
            <Send className="size-3.5" /> Send
          </button>
        </div>
      </div>
    </section>
  );
}

// Responsive ConversationRail
function ResponsiveConversationRail({ conversations, activeId, onNew, onSelect }: { 
  conversations: Conversation[]; 
  activeId: string | null; 
  onNew: () => void; 
  onSelect: (id: string) => void 
}) {
  const isMobile = useIsMobile();
  
  // On mobile, show limited conversations with horizontal scroll
  const displayConversations = isMobile ? conversations.slice(0, 5) : conversations;
  
  return (
    <aside className="glass flex min-h-[260px] md:min-h-[400px] flex-col rounded-2xl border border-white/85 p-3 xl:min-h-0">
      <div className="flex items-center justify-between px-2 py-2">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <LayoutTemplate className="size-4 text-cyan-700" /> 
          <span className="hidden sm:inline">Conversations</span>
        </div>
        <button onClick={onNew} className="grid size-7 place-items-center rounded-lg bg-slate-950 text-white transition hover:bg-cyan-800" aria-label="New chat">
          <Plus className="size-4" />
        </button>
      </div>
      <div className="mt-2 space-y-1 overflow-y-auto pr-1">
        {displayConversations.length ? (
          <div className={isMobile ? "flex gap-2 overflow-x-auto pb-2" : ""}>
            {displayConversations.map(item => (
              <button 
                key={item.id} 
                onClick={() => onSelect(item.id)} 
                className={`group flex ${isMobile ? "shrink-0 w-48" : "w-full"} items-center gap-2 rounded-xl px-3 py-2 text-left transition ${
                  activeId === item.id ? "bg-slate-950 text-white shadow-md shadow-slate-900/15" : "text-slate-700 hover:bg-white/80"
                }`}
              >
                <Sparkles className={`size-3.5 shrink-0 ${activeId === item.id ? "text-cyan-300" : "text-cyan-700"}`} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.title}</span>
                <MoreHorizontal className={`size-4 shrink-0 opacity-0 transition group-hover:opacity-70 ${activeId === item.id ? "text-white" : "text-slate-500"}`} />
              </button>
            ))}
          </div>
        ) : (
          <div className="px-3 py-8 text-center text-sm text-slate-500">
            <SquarePen className="mx-auto mb-3 size-5 text-cyan-700" />
            {isMobile ? "Start a chat" : "Create a chat to begin a focused build."}
          </div>
        )}
        {!isMobile && conversations.length > displayConversations.length && (
          <p className="px-3 py-2 text-xs text-center text-slate-400">+{conversations.length - displayConversations.length} more</p>
        )}
      </div>
      <div className="mt-auto rounded-xl border border-cyan-100 bg-cyan-50/80 p-3">
        <div className="flex items-center gap-2 text-xs font-bold text-cyan-900">
          <Zap className="size-3.5" /> 
          <span className="hidden sm:inline">Stored in this browser</span>
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-cyan-800/80 hidden md:block">
          Conversations and files stay on this device, with no account required.
        </p>
      </div>
    </aside>
  );
}

function SimpleMarkdown({ content }: { content: string }) {
  const segments = content.split(/```([a-zA-Z0-9+#.-]+)?\n([\s\S]*?)```/g);
  return <div className="space-y-3">{segments.map((segment, index) => {
    if (index % 3 === 2) return <pre key={index} className="mono overflow-x-auto rounded-xl bg-slate-950 p-3 text-xs leading-5 text-slate-100"><code>{segment}</code></pre>;
    if (index % 3 === 1) return null;
    return <p key={index} className="whitespace-pre-wrap">{segment.split(/(\*\*.*?\*\*)/g).map((part, partIndex) => part.startsWith("**") && part.endsWith("**") ? <strong key={partIndex}>{part.slice(2, -2)}</strong> : part)}</p>;
  })}</div>;
}

function SettingsPanel({ config, setConfig, apiKey, setApiKey, keyReady, savingKey, testing, onClose, onStoreKey, onTest }: { 
  config: typeof defaultConfig; 
  setConfig: Dispatch<SetStateAction<typeof defaultConfig>>; 
  apiKey: string; 
  setApiKey: (key: string) => void; 
  keyReady: boolean; 
  savingKey: boolean; 
  testing: boolean; 
  onClose: () => void; 
  onStoreKey: () => void; 
  onTest: () => void 
}) {
  const update = <K extends keyof typeof defaultConfig>(key: K, value: typeof defaultConfig[K]) => setConfig(current => ({ ...current, [key]: value }));
  const isMobile = useIsMobile();
  
  return (
    <main className="glass mx-auto mt-3 w-full max-w-5xl rounded-2xl border border-white/85 p-4 sm:p-5 md:p-8">
      <div className="flex items-start justify-between gap-5">
        <div>
          <div className="mb-3 grid size-11 place-items-center rounded-2xl bg-cyan-100 text-cyan-800">
            <Settings className="size-5" />
          </div>
          <p className="text-xs font-bold uppercase tracking-[.17em] text-cyan-700 hidden sm:block">Private connection</p>
          <h1 className="mt-1 text-2xl md:text-4xl font-bold tracking-[-.065em] text-slate-950">Backend settings</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 hidden md:block">
            Choose any public, OpenAI-compatible endpoint. Model preferences are saved only in this browser. 
            Submit your key once over HTTPS; it then lives only in a temporary server session and is never returned to the browser.
          </p>
        </div>
        <button onClick={onClose} className="grid size-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-900" aria-label="Close settings">
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-6 md:mt-8 grid gap-4 md:gap-5 md:grid-cols-2">
        <Field label="Base URL" hint="Example: https://api.example.com/v1">
          <input value={config.baseUrl} onChange={event => update("baseUrl", event.target.value)} placeholder="https://api.example.com/v1" />
        </Field>
        <Field label="Model name" hint="The exact model identifier from your provider">
          <input value={config.model} onChange={event => update("model", event.target.value)} placeholder="gpt-4o-mini" />
        </Field>
        <Field label="API key" hint={keyReady ? "Active in the temporary server session." : "Submit once; never stored in the browser."}>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input type="password" autoComplete="off" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder={keyReady ? "         " : "sk-..."} className="pl-9" />
          </div>
        </Field>
        <Field label="Maximum tokens" hint="256 to 32,000">
          <input type="number" min="256" max="32000" value={config.maxTokens} onChange={event => update("maxTokens", Number(event.target.value))} />
        </Field>
        <Field label={`Temperature     ${config.temperature.toFixed(1)}`} hint="Lower is more deterministic">
          <input type="range" min="0" max="2" step="0.1" value={config.temperature} onChange={event => update("temperature", Number(event.target.value))} className="accent-cyan-700" />
        </Field>
        <div className="rounded-2xl border border-cyan-100 bg-cyan-50/75 p-4 md:col-span-2">
          <p className="flex items-center gap-2 text-sm font-bold text-cyan-950">
            <TerminalSquare className="size-4" /> No-login privacy model
          </p>
          <p className="mt-2 text-xs leading-5 text-cyan-900/75 hidden md:block">
            Chats, files, and model preferences are stored in this browser. No account or database profile is required.
          </p>
        </div>
      </div>
      <div className="mt-4 md:mt-5">
        <Field label="System prompt" hint="Applied server-side to each request">
          <textarea value={config.systemPrompt} onChange={event => update("systemPrompt", event.target.value)} rows={isMobile ? 4 : 6} />
        </Field>
      </div>
      <div className="mt-5 md:mt-7 flex flex-col-reverse justify-between gap-3 border-t border-slate-200 pt-4 md:pt-5 sm:flex-row sm:items-center">
        <p className="text-xs text-slate-500 text-center sm:text-left">Requests are restricted to publicly reachable HTTPS endpoints.</p>
        <div className="flex flex-wrap gap-2 justify-center sm:justify-end">
          <button onClick={onStoreKey} disabled={savingKey || keyReady} className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-bold text-cyan-800 hover:bg-cyan-100 disabled:opacity-50">
            {savingKey ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
            {keyReady ? "Key submitted" : "Submit key"}
          </button>
          <button onClick={onTest} disabled={testing || !keyReady} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:border-cyan-300 hover:text-cyan-800 disabled:opacity-50">
            {testing ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} Test connection
          </button>
          <button onClick={onClose} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-slate-900/15 hover:bg-cyan-800">
            <Check className="size-4" /> Done
          </button>
        </div>
      </div>
    </main>
  );
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-800">{label}</span>
      <span className="ml-2 text-xs text-slate-500 hidden md:inline">{hint}</span>
      <div className="mt-2 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-slate-200 [&_input]:bg-white/85 [&_input]:px-3 [&_input]:py-2 [&_input]:text-sm [&_input]:text-slate-800 [&_input]:outline-none [&_input]:focus:border-cyan-500 [&_textarea]:w-full [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:border-slate-200 [&_textarea]:bg-white/85 [&_textarea]:p-3 [&_textarea]:text-sm [&_textarea]:leading-6 [&_textarea]:text-slate-800 [&_textarea]:outline-none [&_textarea]:focus:border-cyan-500">
        {children}
      </div>
    </label>
  );
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("workspace");
  const [conversations, setConversations] = useState<Conversation[]>(() => readLocal(store.conversations, []));
  const [activeConversationId, setActiveConversationId] = useState<string | null>(() => readLocal<Conversation[]>(store.conversations, [])[0]?.id || null);
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<FileItem[]>(() => readLocal(store.files, starterFiles));
  const [activePath, setActivePath] = useState(() => readLocal<FileItem[]>(store.files, starterFiles)[0]?.path || "index.html");
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [apiKey, setApiKey] = useState("");
  const [config, setConfig] = useState(() => readLocal(store.preferences, defaultConfig));
  const [workspaceId] = useState(() => readLocal<string>("ai-chat-studio-workspace-id", crypto.randomUUID()));
  const [sessionKeyReady, setSessionKeyReady] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);
  
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  const chat = trpc.workspace.chat.useMutation({
    onSuccess: result => {
      setConversations(current => current.map(conversation => 
        conversation.id === activeConversationId ? { 
          ...conversation, 
          messages: [...conversation.messages, { id: crypto.randomUUID(), role: "assistant", content: result.content }], 
          updatedAt: Date.now() 
        } : conversation
      ));
      setArtifacts(result.artifacts);
      if (result.artifacts.length) toast.success(`${result.artifacts.length} code block${result.artifacts.length === 1 ? "" : "s"} extracted from the response.`);
    },
    onError: error => toast.error(error.message),
  });
  const storeSessionKey = trpc.workspace.settings.sessionApiKey.useMutation({
    onSuccess: () => { setApiKey(""); setSessionKeyReady(true); toast.success("Key retained in the temporary server session for this workspace."); },
    onError: error => toast.error(error.message),
  });
  const testSettings = trpc.workspace.settings.test.useMutation({ 
    onSuccess: ({ preview }) => toast.success(`Backend connected: ${preview}`), 
    onError: error => toast.error(error.message) 
  });

  useEffect(() => persistLocal(store.conversations, conversations), [conversations]);
  useEffect(() => persistLocal(store.files, files), [files]);
  useEffect(() => persistLocal(store.preferences, config), [config]);
  useEffect(() => persistLocal("ai-chat-studio-workspace-id", workspaceId), [workspaceId]);

  const activeConversation = conversations.find(conversation => conversation.id === activeConversationId) || null;
  const activeFile = files.find(file => file.path === activePath) || files[0] || starterFiles[0];
  const srcDoc = useMemo(() => previewDocument(files), [files]);

  const createConversation = () => {
    const conversation = { id: crypto.randomUUID(), title: "New workspace", messages: [], updatedAt: Date.now() };
    setConversations(current => [conversation, ...current]);
    setActiveConversationId(conversation.id);
  };
  const sendMessage = () => {
    const content = prompt.trim();
    if (!content || chat.isPending) return;
    if (!sessionKeyReady) { setTab("settings"); toast.error("Submit an API key to the temporary server session before sending a request."); return; }
    let id = activeConversationId;
    if (!id) {
      const conversation = { id: crypto.randomUUID(), title: content.slice(0, 54), messages: [], updatedAt: Date.now() };
      id = conversation.id;
      setConversations(current => [conversation, ...current]);
      setActiveConversationId(id);
    }
    const userMessage = { id: crypto.randomUUID(), role: "user" as const, content };
    const requestMessages = [...(activeConversation?.messages || []), userMessage].map(message => ({ role: message.role, content: message.content }));
    const targetId = id;
    setConversations(current => current.map(conversation => conversation.id === targetId ? { ...conversation, title: conversation.messages.length ? conversation.title : content.slice(0, 54), messages: [...conversation.messages, userMessage], updatedAt: Date.now() } : conversation));
    setPrompt("");
    chat.mutate({ messages: requestMessages, preferences: config, workspaceId });
  };
  const updateFile = (content: string) => setFiles(current => current.map(file => file.path === activeFile.path ? { ...file, content } : file));
  const addArtifact = (artifact: Artifact) => { 
    setFiles(current => current.some(file => file.path === artifact.path) ? current.map(file => file.path === artifact.path ? artifact : file) : [...current, artifact]); 
    setActivePath(artifact.path); 
    toast.success(`${artifact.path} added to this local project.`); 
  };
  const copyCode = () => navigator.clipboard.writeText(activeFile.content).then(() => toast.success("Code copied."));
  const saveTemporaryKey = () => { if (!apiKey.trim()) return toast.error("Enter an API key to continue."); storeSessionKey.mutate({ workspaceId, apiKey }); };
  const testConnection = () => { if (!sessionKeyReady) return toast.error("Submit the key to the temporary server session before testing."); testSettings.mutate({ ...config, workspaceId }); };

  // Determine layout based on screen size
  const renderLayout = () => {
    if (isMobile) {
      return (
        <MobileLayout>
          <ResponsivePreviewPane srcDoc={srcDoc} mode={previewMode} setMode={setPreviewMode} onRefresh={() => toast.success("Preview refreshed from the current files.")} />
          <ResponsiveChatPane 
            messages={activeConversation?.messages || []} 
            prompt={prompt} 
            setPrompt={setPrompt} 
            focused={composerFocused} 
            setFocused={setComposerFocused} 
            pending={chat.isPending} 
            onSend={sendMessage} 
            onOpenSettings={() => setTab("settings")} 
          />
          <ResponsiveCodePane 
            files={files} 
            activeFile={activeFile} 
            activePath={activePath} 
            artifacts={artifacts} 
            onSelect={setActivePath} 
            onUpdate={updateFile} 
            onSave={() => toast.success("Files are saved in this browser.")} 
            onCopy={copyCode} 
            onDownload={() => downloadFile(activeFile)} 
            onAddArtifact={addArtifact} 
          />
          <ResponsiveConversationRail 
            conversations={conversations} 
            activeId={activeConversationId} 
            onNew={createConversation} 
            onSelect={setActiveConversationId} 
          />
        </MobileLayout>
      );
    }
    
    if (isTablet) {
      return (
        <TabletLayout>
          <ResponsiveConversationRail 
            conversations={conversations} 
            activeId={activeConversationId} 
            onNew={createConversation} 
            onSelect={setActiveConversationId} 
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ResponsiveChatPane 
              messages={activeConversation?.messages || []} 
              prompt={prompt} 
              setPrompt={setPrompt} 
              focused={composerFocused} 
              setFocused={setComposerFocused} 
              pending={chat.isPending} 
              onSend={sendMessage} 
              onOpenSettings={() => setTab("settings")} 
            />
            <ResponsiveCodePane 
              files={files} 
              activeFile={activeFile} 
              activePath={activePath} 
              artifacts={artifacts} 
              onSelect={setActivePath} 
              onUpdate={updateFile} 
              onSave={() => toast.success("Files are saved in this browser.")} 
              onCopy={copyCode} 
              onDownload={() => downloadFile(activeFile)} 
              onAddArtifact={addArtifact} 
            />
          </div>
          <ResponsivePreviewPane srcDoc={srcDoc} mode={previewMode} setMode={setPreviewMode} onRefresh={() => toast.success("Preview refreshed from the current files.")} />
        </TabletLayout>
      );
    }

    // Desktop layout
    return (
      <DesktopLayout>
        <ResponsiveConversationRail 
          conversations={conversations} 
          activeId={activeConversationId} 
          onNew={createConversation} 
          onSelect={setActiveConversationId} 
        />
        <ResponsiveChatPane 
          messages={activeConversation?.messages || []} 
          prompt={prompt} 
          setPrompt={setPrompt} 
          focused={composerFocused} 
          setFocused={setComposerFocused} 
          pending={chat.isPending} 
          onSend={sendMessage} 
          onOpenSettings={() => setTab("settings")} 
        />
        <ResponsiveCodePane 
          files={files} 
          activeFile={activeFile} 
          activePath={activePath} 
          artifacts={artifacts} 
          onSelect={setActivePath} 
          onUpdate={updateFile} 
          onSave={() => toast.success("Files are saved in this browser.")} 
          onCopy={copyCode} 
          onDownload={() => downloadFile(activeFile)} 
          onAddArtifact={addArtifact} 
        />
        <ResponsivePreviewPane srcDoc={srcDoc} mode={previewMode} setMode={setPreviewMode} onRefresh={() => toast.success("Preview refreshed from the current files.")} />
      </DesktopLayout>
    );
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="plane plane-blue h-80 w-[47rem] -top-40 left-[28%] rounded-[5rem] opacity-80" />
      <div className="plane plane-teal h-56 w-96 top-[34%] -right-36 rounded-[4rem] opacity-50" />
      <div className="plane plane-coral h-52 w-[30rem] -bottom-20 left-[28%] rounded-[4rem] opacity-50" />
      
      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1760px] flex-col p-2 md:p-3 lg:p-5">
        <header className="glass flex h-16 shrink-0 items-center justify-between rounded-2xl border border-white/85 px-3 md:px-4">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-slate-950 text-white shadow-lg shadow-slate-900/20">
              <Braces className="size-5" />
            </div>
            <div className="hidden sm:block">
              <p className="font-bold leading-none tracking-[-.04em] text-slate-950">AI Chat Studio</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[.14em] text-cyan-700">No-login coding workspace</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 md:flex">
              <span className="size-1.5 rounded-full bg-emerald-500" /> Ready to build
            </div>
            <button onClick={() => setTab("settings")} className={`grid size-9 place-items-center rounded-xl border transition ${tab === "settings" ? "border-cyan-300 bg-cyan-100 text-cyan-800" : "border-slate-200 bg-white/75 text-slate-600 hover:bg-white"}`} aria-label="Open settings">
              <Settings className="size-4" />
            </button>
            <div className="grid size-9 place-items-center rounded-xl bg-slate-900 text-xs font-bold text-white">AI</div>
          </div>
        </header>
        
        {tab === "settings" ? (
          <SettingsPanel 
            config={config} 
            setConfig={setConfig} 
            apiKey={apiKey} 
            setApiKey={setApiKey} 
            keyReady={sessionKeyReady} 
            savingKey={storeSessionKey.isPending} 
            testing={testSettings.isPending} 
            onClose={() => setTab("workspace")} 
            onStoreKey={saveTemporaryKey} 
            onTest={testConnection} 
          />
        ) : (
          <div className="flex-1 mt-2 md:mt-3">{renderLayout()}</div>
        )}
      </div>
    </div>
  );
}
