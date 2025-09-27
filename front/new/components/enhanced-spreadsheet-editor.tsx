"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { parse, unparse } from "papaparse";
import DataGrid, { textEditor } from "react-data-grid";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarInset,
} from "@/components/ui/sidebar";

// Icons
import {
  HomeIcon,
  LineChartIcon,
  FileIcon,
  InvoiceIcon,
  SidebarLeftIcon,
  DownloadIcon,
} from "@/components/icons";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Filter,
  Plus,
} from "lucide-react";

import "react-data-grid/lib/styles.css";

export type SpreadsheetEditorProps = {
  initialData?: string;
  onSave?: (data: string) => void;
  className?: string;
};

type CellFormat = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  align?: 'left' | 'center' | 'right';
};

type FormattedCell = {
  value: string;
  format?: CellFormat;
};

const SAMPLE_DATA = `Income Statement,2023,2022
,Revenues,3542.8,3215.6
,Gross Profit,1650.4,1461.3
,Operating Expenses,425.6,388.2
,EBITDA,1582.7,1426.8
,Net Income,982.5,1352.6
,Rent (Handbook),5.8,3.8
,EBITDA - Rent,1576.9,1421.0
,Rent Coverage,272.9%,245.3%`;

const MIN_ROWS = 30;
const MIN_COLS = 15;

// Sidebar Navigation Items
const navigationItems = [
  {
    title: "Home",
    icon: HomeIcon,
    isActive: true,
  },
  {
    title: "History",
    icon: FileIcon,
  },
  {
    title: "Charts",
    icon: LineChartIcon,
  },
  {
    title: "Reports",
    icon: InvoiceIcon,
  },
  {
    title: "Report Settings",
    icon: FileIcon,
  },
  {
    title: "File Library",
    icon: FileIcon,
  },
  {
    title: "Sheets",
    icon: FileIcon,
  },
];

// Formatting Toolbar Component
const FormattingToolbar = ({
  onExportCSV,
  onExportXLSX,
  onSave,
}: {
  onExportCSV: () => void;
  onExportXLSX: () => void;
  onSave: () => void;
}) => {
  const [selectedFormat, setSelectedFormat] = useState<CellFormat>({});

  return (
    <div className="flex items-center justify-between border-b bg-background p-2">
      <div className="flex items-center space-x-1">
        {/* File Operations */}
        <Button size="sm" onClick={onSave}>
          Save
        </Button>
        <Button variant="outline" size="sm" onClick={onExportCSV}>
          Export CSV
        </Button>
        <Button variant="outline" size="sm" onClick={onExportXLSX}>
          Export XLSX
        </Button>
        
        <Separator orientation="vertical" className="mx-2 h-6" />
        
        {/* Text Formatting */}
        <div className="flex items-center space-x-1">
          <Input
            placeholder="Filter 13"
            className="h-8 w-20 text-xs"
          />
          <Button
            variant={selectedFormat.bold ? "default" : "ghost"}
            size="sm"
            onClick={() => setSelectedFormat(prev => ({ ...prev, bold: !prev.bold }))}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            variant={selectedFormat.italic ? "default" : "ghost"}
            size="sm"
            onClick={() => setSelectedFormat(prev => ({ ...prev, italic: !prev.italic }))}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            variant={selectedFormat.underline ? "default" : "ghost"}
            size="sm"
            onClick={() => setSelectedFormat(prev => ({ ...prev, underline: !prev.underline }))}
          >
            <Underline className="h-4 w-4" />
          </Button>
          <Button
            variant={selectedFormat.strikethrough ? "default" : "ghost"}
            size="sm"
            onClick={() => setSelectedFormat(prev => ({ ...prev, strikethrough: !prev.strikethrough }))}
          >
            <Strikethrough className="h-4 w-4" />
          </Button>
          
          <Separator orientation="vertical" className="mx-2 h-6" />
          
          {/* Alignment */}
          <Button
            variant={selectedFormat.align === 'left' ? "default" : "ghost"}
            size="sm"
            onClick={() => setSelectedFormat(prev => ({ ...prev, align: 'left' }))}
          >
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button
            variant={selectedFormat.align === 'center' ? "default" : "ghost"}
            size="sm"
            onClick={() => setSelectedFormat(prev => ({ ...prev, align: 'center' }))}
          >
            <AlignCenter className="h-4 w-4" />
          </Button>
          <Button
            variant={selectedFormat.align === 'right' ? "default" : "ghost"}
            size="sm"
            onClick={() => setSelectedFormat(prev => ({ ...prev, align: 'right' }))}
          >
            <AlignRight className="h-4 w-4" />
          </Button>
          
          <Separator orientation="vertical" className="mx-2 h-6" />
          
          <Button variant="ghost" size="sm">
            <Filter className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="text-sm text-muted-foreground">
        Tables from Screening Memo ✏️
      </div>
    </div>
  );
};

