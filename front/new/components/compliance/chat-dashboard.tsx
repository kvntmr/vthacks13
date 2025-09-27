"use client";

import { formatDistanceToNow } from "date-fns";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileStack,
  Folder,
  Home,
  LayoutGrid,
  List,
  RotateCcw,
  Search,
  Sparkles,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { type ElementType, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types & mock data for the real estate file library
// ---------------------------------------------------------------------------

type NavItem = {
  id: string;
  label: string;
  icon: ElementType;
  children?: { id: string; label: string }[];
};

type RealEstateFile = {
  id: string;
  name: string;
  type: "pdf" | "xlsx" | "doc";
  size: string;
  status: "indexed" | "indexing" | "queued";
  progress?: number;
  updatedAt: string;
};

type UploadTask = {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "complete";
};

const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Home", icon: Home },
  {
    id: "history",
    label: "History",
    icon: ClipboardList,
    children: [
      { id: "history-chats", label: "Chats" },
      { id: "history-reports", label: "Reports" },
      { id: "history-settings", label: "Report Settings" },
    ],
  },
  { id: "file-library", label: "File Library", icon: FileStack },
  { id: "sheets", label: "Sheets", icon: Building2 },
];

const NAV_LABEL_LOOKUP = NAV_ITEMS.reduce<Record<string, string>>(
  (accumulator, item) => {
    accumulator[item.id] = item.label;
    if (item.children) {
      for (const child of item.children) {
        accumulator[child.id] = child.label;
      }
    }
    return accumulator;
  },
  {}
);

const LIBRARY_FILES: RealEstateFile[] = [
  {
    id: "file-1",
    name: "Summary Lease Report.pdf",
    type: "pdf",
    size: "351 KB",
    status: "indexing",
    progress: 96,
    updatedAt: "2024-09-26T09:00:00Z",
  },
  {
    id: "file-2",
    name: "Sector Analysis.pdf",
    type: "pdf",
    size: "1.7 MB",
    status: "indexing",
    progress: 79,
    updatedAt: "2024-09-24T11:10:00Z",
  },
  {
    id: "file-3",
    name: "Offering Memorandum v2.pdf",
    type: "pdf",
    size: "213 KB",
    status: "indexing",
    progress: 80,
    updatedAt: "2024-09-23T16:32:00Z",
  },
  {
    id: "file-4",
    name: "Cash Yield.xlsx",
    type: "xlsx",
    size: "2.4 MB",
    status: "indexing",
    progress: 87,
    updatedAt: "2024-09-25T07:45:00Z",
  },
  {
    id: "file-5",
    name: "ARGUS Assumptions.xlsx",
    type: "xlsx",
    size: "218 KB",
    status: "indexing",
    progress: 82,
    updatedAt: "2024-09-27T13:05:00Z",
  },
  {
    id: "file-6",
    name: "Screening Memo Draft.pdf",
    type: "pdf",
    size: "499 KB",
    status: "indexing",
    progress: 78,
    updatedAt: "2024-09-20T14:50:00Z",
  },
  {
    id: "file-7",
    name: "Model Assumptions.xlsx",
    type: "xlsx",
    size: "1.8 MB",
    status: "indexed",
    updatedAt: "2024-09-18T10:15:00Z",
  },
  {
    id: "file-8",
    name: "Economic Growth.pdf",
    type: "pdf",
    size: "130 KB",
    status: "indexed",
    updatedAt: "2024-09-17T08:05:00Z",
  },
];

const UPLOAD_QUEUE: UploadTask[] = [
  { id: "upload-1", name: "analysis.pdf", progress: 68, status: "uploading" },
  {
    id: "upload-2",
    name: "ARGUS assumptions.pdf",
    progress: 54,
    status: "uploading",
  },
  {
    id: "upload-3",
    name: "cash yield.xlsx",
    progress: 100,
    status: "complete",
  },
  {
    id: "upload-4",
    name: "Economic growth.pdf",
    progress: 33,
    status: "uploading",
  },
];

type LegacyAction = {
  label: string;
  href: string;
  variant?: "default" | "outline";
};

type LegacySectionContent = {
  heading: string;
  description: string;
  actions?: LegacyAction[];
};

