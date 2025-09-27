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
import { type ElementType, Fragment, useMemo, useState } from "react";

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

type RealEstateFolder = {
  id: string;
  name: string;
  description?: string;
  files: RealEstateFile[];
  children?: RealEstateFolder[];
};

type BreadcrumbItem = {
  id: string;
  label: string;
};

type FolderStats = {
  total: number;
  indexed: number;
  indexing: number;
  queued: number;
  lastUpdated?: string;
};

type FolderIndexEntry = {
  folder: RealEstateFolder;
  ancestors: BreadcrumbItem[];
};

type LibraryFileRecord = {
  file: RealEstateFile;
  folderId: string;
  folderTrail: BreadcrumbItem[];
};

type UploadQueueItem = {
  id: string;
  name: string;
  progress: number;
  statusLabel: string;
  isComplete: boolean;
  folderName: string;
  folderId: string;
};

function buildFolderIndex(
  root: RealEstateFolder
): Record<string, FolderIndexEntry> {
  const index: Record<string, FolderIndexEntry> = {};

  function traverse(folder: RealEstateFolder, trail: BreadcrumbItem[]) {
    index[folder.id] = { folder, ancestors: trail };

    if (folder.children) {
      for (const child of folder.children) {
        traverse(child, [...trail, { id: folder.id, label: folder.name }]);
      }
    }
  }

  traverse(root, []);

  return index;
}

function flattenLibraryFiles(
  folder: RealEstateFolder,
  trail: BreadcrumbItem[] = []
): LibraryFileRecord[] {
  const currentTrail = [...trail, { id: folder.id, label: folder.name }];
  const currentFiles = folder.files.map((file) => ({
    file,
    folderId: folder.id,
    folderTrail: currentTrail,
  }));

  const childFiles = folder.children?.flatMap((child) =>
    flattenLibraryFiles(child, currentTrail)
  );

  return [...currentFiles, ...(childFiles ?? [])];
}

function collectFolderStats(folder: RealEstateFolder): FolderStats {
  let total = 0;
  let indexed = 0;
  let indexing = 0;
  let queued = 0;
  let latest: Date | undefined;

  function visit(node: RealEstateFolder) {
    for (const file of node.files) {
      total += 1;
      if (file.status === "indexed") {
        indexed += 1;
      }
      if (file.status === "indexing") {
        indexing += 1;
      }
      if (file.status === "queued") {
        queued += 1;
      }

      const updated = new Date(file.updatedAt);
      if (!Number.isNaN(updated.getTime()) && (!latest || updated > latest)) {
        latest = updated;
      }
    }

    if (node.children) {
      for (const child of node.children) {
        visit(child);
      }
    }
  }

  visit(folder);

  return {
    total,
    indexed,
    indexing,
    queued,
    lastUpdated: latest?.toISOString(),
  };
}

function buildUploadQueueItems(
  records: LibraryFileRecord[],
  folderIndex: Record<string, FolderIndexEntry>
): UploadQueueItem[] {
  return records
    .filter((record) => record.file.status !== "indexed")
    .map((record) => {
      const rawProgress = record.file.progress ?? 0;
      const progress = record.file.status === "queued" ? 0 : rawProgress;
      const isComplete = progress >= 100;
      const folderName = folderIndex[record.folderId]?.folder.name ?? "Library";

      let statusLabel = "Queued";
      if (record.file.status === "indexing") {
        statusLabel = isComplete ? "Complete" : `Indexing ${progress}%`;
      }
      if (record.file.status === "indexed") {
        statusLabel = "Complete";
      }

      return {
        id: record.file.id,
        name: record.file.name,
        progress: isComplete ? 100 : progress,
        statusLabel,
        isComplete,
        folderName,
        folderId: record.folderId,
      } satisfies UploadQueueItem;
    })
    .sort((a, b) => {
      if (a.isComplete && !b.isComplete) {
        return 1;
      }
      if (!a.isComplete && b.isComplete) {
        return -1;
      }
      return b.progress - a.progress;
    });
}

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

