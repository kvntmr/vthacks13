"use client";

import { formatDistanceToNow } from "date-fns";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileStack,
  FileText,
  Folder,
  Home,
  LayoutGrid,
  List,
  MessageSquare,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Upload,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Minimize2,
  Maximize2,
  ChevronDown,
  ChevronUp,
  Plus,
} from "lucide-react";
import { type ElementType, Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import SpreadsheetEditor from "@/components/spreadsheet";
import React from "react";
import { backendAPI } from "@/lib/api/backend";
import { toast } from "sonner";

import { Spreadsheet, Worksheet, jspreadsheet } from "@jspreadsheet-ce/react";
import "jsuites/dist/jsuites.css";
import "jspreadsheet-ce/dist/jspreadsheet.css";
import "handsontable/dist/handsontable.full.min.css";

// ---------------------------------------------------------------------------
// Types & mock data for the real estate file library
// ---------------------------------------------------------------------------

type NavItem = {
  id: string;
  label: string;
  icon: ElementType;
  children?: { id: string; label: string; icon: ElementType }[];
};

type RealEstateFile = {
  id: string;
  name: string;
  type: "pdf" | "xlsx" | "doc" | "csv";
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

// Upload Manager Types
type UploadStatus = 'uploading' | 'completed' | 'error' | 'cancelled';

type UploadItem = {
  id: string;
  file: File;
  progress: number;
  status: UploadStatus;
  targetFolderId: string;
  addToLibrary: boolean;
  error?: string;
};

type UploadManagerState = {
  uploads: UploadItem[];
  isMinimized: boolean;
  isVisible: boolean;
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




const FILE_LIBRARY_ROOT: RealEstateFolder = {
  id: "library-root",
  name: "All Files",
  description: "Uploaded documents available to the workspace.",
  files: [],
  children: [],
};
type PipelineMetric = {
  id: string;
  label: string;
  value: string;
  delta: string;
};

type DealSummary = {
  id: string;
  name: string;
  market: string;
  occupancy: string;
  status: string;
  nextAction: string;
  folderId: string;
};

type ActivityItem = {
  id: string;
  title: string;
  timestamp: string;
  summary: string;
  actionLabel?: string;
  actionNavId?: string;
  actionFolderId?: string;
};

type ConversationMessage = {
  id: string;
  author: string;
  role: "analyst" | "stag";
  timestamp: string;
  content: string;
};

type MemoSection = {
  id: string;
  title: string;
  bullets: string[];
};

type SheetsExport = {
  id: string;
  name: string;
  lastSynced: string;
  status: "synced" | "pending" | "error";
  owner: string;
};

type ReportPreference = {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
};

const HOME_METRICS: PipelineMetric[] = [
  {
    id: "deals",
    label: "Active deals",
    value: "8",
    delta: "+2 vs last week",
  },
  {
    id: "documents",
    label: "Documents ingested",
    value: "146",
    delta: "+18 this week",
  },
  {
    id: "tasks",
    label: "Open tasks",
    value: "5",
    delta: "3 due today",
  },
];

const HOME_DEALS: DealSummary[] = [
  {
    id: "deal-horizon",
    name: "Horizon Logistics Park",
    market: "Dallas, TX",
    occupancy: "81%",
    status: "Screening memo in review",
    nextAction: "Collect updated rent roll",
    folderId: FILE_LIBRARY_ROOT.id,
  },
  {
    id: "deal-suncrest",
    name: "Suncrest Retail",
    market: "Phoenix, AZ",
    occupancy: "92%",
    status: "Tenant diligence underway",
    nextAction: "Confirm CAM reconciliation",
    folderId: FILE_LIBRARY_ROOT.id,
  },
  {
    id: "deal-seaside",
    name: "Seaside Multifamily",
    market: "San Diego, CA",
    occupancy: "93%",
    status: "Underwriting updates",
    nextAction: "Refresh ARGUS sensitivities",
    folderId: FILE_LIBRARY_ROOT.id,
  },
];

const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Overview", icon: Home },
  { id: "chat", label: "Chat", icon: MessageSquare },
  {
    id: "reports",
    label: "Reports",
    icon: ClipboardList,
    children: [
      ...HOME_DEALS.map(deal => ({
        id: `memo-${deal.id}`,
        label: `${deal.name} Memo`,
        icon: FileText,
      })),
      { id: "history-settings", label: "Memo controls", icon: Settings },
    ],
  },
  { id: "file-library", label: "Deal files", icon: FileStack },
  { id: "sheets", label: "Sheets sync", icon: Building2 },
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

const HOME_ACTIVITY: ActivityItem[] = [
  {
    id: "timeline-memo",
    title: "Screening memo delivered",
    timestamp: "Today · 10:12 AM",
    summary: "Shared to deal team and staged for IC review.",
    actionLabel: "Open memo",
    actionNavId: "history-reports",
  },
  {
    id: "timeline-chat",
    title: "Conversation: rent roll QA",
    timestamp: "Yesterday · 4:36 PM",
    summary: "Analyst confirmed missing suite details for Horizon Logistics.",
    actionLabel: "View chat",
    actionNavId: "history-chats",
  },
  {
    id: "timeline-sheet",
    title: "Sheets export refreshed",
    timestamp: "Yesterday · 9:05 AM",
    summary: "Updated waterfall assumptions synced to 'Deal Scorecard'.",
    actionLabel: "Open Sheets",
    actionNavId: "sheets",
  },
]

const HISTORY_TIMELINE: ActivityItem[] = [
  {
    id: "history-memo-1",
    title: "Screening memo delivered",
    timestamp: "Today · 10:12 AM",
    summary: "Shared to deal team and staged for IC review.",
    actionLabel: "Open memo",
    actionNavId: "history-reports",
  },
  {
    id: "history-chat-1",
    title: "Conversation: rent roll QA",
    timestamp: "Yesterday · 4:36 PM",
    summary: "Analyst confirmed missing suite details for Horizon Logistics.",
    actionLabel: "View chat",
    actionNavId: "history-chats",
  },
  {
    id: "history-sheet-1",
    title: "Sheets export refreshed",
    timestamp: "Yesterday · 9:05 AM",
    summary: "Updated waterfall assumptions synced to 'Deal Scorecard'.",
    actionLabel: "Open Sheets",
    actionNavId: "sheets",
  },
  {
    id: "history-memo-2",
    title: "Previous screening memo",
    timestamp: "Last week · 2:15 PM",
    summary: "Suncrest Retail memo shared with underwriting team.",
    actionLabel: "View memo",
    actionNavId: "memo-deal-suncrest",
  },
  {
    id: "history-chat-2",
    title: "Conversation: tenant analysis",
    timestamp: "Last week · 11:30 AM",
    summary: "Reviewed anchor lease terms and CAM reconciliation.",
    actionLabel: "View chat",
    actionNavId: "history-chats",
  },
];

//hardcoded conversation messages for the chat view
const CONVERSATION_MESSAGES: ConversationMessage[] = [
  {
    id: "msg-analyst-1",
    author: "Avery Chen",
    role: "analyst",
    timestamp: "Today · 9:18 AM",
    content:
      "Flagging the 2025 rollover: Redwood's renewal isn't firm yet. Can you thread the risk callout into the memo summary?",
  },
  {
    id: "msg-stag-1",
    author: "Stag",
    role: "stag",
    timestamp: "Today · 9:19 AM",
    content:
      "Added a risk paragraph with the rollover schedule and linked the rent roll excerpt. I also refreshed the supporting comps.",
  },
  {
    id: "msg-analyst-2",
    author: "Avery Chen",
    role: "analyst",
    timestamp: "Today · 9:24 AM",
    content:
      "Great—push the updated IRR sensitivity to the Sheets sync and keep the memo tagged as IC ready once the export lands.",
  },
  {
    id: "msg-stag-2",
    author: "Stag",
    role: "stag",
    timestamp: "Today · 9:25 AM",
    content:
      "Sheets sync is running now. Levered IRR at 13.2% is published on the 'Memo Summary' tab and memo status flipped to IC ready.",
  },
  {
    id: "msg-analyst-3",
    author: "Avery Chen",
    role: "analyst",
    timestamp: "Today · 9:27 AM",
    content:
      "Let's also grab the updated utility audit before IC. Can you set a reminder inside memo controls?",
  },
  {
    id: "msg-stag-3",
    author: "Stag",
    role: "stag",
    timestamp: "Today · 9:28 AM",
    content:
      "Reminder scheduled for Thursday · 2:00 PM and pinned under memo controls with a link back to the diligence folder.",
  },
];

const MEMO_SECTIONS: MemoSection[] = [
  {
    id: "section-thesis",
    title: "Investment thesis",
    bullets: [
      "Horizon Logistics Park pricing at $128M, going-in cap 7.1% with upside via Building B re-lease.",
      "Dallas infill submarket vacancy at 4.8% with 2.1M SF trailing absorption supporting rent growth.",
      "Tenant mix anchored by FedEx and OmniCable with Redwood rollover negotiated via LOI in progress.",
    ],
  },
  {
    id: "section-financials",
    title: "Financial focus",
    bullets: [
      "Base case levered IRR 13.2%; downside 10.4% assuming 50 bps exit cap expansion.",
      "ARGUS v4 export reflects CAM reimbursement clean-up and refreshed utility assumptions.",
      "Waterfall scenarios synced to Sheets capture upside/downside KPIs for IC review.",
    ],
  },
  {
    id: "section-risks",
    title: "Risks & mitigations",
    bullets: [
      "Renewal concentration: 33% of NOI from Redwood Logistics; mitigation via LOI with rate step-downs.",
      "Deferred capital: $1.4M HVAC replacements staged in year one with contingency reserve.",
      "Speculative backfill risk offset by signed LOIs covering 60% of near-term rollover.",
    ],
  },
];

const CONVERSATION_ACTIONS: ActivityItem[] = [
  {
    id: "action-export",
    title: "Publish memo summary to Sheets",
    timestamp: "",
    summary:
      "Sync the IC-ready narrative and KPI snapshot to the shared workbook for leadership.",
    actionLabel: "Sync now",
    actionNavId: "sheets",
  },
  {
    id: "action-folder",
    title: "Open diligence source folder",
    timestamp: "",
    summary: "Review rent roll uploads, stacking plan renders, and refreshed comps.",
    actionLabel: "View files",
    actionNavId: "file-library",
    actionFolderId: FILE_LIBRARY_ROOT.id,
  },
  {
    id: "action-controls",
    title: "Review memo controls",
    timestamp: "",
    summary:
      "Confirm reminders, risk toggles, and distribution list before the IC session.",
    actionLabel: "Open memo controls",
    actionNavId: "history-settings",
  },
];

const REPORT_SECTIONS: MemoSection[] = [
  {
    id: "memo-overview",
    title: "Executive highlights",
    bullets: [
      "IC-ready memo validated against the September rent roll and refreshed ARGUS export.",
      "Building B rollover scenario locked with $22 NNN re-lease and 6-month TI package.",
      "Capital program budgets $1.4M HVAC scope and keeps year-two cash-on-cash at 8.2%.",
    ],
  },
  {
    id: "memo-operations",
    title: "Operations snapshot",
    bullets: [
      "Occupancy recovers to 92% within nine months supported by signed LOIs.",
      "Expense growth normalized at 3% with CAM recapture uplift embedded in NOI forecast.",
      "Pending ProLogis utility audit tracked via memo controls and referenced in assumptions.",
    ],
  },
  {
    id: "memo-tasks",
    title: "Next steps",
    bullets: [
      "Finalize IC deck export and circulate by Thursday 2 PM.",
      "Collect updated utility audit and attach before distribution.",
      "Confirm Redwood renewal terms ahead of investment committee review.",
    ],
  },
];

const SUNCREST_REPORT_SECTIONS: MemoSection[] = [
  {
    id: "suncrest-overview",
    title: "Executive highlights",
    bullets: [
      "Suncrest Retail pricing at $45M, going-in cap 6.8% with strong tenant concentration.",
      "Phoenix submarket vacancy at 3.2% with limited new supply supporting rent growth.",
      "Anchor tenant mix led by national retailers with staggered lease maturities.",
    ],
  },
  {
    id: "suncrest-operations",
    title: "Operations snapshot",
    bullets: [
      "Occupancy stabilized at 94% with minimal rollover risk in near term.",
      "Expense ratio at 12.5% with recent CAM reconciliation reducing landlord expenses.",
      "Property management contract renewed with performance incentives.",
    ],
  },
  {
    id: "suncrest-tasks",
    title: "Next steps",
    bullets: [
      "Complete tenant estoppel certificates for anchor spaces.",
      "Review 2025 budget assumptions with property manager.",
      "Schedule property inspection ahead of year-end reporting.",
    ],
  },
];

const SEASIDE_REPORT_SECTIONS: MemoSection[] = [
  {
    id: "seaside-overview",
    title: "Executive highlights",
    bullets: [
      "Seaside Multifamily acquisition at $185M, going-in cap 5.2% with value-add potential.",
      "San Diego coastal submarket showing 2.1% vacancy with strong rental demand.",
      "88-unit portfolio with mix of one and two-bedroom units averaging 850 SF.",
    ],
  },
  {
    id: "seaside-operations",
    title: "Operations snapshot",
    bullets: [
      "Occupancy at 93% with waiting list for move-ins supporting rent growth.",
      "Operating expenses at $8,450 per unit with recent utility cost reductions.",
      "Capital improvement program focused on unit upgrades and common area enhancements.",
    ],
  },
  {
    id: "seaside-tasks",
    title: "Next steps",
    bullets: [
      "Complete unit renovation schedule for Q1 2025.",
      "Negotiate service contracts for HVAC and landscaping.",
      "Update market rent analysis with recent comparable data.",
    ],
  },
];

const SHEETS_EXPORTS: SheetsExport[] = [
  {
    id: "sheet-memo",
    name: "Memo Summary (IC)",
    lastSynced: "Today · 9:25 AM",
    status: "synced",
    owner: "Stag",
  },
  {
    id: "sheet-scorecard",
    name: "Deal Scorecard",
    lastSynced: "Today · 9:10 AM",
    status: "synced",
    owner: "Avery Chen",
  },
  {
    id: "sheet-sensitivity",
    name: "Sensitivity Tracker",
    lastSynced: "Today · 9:24 AM",
    status: "pending",
    owner: "Priya Patel",
  },
];

const REPORT_SETTINGS: ReportPreference[] = [
  {
    id: "pref-ic",
    label: "Tag memo as IC ready on publish",
    description:
      "Automatically flip status and alert the deal team once exports complete.",
    enabled: true,
  },
  {
    id: "pref-rent-roll",
    label: "Attach rent roll variance appendix",
    description:
      "Bundle CAM variance and rent roll summary tabs with the generated memo PDF.",
    enabled: true,
  },
  {
    id: "pref-waterfall",
    label: "Sync waterfall sensitivities",
    description:
      "Push IRR, equity multiple, and downside scenarios to the Sheets sync on publish.",
    enabled: true,
  },
  {
    id: "pref-reminders",
    label: "Schedule diligence reminders",
    description:
      "Track utility audits and tenant deliverables alongside memo controls.",
    enabled: false,
  },
];

// ---------------------------------------------------------------------------
// Upload Manager Component
// ---------------------------------------------------------------------------

type UploadManagerProps = {
  uploads: UploadItem[];
  isMinimized: boolean;
  isVisible: boolean;
  onCancel: (uploadId: string) => void;
  onMinimize: () => void;
  onRemove: (uploadId: string) => void;
  onRetry: (uploadId: string) => void;
};

function UploadManager({
  uploads,
  isMinimized,
  isVisible,
  onCancel,
  onMinimize,
  onRemove,
  onRetry,
}: UploadManagerProps) {
  const activeUploads = uploads.filter(u => u.status === 'uploading');
  const completedUploads = uploads.filter(u => u.status === 'completed');
  const errorUploads = uploads.filter(u => u.status === 'error');
  const cancelledUploads = uploads.filter(u => u.status === 'cancelled');

  const totalUploads = uploads.length;
  const completedCount = completedUploads.length + errorUploads.length + cancelledUploads.length;

  const getStatusIcon = (status: UploadStatus) => {
    switch (status) {
      case 'uploading':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        return <X className="h-4 w-4 text-gray-500" />;
      default:
        return null;
    }
  };

  const getHeaderText = () => {
    if (activeUploads.length > 0) {
      return `Uploading... ${completedCount} of ${totalUploads} files`;
    }
    return 'All uploads complete';
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isMinimized ? (
        // Minimized pill view
        <div className="flex items-center gap-2 rounded-full bg-background border border-border/60 px-4 py-2 shadow-lg">
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          <span className="text-sm font-medium">
            {activeUploads.length > 0
              ? `Uploading ${activeUploads.length} file${activeUploads.length === 1 ? '' : 's'}`
              : 'Uploads complete'
            }
          </span>
          <Button
            onClick={onMinimize}
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
          >
            <Maximize2 className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        // Full drawer view
        <div className="w-96 max-h-96 bg-background border border-border/60 rounded-lg shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border/60">
            <h3 className="font-semibold text-sm">{getHeaderText()}</h3>
            <Button
              onClick={onMinimize}
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
            >
              <Minimize2 className="h-3 w-3" />
            </Button>
          </div>

          {/* Upload list */}
          <div className="max-h-80 overflow-y-auto">
            {uploads.map((upload) => (
              <div
                key={upload.id}
                className="flex items-center gap-3 p-3 border-b border-border/20 last:border-b-0"
              >
                {/* Status icon */}
                <div className="flex-shrink-0">
                  {getStatusIcon(upload.status)}
                </div>

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" title={upload.file.name}>
                    {upload.file.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Progress
                      value={upload.progress}
                      className="flex-1 h-1"
                    />
                    <span className="text-xs text-muted-foreground">
                      {upload.progress.toFixed(0)}%
                    </span>
                  </div>
                  {upload.error && (
                    <p className="text-xs text-red-500 mt-1">{upload.error}</p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1">
                  {upload.status === 'uploading' && (
                    <Button
                      onClick={() => onCancel(upload.id)}
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                      title="Cancel upload"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                  {upload.status === 'error' && (
                    <Button
                      onClick={() => onRetry(upload.id)}
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                      title="Retry upload"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  )}
                  {(upload.status === 'completed' || upload.status === 'error' || upload.status === 'cancelled') && (
                    <Button
                      onClick={() => onRemove(upload.id)}
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                      title="Remove from list"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ChatDashboard() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeNavId, setActiveNavId] = useState<string>("home");
  const [expandedNav, setExpandedNav] = useState<string[]>(["history"]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFolderId, setActiveFolderId] = useState<string>(
    FILE_LIBRARY_ROOT.id
  );
  const [fileLibraryData, setFileLibraryData] = useState<RealEstateFolder>(FILE_LIBRARY_ROOT);
  const [folderIndex, setFolderIndex] = useState<Record<string, FolderIndexEntry>>(() => buildFolderIndex(FILE_LIBRARY_ROOT));
  const [uploadManager, setUploadManager] = useState<UploadManagerState>({
    uploads: [],
    isMinimized: false,
    isVisible: false,
  });
  const uploadControllersRef = useRef<Record<string, AbortController>>({});
  const [fileToLoad, setFileToLoad] = useState<{
    id: string;
    name: string;
    type: string;
  } | undefined>(undefined);

  const loadFileLibrary = useCallback(async () => {
    try {
      const response = await fetch("/api/files/list", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Failed to load file library (${response.status})`);
      }
      const data = await response.json();
      if (data?.folder) {
        setFileLibraryData(data.folder);
      }
    } catch (error) {
      console.error("Failed to load uploaded files:", error);
    }
  }, []);

  useEffect(() => {
    loadFileLibrary();
  }, [loadFileLibrary]);

  // Update folder index when data changes
  useEffect(() => {
    setFolderIndex(buildFolderIndex(fileLibraryData));
  }, [fileLibraryData]);

  useEffect(() => {
    if (!folderIndex[activeFolderId] && fileLibraryData?.id) {
      setActiveFolderId(fileLibraryData.id);
    }
  }, [folderIndex, activeFolderId, fileLibraryData.id]);

  const activeFolderEntry =
    folderIndex[activeFolderId] ?? folderIndex[fileLibraryData.id];

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

  // Upload Manager Functions
  const scheduleUploadManagerCleanup = () => {
    setTimeout(() => {
      setUploadManager(prev => {
        const hasActiveUploads = prev.uploads.some(u => u.status === 'uploading');
        if (!hasActiveUploads) {
          return { ...prev, isVisible: false };
        }
        return prev;
      });
    }, 3000);
  };

  const startUploads = (files: File[], options?: { addToLibrary?: boolean }) => {
    if (files.length === 0) return;

    const addToLibrary = options?.addToLibrary ?? true;
    const timestamp = Date.now();

    const newUploads: UploadItem[] = files.map((file, index) => ({
      id: `upload-${timestamp}-${index}-${Math.random().toString(36).slice(2, 9)}`,
      file,
      progress: 0,
      status: 'uploading' as const,
      targetFolderId: activeFolderId,
      addToLibrary,
    }));

    setUploadManager(prev => ({
      ...prev,
      uploads: [...prev.uploads, ...newUploads],
      isVisible: true,
      isMinimized: false,
    }));

    newUploads.forEach(upload => {
      const controller = new AbortController();
      uploadControllersRef.current[upload.id] = controller;
      uploadFileToServer(upload, controller);
    });
  };

  async function uploadFileToServer(upload: UploadItem, controller: AbortController) {
    setUploadManager(prev => ({
      ...prev,
      uploads: prev.uploads.map(u =>
        u.id === upload.id
          ? { ...u, progress: 10, error: undefined }
          : u
      ),
    }));

    const formData = new FormData();
    formData.append('file', upload.file);

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorMessage = await extractErrorMessage(response);
        setUploadManager(prev => ({
          ...prev,
          uploads: prev.uploads.map(u =>
            u.id === upload.id
              ? { ...u, progress: 0, status: 'error', error: errorMessage }
              : u
          ),
        }));
        return;
      }

      const data = await response.json();

      if (!data?.success) {
        const failureMessage = data?.error ? String(data.error) : 'Upload failed';
        setUploadManager(prev => ({
          ...prev,
          uploads: prev.uploads.map(u =>
            u.id === upload.id
              ? { ...u, progress: 0, status: 'error', error: failureMessage }
              : u
          ),
        }));
        return;
      }

      setUploadManager(prev => ({
        ...prev,
        uploads: prev.uploads.map(u =>
          u.id === upload.id
            ? { ...u, progress: 100, status: 'completed', error: undefined }
            : u
        ),
      }));

      await loadFileLibrary();
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === 'AbortError';

      setUploadManager(prev => ({
        ...prev,
        uploads: prev.uploads.map(u =>
          u.id === upload.id
            ? {
                ...u,
                progress: 0,
                status: isAbort ? 'cancelled' : 'error',
                error: isAbort ? undefined : (error instanceof Error ? error.message : 'Upload failed'),
              }
            : u
        ),
      }));

      if (!isAbort) {
        console.error('Upload failed:', error);
      }
    } finally {
      delete uploadControllersRef.current[upload.id];
      scheduleUploadManagerCleanup();
    }
  }

  async function extractErrorMessage(response: Response): Promise<string> {
    try {
      const parsed = await response.clone().json();
      if (parsed && typeof parsed === 'object' && 'error' in parsed) {
        const message = (parsed as Record<string, unknown>).error;
        if (typeof message === 'string') return message;
        return JSON.stringify(message);
      }
    } catch (_error) {
      // fall through to text parsing below
    }

    try {
      const text = await response.text();
      if (text) return text;
    } catch (_error) {
      // ignore
    }

    return response.statusText || 'Upload failed';
  }

  const cancelUpload = (uploadId: string) => {
    const controller = uploadControllersRef.current[uploadId];
    if (controller) {
      controller.abort();
    }

    setUploadManager(prev => ({
      ...prev,
      uploads: prev.uploads.map(u =>
        u.id === uploadId ? { ...u, status: 'cancelled', progress: 0, error: undefined } : u
      ),
    }));

    scheduleUploadManagerCleanup();
  };

  const retryUpload = (uploadId: string) => {
    const uploadToRetry = uploadManager.uploads.find(u => u.id === uploadId);
    if (!uploadToRetry) return;

    const controller = new AbortController();
    uploadControllersRef.current[uploadId] = controller;

    const refreshedUpload: UploadItem = {
      ...uploadToRetry,
      progress: 0,
      status: 'uploading',
      error: undefined,
    };

    setUploadManager(prev => ({
      ...prev,
      uploads: prev.uploads.map(u =>
        u.id === uploadId ? refreshedUpload : u
      ),
    }));

    uploadFileToServer(refreshedUpload, controller);
  };

  const removeUpload = (uploadId: string) => {
    const controller = uploadControllersRef.current[uploadId];
    if (controller) {
      controller.abort();
      delete uploadControllersRef.current[uploadId];
    }

    setUploadManager(prev => ({
      ...prev,
      uploads: prev.uploads.filter(u => u.id !== uploadId),
    }));

    scheduleUploadManagerCleanup();
  };

  const toggleMinimize = () => {
    setUploadManager(prev => ({ ...prev, isMinimized: !prev.isMinimized }));
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
              setActiveFolderId(fileLibraryData.id);
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
            <span className="flex-1 text-left truncate">{item.label}</span>
          )}
          {isSidebarOpen && item.children && (
            isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )
          )}
        </Button>

        {isSidebarOpen && item.children && isExpanded && (
          <div className="mt-2 space-y-1">
            {item.children.map((child) => {
              const isChildActive = activeNavId === child.id;
              return (
                <Button
                  key={child.id}
                  className={cn(
                    "w-full justify-start gap-3 pl-8 border border-transparent text-sm",
                    isChildActive
                      ? "bg-primary text-primary-foreground shadow"
                      : "bg-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                  onClick={() => setActiveNavId(child.id)}
                  variant={isChildActive ? "default" : "ghost"}
                  size="sm"
                >
                  <child.icon className="h-3.5 w-3.5" />
                  <span className="flex-1 text-left truncate">{child.label}</span>
                </Button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const navigateTo = (viewId: string) => {
    setActiveNavId(viewId);
    if (viewId === "file-library") {
      handleOpenFolder(fileLibraryData.id);
    }
  };

  const openFolderInLibrary = (folderId: string) => {
    setActiveNavId("file-library");
    handleOpenFolder(folderId);
  };

  const handleOpenInSpreadsheet = (file: RealEstateFile) => {
    setFileToLoad({
      id: file.id,
      name: file.name,
      type: file.type,
    });
    setActiveNavId("sheets");
  };

  const renderContent = () => {
    switch (activeNavId) {
      case "file-library":
        return (
          <FileLibraryView
            activeFolder={activeFolder}
            activeFolderId={activeFolderId}
            breadcrumbs={breadcrumbs}
            files={filteredFiles}
            fileLibraryData={fileLibraryData}
            folderStats={folderStats}
            folders={childFolders}
            isSearching={isSearching}
            onBreadcrumbSelect={handleOpenFolder}
            onFileUpload={startUploads}
            onFolderOpen={handleOpenFolder}
            onSearchChange={setSearchQuery}
            onUpdateFileLibraryData={setFileLibraryData}
            onViewModeChange={setViewMode}
            onOpenInSpreadsheet={handleOpenInSpreadsheet}
            searchQuery={searchQuery}
            viewMode={viewMode}
          />
        );
      case "home":
        return (
          <HomeOverviewView
            activity={HOME_ACTIVITY}
            deals={HOME_DEALS}
            metrics={HOME_METRICS}
            onNavigate={navigateTo}
            onOpenFolder={openFolderInLibrary}
          />
        );
      case "chat":
        return (
          <ChatInterface
            setActiveNavId={setActiveNavId}
            handleOpenFolder={handleOpenFolder}
            fileLibraryData={fileLibraryData}
            folderIndex={folderIndex}
            onCloseLeftSidebar={() => setIsSidebarOpen(false)}
          />
        );
      case "history":
        return (
          <HistoryOverviewView
            onNavigate={navigateTo}
            onOpenFolder={openFolderInLibrary}
            timeline={HISTORY_TIMELINE}
          />
        );
      case "history-reports":
        return (
          <ReportWorkspaceView
            onNavigate={navigateTo}
            onOpenFolder={openFolderInLibrary}
            sections={REPORT_SECTIONS}
          />
        );
      case "history-settings":
        return <ReportSettingsView preferences={REPORT_SETTINGS} />;
      case "sheets":
        return (
          <SpreadsheetEditor fileToLoad={fileToLoad} />
        );
      case "memo-deal-horizon":
        return (
          <ReportWorkspaceView
            onNavigate={navigateTo}
            onOpenFolder={openFolderInLibrary}
            sections={REPORT_SECTIONS}
            dealSummary={HOME_DEALS[0]}
          />
        );
      case "memo-deal-suncrest":
        return (
          <ReportWorkspaceView
            onNavigate={navigateTo}
            onOpenFolder={openFolderInLibrary}
            sections={SUNCREST_REPORT_SECTIONS}
            dealSummary={HOME_DEALS[1]}
          />
        );
      case "memo-deal-seaside":
        return (
          <ReportWorkspaceView
            onNavigate={navigateTo}
            onOpenFolder={openFolderInLibrary}
            sections={SEASIDE_REPORT_SECTIONS}
            dealSummary={HOME_DEALS[2]}
          />
        );
      default:
        return (
          <ComingSoonView
            label={NAV_LABEL_LOOKUP[activeNavId] ?? "Workspace"}
          />
        );
    }
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

        <div className="mt-auto space-y-3 overflow-y-auto pr-1">
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
                handleOpenFolder(fileLibraryData.id);
              }
              // Handle child navigation items
              if (value === "history-reports") {
                setActiveNavId("history-reports");
              }
              if (value === "history-settings") {
                setActiveNavId("history-settings");
              }
              if (value === "memo-deal-horizon") {
                setActiveNavId("memo-deal-horizon");
              }
              if (value === "memo-deal-suncrest") {
                setActiveNavId("memo-deal-suncrest");
              }
              if (value === "memo-deal-seaside") {
                setActiveNavId("memo-deal-seaside");
              }
            }}
            value={activeNavId}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select view" />
            </SelectTrigger>
            <SelectContent>
              {NAV_ITEMS.map((item) => (
                <React.Fragment key={item.id}>
                  <SelectItem value={item.id}>
                    {item.label}
                  </SelectItem>
                  {item.children?.map((child) => (
                    <SelectItem key={child.id} value={child.id}>
                      &nbsp;&nbsp;{child.label}
                    </SelectItem>
                  ))}
                </React.Fragment>
              ))}
            </SelectContent>
          </Select>
        </header>

        <div className="flex flex-1 flex-col gap-6 overflow-hidden px-4 pt-4 pb-8 lg:flex-row lg:gap-8 lg:px-8">
          <div className="flex flex-1 flex-col gap-6 overflow-hidden">
            {renderContent()}
          </div>

        </div>
      </div>

      {/* Upload Manager */}
      <UploadManager
        uploads={uploadManager.uploads}
        isMinimized={uploadManager.isMinimized}
        isVisible={uploadManager.isVisible}
        onCancel={cancelUpload}
        onMinimize={toggleMinimize}
        onRemove={removeUpload}
        onRetry={retryUpload}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// File Library view
// ---------------------------------------------------------------------------

type FileLibraryViewProps = {
  activeFolder: RealEstateFolder;
  activeFolderId: string;
  breadcrumbs: BreadcrumbItem[];
  files: RealEstateFile[];
  fileLibraryData: RealEstateFolder;
  folderStats: FolderStats;
  folders: RealEstateFolder[];
  isSearching: boolean;
  onBreadcrumbSelect: (id: string) => void;
  onFileUpload: (files: File[], options?: { addToLibrary?: boolean }) => void;
  onFolderOpen: (id: string) => void;
  onSearchChange: (value: string) => void;
  onViewModeChange: (mode: "grid" | "list") => void;
  onUpdateFileLibraryData: (updater: (prev: RealEstateFolder) => RealEstateFolder) => void;
  onOpenInSpreadsheet: (file: RealEstateFile) => void;
  searchQuery: string;
  viewMode: "grid" | "list";
};

function FileLibraryView({
  activeFolder,
  activeFolderId,
  breadcrumbs,
  files,
  fileLibraryData,
  folderStats,
  folders,
  isSearching,
  onBreadcrumbSelect,
  onFileUpload,
  onFolderOpen,
  onSearchChange,
  onUpdateFileLibraryData,
  onViewModeChange,
  onOpenInSpreadsheet,
  searchQuery,
  viewMode,
}: FileLibraryViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Start uploads using the upload manager
    onFileUpload(files, { addToLibrary: true });

    // Clear the input
    event.target.value = '';
  };

  const handleFolderUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Start uploads using the upload manager for visual feedback
    onFileUpload(files, { addToLibrary: false });

    // Also create the folder structure immediately
    const firstFile = files[0] as any;
    const folderPath = firstFile.webkitRelativePath;
    const rootFolderName = folderPath.split('/')[0];

    // Create a new folder structure
    const createFolderStructure = (files: File[]): RealEstateFolder => {
      const folderMap: Record<string, RealEstateFolder> = {};
      
      // Create root folder
      const rootFolder: RealEstateFolder = {
        id: `folder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: rootFolderName,
        description: `Uploaded folder containing ${files.length} files`,
        files: [],
        children: [],
      };
      
      folderMap[''] = rootFolder;
      
      // Process each file
      files.forEach((file) => {
        const fileWithPath = file as any;
        const relativePath = fileWithPath.webkitRelativePath;
        const pathParts = relativePath.split('/').slice(1); // Remove root folder name
        const fileName = pathParts.pop() || '';
        const folderPath = pathParts.join('/');
        
        // Ensure parent folders exist
        let currentPath = '';
        let currentFolder = rootFolder;
        
        for (const part of pathParts) {
          currentPath += (currentPath ? '/' : '') + part;
          
          if (!folderMap[currentPath]) {
            const newFolder: RealEstateFolder = {
              id: `folder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${currentPath.replace(/\//g, '-')}`,
              name: part,
              files: [],
              children: [],
            };
            folderMap[currentPath] = newFolder;
            
            // Add to parent
            if (!currentFolder.children) currentFolder.children = [];
            currentFolder.children.push(newFolder);
          }
          
          currentFolder = folderMap[currentPath];
        }
        
        // Add file to the appropriate folder
        const normalizedName = file.name.toLowerCase();
        const fileType = normalizedName.endsWith('.pdf') ? 'pdf' :
                        normalizedName.endsWith('.csv') ? 'csv' :
                        normalizedName.endsWith('.xlsx') || normalizedName.endsWith('.xls') ? 'xlsx' :
                        'doc';
        
        const fileSize = file.size < 1024 * 1024 
          ? `${(file.size / 1024).toFixed(1)} KB`
          : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

        const newFile: RealEstateFile = {
          id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          type: fileType as "pdf" | "xlsx" | "doc",
          size: fileSize,
          status: "queued",
          updatedAt: new Date().toISOString(),
        };
        
        currentFolder.files.push(newFile);
      });
      
      return rootFolder;
    };

    const newFolder = createFolderStructure(files);

    // Add the new folder to the current active folder
    onUpdateFileLibraryData(prevData => {
      const updateFolder = (folder: RealEstateFolder): RealEstateFolder => {
        if (folder.id === activeFolderId) {
          return {
            ...folder,
            children: [...(folder.children || []), newFolder],
          };
        }
        if (folder.children) {
          return {
            ...folder,
            children: folder.children.map(updateFolder),
          };
        }
        return folder;
      };

      return updateFolder(prevData);
    });

    // Clear the input
    event.target.value = '';
  };
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

  return (
    <div className="flex h-full flex-col gap-6 rounded-3xl border border-border/60 bg-background/95 px-6 py-6 shadow-sm">
      <div className="flex flex-col gap-3">
        <BreadcrumbTrail items={breadcrumbs} onSelect={onBreadcrumbSelect} />
        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <h1 className="font-semibold text-2xl text-foreground">
                {activeFolder.name}
              </h1>
              {activeFolder.description ? (
                <p className="text-muted-foreground text-sm">
                  {activeFolder.description}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between xl:gap-6">
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
        <div className="flex items-center gap-3 xl:gap-2">
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2">
                <Upload className="h-4 w-4" />
                Upload
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Files
                <span className="ml-auto text-xs text-muted-foreground">to current folder</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => folderInputRef.current?.click()}>
                <Folder className="h-4 w-4 mr-2" />
                Upload Folder
                <span className="ml-auto text-xs text-muted-foreground">with subfolders</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
                  <FileCard file={file} key={file.id} onOpenInSpreadsheet={onOpenInSpreadsheet} />
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
                  <FileRow file={file} key={file.id} onOpenInSpreadsheet={onOpenInSpreadsheet} />
                ))}
              </div>
            )
          ) : isSearching ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-12 text-center text-muted-foreground text-sm">
              <Search className="h-10 w-10" />
              <div>
                <p>No files match your search.</p>
                <p className="text-muted-foreground/80 text-xs">
                  Try different keywords or clear the filter.
                </p>
                <Button
                  onClick={() => onSearchChange("")}
                  size="sm"
                  variant="outline"
                  className="mt-3"
                >
                  Clear search
                </Button>
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
                <div className="flex gap-2 mt-3">
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    size="sm"
                    variant="outline"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Files
                  </Button>
                  <Button
                    onClick={() => folderInputRef.current?.click()}
                    size="sm"
                    variant="outline"
                  >
                    <Folder className="h-4 w-4 mr-2" />
                    Upload Folder
                  </Button>
                </div>
              </div>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileUpload}
        className="hidden"
      />
      <input
        ref={folderInputRef}
        type="file"
        {...({ webkitdirectory: "" } as any)}
        onChange={handleFolderUpload}
        className="hidden"
      />

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
      className="flex h-full flex-col gap-3 rounded-3xl border border-border/60 bg-background/95 p-5 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 relative group"
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

      {/* Hover Statistics Tooltip */}
      <div className="absolute top-full left-0 mt-2 bg-background border border-border/60 rounded-lg p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20 shadow-lg w-80">
        <div className="space-y-3">
          <h5 className="font-medium text-sm text-foreground">File Statistics</h5>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <p className="text-2xl font-bold text-primary">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Files</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <p className="text-2xl font-bold text-green-600">{stats.indexed}</p>
              <p className="text-xs text-muted-foreground">Ready</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <p className="text-2xl font-bold text-blue-600">{stats.indexing}</p>
              <p className="text-xs text-muted-foreground">Indexing</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <p className="text-2xl font-bold text-amber-600">{stats.queued}</p>
              <p className="text-xs text-muted-foreground">Queued</p>
            </div>
          </div>
          {stats.lastUpdated && (
            <p className="text-xs text-muted-foreground">
              Updated {relativeTime(stats.lastUpdated)}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

function FolderRow({ folder, stats, onOpen }: FolderDisplayProps) {
  const details = getFolderMeta(stats);

  return (
    <button
      className="flex w-full items-center justify-between rounded-2xl border border-border/60 bg-background/95 px-4 py-4 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 relative group"
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

      {/* Hover Statistics Tooltip */}
      <div className="absolute top-full left-0 mt-2 bg-background border border-border/60 rounded-lg p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20 shadow-lg w-80">
        <div className="space-y-3">
          <h5 className="font-medium text-sm text-foreground">File Statistics</h5>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <p className="text-2xl font-bold text-primary">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Files</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <p className="text-2xl font-bold text-green-600">{stats.indexed}</p>
              <p className="text-xs text-muted-foreground">Ready</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <p className="text-2xl font-bold text-blue-600">{stats.indexing}</p>
              <p className="text-xs text-muted-foreground">Indexing</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <p className="text-2xl font-bold text-amber-600">{stats.queued}</p>
              <p className="text-xs text-muted-foreground">Queued</p>
            </div>
          </div>
          {stats.lastUpdated && (
            <p className="text-xs text-muted-foreground">
              Updated {relativeTime(stats.lastUpdated)}
            </p>
          )}
        </div>
      </div>

      <ChevronRight aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
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
// Real estate workspace views (Phase 3)
// ---------------------------------------------------------------------------

type HomeOverviewViewProps = {
  metrics: PipelineMetric[];
  deals: DealSummary[];
  activity: ActivityItem[];
  onNavigate: (viewId: string) => void;
  onOpenFolder: (folderId: string) => void;
};

function HomeOverviewView({
  metrics,
  deals,
  activity,
  onNavigate,
  onOpenFolder,
}: HomeOverviewViewProps) {
  return (
    <div className="flex h-full flex-col gap-6 rounded-3xl border border-border/60 bg-background/95 px-6 py-6 shadow-sm">
      <div className="flex flex-col gap-2">
        <h1 className="font-semibold text-2xl text-foreground">
          Workspace overview
        </h1>
        <p className="text-muted-foreground text-sm">
          Track active deals, monitor ingestion progress, and jump into the
          latest deliverables.
        </p>
        {metrics.every(m => m.value === "0") && (
          <div className="mt-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm">
            <p className="font-medium">Welcome to Stag! 🎉</p>
            <p className="text-blue-700 mt-1">
              Start by uploading some real estate documents to the File Library, then use the Chat to ask questions about your data.
            </p>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {metrics.map((metric) => (
          <div
            className="rounded-3xl border border-border/60 bg-background/95 p-5 shadow-sm"
            key={metric.id}
          >
            <p className="text-muted-foreground text-xs uppercase tracking-wide">
              {metric.label}
            </p>
            <p className="mt-2 font-semibold text-2xl text-foreground">
              {metric.value}
            </p>
            <p className="text-muted-foreground/80 text-xs">{metric.delta}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-3xl border border-border/60 bg-background/95 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground text-sm">
              Active diligence
            </h2>
            <Button
              onClick={() => onNavigate("file-library")}
              size="sm"
              variant="outline"
            >
              Go to File Library
            </Button>
          </div>
          <div className="space-y-3">
            {deals.map((deal) => (
              <div
                className="rounded-2xl border border-border/60 bg-background/95 p-4 text-sm shadow-sm"
                key={deal.id}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">{deal.name}</p>
                    <p className="text-muted-foreground text-xs">{deal.market}</p>
                  </div>
                  <Badge className="text-[11px] uppercase" variant="outline">
                    {deal.status}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
                  <span>Occupancy {deal.occupancy}</span>
                  <span className="hidden sm:inline">•</span>
                  <span>Next: {deal.nextAction}</span>
                </div>
                <div className="mt-3">
                  <Button
                    className="px-0 text-primary text-sm"
                    onClick={() => onOpenFolder(deal.folderId)}
                    size="sm"
                    variant="ghost"
                  >
                    Open folder
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-3xl border border-border/60 bg-background/95 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground text-sm">
              Recent activity
            </h2>
            <Button
              onClick={() => onNavigate("history")}
              size="sm"
              variant="outline"
            >
              View All
            </Button>
          </div>
          <div className="space-y-3">
            {activity.map((item) => {
              const handleAction = () => {
                if (
                  item.actionNavId === "file-library" &&
                  item.actionFolderId
                ) {
                  onOpenFolder(item.actionFolderId);
                  return;
                }
                if (item.actionNavId) {
                  onNavigate(item.actionNavId);
                }
              };

              return (
                <div
                  className="rounded-2xl border border-border/60 bg-background/95 p-4 text-sm shadow-sm"
                  key={item.id}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-foreground">{item.title}</p>
                    <span className="text-muted-foreground text-xs">
                      {item.timestamp}
                    </span>
                  </div>
                  <p className="mt-2 text-muted-foreground/90 text-xs">
                    {item.summary}
                  </p>
                  {item.actionLabel ? (
                    <Button
                      className="mt-3 px-0 text-primary"
                      onClick={handleAction}
                      size="sm"
                      variant="ghost"
                    >
                      {item.actionLabel}
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

type HistoryOverviewViewProps = {
  timeline: ActivityItem[];
  onNavigate: (viewId: string) => void;
  onOpenFolder: (folderId: string) => void;
};

function HistoryOverviewView({
  timeline,
  onNavigate,
  onOpenFolder,
}: HistoryOverviewViewProps) {
  return (
    <div className="flex h-full flex-col gap-6 rounded-3xl border border-border/60 bg-background/95 px-6 py-6 shadow-sm">
      <div className="flex flex-col gap-2">
        <h1 className="font-semibold text-2xl text-foreground">
          Recent outputs
        </h1>
        <p className="text-muted-foreground text-sm">
          Quick links to the latest memos, chats, and sheet exports created in
          this workspace.
        </p>
      </div>

      <div className="space-y-4">
        {timeline.map((item) => {
          const handleAction = () => {
            if (
              item.actionNavId === "file-library" &&
              item.actionFolderId
            ) {
              onOpenFolder(item.actionFolderId);
              return;
            }
            if (item.actionNavId) {
              onNavigate(item.actionNavId);
            }
          };

          return (
            <div
              className="rounded-3xl border border-border/60 bg-background/95 p-5 shadow-sm"
              key={item.id}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground">{item.title}</p>
                  <p className="text-muted-foreground text-xs">
                    {item.timestamp}
                  </p>
                </div>
                {item.actionLabel ? (
                  <Button onClick={handleAction} size="sm" variant="outline">
                    {item.actionLabel}
                  </Button>
                ) : null}
              </div>
              <p className="mt-3 text-muted-foreground/90 text-sm">
                {item.summary}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type ConversationWorkspaceViewProps = {
  messages: ConversationMessage[];
  memoSections: MemoSection[];
  actions: ActivityItem[];
  onNavigate: (viewId: string) => void;
  onOpenFolder: (folderId: string) => void;
};

function ConversationWorkspaceView({
  messages,
  memoSections,
  actions,
  onNavigate,
  onOpenFolder,
}: ConversationWorkspaceViewProps) {
  const conversationMeta = [
    {
      id: "status",
      label: "Memo status",
      value: "IC ready · synced 2 min ago",
    },
    {
      id: "milestone",
      label: "Next milestone",
      value: "IC deck due Thu · 2 PM",
    },
    {
      id: "owner",
      label: "Deal owner",
      value: "Avery Chen",
    },
  ];

  return (
    <div className="grid h-full gap-6 rounded-3xl border border-border/60 bg-background/95 px-6 py-6 shadow-sm lg:grid-cols-[2fr_1fr]">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-5 rounded-3xl border border-border/60 bg-background/95 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <Badge className="w-fit text-[11px] uppercase tracking-wide" variant="outline">
                Deal chat
              </Badge>
              <div>
                <h1 className="font-semibold text-2xl text-foreground">
                  Horizon Logistics Park
                </h1>
                <p className="text-muted-foreground text-sm">
                  Live thread powering the screening memo and Sheets exports.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => onOpenFolder(FILE_LIBRARY_ROOT.id)}
                variant="outline"
              >
                Open deal files
              </Button>
              <Button
                onClick={() => onNavigate("history-reports")}
                variant="outline"
              >
                View memo
              </Button>
            </div>
          </div>

          <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-3">
            {conversationMeta.map((item) => (
              <div
                className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3"
                key={item.id}
              >
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
                  {item.label}
                </p>
                <p className="mt-1 text-sm text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-border/60 bg-background/95 p-5 shadow-sm">
          <h2 className="font-semibold text-foreground text-sm">Message thread</h2>
          <ScrollArea className="mt-4 h-[320px] pr-2">
            <div className="space-y-3">
              {messages.map((message) => {
                const isStag = message.role === "stag";

                const handleBadgeVariant = isStag ? "default" : "outline";
                const roleLabel = isStag ? "Stag" : "Analyst";

                return (
                  <div
                    className={cn(
                      "rounded-2xl border border-border/60 bg-background/95 p-4 text-sm shadow-sm",
                      isStag && "border-primary/40 bg-primary/5"
                    )}
                    key={message.id}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{message.author}</span>
                      <Badge className="text-[10px] uppercase tracking-wide" variant={handleBadgeVariant}>
                        {roleLabel}
                      </Badge>
                      <span className="text-muted-foreground/80">{message.timestamp}</span>
                    </div>
                    <p className="mt-2 text-muted-foreground/90">{message.content}</p>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <div className="space-y-3 rounded-3xl border border-border/60 bg-background/95 p-5 shadow-sm">
          <h2 className="font-semibold text-foreground text-sm">Memo highlights</h2>
          <div className="space-y-3">
            {memoSections.map((section) => (
              <div
                className="rounded-2xl border border-border/60 bg-background/95 p-4 text-sm shadow-sm"
                key={section.id}
              >
                <p className="font-semibold text-foreground">{section.title}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground/90 text-xs">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3 rounded-3xl border border-border/60 bg-background/95 p-5 shadow-sm">
          <h3 className="font-semibold text-foreground text-sm">Workflow actions</h3>
          <div className="space-y-3 text-sm">
            {actions.map((item) => {
              const handleAction = () => {
                if (
                  item.actionNavId === "file-library" &&
                  item.actionFolderId
                ) {
                  onOpenFolder(item.actionFolderId);
                  return;
                }
                if (item.actionNavId) {
                  onNavigate(item.actionNavId);
                }
              };

              return (
                <div
                  className="rounded-2xl border border-border/60 bg-background/95 p-4 shadow-sm"
                  key={item.id}
                >
                  <p className="font-semibold text-foreground">{item.title}</p>
                  <p className="mt-1 text-muted-foreground/90 text-xs">{item.summary}</p>
                  {item.actionLabel ? (
                    <Button
                      className="mt-3 px-0 text-primary"
                      onClick={handleAction}
                      size="sm"
                      variant="ghost"
                    >
                      {item.actionLabel}
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

type ReportWorkspaceViewProps = {
  sections: MemoSection[];
  dealSummary?: DealSummary;
  onNavigate: (viewId: string) => void;
  onOpenFolder: (folderId: string) => void;
};

function ReportWorkspaceView({
  sections,
  dealSummary,
  onNavigate,
  onOpenFolder,
}: ReportWorkspaceViewProps) {
  const memoMeta = [
    {
      id: "status",
      label: "Status",
      value: "IC ready",
    },
    {
      id: "updated",
      label: "Last updated",
      value: "Today · 9:25 AM",
    },
    {
      id: "prepared",
      label: "Prepared by",
      value: "Stag × Avery Chen",
    },
  ];

  return (
    <div className="flex h-full flex-col gap-6 rounded-3xl border border-border/60 bg-background/95 px-6 py-6 shadow-sm">
      <div className="flex flex-col gap-5 rounded-3xl border border-border/60 bg-background/95 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Badge className="w-fit text-[11px] uppercase tracking-wide" variant="outline">
              Screening memo
            </Badge>
            <div>
              <h1 className="font-semibold text-2xl text-foreground">
                {dealSummary?.name || "Horizon Logistics Park"}
              </h1>
              <p className="text-muted-foreground text-sm">
                Real estate diligence memo generated by Stag with analyst commentary.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => onNavigate("history-settings")} variant="outline">
              Memo controls
            </Button>
            <Button onClick={() => onOpenFolder(dealSummary?.folderId || FILE_LIBRARY_ROOT.id)} variant="outline">
              Deal files
            </Button>
          </div>
        </div>

        <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-3">
          {memoMeta.map((item) => (
            <div
              className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3"
              key={item.id}
            >
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
                {item.label}
              </p>
              <p className="mt-1 text-sm text-foreground">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {sections.map((section) => (
          <div
            className="rounded-3xl border border-border/60 bg-background/95 p-5 shadow-sm"
            key={section.id}
          >
            <h2 className="font-semibold text-foreground text-sm">{section.title}</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground/90 text-sm">
              {section.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => onNavigate("sheets")}>
          Sync to Sheets
        </Button>
        <Button onClick={() => onNavigate("history-chats")} variant="outline">
          View deal chat
        </Button>
        <Button onClick={() => onOpenFolder(dealSummary?.folderId || FILE_LIBRARY_ROOT.id)} variant="outline">
          Export source files
        </Button>
      </div>
    </div>
  );
}

type ReportSettingsViewProps = {
  preferences: ReportPreference[];
};

function ReportSettingsView({ preferences }: ReportSettingsViewProps) {
  return (
    <div className="flex h-full flex-col gap-6 rounded-3xl border border-border/60 bg-background/95 px-6 py-6 shadow-sm">
      <div className="space-y-3">
        <Badge className="w-fit text-[11px] uppercase tracking-wide" variant="outline">
          Memo controls
        </Badge>
        <div>
          <h1 className="font-semibold text-2xl text-foreground">Publishing defaults</h1>
          <p className="text-muted-foreground text-sm">
            Configure the sections, reminders, and sync targets that ship with
            every screening memo export.
          </p>
        </div>
        <p className="text-muted-foreground/80 text-xs">
          Changes apply to Horizon Logistics and any linked deliverables.
        </p>
      </div>

      <div className="space-y-3">
        {preferences.map((pref) => (
          <div
            className="flex items-center justify-between rounded-3xl border border-border/60 bg-background/95 p-5 text-sm shadow-sm"
            key={pref.id}
          >
            <div>
              <p className="font-semibold text-foreground">{pref.label}</p>
              <p className="mt-1 text-muted-foreground/90 text-xs">{pref.description}</p>
            </div>
            <Badge
              className="text-[11px] uppercase tracking-wide"
              variant={pref.enabled ? "default" : "outline"}
            >
              {pref.enabled ? "On" : "Off"}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

type SheetsWorkspaceViewProps = {
  exports: SheetsExport[];
  onNavigate: (viewId: string) => void;
};


type ComingSoonViewProps = {
  label: string;
};

function ComingSoonView({ label }: ComingSoonViewProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 rounded-3xl border border-border/60 bg-background/95 p-12 text-center text-muted-foreground shadow-sm">
      <div className="space-y-2">
        <h2 className="font-semibold text-foreground text-xl">{label}</h2>
        <p className="text-sm">This section is coming soon for the real estate workspace.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat Interface Component
// ---------------------------------------------------------------------------

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  attachments?: File[];
  visualizations?: VisualizationData[];
};

type VisualizationData = {
  id: string;
  type: "chart" | "spreadsheet" | "map";
  title: string;
  data: any;
};

type ChatInterfaceState = {
  messages: ChatMessage[];
  isStreaming: boolean;
  currentMessage: string;
  attachedFiles: File[];
  showVisualization: VisualizationData | null;
  selectedFolders: string[];
  showDatasetSidebar: boolean;
  showDatasetDetails: string | null; // ID of dataset to show details for
  clickedButton: string | null; // ID of button that was just clicked for animation
  datasetJsonData: Record<string, { data: any; lastFetched: number; loading: boolean; error: string | null }>; // JSON data for each dataset
  conversationId: string | null; // Backend conversation ID
};

function ChatInterface({
  setActiveNavId,
  handleOpenFolder,
  onCloseLeftSidebar,
  fileLibraryData,
  folderIndex,
}: {
  setActiveNavId: (id: string) => void;
  handleOpenFolder: (id: string) => void;
  fileLibraryData: RealEstateFolder;
  folderIndex: Record<string, FolderIndexEntry>;
  onCloseLeftSidebar?: () => void;
}) {
  const [state, setState] = useState<ChatInterfaceState>({
    messages: [
      {
        id: "welcome",
        role: "assistant",
        content: "Hello! I'm here to help you analyze real estate data. You can upload files, ask questions, and I'll provide insights with interactive visualizations. What would you like to explore?",
        timestamp: new Date().toLocaleTimeString(),
      },
    ],
    isStreaming: false,
    currentMessage: "",
    attachedFiles: [],
    showVisualization: null,
    selectedFolders: [],
    showDatasetSidebar: false,
    showDatasetDetails: null,
    clickedButton: null,
    datasetJsonData: {},
    conversationId: null,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const setStateRef = useRef<typeof setState>();
  const attachedFilesRef = useRef<File[]>([]);
  const isProcessingUploadRef = useRef(false);

  // Update the ref whenever setState changes
  useEffect(() => {
    setStateRef.current = setState;
  }, [setState]);

  // Keep the ref in sync with state
  useEffect(() => {
    attachedFilesRef.current = state.attachedFiles;
  }, [state.attachedFiles]);

  // Get all available folders for selection
  const availableFolders = useMemo(() => {
    if (!fileLibraryData) return [] as { id: string; name: string; description?: string }[];

    const folders: { id: string; name: string; description?: string }[] = [];

    const visit = (folder: RealEstateFolder, ancestors: string[]) => {
      const displayName = ancestors.length
        ? `${ancestors.join(" > ")} > ${folder.name}`
        : folder.name;
      folders.push({
        id: folder.id,
        name: displayName,
        description: folder.description,
      });

      if (folder.children) {
        const nextAncestors = [...ancestors, folder.name];
        folder.children.forEach(child => visit(child, nextAncestors));
      }
    };

    visit(fileLibraryData, []);
    return folders;
  }, [fileLibraryData]);

  // Expose API for backend to call
  useEffect(() => {
    // Create global API object if it doesn't exist
    if (typeof window !== 'undefined') {
      (window as any).StagAPI = (window as any).StagAPI || {};
      
      // Expose dataset selection function
      (window as any).StagAPI.selectDatasets = (datasetIds: string[]) => {
        if (setStateRef.current) {
          setStateRef.current(prev => ({
            ...prev,
            selectedFolders: datasetIds,
            clickedButton: null // Clear any animation state
          }));
          return true; // Success
        }
        return false; // Failed - component not mounted
      };

      // Expose function to get current selected datasets
      (window as any).StagAPI.getSelectedDatasets = () => {
        return state.selectedFolders;
      };

      // Expose function to get available datasets
      (window as any).StagAPI.getAvailableDatasets = () => {
        return availableFolders.map(folder => ({
          id: folder.id,
          name: folder.name,
          description: folder.description,
        }));
      };
    }

    // Cleanup on unmount
    return () => {
      if (typeof window !== 'undefined' && (window as any).StagAPI) {
        delete (window as any).StagAPI.selectDatasets;
        delete (window as any).StagAPI.getSelectedDatasets;
        delete (window as any).StagAPI.getAvailableDatasets;
      }
    };
  }, [state.selectedFolders, availableFolders]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [state.messages]);

  // Clear clicked button animation after 600ms
  useEffect(() => {
    if (state.clickedButton) {
      const timer = setTimeout(() => {
        setState(prev => ({ ...prev, clickedButton: null }));
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [state.clickedButton]);

  // Poll for JSON data every 5 seconds when dataset details sidebar is open
  useEffect(() => {
    if (!state.showDatasetDetails) return;

    const datasetId = state.showDatasetDetails;
    const pollJsonData = async () => {
      const lastFetched = state.datasetJsonData[datasetId]?.lastFetched || 0;
      const now = Date.now();
      
      // Only fetch if it's been more than 5 seconds since last fetch
      if (now - lastFetched > 5000) {
        try {
          setState(prev => ({
            ...prev,
            datasetJsonData: {
              ...prev.datasetJsonData,
              [datasetId]: {
                ...prev.datasetJsonData[datasetId],
                loading: true,
                error: null,
              }
            }
          }));

          // Fetch JSON data for this dataset
          const response = await fetch(`/api/datasets/${datasetId}/data.json`);
          
          if (response.ok) {
            const jsonData = await response.json();
            setState(prev => ({
              ...prev,
              datasetJsonData: {
                ...prev.datasetJsonData,
                [datasetId]: {
                  data: jsonData,
                  lastFetched: now,
                  loading: false,
                  error: null,
                }
              }
            }));
          } else if (response.status === 404) {
            // JSON file doesn't exist yet, clear any existing data
            setState(prev => ({
              ...prev,
              datasetJsonData: {
                ...prev.datasetJsonData,
                [datasetId]: {
                  data: null,
                  lastFetched: now,
                  loading: false,
                  error: null,
                }
              }
            }));
          } else {
            throw new Error(`HTTP ${response.status}`);
          }
        } catch (error) {
          setState(prev => ({
            ...prev,
            datasetJsonData: {
              ...prev.datasetJsonData,
              [datasetId]: {
                ...prev.datasetJsonData[datasetId],
                loading: false,
                error: error instanceof Error ? error.message : 'Failed to fetch data',
                lastFetched: now,
              }
            }
          }));
        }
      }
    };

    // Initial poll
    pollJsonData();

    // Set up polling interval
    const interval = setInterval(pollJsonData, 5000);

    return () => clearInterval(interval);
  }, [state.showDatasetDetails]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    // Prevent multiple simultaneous uploads
    if (isProcessingUploadRef.current) return;
    isProcessingUploadRef.current = true;
    
    try {
      // Clear the input immediately to prevent duplicate events
      event.target.value = '';
      
      const files = Array.from(event.target.files || []);
      if (files.length === 0) return;
      
      // Filter out files that are already attached to prevent duplicates
      const newFiles = files.filter(newFile => 
        !attachedFilesRef.current.some(existingFile => 
          existingFile.name === newFile.name && existingFile.size === newFile.size
        )
      );
      
      if (newFiles.length > 0) {
        setState(prev => ({
          ...prev,
          attachedFiles: [...prev.attachedFiles, ...newFiles],
        }));

        // Upload files to backend
        try {
          console.log('Uploading files to backend:', newFiles.map(f => f.name));
          const response = await backendAPI.processUploadParallel(newFiles);
          console.log('File upload response:', response);
          
          if (response.success) {
            toast.success(`Successfully uploaded ${response.file_ids.length} file(s)`);
          } else {
            toast.error(response.message || 'Failed to upload files');
          }
        } catch (error) {
          console.error('Error uploading files:', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to upload files';
          toast.error(`Upload failed: ${errorMessage}`);
        }
      }
    } finally {
      isProcessingUploadRef.current = false;
    }
  };

  const handleFolderUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    // Prevent multiple simultaneous uploads
    if (isProcessingUploadRef.current) return;
    isProcessingUploadRef.current = true;
    
    try {
      // Clear the input immediately to prevent duplicate events
      event.target.value = '';
      
      const files = Array.from(event.target.files || []);
      if (files.length === 0) return;
      
      // Filter out files that are already attached to prevent duplicates
      const newFiles = files.filter(newFile => 
        !attachedFilesRef.current.some(existingFile => 
          existingFile.name === newFile.name && existingFile.size === newFile.size
        )
      );
      
      if (newFiles.length > 0) {
        setState(prev => ({
          ...prev,
          attachedFiles: [...prev.attachedFiles, ...newFiles],
        }));

        // Upload folder to backend
        try {
          const folderPath = newFiles[0].webkitRelativePath?.split('/')[0] || 'uploaded-folder';
          console.log('Processing folder to backend:', folderPath);
          const response = await backendAPI.processFolder(folderPath);
          console.log('Folder processing response:', response);
          
          if (response.success) {
            toast.success(`Successfully processed folder with ${response.file_ids.length} file(s)`);
          } else {
            toast.error(response.message || 'Failed to process folder');
          }
        } catch (error) {
          console.error('Error processing folder:', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to process folder';
          toast.error(`Folder processing failed: ${errorMessage}`);
        }
      }
    } finally {
      isProcessingUploadRef.current = false;
    }
  };

  const removeFile = (index: number) => {
    setState(prev => ({
      ...prev,
      attachedFiles: prev.attachedFiles.filter((_, i) => i !== index),
    }));
  };

  const sendMessage = async () => {
    if (!state.currentMessage.trim() && state.attachedFiles.length === 0) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: state.currentMessage,
      timestamp: new Date().toLocaleTimeString(),
      attachments: state.attachedFiles.length > 0 ? [...state.attachedFiles] : undefined,
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      currentMessage: "",
      attachedFiles: [],
      isStreaming: true,
    }));

    try {
      // Make real API call to the backend
      console.log('Sending message to backend:', state.currentMessage);
      const response = await backendAPI.chat({
        message: state.currentMessage,
        conversation_id: state.conversationId || undefined,
      });
      
      console.log('Received response from backend:', response);
      
      // Update conversation ID if we got one back
      if (response.conversation_id) {
        setState(prev => ({ ...prev, conversationId: response.conversation_id }));
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.response,
        timestamp: response.timestamp || new Date().toLocaleTimeString(),
      };

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
        isStreaming: false,
      }));
    } catch (error) {
      console.error('Error sending message to backend:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      
      const errorChatMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Error: ${errorMessage}`,
        timestamp: new Date().toLocaleTimeString(),
      };
      
      setState(prev => ({
        ...prev,
        messages: [...prev.messages, errorChatMessage],
        isStreaming: false,
      }));
      
      toast.error(`Failed to send message: ${errorMessage}`);
    }
  };

  const openVisualization = (viz: VisualizationData) => {
    setState(prev => ({ ...prev, showVisualization: viz }));
  };

  const closeVisualization = () => {
    setState(prev => ({ ...prev, showVisualization: null }));
  };

  const openDatasetSidebar = () => {
    setState(prev => ({ ...prev, showDatasetSidebar: true }));
  };

  const closeDatasetSidebar = () => {
    setState(prev => ({ ...prev, showDatasetSidebar: false }));
  };

  const openDatasetDetails = (datasetId: string) => {
    setState(prev => ({ ...prev, showDatasetDetails: datasetId }));
    onCloseLeftSidebar?.();
  };

  const closeDatasetDetails = () => {
    setState(prev => ({ ...prev, showDatasetDetails: null }));
  };

  return (
    <div className="flex h-full flex-col gap-6 rounded-3xl border border-border/60 bg-background/95 px-6 py-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="font-semibold text-2xl text-foreground">AI Assistant</h1>
        <p className="text-muted-foreground text-sm">
          Upload files, ask questions, and get AI-powered insights with interactive visualizations.
        </p>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full pr-2">
          <div className="space-y-4">
            {state.messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}
                >
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="mb-2 space-y-1">
                      {message.attachments.map((file, index) => (
                        <div key={index} className="flex items-center gap-2 text-xs">
                          <FileStack className="h-3 w-3" />
                          <span>{file.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.visualizations && message.visualizations.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {message.visualizations.map((viz) => (
                        <Button
                          key={viz.id}
                          onClick={() => openVisualization(viz)}
                          size="sm"
                          variant="outline"
                          className="text-xs"
                        >
                          📊 {viz.title}
                        </Button>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-xs opacity-70">{message.timestamp}</p>
                </div>
              </div>
            ))}
            {state.isStreaming && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl bg-muted px-4 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex space-x-1">
                      <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50"></div>
                      <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: '0.1s' }}></div>
                      <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <span className="text-muted-foreground">Analyzing...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      {/* File Attachments */}
      {state.attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {state.attachedFiles.map((file, index) => (
            <div
              key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
              className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm"
            >
              <FileStack className="h-4 w-4" />
              <span className="max-w-32 truncate">{file.name}</span>
              <Button
                onClick={() => removeFile(index)}
                size="sm"
                variant="ghost"
                className="h-4 w-4 p-0"
              >
                ×
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Dataset Selection */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Folder className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Active datasets:</span>
            <span className="text-xs text-muted-foreground/80">
              {state.selectedFolders.length} selected
            </span>
          </div>
          <Button
            onClick={openDatasetSidebar}
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {availableFolders.length === 0 ? (
            <div className="w-full rounded-lg border border-dashed border-border/60 bg-muted/20 p-8 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                  <Folder className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-medium text-sm text-foreground">No datasets available</h4>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Upload files or folders to create datasets that the AI can analyze. 
                    Your documents will be organized and indexed for intelligent insights.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    size="sm"
                    variant="outline"
                    className="gap-2"
                  >
                    <Upload className="h-3 w-3" />
                    Upload Files
                  </Button>
                  <Button
                    onClick={() => folderInputRef.current?.click()}
                    size="sm"
                    variant="outline"
                    className="gap-2"
                  >
                    <Folder className="h-3 w-3" />
                    Upload Folder
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            availableFolders.map((folder) => {
              const isSelected = state.selectedFolders.includes(folder.id);
              return (
                <div
                  key={folder.id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                    isSelected
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border/60 bg-muted/30 hover:bg-muted/50"
                  )}
                >
                  <Button
                    onClick={() => {
                      const buttonId = `add-${folder.id}`;
                      setState(prev => ({
                        ...prev,
                        selectedFolders: isSelected
                          ? prev.selectedFolders.filter(id => id !== folder.id)
                          : [...prev.selectedFolders, folder.id],
                        clickedButton: buttonId
                      }));
                    }}
                    size="sm"
                    variant="ghost"
                    className={cn(
                      "h-4 w-4 p-0 transition-all duration-300",
                      isSelected
                        ? "text-green-600 hover:text-green-700"
                        : "text-muted-foreground hover:text-foreground",
                      state.clickedButton === `add-${folder.id}` && "animate-pulse scale-110 text-green-500"
                    )}
                    title={isSelected ? "Remove from context" : "Add to context"}
                  >
                    {isSelected ? (
                      <CheckCircle className="h-3 w-3" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                  </Button>
                  <span className="font-medium">{folder.name}</span>
                  <Button
                    onClick={() => openDatasetDetails(folder.id)}
                    size="sm"
                    variant="ghost"
                    className="h-4 w-4 p-0 text-muted-foreground hover:text-foreground ml-1"
                    title={`View dataset details: ${folder.name}`}
                  >
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              );
            })
          )}
        </div>
        {state.selectedFolders.length > 0 && (
          <p className="text-xs text-muted-foreground">
            AI will analyze documents from the selected datasets to provide more relevant insights.
          </p>
        )}
        {state.selectedFolders.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Select datasets above to give the AI context from your uploaded documents.
          </p>
        )}
      </div>

      {/* Input Area */}
      <div className="flex gap-2">
        <div className="flex gap-1">
          <Button
            onClick={() => fileInputRef.current?.click()}
            size="icon"
            variant="outline"
            className="shrink-0"
            title="Upload files"
          >
            <Upload className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => folderInputRef.current?.click()}
            size="icon"
            variant="outline"
            className="shrink-0"
            title="Upload folder"
          >
            <Folder className="h-4 w-4" />
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileUpload}
          className="hidden"
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          {...({ webkitdirectory: "" } as any)}
          onChange={handleFolderUpload}
          className="hidden"
        />
        <Input
          value={state.currentMessage}
          onChange={(e) => setState(prev => ({ ...prev, currentMessage: e.target.value }))}
          onKeyPress={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Ask about your real estate data..."
          className="flex-1"
        />
        <Button onClick={sendMessage} disabled={state.isStreaming}>
          Send
        </Button>
      </div>

      {/* Visualization Popup */}
      {state.showVisualization && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-w-4xl max-h-[80vh] w-full mx-4 overflow-hidden rounded-lg bg-background p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">{state.showVisualization.title}</h3>
              <Button onClick={closeVisualization} size="icon" variant="ghost">
                ×
              </Button>
            </div>
            <div className="h-96 overflow-auto">
              {state.showVisualization.type === "chart" && (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  📊 Chart visualization would render here
                  <pre className="mt-4 text-xs">
                    {JSON.stringify(state.showVisualization.data, null, 2)}
                  </pre>
                </div>
              )}
              {state.showVisualization.type === "spreadsheet" && (
                <SpreadsheetEditor />
              )}
              {state.showVisualization.type === "map" && (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  🗺️ Map visualization would render here
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dataset Details Sidebar */}
      {state.showDatasetDetails && (
        <div className="fixed inset-y-0 right-0 z-50 w-80 bg-background border-l border-border/60 shadow-xl">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/60">
              <h3 className="font-semibold text-lg">Dataset Details</h3>
              <Button onClick={closeDatasetDetails} size="icon" variant="ghost">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-6">
                {(() => {
                  const dataset = availableFolders.find(f => f.id === state.showDatasetDetails);
                  if (!dataset) return null;

                  const folderEntry = folderIndex[dataset.id] ?? folderIndex[fileLibraryData.id];
                  const targetFolder = folderEntry?.folder ?? fileLibraryData;
                  const stats = collectFolderStats(targetFolder);

                  return (
                    <>
                      {/* Dataset Header */}
                      <div className="space-y-3 relative group">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <Folder className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-lg">{dataset.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              Dataset • {stats.total} files
                            </p>
                          </div>
                        </div>

                        {dataset.description && (
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {dataset.description}
                          </p>
                        )}

                        {/* Hover Statistics Tooltip */}
                        <div className="absolute top-0 right-0 translate-x-full ml-4 bg-background border border-border/60 rounded-lg p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20 shadow-lg w-80">
                          <div className="space-y-3">
                            <h5 className="font-medium text-sm text-foreground">File Statistics</h5>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                                <p className="text-2xl font-bold text-primary">{stats.total}</p>
                                <p className="text-xs text-muted-foreground">Total Files</p>
                              </div>
                              <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                                <p className="text-2xl font-bold text-green-600">{stats.indexed}</p>
                                <p className="text-xs text-muted-foreground">Ready</p>
                              </div>
                              <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                                <p className="text-2xl font-bold text-blue-600">{stats.indexing}</p>
                                <p className="text-xs text-muted-foreground">Indexing</p>
                              </div>
                              <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                                <p className="text-2xl font-bold text-amber-600">{stats.queued}</p>
                                <p className="text-xs text-muted-foreground">Queued</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Recent Files */}
                      <div className="space-y-3">
                        <h5 className="font-medium text-sm">Recent Files</h5>
                        <div className="space-y-2">
                          {(() => {
                            const folder = folderIndex[dataset.id]?.folder ?? fileLibraryData;

                            if (!folder?.files?.length) {
                              return (
                                <p className="text-sm text-muted-foreground">No files in this dataset yet.</p>
                              );
                            }

                            return folder.files
                              .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                              .slice(0, 5)
                              .map((file) => (
                                <div key={file.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
                                  <FileTypeBadge type={file.type} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{file.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {file.size} • {relativeTime(file.updatedAt)}
                                    </p>
                                  </div>
                                  <Badge 
                                    variant="outline" 
                                    className={cn(
                                      "text-xs",
                                      file.status === "indexed" && "text-green-600",
                                      file.status === "indexing" && "text-blue-600",
                                      file.status === "queued" && "text-amber-600"
                                    )}
                                  >
                                    {file.status}
                                  </Badge>
                                </div>
                              ));
                          })()}
                        </div>
                      </div>

                      {/* Database JSON Data */}
                      <div className="space-y-3">
                        <h5 className="font-medium text-sm">Database Data</h5>
                        {(() => {
                          const jsonInfo = state.datasetJsonData[dataset.id];
                          
                          if (jsonInfo?.loading) {
                            return (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Loading data...</span>
                              </div>
                            );
                          }
                          
                          if (jsonInfo?.error) {
                            return (
                              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                                <p className="text-sm text-red-600">
                                  Failed to load data: {jsonInfo.error}
                                </p>
                              </div>
                            );
                          }
                          
                          if (jsonInfo?.data) {
                            return (
                              <div className="space-y-2">
                                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                      Live Database Data
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      Updated {jsonInfo.lastFetched ? new Date(jsonInfo.lastFetched).toLocaleTimeString() : 'just now'}
                                    </span>
                                  </div>
                                  <ScrollArea className="h-48 w-full">
                                    <pre className="text-xs text-foreground whitespace-pre-wrap">
                                      {JSON.stringify(jsonInfo.data, null, 2)}
                                    </pre>
                                  </ScrollArea>
                                </div>
                              </div>
                            );
                          }
                          
                          return (
                            <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-4 text-center">
                              <p className="text-sm text-muted-foreground">
                                No database data available yet.
                              </p>
                              <p className="text-xs text-muted-foreground/80 mt-1">
                                Data will appear here when the backend provides it.
                              </p>
                            </div>
                          );
                        })()}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SidebarSummary() {
  return null;
}

// ---------------------------------------------------------------------------
// File cards & rows
// ---------------------------------------------------------------------------

type FileCardProps = {
  file: RealEstateFile;
  onOpenInSpreadsheet?: (file: RealEstateFile) => void;
};

function FileCard({ file, onOpenInSpreadsheet }: FileCardProps) {
  const handleOpenInSpreadsheet = () => {
    if (onOpenInSpreadsheet) {
      onOpenInSpreadsheet(file);
    }
  };

  const canOpenInSpreadsheet = file.type === 'csv' || file.type === 'xlsx';

  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-border/60 bg-background/95 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileTypeBadge type={file.type} />
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
              <span className="font-medium text-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Indexing
              </span>
              <span>{file.progress}%</span>
            </div>
            <Progress className="mt-2 h-1.5" value={file.progress} />
            <p className="text-muted-foreground/70 text-[10px] mt-1">
              Processing for AI analysis
            </p>
          </div>
        ) : file.status === "queued" ? (
          <div className="flex items-center gap-1">
            <RotateCcw className="h-3 w-3" />
            <Badge className="text-[11px] text-amber-600" variant="outline">
              Queued for processing
            </Badge>
          </div>
        ) : (
          <Badge className="text-[11px] text-emerald-600" variant="outline">
            Ready for analysis
          </Badge>
        )}
        {canOpenInSpreadsheet && file.status === "indexed" && (
          <Button
            onClick={handleOpenInSpreadsheet}
            size="sm"
            variant="outline"
            className="w-full mt-2"
          >
            Open in Spreadsheet
          </Button>
        )}
      </div>
    </div>
  );
}

type FileRowProps = {
  file: RealEstateFile;
  onOpenInSpreadsheet?: (file: RealEstateFile) => void;
};

function FileRow({ file, onOpenInSpreadsheet }: FileRowProps) {
  const handleOpenInSpreadsheet = () => {
    if (onOpenInSpreadsheet) {
      onOpenInSpreadsheet(file);
    }
  };

  const canOpenInSpreadsheet = file.type === 'csv' || file.type === 'xlsx';

  return (
    <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/95 px-4 py-4 shadow-sm">
      <div className="flex items-center gap-3">
        <FileTypeBadge type={file.type} />
        <div>
          <p className="font-semibold text-foreground text-sm">{file.name}</p>
          <p className="text-muted-foreground text-xs">
            Updated {relativeTime(file.updatedAt)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 text-muted-foreground text-xs">
        {file.status === "indexing" ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Indexing {file.progress}%</span>
            <Progress className="h-1.5 w-24" value={file.progress} />
          </div>
        ) : file.status === "queued" ? (
          <div className="flex items-center gap-1">
            <RotateCcw className="h-3 w-3" />
            <span className="text-amber-600">Queued</span>
          </div>
        ) : (
          <Badge className="text-[11px] text-emerald-600" variant="outline">
            Ready
          </Badge>
        )}
        {canOpenInSpreadsheet && file.status === "indexed" && (
          <Button
            onClick={handleOpenInSpreadsheet}
            size="sm"
            variant="outline"
          >
            Open in Spreadsheet
          </Button>
        )}
        <Button className="text-muted-foreground" size="icon" variant="ghost">
          ...
        </Button>
      </div>
    </div>
  );
}

function FileTypeBadge({ type }: { type: RealEstateFile["type"] }) {
  const label = type === "pdf" ? "PDF" : type === "xlsx" ? "XLSX" : type === "csv" ? "CSV" : "DOC";
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