// Sidebar Component
const SpreadsheetSidebar = () => {
  return (
    <Sidebar>
      <SidebarHeader className="border-b">
        <div className="px-2 py-2">
          <h2 className="text-lg font-semibold">stag</h2>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    isActive={item.isActive}
                    className="w-full justify-start"
                  >
                    <item.icon size={16} />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};

// Main Spreadsheet Component
const SpreadsheetGrid = ({
  content,
  onContentChange,
}: {
  content: string;
  onContentChange: (content: string) => void;
}) => {
  const { resolvedTheme } = useTheme();
  
  const parseData = useMemo(() => {
    if (!content) {
      return Array(MIN_ROWS).fill(Array(MIN_COLS).fill(""));
    }
    const result = parse<string[]>(content, { skipEmptyLines: false });

    const paddedData = result.data.map((row) => {
      const paddedRow = [...row];
      while (paddedRow.length < MIN_COLS) {
        paddedRow.push("");
      }
      return paddedRow;
    });

    while (paddedData.length < MIN_ROWS) {
      paddedData.push(Array(MIN_COLS).fill(""));
    }

    return paddedData;
  }, [content]);

  const columns = useMemo(() => {
    const rowNumberColumn = {
      key: "rowNumber",
      name: "",
      frozen: true,
      width: 50,
      renderCell: ({ rowIdx }: { rowIdx: number }) => (
        <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
          {rowIdx + 1}
        </div>
      ),
      cellClass: "border-r bg-muted/50 text-muted-foreground",
      headerCellClass: "border-r bg-muted text-muted-foreground",
    };

    const dataColumns = Array.from({ length: MIN_COLS }, (_, i) => ({
      key: i.toString(),
      name: String.fromCharCode(65 + i),
      renderEditCell: textEditor,
      width: 120,
      cellClass: cn(
        "border-r border-b dark:border-zinc-700",
        "hover:bg-accent/50 focus-within:bg-accent/50"
      ),
      headerCellClass: cn(
        "border-r border-b bg-muted dark:border-zinc-700",
        "text-xs font-medium text-center"
      ),
    }));

    return [rowNumberColumn, ...dataColumns];
  }, []);

  const initialRows = useMemo(() => {
    return parseData.map((row, rowIndex) => {
      const rowData: Record<string, any> = {
        id: rowIndex,
        rowNumber: rowIndex + 1,
      };

      columns.slice(1).forEach((col, colIndex) => {
        rowData[col.key] = row[colIndex] || "";
      });

      return rowData;
    });
  }, [parseData, columns]);

  const [localRows, setLocalRows] = useState(initialRows);

  useEffect(() => {
    setLocalRows(initialRows);
  }, [initialRows]);

  const handleRowsChange = useCallback((newRows: any[]) => {
    setLocalRows(newRows);

    const updatedData = newRows.map((row) => {
      return columns.slice(1).map((col) => row[col.key] || "");
    });

    const newCsvContent = unparse(updatedData);
    onContentChange(newCsvContent);
  }, [columns, onContentChange]);

  return (
    <div className="flex-1 overflow-hidden">
      <DataGrid
        className={cn(
          "flex-1",
          resolvedTheme === "dark" ? "rdg-dark" : "rdg-light"
        )}
        columns={columns}
        rows={localRows}
        defaultColumnOptions={{
          resizable: true,
          sortable: true,
        }}
        enableVirtualization
        onCellClick={(args) => {
          if (args.column.key !== "rowNumber") {
            args.selectCell(true);
          }
        }}
        onRowsChange={handleRowsChange}
        style={{ 
          height: "100%",
          "--rdg-header-background-color": "hsl(var(--muted))",
          "--rdg-border-color": "hsl(var(--border))",
          "--rdg-summary-border-color": "hsl(var(--border))",
        } as any}
      />
    </div>
  );
};

// Main Enhanced Spreadsheet Editor Component
const PureEnhancedSpreadsheetEditor = ({
  initialData = SAMPLE_DATA,
  onSave,
  className,
}: SpreadsheetEditorProps) => {
  const [content, setContent] = useState(initialData);

  const handleSave = useCallback(() => {
    onSave?.(content);
    toast.success("Spreadsheet saved successfully!");
  }, [content, onSave]);

  const handleExportCSV = useCallback(() => {
    const parsed = parse<string[]>(content, { skipEmptyLines: true });
    const nonEmptyRows = parsed.data.filter((row) =>
      row.some((cell) => cell.trim() !== "")
    );
    const cleanedCsv = unparse(nonEmptyRows);
    
    const blob = new Blob([cleanedCsv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "spreadsheet.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success("CSV exported successfully!");
  }, [content]);

  const handleExportXLSX = useCallback(() => {
    // For now, we'll export as CSV with xlsx extension
    // In a real implementation, you'd use a library like xlsx
    const parsed = parse<string[]>(content, { skipEmptyLines: true });
    const nonEmptyRows = parsed.data.filter((row) =>
      row.some((cell) => cell.trim() !== "")
    );
    const cleanedCsv = unparse(nonEmptyRows);
    
    const blob = new Blob([cleanedCsv], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "spreadsheet.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success("XLSX exported successfully!");
  }, [content]);

  return (
    <SidebarProvider defaultOpen={true}>
      <div className={cn("flex h-screen w-full", className)}>
        <SpreadsheetSidebar />
        <SidebarInset className="flex flex-col">
          <FormattingToolbar
            onSave={handleSave}
            onExportCSV={handleExportCSV}
            onExportXLSX={handleExportXLSX}
          />
          <SpreadsheetGrid
            content={content}
            onContentChange={setContent}
          />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

// Memoized component for performance
export const EnhancedSpreadsheetEditor = memo(PureEnhancedSpreadsheetEditor);

// Default export
export default EnhancedSpreadsheetEditor;
