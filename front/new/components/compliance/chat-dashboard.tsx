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
} from "lucide-react";
import { type ElementType, Fragment, useEffect, useMemo, useRef, useState } from "react";

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

// Upload Manager Types
type UploadStatus = 'uploading' | 'completed' | 'error' | 'cancelled';

type UploadItem = {
  id: string;
  file: File;
  progress: number;
  status: UploadStatus;
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

const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Overview", icon: Home },
  { id: "chat", label: "Chat", icon: MessageSquare },
  {
    id: "history",
    label: "Reports",
    icon: ClipboardList,
    children: [
      { id: "history-reports", label: "Screening memo", icon: FileText },
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
    folderId: "folder-horizon-logistics",
  },
  {
    id: "deal-suncrest",
    name: "Suncrest Retail",
    market: "Phoenix, AZ",
    occupancy: "92%",
    status: "Tenant diligence underway",
    nextAction: "Confirm CAM reconciliation",
    folderId: "folder-suncrest-retail",
  },
  {
    id: "deal-seaside",
    name: "Seaside Multifamily",
    market: "San Diego, CA",
    occupancy: "93%",
    status: "Underwriting updates",
    nextAction: "Refresh ARGUS sensitivities",
    folderId: "folder-seaside-multifamily",
  },
];

const HOME_ACTIVITY: ActivityItem[] = [
  {
    id: "activity-memo",
    title: "Screening memo draft ready",
    timestamp: "10 minutes ago",
    summary:
      "Stag drafted the Horizon Logistics screening memo with rent roll highlights and risk flags.",
    actionLabel: "Review memo",
    actionNavId: "history-reports",
  },
  {
    id: "activity-argus",
    title: "ARGUS export synced",
    timestamp: "1 hour ago",
    summary:
      "Latest ARGUS sensitivity scenarios pushed to Sheets for Seaside Multifamily.",
    actionLabel: "Open Sheets",
    actionNavId: "sheets",
  },
  {
    id: "activity-files",
    title: "New diligence docs indexed",
    timestamp: "Yesterday",
    summary:
      "CAM reconciliation and traffic study processed for Suncrest Retail.",
    actionLabel: "View files",
    actionNavId: "file-library",
    actionFolderId: "folder-suncrest-retail",
  },
];

const HISTORY_TIMELINE: ActivityItem[] = [
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
    actionFolderId: "folder-horizon-logistics",
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

  // Update folder index when data changes
  useEffect(() => {
    setFolderIndex(buildFolderIndex(fileLibraryData));
  }, [fileLibraryData]);

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
  const startUploads = (files: File[]) => {
    const newUploads: UploadItem[] = files.map(file => ({
      id: `upload-${Date.now()}-${Math.random()}`,
      file,
      progress: 0,
      status: 'uploading' as const,
    }));

    setUploadManager(prev => ({
      ...prev,
      uploads: [...prev.uploads, ...newUploads],
      isVisible: true,
      isMinimized: false,
    }));

    // Start mock upload for each file
    newUploads.forEach(upload => {
      simulateUpload(upload.id);
    });
  };

  const simulateUpload = (uploadId: string) => {
    // Simulate random upload time between 1-5 seconds
    const totalTime = Math.random() * 4000 + 1000;
    const steps = 20;
    const stepTime = totalTime / steps;
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      const progress = Math.min((currentStep / steps) * 100, 95); // Cap at 95% until complete

      setUploadManager(prev => ({
        ...prev,
        uploads: prev.uploads.map(u =>
          u.id === uploadId ? { ...u, progress } : u
        ),
      }));

      if (currentStep >= steps) {
        clearInterval(interval);

        // Randomly simulate error (10% chance)
        const hasError = Math.random() < 0.1;

        setTimeout(() => {
          setUploadManager(prev => ({
            ...prev,
            uploads: prev.uploads.map(u =>
              u.id === uploadId
                ? {
                    ...u,
                    progress: hasError ? u.progress : 100,
                    status: hasError ? 'error' : 'completed',
                    error: hasError ? 'Upload failed. Please try again.' : undefined,
                  }
                : u
            ),
          }));

          // Auto-dismiss after 3 seconds if all uploads are complete
          setTimeout(() => {
            setUploadManager(prev => {
              const activeUploads = prev.uploads.filter(u => u.status === 'uploading');
              if (activeUploads.length === 0) {
                return { ...prev, isVisible: false };
              }
              return prev;
            });
          }, 3000);
        }, 200);
      }
    }, stepTime);
  };

  const cancelUpload = (uploadId: string) => {
    setUploadManager(prev => ({
      ...prev,
      uploads: prev.uploads.map(u =>
        u.id === uploadId ? { ...u, status: 'cancelled' } : u
      ),
    }));
  };

  const retryUpload = (uploadId: string) => {
    setUploadManager(prev => ({
      ...prev,
      uploads: prev.uploads.map(u =>
        u.id === uploadId
          ? { ...u, progress: 0, status: 'uploading', error: undefined }
          : u
      ),
    }));
    simulateUpload(uploadId);
  };

  const removeUpload = (uploadId: string) => {
    setUploadManager(prev => ({
      ...prev,
      uploads: prev.uploads.filter(u => u.id !== uploadId),
    }));
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
            <span className="flex-1 text-left">{item.label}</span>
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
                  <span className="flex-1 text-left">{child.label}</span>
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

  const renderContent = () => {
    switch (activeNavId) {
      case "file-library":
        return (
          <FileLibraryView
            activeFolder={activeFolder}
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
            onViewModeChange={setViewMode}
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
        return <ChatInterface />;
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
          <SpreadsheetEditor />
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
  breadcrumbs: BreadcrumbItem[];
  files: RealEstateFile[];
  fileLibraryData: RealEstateFolder;
  folderStats: FolderStats;
  folders: RealEstateFolder[];
  isSearching: boolean;
  onBreadcrumbSelect: (id: string) => void;
  onFileUpload: (files: File[]) => void;
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
  fileLibraryData,
  folderStats,
  folders,
  isSearching,
  onBreadcrumbSelect,
  onFileUpload,
  onFolderOpen,
  onSearchChange,
  onViewModeChange,
  searchQuery,
  viewMode,
}: FileLibraryViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Start uploads using the upload manager
    onFileUpload(files);

    // Clear the input
    event.target.value = '';
  };

  const handleFolderUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Start uploads using the upload manager
    onFileUpload(files);

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
                onClick={() => onOpenFolder("folder-horizon-logistics")}
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
  onNavigate: (viewId: string) => void;
  onOpenFolder: (folderId: string) => void;
};

function ReportWorkspaceView({
  sections,
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
                Horizon Logistics Park
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
            <Button onClick={() => onOpenFolder("folder-horizon-logistics")} variant="outline">
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
        <Button onClick={() => onOpenFolder("folder-horizon-logistics")} variant="outline">
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
};

function ChatInterface() {
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
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get all available folders for selection
  const availableFolders = useMemo(() => {
    const folders = [];
    if (FILE_LIBRARY_ROOT.children) {
      for (const folder of FILE_LIBRARY_ROOT.children) {
        folders.push({
          id: folder.id,
          name: folder.name,
          description: folder.description,
        });
        // Also include subfolders
        if (folder.children) {
          for (const subfolder of folder.children) {
            folders.push({
              id: subfolder.id,
              name: `${folder.name} > ${subfolder.name}`,
              description: subfolder.description,
            });
          }
        }
      }
    }
    return folders;
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [state.messages]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setState(prev => ({
      ...prev,
      attachedFiles: [...prev.attachedFiles, ...files],
    }));
  };

  const handleFolderUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setState(prev => ({
      ...prev,
      attachedFiles: [...prev.attachedFiles, ...files],
    }));
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

    // Simulate streaming response with folder context
    setTimeout(() => {
      const selectedFolderNames = state.selectedFolders.length > 0
        ? state.selectedFolders.map(folderId => availableFolders.find(f => f.id === folderId)?.name).filter(Boolean)
        : [];

      const assistantContent = selectedFolderNames.length > 0
        ? `I've analyzed your query using documents from the following datasets: ${selectedFolderNames.join(", ")}. Here are some insights based on that context.`
        : "I've analyzed your data and found some interesting insights.";

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `${assistantContent} Let me show you a visualization of the property values over time.`,
        timestamp: new Date().toLocaleTimeString(),
        visualizations: [
          {
            id: "chart-1",
            type: "chart",
            title: "Property Value Trends",
            data: {
              labels: ["2020", "2021", "2022", "2023", "2024"],
              datasets: [{
                label: "Average Property Value",
                data: [250000, 275000, 310000, 345000, 380000],
                borderColor: "rgb(75, 192, 192)",
                tension: 0.1
              }]
            }
          }
        ],
      };

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
        isStreaming: false,
      }));
    }, 2000);
  };

  const openVisualization = (viz: VisualizationData) => {
    setState(prev => ({ ...prev, showVisualization: viz }));
  };

  const closeVisualization = () => {
    setState(prev => ({ ...prev, showVisualization: null }));
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
              key={index}
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
        <div className="flex items-center gap-2 text-sm">
          <Folder className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Active datasets:</span>
          <span className="text-xs text-muted-foreground/80">
            {state.selectedFolders.length} selected
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {availableFolders.map((folder) => {
            const isSelected = state.selectedFolders.includes(folder.id);
            return (
              <div
                key={folder.id}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors",
                  isSelected
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border/60 bg-muted/30 hover:bg-muted/50"
                )}
                onClick={() => {
                  setState(prev => ({
                    ...prev,
                    selectedFolders: isSelected
                      ? prev.selectedFolders.filter(id => id !== folder.id)
                      : [...prev.selectedFolders, folder.id]
                  }));
                }}
              >
                <Checkbox
                  checked={isSelected}
                  onChange={() => {}}
                  className="pointer-events-none"
                />
                <span className="font-medium">{folder.name}</span>
              </div>
            );
          })}
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
