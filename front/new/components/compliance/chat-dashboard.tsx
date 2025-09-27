"use client";

import {
  type ElementType,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { differenceInDays, formatDistanceToNow } from "date-fns";
import { nanoid } from "nanoid";
import {
  Activity,
  Bot,
  CheckCircle2,
  Folder,
  FolderPlus,
  Files,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DocumentStatus = "Queued" | "Indexed" | "Flagged";

type ComplianceDocument = {
  id: string;
  name: string;
  size: number;
  status: DocumentStatus;
  uploadedAt: string;
  focus?: string;
  summary?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

type ComplianceFinding = {
  id: string;
  title: string;
  standard: string;
  severity: "High" | "Medium" | "Low";
  summary: string;
  due: string;
  impactedDocumentIds?: string[];
};

type AgentStatus = {
  id: string;
  name: string;
  focus: string;
  progress: number;
};

type QuickPrompt = {
  id: string;
  label: string;
  prompt: string;
};

type AlertItem = {
  id: string;
  label: string;
  detail?: string;
};

type MetricTone = "default" | "positive" | "alert";

type WorkspaceFolder = {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  documents: ComplianceDocument[];
};


const REFERENCE_NOW = new Date("2024-10-01T12:00:00.000Z");
const TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

type ActiveView = "chat" | "files" | "insights" | "agents";

const VIEW_OPTIONS: Array<{ id: ActiveView; label: string; icon: ElementType }> = [
  { id: "chat", label: "Chat", icon: Bot },
  { id: "files", label: "Files", icon: Files },
  { id: "insights", label: "Insights", icon: ShieldAlert },
  { id: "agents", label: "Agents", icon: Users },
];

const INITIAL_FOLDERS: WorkspaceFolder[] = [
  {
    id: "folder-pci",
    name: "PCI DSS Evidence",
    description: "Network segmentation tests, card processing SOPs, quarterly attestations.",
    createdAt: "2024-09-28T09:00:00.000Z",
    documents: [
      {
        id: "doc-2",
        name: "Payment Card SOP.docx",
        size: 2_402_321,
        status: "Flagged",
        uploadedAt: "2024-10-01T09:15:00.000Z",
        focus: "PCI DSS",
        summary: "Requires evidence for quarterly segmentation tests and dual-control approvals.",
      },
    ],
  },
  {
    id: "folder-privacy",
    name: "Privacy Program",
    description: "GDPR DPIAs, retention schedules, incident response procedures.",
    createdAt: "2024-08-12T08:30:00.000Z",
    documents: [
      {
        id: "doc-1",
        name: "Employee Data Handling Policy.pdf",
        size: 1_606_000,
        status: "Indexed",
        uploadedAt: "2024-10-01T10:30:00.000Z",
        focus: "GDPR",
        summary:
          "Annotated for retention and subprocessors controls; linked to Article 30 obligations.",
      },
      {
        id: "doc-3",
        name: "Incident Response Playbook.md",
        size: 782_144,
        status: "Queued",
        uploadedAt: "2024-10-01T08:00:00.000Z",
        focus: "SOC 2",
        summary: "Awaiting enrichment by swarm incident-response agent for R2 policies.",
      },
    ],
  },
];

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "msg-1",
    role: "assistant",
    content:
      "Welcome to the Swarm Compliance Studio. Drop policy or evidence files and I'll coordinate agents around your compliance objectives.",
    timestamp: "2024-10-01T11:53:00.000Z",
  },
  {
    id: "msg-2",
    role: "user",
    content: "Give me a quick read on our PCI DSS evidence coverage for Q4.",
    timestamp: "2024-10-01T11:55:00.000Z",
  },
  {
    id: "msg-3",
    role: "assistant",
    content:
      "We're tracking 3 PCI DSS controls needing fresh evidence. Import recent segmentation reports and I can generate remediation tasks.",
    timestamp: "2024-10-01T11:56:00.000Z",
  },
];

const INITIAL_FINDINGS: ComplianceFinding[] = [
  {
    id: "finding-1",
    title: "Vendor SOC report expired",
    standard: "SOC 2",
    severity: "High",
    summary:
      "Onboardly vendor SOC 2 report expired last quarter. Request updated attestation before customer review.",
    due: "Due in 2 days",
    impactedDocumentIds: ["doc-1"],
  },
  {
    id: "finding-2",
    title: "DPIA evidence missing",
    standard: "GDPR",
    severity: "Medium",
    summary:
      "Need data protection impact assessment for the mobile app rollout. Attach the DPIA template and latest outcomes.",
    due: "Due in 5 days",
    impactedDocumentIds: ["doc-3"],
  },
  {
    id: "finding-3",
    title: "Segmentation validation gap",
    standard: "PCI DSS",
    severity: "High",
    summary:
      "Quarterly network segmentation validation missing Q3 evidence. Import the penetration report to close this gap.",
    due: "Due in 1 day",
    impactedDocumentIds: ["doc-2"],
  },
];

const AGENT_STATUSES: AgentStatus[] = [
  {
    id: "agent-1",
    name: "Policy Summarizer",
    focus: "SOC 2 · Security",
    progress: 72,
  },
  {
    id: "agent-2",
    name: "Evidence Tracker",
    focus: "PCI DSS · Requirement 11",
    progress: 46,
  },
  {
    id: "agent-3",
    name: "Privacy Analyst",
    focus: "GDPR · DPIA",
    progress: 58,
  },
];

//example prompts for quick actions *could automatic this based on recent activity*
const QUICK_PROMPTS: QuickPrompt[] = [
  {
    id: "prompt-1",
    label: "Map GDPR gaps",
    prompt:
      "Run a GDPR gap analysis across the newest policy uploads and list critical actions.",
  },
  {
    id: "prompt-2",
    label: "Prep audit brief",
    prompt:
      "Draft a 3-bullet briefing for the PCI DSS auditor using the latest evidence status.",
  },
  {
    id: "prompt-3",
    label: "Assign swarm agents",
    prompt:
      "Launch swarm agents for vendor risk evidence collection and coordinate owners.",
  },
];

const QUICK_PROMPT_TOOLTIPS: Record<string, string> = {
  "Map GDPR gaps": "Have the swarm scan recent uploads for GDPR control gaps and action items.",
  "Prep audit brief": "Generate a concise summary your auditor can review before the meeting.",
  "Assign swarm agents": "Dispatch specialized agents to gather evidence and notify control owners.",
};

export function ChatDashboard() {
  const [folders, setFolders] = useState<WorkspaceFolder[]>(INITIAL_FOLDERS);
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>(() =>
    INITIAL_FOLDERS[0] ? [INITIAL_FOLDERS[0].id] : []
  );
  const [activeFolderId, setActiveFolderId] = useState<string>(INITIAL_FOLDERS[0]?.id ?? "");
  const [activeView, setActiveView] = useState<ActiveView>("chat");

  const activeFolder = useMemo(
    () => folders.find((folder) => folder.id === activeFolderId) ?? folders[0] ?? null,
    [folders, activeFolderId]
  );

  useEffect(() => {
    if (!activeFolder && folders.length) {
      setActiveFolderId(folders[0].id);
    }
  }, [activeFolder, folders]);

  useEffect(() => {
    if (activeFolder && !selectedFolderIds.includes(activeFolder.id)) {
      setSelectedFolderIds((prev) => [...prev, activeFolder.id]);
    }
  }, [activeFolder, selectedFolderIds]);

  useEffect(() => {
    if (!selectedFolderIds.length && activeFolder) {
      setSelectedFolderIds([activeFolder.id]);
    }
  }, [selectedFolderIds, activeFolder]);

  const selectedFolders = useMemo(
    () => folders.filter((folder) => selectedFolderIds.includes(folder.id)),
    [folders, selectedFolderIds]
  );

  const documents = useMemo(() => {
    if (selectedFolders.length) {
      return selectedFolders.flatMap((folder) => folder.documents);
    }
    return activeFolder ? activeFolder.documents : [];
  }, [selectedFolders, activeFolder]);

  const metrics = useMemo(() => {
    const queued = documents.filter((doc) => doc.status === "Queued").length;
    const flagged = documents.filter((doc) => doc.status === "Flagged").length;
    const indexed = documents.filter((doc) => doc.status === "Indexed").length;

    return {
      total: documents.length,
      queued,
      flagged,
      indexed,
      latestUpload: documents[0]?.uploadedAt ?? null,
    };
  }, [documents]);

  const coveragePercent = useMemo(() => {
    if (!metrics.total) {
      return 0;
    }
    return Math.min(100, Math.round((metrics.indexed / metrics.total) * 100));
  }, [metrics.indexed, metrics.total]);

  const freshnessMeta = useMemo(() => {
    if (!metrics.latestUpload) {
      return null;
    }
    return getFreshnessDescriptor(metrics.latestUpload);
  }, [metrics.latestUpload]);

  const selectedDocumentIds = useMemo(
    () => new Set(documents.map((doc) => doc.id)),
    [documents]
  );

  const folderContextLabel = useMemo(() => {
    if (!selectedFolders.length) {
      return "No folders selected";
    }

    if (selectedFolders.length === folders.length && folders.length > 1) {
      return "All folders";
    }

    if (selectedFolders.length <= 2) {
      return selectedFolders.map((folder) => folder.name).join(", ");
    }

    return `${selectedFolders[0].name}, ${selectedFolders[1].name} +${selectedFolders.length - 2}`;
  }, [selectedFolders, folders.length]);

  const criticalAlerts = useMemo(() => {
    const flaggedDocs = selectedFolders
      .flatMap((folder) => folder.documents)
      .filter((doc) => doc.status === "Flagged")
      .map((doc) => ({
        id: doc.id,
        label: doc.name,
        detail: doc.focus ?? "Unassigned focus",
      }));

    const highSeverityFindings = INITIAL_FINDINGS.filter(
      (finding) =>
        finding.severity === "High" &&
        (finding.impactedDocumentIds?.some((id) => selectedDocumentIds.has(id)) ?? false)
    ).map((finding) => ({
      id: finding.id,
      label: finding.title,
      detail: finding.standard,
    }));

    return [...flaggedDocs, ...highSeverityFindings].slice(0, 4);
  }, [selectedFolders, selectedDocumentIds]);

  const handleToggleFolderSelection = useCallback((folderId: string) => {
    setSelectedFolderIds((prev) => {
      const exists = prev.includes(folderId);
      let next = exists ? prev.filter((id) => id !== folderId) : [...prev, folderId];

      if (!next.length) {
        next = [folderId];
      }

      return next;
    });
  }, []);

  const handleSelectFolder = useCallback((folderId: string) => {
    setActiveFolderId(folderId);
    setSelectedFolderIds((prev) => (prev.includes(folderId) ? prev : [...prev, folderId]));
  }, []);

  const handleCreateFolder = useCallback(() => {
    if (typeof window === "undefined") return;

    const name = window.prompt("Folder name");
    if (!name) return;

    const cleaned = name.trim();
    if (!cleaned) return;

    const newFolder: WorkspaceFolder = {
      id: nanoid(),
      name: cleaned,
      createdAt: new Date().toISOString(),
      documents: [],
    };

    setFolders((prev) => [...prev, newFolder]);
    setActiveFolderId(newFolder.id);
    setSelectedFolderIds((prev) => [...prev, newFolder.id]);
  }, []);

  const handleFilesAdded = useCallback((folderId: string, files: FileList | File[]) => {
    const parsedFiles = Array.from(files);
    if (!parsedFiles.length) return;

    setFolders((prev) =>
      prev.map((folder) => {
        if (folder.id !== folderId) {
          return folder;
        }

        const newDocuments = parsedFiles.map((file) => ({
          id: nanoid(),
          name: file.name,
          size: file.size,
          status: "Queued" as const,
          uploadedAt: new Date().toISOString(),
          focus: inferFocusArea(file.name),
          summary: "Queued for swarm enrichment.",
        }));

        return {
          ...folder,
          documents: [...newDocuments, ...folder.documents],
        };
      })
    );
  }, []);

  const handleRemoveDocument = useCallback((folderId: string, documentId: string) => {
    setFolders((prev) =>
      prev.map((folder) => {
        if (folder.id !== folderId) {
          return folder;
        }

        return {
          ...folder,
          documents: folder.documents.filter((doc) => doc.id !== documentId),
        };
      })
    );
  }, []);

  return (
    <div className="flex min-h-screen bg-muted/15 text-foreground">
      <aside className="hidden w-64 flex-col border-r border-border/60 bg-background/95 px-5 py-6 lg:flex">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="h-5 w-5" />
          <span className="text-sm font-semibold tracking-[0.25em] uppercase">Swarm</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground/80">
          AI-powered compliance workbench
        </p>
        <nav className="mt-8 flex flex-col gap-1">
          {VIEW_OPTIONS.map((option) => {
            const isActive = activeView === option.id;

            return (
              <Button
                key={option.id}
                variant={isActive ? "default" : "ghost"}
                className={cn(
                  "justify-start gap-3 border border-transparent",
                  isActive
                    ? "bg-primary text-primary-foreground shadow"
                    : "bg-transparent text-muted-foreground hover:bg-muted/60"
                )}
                onClick={() => setActiveView(option.id)}
              >
                <option.icon className="h-4 w-4" />
                {option.label}
              </Button>
            );
          })}
        </nav>

        <div className="mt-6 overflow-y-auto pr-1">
          <WorkspaceFolderSelector
            folders={folders}
            selectedFolderIds={selectedFolderIds}
            activeFolderId={activeFolderId}
            onSelectFolder={handleSelectFolder}
            onToggleFolder={handleToggleFolderSelection}
            onCreateFolder={handleCreateFolder}
          />
        </div>

        <div className="mt-auto text-xs text-muted-foreground/70">
          Choose a view to focus your swarm workflow.
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col lg:overflow-hidden">
        <header className="flex items-center justify-between gap-3 border-b border-border/60 bg-background/95 px-4 py-4 lg:hidden">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-[0.25em]">Swarm</span>
          </div>
          <Select value={activeView} onValueChange={(value) => setActiveView(value as ActiveView)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Select view" />
            </SelectTrigger>
            <SelectContent>
              {VIEW_OPTIONS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </header>

        <div className="flex flex-1 flex-col gap-6 overflow-hidden px-4 pb-8 pt-4 lg:flex-row lg:gap-8 lg:px-8">
          <div className="flex flex-1 flex-col gap-6 overflow-hidden">
            <div className="lg:hidden">
              <WorkspaceFolderSelector
                folders={folders}
                selectedFolderIds={selectedFolderIds}
                activeFolderId={activeFolderId}
                onSelectFolder={handleSelectFolder}
                onToggleFolder={handleToggleFolderSelection}
                onCreateFolder={handleCreateFolder}
              />
            </div>

            <section className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-border/60 bg-background/95 shadow-sm">
              <div className="flex-1 overflow-hidden px-4 pb-6 pt-4 sm:px-6">
                {criticalAlerts.length > 0 ? <AlertStrip alerts={criticalAlerts} /> : null}

                {activeView === "chat" && (
                  <section className="flex h-full flex-col gap-6 overflow-hidden">
                    <SectionHeading
                      icon={Bot}
                      title="Compliance copilot"
                      description="Converse with the swarm, escalate findings, and capture decisions."
                    />
                    <ChatView
                      documents={documents}
                      metrics={metrics}
                      quickPrompts={QUICK_PROMPTS}
                      contextLabel={folderContextLabel}
                    />
                  </section>
                )}

                {activeView === "files" && (
                  <section className="flex h-full flex-col gap-6 overflow-hidden">
                    <SectionHeading
                      icon={Upload}
                      title="Evidence workspace"
                      description="Bulk ingest files, track processing status, and prune stale artifacts."
                    />
                    <FilesView
                      folders={folders}
                      activeFolderId={activeFolderId}
                      selectedFolderIds={selectedFolderIds}
                      onSelectFolder={handleSelectFolder}
                      onToggleFolder={handleToggleFolderSelection}
                      onCreateFolder={handleCreateFolder}
                      onFilesAdded={handleFilesAdded}
                      onRemoveDocument={handleRemoveDocument}
                      compact
                      fullHeight
                    />
                  </section>
                )}

                {activeView === "insights" && (
                  <section className="flex h-full flex-col gap-6 overflow-hidden">
                    <SectionHeading
                      icon={ShieldAlert}
                      title="Compliance radar"
                      description="Review prioritized findings and escalation signals across frameworks."
                    />
                    <InsightsView
                      compact
                      fullHeight
                      metrics={metrics}
                      documents={documents}
                      findings={INITIAL_FINDINGS}
                    />
                  </section>
                )}

                {activeView === "agents" && (
                  <section className="flex h-full flex-col gap-6 overflow-hidden">
                    <SectionHeading
                      icon={Users}
                      title="Swarm agents"
                      description="Understand how specialized agents are progressing and balancing workloads."
                    />
                    <AgentsView compact fullHeight agents={AGENT_STATUSES} />
                  </section>
                )}
              </div>
            </section>
          </div>

          <aside className="w-full shrink-0 space-y-4 rounded-3xl border border-border/60 bg-background/95 px-6 py-6 shadow-sm lg:w-80">
            <h2 className="text-sm font-semibold text-muted-foreground">Key health metrics</h2>
            <div className="grid gap-3">
              <MetricTile
                icon={ShieldCheck}
                label="Verified"
                value={metrics.indexed}
                progress={coveragePercent}
                secondaryLabel={`Coverage ${coveragePercent}%`}
                tone="positive"
              />
              <MetricTile icon={ShieldAlert} label="Flagged" value={metrics.flagged} tone="alert" />
              <MetricTile icon={Activity} label="In queue" value={metrics.queued} />
              <MetricTile
                icon={Files}
                label="Total scope"
                value={metrics.total}
                secondaryLabel={freshnessMeta?.label}
                tone={freshnessMeta?.tone ?? "default"}
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );

}

type Metrics = {
  total: number;
  queued: number;
  flagged: number;
  indexed: number;
  latestUpload: string | null;
};

type ChatViewProps = {
  documents: ComplianceDocument[];
  metrics: Metrics;
  quickPrompts: QuickPrompt[];
  contextLabel: string;
};

function ChatView({ documents, metrics, quickPrompts, contextLabel }: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const pendingReplyRef = useRef<number | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  useEffect(() => {
    return () => {
      if (pendingReplyRef.current) {
        window.clearTimeout(pendingReplyRef.current);
      }
    };
  }, []);

  const buildAssistantResponse = useCallback(
    (prompt: string) => {
      const flagged = documents.filter((doc) => doc.status === "Flagged");
      const queued = documents.filter((doc) => doc.status === "Queued");
      const indexed = documents.filter((doc) => doc.status === "Indexed");

      const flaggedSnippet =
        flagged.length > 0
          ? `Flagged focus: ${flagged
              .map((doc) => doc.focus ?? doc.name)
              .slice(0, 2)
              .join(", ")}.`
          : "No urgent flags from the latest sync.";

      const queuedSnippet =
        queued.length > 0
          ? `${queued.length} documents queued for enrichment.`
          : "Queue is clear.";

      const indexedSnippet = `${indexed.length} indexed files ready for cross-standard mapping.`;

      return `${flaggedSnippet} ${queuedSnippet} ${indexedSnippet} Based on your request: “${prompt.trim()}”, I've dispatched swarm agents to surface the most relevant control summaries.`;
    },
    [documents]
  );

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const userMessage: ChatMessage = {
      id: nanoid(),
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsThinking(true);

    const response = buildAssistantResponse(trimmed);

    if (pendingReplyRef.current) {
      window.clearTimeout(pendingReplyRef.current);
    }

    pendingReplyRef.current = window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: nanoid(),
          role: "assistant",
          content: response,
          timestamp: new Date().toISOString(),
        },
      ]);
      setIsThinking(false);
      pendingReplyRef.current = null;
    }, 500);
  }, [buildAssistantResponse, input]);

  const handlePromptClick = useCallback((prompt: QuickPrompt) => {
    setInput(prompt.prompt);
  }, []);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <StatusChip icon={Files}>{documents.length} files in context</StatusChip>
        <StatusChip icon={ShieldAlert}>{metrics.flagged} urgent flags</StatusChip>
        {metrics.latestUpload ? (
          <StatusChip icon={Upload}>Updated {relativeTime(metrics.latestUpload)}</StatusChip>
        ) : null}
        <StatusChip icon={Folder}>{contextLabel}</StatusChip>
      </div>

      <div className="flex flex-1 min-h-[60vh] flex-col gap-4 overflow-hidden">
        <div className="flex flex-1 overflow-hidden rounded-2xl border border-border/60 bg-muted/20">
          <ScrollArea className="flex-1 pr-3">
            <div className="flex min-h-full flex-col gap-4 p-4">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {isThinking && <AssistantTypingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </div>

        <div className="space-y-3">
          <TooltipProvider>
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => {
                const tooltip = QUICK_PROMPT_TOOLTIPS[prompt.label];
                const button = (
                  <Button
                    key={prompt.id}
                    variant="secondary"
                    size="sm"
                    className="gap-2"
                    onClick={() => handlePromptClick(prompt)}
                  >
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    {prompt.label}
                  </Button>
                );

                if (!tooltip) {
                  return button;
                }

                return (
                  <Tooltip key={prompt.id} delayDuration={150}>
                    <TooltipTrigger asChild>{button}</TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-sm">
                      {tooltip}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>

          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask the swarm to assess a standard, prepare an auditor brief, or link evidence..."
            className="min-h-[96px] resize-none rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-sm shadow-sm"
          />

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>Shift + Enter for new line</span>
            <Button size="sm" className="gap-2" onClick={handleSend} disabled={!input.trim()}>
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

type FilesViewProps = {
  folders: WorkspaceFolder[];
  activeFolderId: string;
  selectedFolderIds: string[];
  onSelectFolder: (folderId: string) => void;
  onToggleFolder: (folderId: string) => void;
  onCreateFolder: () => void;
  onFilesAdded: (folderId: string, files: FileList | File[]) => void;
  onRemoveDocument: (folderId: string, documentId: string) => void;
  compact?: boolean;
  fullHeight?: boolean;
};

function FilesView({
  folders,
  activeFolderId,
  selectedFolderIds,
  onSelectFolder,
  onToggleFolder,
  onCreateFolder,
  onFilesAdded,
  onRemoveDocument,
  compact = false,
  fullHeight = false,
}: FilesViewProps) {
  const activeFolder = folders.find((folder) => folder.id === activeFolderId) ?? folders[0] ?? null;
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!activeFolder && folders.length) {
      onSelectFolder(folders[0].id);
    }
  }, [activeFolder, folders, onSelectFolder]);

  const handleFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!event.target.files?.length || !activeFolder) return;
      onFilesAdded(activeFolder.id, event.target.files);
      event.target.value = "";
    },
    [activeFolder, onFilesAdded]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      if (!activeFolder) return;
      if (event.dataTransfer.files?.length) {
        onFilesAdded(activeFolder.id, event.dataTransfer.files);
      }
    },
    [onFilesAdded, activeFolder]
  );

  if (!activeFolder) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 rounded-2xl border border-border/60 bg-background/80 p-6 text-center text-sm text-muted-foreground">
        <p>No folders yet. Create one to start organizing evidence uploads.</p>
        <Button variant="outline" size="sm" onClick={onCreateFolder} className="gap-2">
          <FolderPlus className="h-4 w-4" />
          New folder
        </Button>
      </div>
    );
  }

  const flaggedCount = activeFolder.documents.filter((doc) => doc.status === "Flagged").length;
  const isInContext = selectedFolderIds.includes(activeFolder.id);

  return (
    <div
      className={cn(
        "space-y-5",
        compact && "space-y-4",
        fullHeight && "flex h-full flex-col gap-4"
      )}
    >
      <div className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-background/80 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={activeFolder.id} onValueChange={onSelectFolder}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select folder" />
              </SelectTrigger>
              <SelectContent>
                {folders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant={isInContext ? "default" : "outline"}
              className="gap-2"
              onClick={() => onToggleFolder(activeFolder.id)}
            >
              {isInContext ? "In AI context" : "Add to context"}
            </Button>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={onCreateFolder}>
            <FolderPlus className="h-4 w-4" />
            New folder
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{activeFolder.documents.length} files</span>
          <span>Created {relativeTime(activeFolder.createdAt)}</span>
          <span className={cn(flaggedCount ? "text-destructive" : "text-muted-foreground/80")}
          >
            {flaggedCount} flagged
          </span>
        </div>
        {activeFolder.description ? (
          <p className="text-xs text-muted-foreground/80">{activeFolder.description}</p>
        ) : null}
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed text-center transition",
          compact ? "px-4 py-6" : "px-6 py-10",
          fullHeight && "shrink-0",
          isDragging
            ? "border-primary bg-primary/10"
            : "border-border/70 bg-background/75 hover:border-primary/60 hover:bg-primary/5"
        )}
      >
        <Upload className="h-8 w-8 text-primary" />
        <div className="space-y-1">
          <p className="text-sm font-medium">Drag & drop evidence, policies, or reports</p>
          <p className="text-xs text-muted-foreground">
            Files will be added to <span className="font-semibold">{activeFolder.name}</span>
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={(event) => {
            event.stopPropagation();
            fileInputRef.current?.click();
          }}
        >
          Browse files
        </Button>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInputChange} />
      </div>

      <div
        className={cn(
          "rounded-2xl border border-border/60 bg-muted/20",
          fullHeight && "flex flex-1 flex-col"
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground",
            compact ? "px-4 py-2" : "px-5 py-3"
          )}
        >
          <span>Recent uploads</span>
          <span>{activeFolder.documents.length} total</span>
        </div>
        <Separator />
        <ScrollArea
          className={cn(
            compact ? "px-3 py-3" : "px-5 py-4",
            fullHeight ? "flex-1" : "h-[220px]"
          )}
        >
          <div className={cn("space-y-3", compact && "space-y-2.5")}>
            {activeFolder.documents.map((document) => (
              <DocumentRow
                key={document.id}
                document={document}
                onRemove={() => onRemoveDocument(activeFolder.id, document.id)}
              />
            ))}
            {!activeFolder.documents.length ? (
              <p className="text-xs text-muted-foreground/80">
                No uploads yet. Drop files above to populate this workspace.
              </p>
            ) : null}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

