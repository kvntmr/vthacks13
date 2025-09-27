"use client";

import { type ElementType, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { nanoid } from "nanoid";
import {
  Activity,
  Bot,
  CheckCircle2,
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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

const now = Date.now();

const INITIAL_DOCUMENTS: ComplianceDocument[] = [
  {
    id: "doc-1",
    name: "Employee Data Handling Policy.pdf",
    size: 1_606_000,
    status: "Indexed",
    uploadedAt: new Date(now - 45 * 60 * 1000).toISOString(),
    focus: "GDPR",
    summary:
      "Annotated for retention and subprocessors controls; linked to Article 30 obligations.",
  },
  {
    id: "doc-2",
    name: "Payment Card SOP.docx",
    size: 2_402_321,
    status: "Flagged",
    uploadedAt: new Date(now - 90 * 60 * 1000).toISOString(),
    focus: "PCI DSS",
    summary: "Requires evidence for quarterly segmentation tests and dual-control approvals.",
  },
  {
    id: "doc-3",
    name: "Incident Response Playbook.md",
    size: 782_144,
    status: "Queued",
    uploadedAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
    focus: "SOC 2",
    summary: "Awaiting enrichment by swarm incident-response agent for R2 policies.",
  },
];

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "msg-1",
    role: "assistant",
    content:
      "Welcome to the Swarm Compliance Studio. Drop policy or evidence files and I'll coordinate agents around your compliance objectives.",
    timestamp: new Date(now - 7 * 60 * 1000).toISOString(),
  },
  {
    id: "msg-2",
    role: "user",
    content: "Give me a quick read on our PCI DSS evidence coverage for Q4.",
    timestamp: new Date(now - 5 * 60 * 1000).toISOString(),
  },
  {
    id: "msg-3",
    role: "assistant",
    content:
      "We're tracking 3 PCI DSS controls needing fresh evidence. Import recent segmentation reports and I can generate remediation tasks.",
    timestamp: new Date(now - 4 * 60 * 1000).toISOString(),
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

type ActiveView = "chat" | "files" | "insights" | "agents";

const VIEW_OPTIONS: Array<{ id: ActiveView; label: string; icon: ElementType }> = [
  { id: "chat", label: "Chat", icon: Bot },
  { id: "files", label: "Files", icon: Files },
  { id: "insights", label: "Insights", icon: ShieldAlert },
  { id: "agents", label: "Agents", icon: Users },
];


export function ChatDashboard() {
  const [documents, setDocuments] = useState<ComplianceDocument[]>(INITIAL_DOCUMENTS);
  const [activeView, setActiveView] = useState<ActiveView>("chat");
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

  const handleFilesAdded = useCallback((files: FileList | File[]) => {
    const parsedFiles = Array.from(files);
    if (!parsedFiles.length) return;

    setDocuments((prev) => [
      ...parsedFiles.map((file) => ({
        id: nanoid(),
        name: file.name,
        size: file.size,
        status: "Queued" as const,
        uploadedAt: new Date().toISOString(),
        focus: inferFocusArea(file.name),
        summary: "Queued for swarm enrichment.",
      })),
      ...prev,
    ]);
  }, []);

  const handleRemoveDocument = useCallback((documentId: string) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <Card className="w-full max-w-4xl border-border/70 bg-background/95 shadow-xl backdrop-blur">
        <CardHeader className="gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-5 w-5" />
              <span className="text-xs font-semibold tracking-[0.25em] uppercase">
                Swarm Compliance Studio
              </span>
            </div>
            <CardTitle className="text-3xl font-semibold sm:text-4xl">
              Everything you need in one responsive window
            </CardTitle>
            <CardDescription className="max-w-2xl text-sm sm:text-base">
              Chat with the compliance copilot, ingest evidence in bulk, and review
              critical findings without hopping between screens.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm">
            <Badge variant="outline" className="gap-1 text-xs">
              <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
              {metrics.indexed} verified
            </Badge>
            <MetricPill label="Queued" value={metrics.queued} icon={Activity} />
            <MetricPill label="Flagged" value={metrics.flagged} icon={ShieldAlert} />
            <MetricPill label="Total" value={metrics.total} icon={Files} />
          </div>
          <div className="flex flex-wrap gap-2">
            {VIEW_OPTIONS.map((option) => (
              <Button
                key={option.id}
                variant={activeView === option.id ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "gap-2 rounded-full px-4 py-1.5 text-sm",
                  activeView === option.id ? "shadow" : "border border-border/60"
                )}
                onClick={() => setActiveView(option.id)}
              >
                <option.icon className="h-3.5 w-3.5" />
                {option.label}
              </Button>
            ))}
          </div>

        </CardHeader>

        <CardContent className="space-y-6">
          {activeView === "chat" && (
            <section className="space-y-4">
              <SectionHeading
                icon={Bot}
                title="Compliance copilot"
                description="Conversational interface orchestrating swarm agents across your compliance objectives."
              />
              <ChatView documents={documents} metrics={metrics} quickPrompts={QUICK_PROMPTS} />
            </section>
          )}

          {activeView === "files" && (
            <section className="space-y-4">
              <SectionHeading
                icon={Upload}
                title="Evidence space"
                description="Bulk-manage files, track ingest status, and stage artifacts for analysis."
              />
              <FilesView
                documents={documents}
                onFilesAdded={handleFilesAdded}
                onRemoveDocument={handleRemoveDocument}
              />
            </section>
          )}

          {activeView === "insights" && (
            <section className="space-y-4">
              <SectionHeading
                icon={ShieldAlert}
                title="Compliance radar"
                description="Monitor critical findings and control coverage across frameworks in real time."
              />
              <InsightsView metrics={metrics} documents={documents} findings={INITIAL_FINDINGS} />
            </section>
          )}

          {activeView === "agents" && (
            <section className="space-y-4">
              <SectionHeading
                icon={Users}
                title="Swarm agents"
                description="Understand how micro-agents are progressing and balancing workloads."
              />
              <AgentsView agents={AGENT_STATUSES} />
            </section>
          )}
        </CardContent>
      </Card>
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
};

function ChatView({ documents, metrics, quickPrompts }: ChatViewProps) {
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
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="rounded-full bg-muted px-3 py-1">
          {documents.length} files in context
        </span>
        <span className="rounded-full bg-muted px-3 py-1">
          {metrics.flagged} urgent flags
        </span>
        {metrics.latestUpload && (
          <span className="rounded-full bg-muted px-3 py-1">
            Last upload {relativeTime(metrics.latestUpload)}
          </span>
        )}
      </div>

      <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
        <ScrollArea className="h-[280px] pr-3">
          <div className="space-y-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isThinking && <AssistantTypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {quickPrompts.map((prompt) => (
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
          ))}
        </div>

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
          className="min-h-[100px] resize-none"
        />

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>Shift + Enter for new line</span>
          <Button size="sm" className="gap-2" onClick={handleSend} disabled={!input.trim()}>
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}