const FILE_LIBRARY_ROOT: RealEstateFolder = {
  id: "library-root",
  name: "All Files",
  description:
    "Shared diligence documents, underwriting files, and reporting artifacts for active deals.",
  files: [
    {
      id: "file-market-overview",
      name: "Market Overview Q4.pdf",
      type: "pdf",
      size: "2.1 MB",
      status: "indexed",
      updatedAt: "2024-09-27T15:30:00Z",
    },
    {
      id: "file-lease-comps",
      name: "Lease Comps Summary.xlsx",
      type: "xlsx",
      size: "1.2 MB",
      status: "indexing",
      progress: 88,
      updatedAt: "2024-09-28T10:15:00Z",
    },
    {
      id: "file-investment-memo",
      name: "Pipeline Investment Memo.doc",
      type: "doc",
      size: "864 KB",
      status: "queued",
      updatedAt: "2024-09-28T09:45:00Z",
    },
  ],
  children: [
    {
      id: "folder-horizon-logistics",
      name: "Horizon Logistics Park",
      description:
        "Industrial repositioning diligence for Horizon Logistics Park.",
      files: [
        {
          id: "file-horizon-memo",
          name: "Screening Memo Draft.pdf",
          type: "pdf",
          size: "512 KB",
          status: "indexing",
          progress: 72,
          updatedAt: "2024-09-26T17:05:00Z",
        },
        {
          id: "file-horizon-stacking",
          name: "Tenant Stacking Plan.pdf",
          type: "pdf",
          size: "1.1 MB",
          status: "indexing",
          progress: 64,
          updatedAt: "2024-09-25T12:20:00Z",
        },
        {
          id: "file-horizon-utilities",
          name: "Utilities Audit.xlsx",
          type: "xlsx",
          size: "944 KB",
          status: "queued",
          updatedAt: "2024-09-23T08:40:00Z",
        },
      ],
      children: [
        {
          id: "folder-horizon-financials",
          name: "Financial Models",
          description: "ARGUS exports and underwriting versions.",
          files: [
            {
              id: "file-horizon-argus",
              name: "ARGUS Export v3.xlsx",
              type: "xlsx",
              size: "3.4 MB",
              status: "indexing",
              progress: 58,
              updatedAt: "2024-09-27T19:12:00Z",
            },
            {
              id: "file-horizon-sensitivities",
              name: "Sensitivity Scenarios.xlsx",
              type: "xlsx",
              size: "2.6 MB",
              status: "indexed",
              updatedAt: "2024-09-24T14:10:00Z",
            },
          ],
        },
      ],
    },
    {
      id: "folder-suncrest-retail",
      name: "Suncrest Retail",
      description: "Retail center acquisition materials and tenant diligence.",
      files: [
        {
          id: "file-suncrest-anchor",
          name: "Anchor Lease Abstract.pdf",
          type: "pdf",
          size: "1.5 MB",
          status: "indexed",
          updatedAt: "2024-09-22T09:25:00Z",
        },
        {
          id: "file-suncrest-cam",
          name: "CAM Reconciliation.xlsx",
          type: "xlsx",
          size: "1.9 MB",
          status: "indexing",
          progress: 55,
          updatedAt: "2024-09-27T11:03:00Z",
        },
        {
          id: "file-suncrest-traffic",
          name: "Traffic Study 2024.pdf",
          type: "pdf",
          size: "2.0 MB",
          status: "indexed",
          updatedAt: "2024-09-18T16:45:00Z",
        },
      ],
    },
    {
      id: "folder-seaside-multifamily",
      name: "Seaside Multifamily",
      description: "Off-market multifamily diligence and underwriting.",
      files: [
        {
          id: "file-seaside-om",
          name: "Offering Memorandum.pdf",
          type: "pdf",
          size: "4.8 MB",
          status: "indexing",
          progress: 48,
          updatedAt: "2024-09-26T13:32:00Z",
        },
        {
          id: "file-seaside-argus",
          name: "ARGUS Model Export.xlsx",
          type: "xlsx",
          size: "3.1 MB",
          status: "queued",
          updatedAt: "2024-09-25T07:55:00Z",
        },
        {
          id: "file-seaside-notes",
          name: "Inspection Notes.doc",
          type: "doc",
          size: "612 KB",
          status: "indexed",
          updatedAt: "2024-09-24T18:05:00Z",
        },
      ],
    },
  ],
};