type InsightsViewProps = {
  metrics: Metrics;
  documents: ComplianceDocument[];
  findings: ComplianceFinding[];
  compact?: boolean;
  fullHeight?: boolean;
};

function InsightsView({ metrics, documents, findings, compact = false, fullHeight = false }: InsightsViewProps) {
  const flaggedDocs = documents.filter((doc) => doc.status === "Flagged");

  return (
    <div
      className={cn(
        "space-y-5",
        compact && "space-y-4",
        fullHeight && "flex h-full flex-col gap-4"
      )}
    >
      <div className={cn("grid gap-3 sm:grid-cols-2", compact && "gap-2.5")}>
        <InsightStat
          title="Documents indexed"
          value={metrics.indexed}
          caption={`${metrics.total} total in scope`}
          icon={CheckCircle2}
          tone="primary"
        />
        <InsightStat
          title="Flagged controls"
          value={metrics.flagged}
          caption="Requires immediate attention"
          icon={ShieldAlert}
          tone="destructive"
        />
        <InsightStat
          title="Queue health"
          value={metrics.queued}
          caption="Awaiting enrichment"
          icon={Activity}
          tone="neutral"
        />
        <InsightStat
          title="Latest upload"
          value={metrics.latestUpload ? relativeTime(metrics.latestUpload) : "N/A"}
          caption="Most recent evidence ingest"
          icon={Upload}
          tone="neutral"
        />
      </div>

      <div
        className={cn(
          "rounded-2xl border border-border/60 bg-muted/20",
          compact ? "p-4" : "p-5",
          fullHeight && "flex flex-1 flex-col"
        )}
      >
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          <span>Priority findings</span>
          <span>{findings.length}</span>
        </div>
        <ScrollArea className={cn(fullHeight ? "mt-3 flex-1" : "mt-3", "px-1")}>
          <div className={cn("space-y-3 text-sm", compact && "space-y-2.5")}>
            {findings.map((finding) => (
              <div key={finding.id} className="rounded-xl border border-border/40 bg-background/80 p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-destructive" />
                    <span className="font-medium leading-tight">{finding.title}</span>
                  </div>
                  <Badge variant={badgeVariantBySeverity(finding.severity)}>
                    {finding.severity} risk
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground/90">{finding.summary}</p>
                <div
                  className={cn(
                    "mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] uppercase tracking-[0.25em] text-muted-foreground/80",
                    compact && "mt-2.5 gap-x-3"
                  )}
                >
                  <span>{finding.standard}</span>
                  <span>{finding.due}</span>
                  {finding.impactedDocumentIds?.length ? (
                    <span>
                      Sources: {finding.impactedDocumentIds
                        .map((id) => documents.find((doc) => doc.id === id)?.focus ?? "Evidence")
                        .join(", ")}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div
        className={cn(
          "rounded-2xl border border-border/60 bg-muted/20 text-sm",
          compact ? "p-4" : "p-5"
        )}
      >
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          <span>Immediate escalations</span>
          <span>{flaggedDocs.length}</span>
        </div>
        <div className={cn("mt-3 space-y-2", compact && "mt-2.5 space-y-2")}
        >
          {flaggedDocs.length ? (
            flaggedDocs.map((doc) => (
              <div key={doc.id} className="flex items-center gap-2 text-xs text-muted-foreground/90">
                <span className="flex h-2 w-2 rounded-full bg-destructive" />
                {doc.name} · {doc.focus ?? "Unassigned focus"}
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground/80">
              No escalations detected. Swarm agents will alert you if new ones appear.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

type AgentsViewProps = {
  agents: AgentStatus[];
  compact?: boolean;
  fullHeight?: boolean;
};

function AgentsView({ agents, compact = false, fullHeight = false }: AgentsViewProps) {
  const averageProgress = Math.round(
    agents.reduce((acc, agent) => acc + agent.progress, 0) / agents.length
  );

  return (
    <div
      className={cn(
        "space-y-5",
        compact && "space-y-4",
        fullHeight && "flex h-full flex-col gap-4"
      )}
    >
      <div
        className={cn(
          "rounded-2xl border border-border/60 bg-muted/20",
          compact ? "p-4" : "p-5",
          fullHeight && "shrink-0"
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Swarm agent load</h3>
            <p className="text-xs text-muted-foreground">
              Specialized micro-agents collaborating on classification, evidence stitching, and follow-ups.
            </p>
          </div>
          <Badge variant="outline" className="gap-2 text-xs">
            <Users className="h-3.5 w-3.5" />
            {agents.length} active
          </Badge>
        </div>
        <div className={cn("mt-4 flex items-center gap-3", compact && "mt-3")}>
          <Progress value={averageProgress} className="h-2 flex-1" />
          <span className="text-xs text-muted-foreground">{averageProgress}%</span>
        </div>
      </div>

      <div
        className={cn(
          "rounded-2xl border border-border/60 bg-muted/20",
          fullHeight ? "flex-1 overflow-hidden" : ""
        )}
      >
        <ScrollArea className={cn("px-4 py-4", fullHeight ? "h-full" : "max-h-[260px]")}>
          <div className={cn("grid gap-3 md:grid-cols-2 px-1", compact && "gap-2.5")}
          >
            {agents.map((agent) => (
              <div
                key={agent.id}
                className={cn(
                  "rounded-2xl border border-border/60 bg-background/90 p-5 shadow-sm",
                  compact && "p-4"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold leading-tight">{agent.name}</p>
                    <p className="text-xs text-muted-foreground">{agent.focus}</p>
                  </div>
                  <Badge variant="secondary" className="text-[11px]">
                    {agent.progress}%
                  </Badge>
                </div>
                <Progress
                  value={agent.progress}
                  className={cn("h-1.5", compact ? "mt-2" : "mt-3")}
                />
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-xl font-semibold sm:text-2xl">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}


function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex items-start gap-3", isUser && "flex-row-reverse text-right")}>
      <div
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full border",
          isUser
            ? "border-primary/40 bg-primary text-primary-foreground"
            : "border-border/80 bg-muted text-muted-foreground"
        )}
      >
        {isUser ? <Users className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          "max-w-xl rounded-2xl border px-4 py-3 text-left text-sm shadow-sm",
          isUser
            ? "border-primary/40 bg-primary/10 text-foreground"
            : "border-border bg-background"
        )}
      >
        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        <span className="mt-2 block text-xs text-muted-foreground">
          {formatMessageTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
}

function AssistantTypingIndicator() {
  return (
    <div className="flex items-start gap-3 text-left text-sm">
      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border/80 bg-muted text-muted-foreground">
        <Bot className="h-4 w-4" />
      </div>
      <div className="max-w-xs rounded-2xl border border-border bg-background px-4 py-3 shadow-sm">
        <div className="flex gap-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary/80" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary/80 [animation-delay:0.15s]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary/80 [animation-delay:0.3s]" />
        </div>
      </div>
    </div>
  );
}

function DocumentRow({
  document,
  onRemove,
}: {
  document: ComplianceDocument;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-background/90 p-3 text-left shadow-sm">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium leading-tight">{document.name}</span>
          <Badge variant={badgeVariant(document.status)}>{document.status}</Badge>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{formatFileSize(document.size)}</span>
          <span>{relativeTime(document.uploadedAt)}</span>
          {document.focus && <span>{document.focus}</span>}
        </div>
        {document.summary && (
          <p className="text-xs text-muted-foreground/90">{document.summary}</p>
        )}
      </div>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRemove}>
        <Trash2 className="h-4 w-4 text-muted-foreground" />
        <span className="sr-only">Remove document</span>
      </Button>
    </div>
  );
}

type WorkspaceFolderSelectorProps = {
  folders: WorkspaceFolder[];
  selectedFolderIds: string[];
  activeFolderId: string;
  onSelectFolder: (folderId: string) => void;
  onToggleFolder: (folderId: string) => void;
  onCreateFolder: () => void;
};

function WorkspaceFolderSelector({
  folders,
  selectedFolderIds,
  activeFolderId,
  onSelectFolder,
  onToggleFolder,
  onCreateFolder,
}: WorkspaceFolderSelectorProps) {
  if (!folders.length) {
    return (
      <div className="rounded-2xl border border-border/60 bg-background/95 px-4 py-4 text-center text-xs text-muted-foreground">
        <p>No folders yet. Create one to start importing evidence.</p>
        <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={onCreateFolder}>
          <FolderPlus className="h-4 w-4" />
          New folder
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
        <span>Workspace folders</span>
        <Button variant="outline" size="sm" className="gap-2" onClick={onCreateFolder}>
          <FolderPlus className="h-4 w-4" />
          New
        </Button>
      </div>
      <div className="flex flex-col gap-1">
        {folders.map((folder) => {
          const isActive = folder.id === activeFolderId;
          const isSelected = selectedFolderIds.includes(folder.id);
          const flaggedCount = folder.documents.filter((doc) => doc.status === "Flagged").length;
          const docCount = folder.documents.length;

          return (
            <div
              key={folder.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectFolder(folder.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectFolder(folder.id);
                }
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition",
                isActive ? "border-primary bg-primary/10 text-primary" : "border-border/60 hover:border-primary/40"
              )}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{folder.name}</span>
                  {isActive ? (
                    <Badge variant="outline" className="text-[10px] text-primary">
                      Active
                    </Badge>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Files className="h-3 w-3" /> {docCount}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1",
                      flaggedCount ? "text-destructive" : "text-muted-foreground"
                    )}
                  >
                    <ShieldAlert className="h-3 w-3" /> {flaggedCount}
                  </span>
                  <span>{relativeTime(folder.createdAt)}</span>
                </div>
              </div>
              <Button
                size="sm"
                variant={isSelected ? "default" : "outline"}
                className="gap-1"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleFolder(folder.id);
                }}
              >
                {isSelected ? "In" : "Add"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InsightStat({
  title,
  value,
  caption,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string | number;
  caption: string;
  icon: ElementType;
  tone: "primary" | "destructive" | "neutral";
}) {
  const toneClasses = {
    primary: "bg-primary/10 text-primary",
    destructive: "bg-destructive/10 text-destructive",
    neutral: "bg-muted",
  } as const;

  return (
    <div className="rounded-2xl border border-border/60 bg-background/90 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-full", toneClasses[tone])}>
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold">{value}</p>
          <p className="text-xs text-muted-foreground/80">{caption}</p>
        </div>
      </div>
    </div>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  secondaryLabel,
  tone = "default",
  progress,
  className,
}: {
  icon: ElementType;
  label: string;
  value: string | number;
  secondaryLabel?: string;
  tone?: MetricTone;
  progress?: number;
  className?: string;
}) {
  const toneClasses: Record<MetricTone, string> = {
    default: "border-border/70",
    positive: "border-emerald-200/70",
    alert: "border-destructive/60",
  } as const;

  const displayValue = typeof value === "number" ? value.toLocaleString() : value;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-background/90 p-4 shadow-sm",
        toneClasses[tone],
        className
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl bg-muted",
            tone === "positive" && "bg-emerald-100 text-emerald-800",
            tone === "alert" && "bg-destructive/10 text-destructive"
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold leading-none">{displayValue}</p>
          {secondaryLabel ? (
            <p className="text-xs text-muted-foreground/80">{secondaryLabel}</p>
          ) : null}
        </div>
      </div>
      {typeof progress === "number" ? (
        <div className="mt-4">
          <Progress value={progress} className="h-1.5" />
        </div>
      ) : null}
    </div>
  );
}

function StatusChip({ icon: Icon, children }: { icon: ElementType; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

function AlertStrip({ alerts }: { alerts: AlertItem[] }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      <ShieldAlert className="h-4 w-4" />
      <span className="font-medium">Attention needed</span>
      <div className="flex flex-wrap gap-2 text-xs">
        {alerts.map((alert) => (
          <span
            key={alert.id}
            className="rounded-full border border-destructive/40 bg-background/90 px-3 py-1 text-destructive"
          >
            {alert.label}
            {alert.detail ? <span className="text-muted-foreground"> · {alert.detail}</span> : null}
          </span>
        ))}
      </div>
    </div>
  );
}

function getFreshnessDescriptor(timestamp: string): { label: string; tone: MetricTone } {
  try {
    const parsed = new Date(timestamp);
    if (Number.isNaN(parsed.getTime())) {
      return { label: "Unknown freshness", tone: "default" };
    }

    const days = Math.abs(differenceInDays(REFERENCE_NOW, parsed));

    if (days <= 30) {
      return { label: "Fresh (≤30d)", tone: "positive" };
    }

    if (days <= 90) {
      return { label: "Aging (≤90d)", tone: "default" };
    }

    return { label: `Stale (${days}d)`, tone: "alert" };
  } catch (error) {
    return { label: "Unknown freshness", tone: "default" };
  }
}

function inferFocusArea(fileName: string) {
  const normalized = fileName.toLowerCase();
  if (normalized.includes("pci")) return "PCI DSS";
  if (normalized.includes("gdpr") || normalized.includes("privacy")) return "GDPR";
  if (normalized.includes("soc") || normalized.includes("audit")) return "SOC 2";
  if (normalized.includes("hipaa")) return "HIPAA";
  return "Unassigned";
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes)) return "–";
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / Math.pow(1024, exponent);
  const formatted = size >= 10 || exponent === 0 ? size.toFixed(0) : size.toFixed(1);

  return `${formatted} ${units[exponent]}`;
}

function relativeTime(timestamp: string) {
  try {
    const baseDate = typeof window === "undefined" ? REFERENCE_NOW : undefined;

    return formatDistanceToNow(new Date(timestamp), {
      addSuffix: true,
      baseDate,
    });
  } catch (error) {
    return "just now";
  }
}

function formatMessageTime(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return TIME_FORMATTER.format(date);
}

function badgeVariant(status: DocumentStatus) {
  switch (status) {
    case "Flagged":
      return "destructive" as const;
    case "Queued":
      return "secondary" as const;
    default:
      return "default" as const;
  }
}

function badgeVariantBySeverity(severity: ComplianceFinding["severity"]) {
  switch (severity) {
    case "High":
      return "destructive" as const;
    case "Medium":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
}