const LEGACY_SECTION_CONTENT: Record<string, LegacySectionContent> = {
  home: {
    heading: "Home",
    description: "Workspace overview and deal metrics are in progress.",
  },
  history: {
    heading: "History",
    description:
      "Switch between legacy chats and reports while the new timeline ships.",
  },
  "history-chats": {
    heading: "Chat History",
    description:
      "Access the existing chat workspace until the refreshed history view is ready.",
    actions: [{ label: "Open Legacy Chat", href: "/chat" }],
  },
  "history-reports": {
    heading: "Report History",
    description:
      "Report archives are still available in the legacy experience.",
  },
  "history-settings": {
    heading: "Report Settings",
    description: "Customize report templates in the legacy workspace for now.",
  },
  sheets: {
    heading: "Sheets",
    description:
      "Exports to Google Sheets will return after the layout refresh.",
  },
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ChatDashboard() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeNavId, setActiveNavId] = useState<string>("file-library");
  const [expandedNav, setExpandedNav] = useState<string[]>(["history"]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFiles = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) {
      return LIBRARY_FILES;
    }
    return LIBRARY_FILES.filter((file) =>
      file.name.toLowerCase().includes(normalized)
    );
  }, [searchQuery]);

  const handleToggleSection = (id: string) => {
    setExpandedNav((prev) =>
      prev.includes(id)
        ? prev.filter((section) => section !== id)
        : [...prev, id]
    );
  };

  const renderNavItem = (item: NavItem) => {
    const isActive = activeNavId === item.id;
    const isExpanded = expandedNav.includes(item.id);

    return (
      <div key={item.id}>
        <Button
          className={cn(
            "w-full justify-start gap-3 border border-transparent",
            isActive
              ? "bg-primary text-primary-foreground shadow"
              : "bg-transparent text-muted-foreground hover:bg-muted/60",
            !isSidebarOpen && "justify-center"
          )}
          onClick={() => {
            setActiveNavId(item.id);
            if (item.children) {
              handleToggleSection(item.id);
            }
          }}
          variant={isActive ? "default" : "ghost"}
        >
          <item.icon className="h-4 w-4" />
          {isSidebarOpen && (
            <span className="flex-1 text-left">{item.label}</span>
          )}
          {isSidebarOpen && item.children && (
            <span>{isExpanded ? "−" : "+"}</span>
          )}
        </Button>

        {isSidebarOpen && item.children && isExpanded && (
          <div className="mt-2 space-y-2 pl-6 text-muted-foreground text-sm">
            {item.children.map((child) => (
              <button
                className={cn(
                  "block w-full text-left transition hover:text-foreground",
                  activeNavId === child.id && "font-medium text-foreground"
                )}
                key={child.id}
                onClick={() => setActiveNavId(child.id)}
                type="button"
              >
                {child.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    if (activeNavId === "file-library") {
      return (
        <FileLibraryView
          files={filteredFiles}
          onSearchChange={setSearchQuery}
          onViewModeChange={setViewMode}
          searchQuery={searchQuery}
          viewMode={viewMode}
        />
      );
    }

    const section = LEGACY_SECTION_CONTENT[activeNavId];
    const navLabel = NAV_LABEL_LOOKUP[activeNavId];
    const heading = section?.heading ?? navLabel ?? "Workspace";
    const description =
      section?.description ??
      "This section is coming soon for the real estate workspace.";
    const actions = section?.actions ?? [];

    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 rounded-3xl border border-border/60 bg-background/95 p-12 text-center text-muted-foreground shadow-sm">
        <div className="space-y-2">
          <h2 className="font-semibold text-foreground text-xl">{heading}</h2>
          <p className="text-sm">{description}</p>
        </div>
        {actions.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-3">
            {actions.map((action) => (
              <Button
                asChild
                key={`${activeNavId}-${action.label}`}
                variant={action.variant ?? "default"}
              >
                <Link href={action.href}>{action.label}</Link>
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-muted/10 text-foreground">
      {/* Desktop navigation */}
      <aside
        className={cn(
          "hidden flex-col border-border/60 border-r bg-background/95 transition-all duration-200 lg:flex",
          isSidebarOpen ? "w-64 px-5 py-6" : "w-16 px-2 py-6"
        )}
      >
        <div className="flex items-center justify-between gap-2 text-primary">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            {isSidebarOpen && (
              <span className="font-semibold text-sm uppercase tracking-[0.25em]">
                Stag
              </span>
            )}
          </div>
          <Button
            className="h-7 w-7 text-muted-foreground"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            size="icon"
            variant="ghost"
          >
            {isSidebarOpen ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>
        {isSidebarOpen && (
          <p className="mt-2 text-muted-foreground/80 text-xs">
            Manage deal books, diligence data, and reports.
          </p>
        )}

        <nav
          className={cn(
            "flex flex-col gap-1 transition-all",
            isSidebarOpen ? "mt-8" : "mt-6 items-center gap-2"
          )}
        >
          {NAV_ITEMS.map((item) => renderNavItem(item))}
        </nav>

        <div className="mt-6 flex-1 space-y-3 overflow-y-auto pr-1">
          {isSidebarOpen && <SidebarSummary />}
        </div>

        <div className="mt-auto text-muted-foreground/70 text-xs">
          {isSidebarOpen
            ? "Select a section to work with real estate data."
            : ""}
        </div>
      </aside>

      {/* Main workspace column */}
      <div className="flex min-h-screen flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between gap-3 border-border/60 border-b bg-background/95 px-4 py-4 lg:hidden">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5" />
            <span className="font-semibold text-sm uppercase tracking-[0.25em]">
              Stag
            </span>
          </div>
          <Select
            onValueChange={(value) => setActiveNavId(value)}
            value={activeNavId}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select view" />
            </SelectTrigger>
            <SelectContent>
              {NAV_ITEMS.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </header>

        <div className="flex flex-1 flex-col gap-6 overflow-hidden px-4 pt-4 pb-8 lg:flex-row lg:gap-8 lg:px-8">
          <div className="flex flex-1 flex-col gap-6 overflow-hidden">
            {renderContent()}
          </div>

          <aside className="w-full shrink-0 space-y-4 rounded-3xl border border-border/60 bg-background/95 px-6 py-6 shadow-sm lg:w-80">
            <UploadQueuePanel tasks={UPLOAD_QUEUE} />
          </aside>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// File Library view
// ---------------------------------------------------------------------------

type FileLibraryViewProps = {
  files: RealEstateFile[];
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
};

function FileLibraryView({
  files,
  viewMode,
  onViewModeChange,
  searchQuery,
  onSearchChange,
}: FileLibraryViewProps) {
  const isGrid = viewMode === "grid";

  return (
    <div className="flex h-full flex-col gap-6 rounded-3xl border border-border/60 bg-background/95 px-6 py-6 shadow-sm">
      <div className="flex flex-col gap-2">
        <h1 className="font-semibold text-2xl text-foreground">File Library</h1>
        <p className="text-muted-foreground text-sm">
          Manage your uploaded deal books and diligence documents.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Home className="h-4 w-4" />
          <span>Home</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="h-9 w-9"
            onClick={() => onViewModeChange("grid")}
            size="icon"
            variant={isGrid ? "default" : "outline"}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            className="h-9 w-9"
            onClick={() => onViewModeChange("list")}
            size="icon"
            variant={isGrid ? "outline" : "default"}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button className="h-9 w-9" size="icon" variant="outline">
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button className="gap-2" variant="outline">
            <Folder className="h-4 w-4" />
            New Folder
          </Button>
          <Button className="gap-2">
            <Upload className="h-4 w-4" />
            Upload Files
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
        <div className="flex flex-1 items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search files..."
            value={searchQuery}
          />
        </div>
        <Separator className="h-6" orientation="vertical" />
        <span className="text-muted-foreground text-xs">
          {files.length} result{files.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full pr-1">
          {files.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-12 text-center text-muted-foreground text-sm">
              <FileStack className="h-10 w-10" />
              <div>
                <p>No files match your current query.</p>
                <p className="text-muted-foreground/80 text-xs">
                  Try adjusting your search terms.
                </p>
              </div>
            </div>
          ) : isGrid ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {files.map((file) => (
                <FileCard file={file} key={file.id} />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {files.map((file) => (
                <FileRow file={file} key={file.id} />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upload queue panel
// ---------------------------------------------------------------------------

type UploadQueuePanelProps = {
  tasks: UploadTask[];
};

function UploadQueuePanel({ tasks }: UploadQueuePanelProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="font-semibold text-muted-foreground text-sm">
          Uploading
        </h2>
        <p className="text-muted-foreground/80 text-xs">
          Monitor ingestion progress for deal books and financial models.
        </p>
      </div>
      <ScrollArea className="h-[320px] pr-2">
        <div className="space-y-3">
          {tasks.map((task) => (
            <div
              className="rounded-2xl border border-border/60 bg-background/95 p-4 text-sm shadow-sm"
              key={task.id}
            >
              <div className="flex items-center justify-between">
                <span className="text-foreground">{task.name}</span>
                <span className="text-muted-foreground text-xs">
                  {task.status === "complete"
                    ? "Complete"
                    : `${task.progress}%`}
                </span>
              </div>
              <Progress
                className={cn(
                  "mt-2 h-1.5",
                  task.status === "complete" ? "bg-emerald-100" : "bg-muted"
                )}
                value={task.progress}
              />
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar summary placeholder (when expanded)
// ---------------------------------------------------------------------------

function SidebarSummary() {
  return (
    <div className="space-y-4 text-muted-foreground text-xs">
      <div>
        <p className="font-semibold text-foreground">Last activity</p>
        <p className="mt-1">
          Screening memo generated for Horizon Logistics (5 min ago).
        </p>
      </div>
      <Separator />
      <div>
        <p className="font-semibold text-foreground">Team</p>
        <p className="mt-1">
          Adam O'Neill and 3 others reviewing deal documents.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// File cards & rows
// ---------------------------------------------------------------------------

type FileCardProps = {
  file: RealEstateFile;
};

function FileCard({ file }: FileCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-border/60 bg-background/95 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileTypeBadge type={file.type} />
            <span className="text-xs">{file.size}</span>
          </div>
          <p className="mt-2 line-clamp-2 font-semibold text-foreground text-sm">
            {file.name}
          </p>
        </div>
        <Button className="text-muted-foreground" size="icon" variant="ghost">
          ...
        </Button>
      </div>
      <div className="space-y-2 text-muted-foreground text-xs">
        <p>Updated {relativeTime(file.updatedAt)}</p>
        {file.status === "indexing" ? (
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">Indexing</span>
              <span>{file.progress}%</span>
            </div>
            <Progress className="mt-2 h-1.5" value={file.progress} />
          </div>
        ) : (
          <Badge className="text-[11px] text-emerald-600" variant="outline">
            Ready for analysis
          </Badge>
        )}
      </div>
    </div>
  );
}

type FileRowProps = {
  file: RealEstateFile;
};

function FileRow({ file }: FileRowProps) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/95 px-4 py-4 shadow-sm">
      <div className="flex items-center gap-3">
        <FileTypeBadge type={file.type} />
        <div>
          <p className="font-semibold text-foreground text-sm">{file.name}</p>
          <p className="text-muted-foreground text-xs">
            {file.size} · Updated {relativeTime(file.updatedAt)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 text-muted-foreground text-xs">
        {file.status === "indexing" ? (
          <div className="flex items-center gap-2">
            <span>Indexing {file.progress}%</span>
            <Progress className="h-1.5 w-24" value={file.progress} />
          </div>
        ) : (
          <Badge className="text-[11px] text-emerald-600" variant="outline">
            Ready
          </Badge>
        )}
        <Button className="text-muted-foreground" size="icon" variant="ghost">
          ...
        </Button>
      </div>
    </div>
  );
}

function FileTypeBadge({ type }: { type: RealEstateFile["type"] }) {
  const label = type === "pdf" ? "PDF" : type === "xlsx" ? "XLSX" : "DOC";
  return (
    <Badge className="text-[11px] uppercase tracking-wide" variant="outline">
      {label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(timestamp: string) {
  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  } catch (_error) {
    return "just now";
  }
}