const FOLDER_INDEX = buildFolderIndex(FILE_LIBRARY_ROOT);
const ALL_LIBRARY_FILES = flattenLibraryFiles(FILE_LIBRARY_ROOT);
const INITIAL_UPLOAD_QUEUE = buildUploadQueueItems(
  ALL_LIBRARY_FILES,
  FOLDER_INDEX
);

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
  const [activeFolderId, setActiveFolderId] = useState<string>(
    FILE_LIBRARY_ROOT.id
  );

  const activeFolderEntry =
    FOLDER_INDEX[activeFolderId] ?? FOLDER_INDEX[FILE_LIBRARY_ROOT.id];

  const breadcrumbs = useMemo(() => {
    return [
      ...activeFolderEntry.ancestors,
      { id: activeFolderEntry.folder.id, label: activeFolderEntry.folder.name },
    ];
  }, [activeFolderEntry]);

  const folderStats = useMemo(() => {
    return collectFolderStats(activeFolderEntry.folder);
  }, [activeFolderEntry]);

  const filteredFiles = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    const baseFiles = activeFolderEntry.folder.files;
    if (!normalized) {
      return baseFiles;
    }
    return baseFiles.filter((file) =>
      file.name.toLowerCase().includes(normalized)
    );
  }, [searchQuery, activeFolderEntry]);

  const childFolders = searchQuery.trim()
    ? []
    : (activeFolderEntry.folder.children ?? []);

  const uploadQueue = useMemo(() => {
    if (activeFolderId === FILE_LIBRARY_ROOT.id) {
      return INITIAL_UPLOAD_QUEUE;
    }

    return INITIAL_UPLOAD_QUEUE.filter((item) => {
      if (item.folderId === activeFolderId) {
        return true;
      }

      const ancestors = FOLDER_INDEX[item.folderId]?.ancestors ?? [];
      return ancestors.some((crumb) => crumb.id === activeFolderId);
    });
  }, [activeFolderId]);

  const activeFolder = activeFolderEntry.folder;
  const isSearching = searchQuery.trim().length > 0;

  const handleOpenFolder = (folderId: string) => {
    setActiveFolderId(folderId);
    setSearchQuery("");
  };

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
            if (item.id === "file-library") {
              setActiveFolderId(FILE_LIBRARY_ROOT.id);
              setSearchQuery("");
            }
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
          activeFolder={activeFolder}
          breadcrumbs={breadcrumbs}
          files={filteredFiles}
          folderStats={folderStats}
          folders={childFolders}
          isSearching={isSearching}
          onBreadcrumbSelect={handleOpenFolder}
          onFolderOpen={handleOpenFolder}
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
            onValueChange={(value) => {
              setActiveNavId(value);
              if (value === "file-library") {
                handleOpenFolder(FILE_LIBRARY_ROOT.id);
              }
            }}
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
            <UploadQueuePanel tasks={uploadQueue} />
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
  activeFolder: RealEstateFolder;
  breadcrumbs: BreadcrumbItem[];
  files: RealEstateFile[];
  folderStats: FolderStats;
  folders: RealEstateFolder[];
  isSearching: boolean;
  onBreadcrumbSelect: (id: string) => void;
  onFolderOpen: (id: string) => void;
  onSearchChange: (value: string) => void;
  onViewModeChange: (mode: "grid" | "list") => void;
  searchQuery: string;
  viewMode: "grid" | "list";
};