type FilesViewProps = {
  documents: ComplianceDocument[];
  onFilesAdded: (files: FileList | File[]) => void;
  onRemoveDocument: (documentId: string) => void;
};

function FilesView({ documents, onFilesAdded, onRemoveDocument }: FilesViewProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!event.target.files?.length) return;
      onFilesAdded(event.target.files);
      event.target.value = "";
    },
    [onFilesAdded]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      if (event.dataTransfer.files?.length) {
        onFilesAdded(event.dataTransfer.files);
      }
    },
    [onFilesAdded]
  );

  return (
    <div className="space-y-5">
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
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition",
          isDragging
            ? "border-primary bg-primary/10"
            : "border-border/80 bg-muted/30 hover:border-primary/60 hover:bg-primary/5"
        )}
      >
        <Upload className="h-8 w-8 text-primary" />
        <div className="space-y-1">
          <p className="text-sm font-medium">Drag & drop evidence, policies, or reports</p>
          <p className="text-xs text-muted-foreground">
            Accepts PDF, DOCX, CSV, Markdown, and ZIP bundles up to 250 MB
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

      <div className="rounded-2xl border border-border/60 bg-muted/20">
        <div className="flex items-center justify-between px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          <span>Recent uploads</span>
          <span>{documents.length} total</span>
        </div>
        <Separator />
        <ScrollArea className="h-[220px] px-5 py-4">
          <div className="space-y-3">
            {documents.map((document) => (
              <DocumentRow
                key={document.id}
                document={document}
                onRemove={() => onRemoveDocument(document.id)}
              />
            ))}
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
};

function InsightsView({ metrics, documents, findings }: InsightsViewProps) {
  const flaggedDocs = documents.filter((doc) => doc.status === "Flagged");

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
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

      <div className="rounded-2xl border border-border/60 bg-muted/20 p-5">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          <span>Priority findings</span>
          <span>{findings.length}</span>
        </div>
        <div className="mt-4 space-y-3 text-sm">
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
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] uppercase tracking-[0.25em] text-muted-foreground/80">
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
      </div>

      <div className="rounded-2xl border border-border/60 bg-muted/20 p-5 text-sm">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          <span>Immediate escalations</span>
          <span>{flaggedDocs.length}</span>
        </div>
        <div className="mt-3 space-y-2">
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
};

function AgentsView({ agents }: AgentsViewProps) {
  const averageProgress = Math.round(
    agents.reduce((acc, agent) => acc + agent.progress, 0) / agents.length
  );

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-5">
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
        <div className="mt-4 flex items-center gap-3">
          <Progress value={averageProgress} className="h-2 flex-1" />
          <span className="text-xs text-muted-foreground">{averageProgress}%</span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="rounded-2xl border border-border/60 bg-background/90 p-5 shadow-sm"
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
            <Progress value={agent.progress} className="mt-3 h-1.5" />
          </div>
        ))}
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
    <div className="rounded-2xl border border-border/60 bg-background/90 p-5 shadow-sm">
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

function MetricPill({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: ElementType;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-3 py-1 text-xs font-medium">
      <Icon className="h-3.5 w-3.5" />
      {label}: {value}
    </span>
  );
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
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  } catch (error) {
    return "just now";
  }
}

function formatMessageTime(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
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