function FileLibraryView({
  activeFolder,
  breadcrumbs,
  files,
  folderStats,
  folders,
  isSearching,
  onBreadcrumbSelect,
  onFolderOpen,
  onSearchChange,
  onViewModeChange,
  searchQuery,
  viewMode,
}: FileLibraryViewProps) {
  const isGrid = viewMode === "grid";
  const folderSummaries = isSearching
    ? []
    : folders.map((folder) => ({
        folder,
        stats: collectFolderStats(folder),
      }));
  const hasFolders = folderSummaries.length > 0;
  const hasFiles = files.length > 0;
  const hasContent = hasFolders || hasFiles;
  const resultLabel = `${files.length} result${files.length === 1 ? "" : "s"}`;

  const headerMeta = [
    `${folderStats.total} file${folderStats.total === 1 ? "" : "s"}`,
  ];
  if (folderStats.indexed) {
    headerMeta.push(`${folderStats.indexed} ready`);
  }
  if (folderStats.indexing) {
    headerMeta.push(`${folderStats.indexing} indexing`);
  }
  if (folderStats.queued) {
    headerMeta.push(`${folderStats.queued} queued`);
  }
  if (folderStats.lastUpdated) {
    headerMeta.push(`Updated ${relativeTime(folderStats.lastUpdated)}`);
  }

  return (
    <div className="flex h-full flex-col gap-6 rounded-3xl border border-border/60 bg-background/95 px-6 py-6 shadow-sm">
      <div className="flex flex-col gap-3">
        <BreadcrumbTrail items={breadcrumbs} onSelect={onBreadcrumbSelect} />
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-semibold text-2xl text-foreground">
              {activeFolder.name}
            </h1>
          </div>
          {activeFolder.description ? (
            <p className="text-muted-foreground text-sm">
              {activeFolder.description}
            </p>
          ) : null}
          {headerMeta.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
              {headerMeta.map((item, index) => (
                <Fragment key={item}>
                  {index > 0 ? (
                    <span
                      aria-hidden="true"
                      className="text-muted-foreground/50"
                    >
                      |
                    </span>
                  ) : null}
                  <span>{item}</span>
                </Fragment>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-1 items-center gap-2 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search files..."
            value={searchQuery}
          />
          <Separator className="h-6" orientation="vertical" />
          <span className="text-muted-foreground text-xs">{resultLabel}</span>
        </div>
        <div className="flex items-center gap-2">
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

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full pr-1">
          {hasContent ? (
            isGrid ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {folderSummaries.map((entry) => (
                  <FolderCard
                    folder={entry.folder}
                    key={entry.folder.id}
                    onOpen={onFolderOpen}
                    stats={entry.stats}
                  />
                ))}
                {files.map((file) => (
                  <FileCard file={file} key={file.id} />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {folderSummaries.map((entry) => (
                  <FolderRow
                    folder={entry.folder}
                    key={entry.folder.id}
                    onOpen={onFolderOpen}
                    stats={entry.stats}
                  />
                ))}
                {files.map((file) => (
                  <FileRow file={file} key={file.id} />
                ))}
              </div>
            )
          ) : isSearching ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-12 text-center text-muted-foreground text-sm">
              <FileStack className="h-10 w-10" />
              <div>
                <p>No files match your search.</p>
                <p className="text-muted-foreground/80 text-xs">
                  Try different keywords or clear the filter.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-12 text-center text-muted-foreground text-sm">
              <Folder className="h-10 w-10" />
              <div>
                <p>This folder is empty.</p>
                <p className="text-muted-foreground/80 text-xs">
                  Upload files or create a subfolder to organize documents.
                </p>
              </div>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

type BreadcrumbTrailProps = {
  items: BreadcrumbItem[];
  onSelect: (id: string) => void;
};

function BreadcrumbTrail({ items, onSelect }: BreadcrumbTrailProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex flex-wrap items-center gap-1 text-muted-foreground text-sm"
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        if (isLast) {
          return (
            <span
              aria-current="page"
              className="font-medium text-foreground"
              key={item.id}
            >
              {item.label}
            </span>
          );
        }

        return (
          <span className="flex items-center gap-1" key={item.id}>
            <button
              className="rounded-md px-1 py-0.5 text-muted-foreground transition hover:text-foreground"
              onClick={() => onSelect(item.id)}
              type="button"
            >
              {item.label}
            </button>
            <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
          </span>
        );
      })}
    </nav>
  );
}

type FolderDisplayProps = {
  folder: RealEstateFolder;
  stats: FolderStats;
  onOpen: (id: string) => void;
};

function FolderCard({ folder, stats, onOpen }: FolderDisplayProps) {
  const details = getFolderMeta(stats);

  return (
    <button
      className="flex h-full flex-col gap-3 rounded-3xl border border-border/60 bg-background/95 p-5 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      onClick={() => onOpen(folder.id)}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/30 text-primary">
            <Folder className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm">
              {folder.name}
            </p>
            {folder.description ? (
              <p className="text-muted-foreground/80 text-xs">
                {folder.description}
              </p>
            ) : null}
          </div>
        </div>
        <ChevronRight
          aria-hidden="true"
          className="h-4 w-4 text-muted-foreground"
        />
      </div>
      {details.length > 0 ? (
        <p className="text-muted-foreground/80 text-xs">
          {details.join(" | ")}
        </p>
      ) : null}
    </button>
  );
}

function FolderRow({ folder, stats, onOpen }: FolderDisplayProps) {
  const details = getFolderMeta(stats);

  return (
    <button
      className="flex w-full items-center justify-between rounded-2xl border border-border/60 bg-background/95 px-4 py-4 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      onClick={() => onOpen(folder.id)}
      type="button"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/30 text-primary">
          <Folder className="h-4 w-4" />
        </div>
        <div>
          <p className="font-semibold text-foreground text-sm">{folder.name}</p>
          {folder.description ? (
            <p className="text-muted-foreground/80 text-xs">
              {folder.description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-3 text-muted-foreground text-xs">
        {details.length > 0 ? <span>{details.join(" | ")}</span> : null}
        <ChevronRight aria-hidden="true" className="h-4 w-4" />
      </div>
    </button>
  );
}

function getFolderMeta(stats: FolderStats) {
  const summary: string[] = [];
  summary.push(`${stats.total} file${stats.total === 1 ? "" : "s"}`);
  if (stats.indexed) {
    summary.push(`${stats.indexed} ready`);
  }
  if (stats.indexing) {
    summary.push(`${stats.indexing} indexing`);
  }
  if (stats.queued) {
    summary.push(`${stats.queued} queued`);
  }
  if (stats.lastUpdated) {
    summary.push(`Updated ${relativeTime(stats.lastUpdated)}`);
  }
  return summary;
}

// ---------------------------------------------------------------------------
// Upload queue panel
// ---------------------------------------------------------------------------

type UploadQueuePanelProps = {
  tasks: UploadQueueItem[];
};

function UploadQueuePanel({ tasks }: UploadQueuePanelProps) {
  const hasItems = tasks.length > 0;

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
      {hasItems ? (
        <ScrollArea className="h-[320px] pr-2">
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                className="space-y-2 rounded-2xl border border-border/60 bg-background/95 p-4 text-sm shadow-sm"
                key={task.id}
              >
                <div className="flex items-center justify-between">
                  <span className="text-foreground">{task.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {task.statusLabel}
                  </span>
                </div>
                <p className="text-muted-foreground/80 text-xs">
                  {task.folderName}
                </p>
                <Progress
                  className={cn(
                    "mt-2 h-1.5",
                    task.isComplete ? "bg-emerald-100" : "bg-muted"
                  )}
                  value={task.progress}
                />
              </div>
            ))}
          </div>
        </ScrollArea>
      ) : (
        <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-6 text-center text-muted-foreground text-sm">
          All documents are indexed.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar summary placeholder (when expanded)
// ---------------------------------------------------------------------------
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
