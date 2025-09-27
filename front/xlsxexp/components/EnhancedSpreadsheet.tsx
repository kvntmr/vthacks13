"use client";

import React, { useState, useCallback, useMemo } from "react";
import Spreadsheet, { 
  Matrix, 
  CellBase,
  DataViewer
} from "react-spreadsheet";
import { 
  Bold, 
  Italic, 
  Underline, 
  AlignLeft, 
  AlignCenter, 
  AlignRight,
  Download,
  Upload,
  Search,
  Filter,
  SortAsc,
  SortDesc,
  Copy,
  Paste,
  Undo,
  Redo,
  Save,
  Plus,
  Minus,
  Trash2,
  MoreHorizontal
} from "lucide-react";

// Types for enhanced cell data
interface EnhancedCell extends CellBase {
  value: string | number;
  readOnly?: boolean;
  className?: string;
  style?: React.CSSProperties;
  format?: 'text' | 'number' | 'currency' | 'percentage' | 'date';
  formula?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  backgroundColor?: string;
  textColor?: string;
  alignment?: 'left' | 'center' | 'right';
  border?: {
    top?: boolean;
    right?: boolean;
    bottom?: boolean;
    left?: boolean;
  };
}

// Custom DataViewer component to handle formatting
const CustomDataViewer: React.FC<{ cell: EnhancedCell }> = ({ cell }) => {
  const style: React.CSSProperties = {
    fontWeight: cell.bold ? 'bold' : 'normal',
    fontStyle: cell.italic ? 'italic' : 'normal',
    textDecoration: cell.underline ? 'underline' : 'none',
    backgroundColor: cell.backgroundColor || 'transparent',
    color: cell.textColor || 'inherit',
    textAlign: cell.alignment || 'left',
    borderTop: cell.border?.top ? '2px solid #374151' : 'none',
    borderRight: cell.border?.right ? '2px solid #374151' : 'none',
    borderBottom: cell.border?.bottom ? '2px solid #374151' : 'none',
    borderLeft: cell.border?.left ? '2px solid #374151' : 'none',
    padding: '4px 8px',
    minHeight: '20px',
    display: 'flex',
    alignItems: 'center',
    ...cell.style
  };

  // Ensure good contrast for text visibility
  const textColor = cell.textColor || (cell.backgroundColor && cell.backgroundColor !== '#ffffff' ? '#ffffff' : '#000000');

  return (
    <div 
      style={{ ...style, color: textColor }} 
      className={`${cell.className || ''} ${cell.bold ? 'font-bold' : ''} ${cell.italic ? 'italic' : ''} ${cell.underline ? 'underline' : ''}`}
    >
      {cell.value}
    </div>
  );
};

interface SpreadsheetToolbarProps {
  onBold: () => void;
  onItalic: () => void;
  onUnderline: () => void;
  onAlignLeft: () => void;
  onAlignCenter: () => void;
  onAlignRight: () => void;
  onBackgroundColor: (color: string) => void;
  onTextColor: (color: string) => void;
  onClearFormatting: () => void;
  onAddRow: () => void;
  onAddColumn: () => void;
  onDeleteRow: () => void;
  onDeleteColumn: () => void;
  onSortAsc: () => void;
  onSortDesc: () => void;
  onFilter: () => void;
  onFind: () => void;
  onExport: () => void;
  onImport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  canUndo: boolean;
  canRedo: boolean;
  selectedCell?: { row: number; column: number } | null;
  data: Matrix<EnhancedCell>;
}

const SpreadsheetToolbar: React.FC<SpreadsheetToolbarProps> = ({
  onBold,
  onItalic,
  onUnderline,
  onAlignLeft,
  onAlignCenter,
  onAlignRight,
  onBackgroundColor,
  onTextColor,
  onClearFormatting,
  onAddRow,
  onAddColumn,
  onDeleteRow,
  onDeleteColumn,
  onSortAsc,
  onSortDesc,
  onFilter,
  onFind,
  onExport,
  onImport,
  onUndo,
  onRedo,
  onSave,
  canUndo,
  canRedo,
  selectedCell,
  data
}) => {
  const currentCell = selectedCell ? data[selectedCell.row]?.[selectedCell.column] : null;
  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-50 border-b border-gray-200">
      {/* File Operations */}
      <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
        <button
          onClick={onSave}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Save (Ctrl+S)"
        >
          <Save className="w-4 h-4" />
        </button>
        <button
          onClick={onImport}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Import CSV/Excel"
        >
          <Upload className="w-4 h-4" />
        </button>
        <button
          onClick={onExport}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Export CSV/Excel"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>

      {/* Undo/Redo */}
      <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="p-2 hover:bg-gray-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Undo (Ctrl+Z)"
        >
          <Undo className="w-4 h-4" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="p-2 hover:bg-gray-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Redo (Ctrl+Y)"
        >
          <Redo className="w-4 h-4" />
        </button>
      </div>

      {/* Formatting */}
      <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
        <button
          onClick={onBold}
          className={`p-2 hover:bg-gray-200 rounded transition-colors ${
            currentCell?.bold ? 'bg-blue-100 text-blue-600' : ''
          }`}
          title="Bold (Ctrl+B)"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          onClick={onItalic}
          className={`p-2 hover:bg-gray-200 rounded transition-colors ${
            currentCell?.italic ? 'bg-blue-100 text-blue-600' : ''
          }`}
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          onClick={onUnderline}
          className={`p-2 hover:bg-gray-200 rounded transition-colors ${
            currentCell?.underline ? 'bg-blue-100 text-blue-600' : ''
          }`}
          title="Underline (Ctrl+U)"
        >
          <Underline className="w-4 h-4" />
        </button>
      </div>

      {/* Alignment */}
      <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
        <button
          onClick={onAlignLeft}
          className={`p-2 hover:bg-gray-200 rounded transition-colors ${
            currentCell?.alignment === 'left' ? 'bg-blue-100 text-blue-600' : ''
          }`}
          title="Align Left"
        >
          <AlignLeft className="w-4 h-4" />
        </button>
        <button
          onClick={onAlignCenter}
          className={`p-2 hover:bg-gray-200 rounded transition-colors ${
            currentCell?.alignment === 'center' ? 'bg-blue-100 text-blue-600' : ''
          }`}
          title="Align Center"
        >
          <AlignCenter className="w-4 h-4" />
        </button>
        <button
          onClick={onAlignRight}
          className={`p-2 hover:bg-gray-200 rounded transition-colors ${
            currentCell?.alignment === 'right' ? 'bg-blue-100 text-blue-600' : ''
          }`}
          title="Align Right"
        >
          <AlignRight className="w-4 h-4" />
        </button>
      </div>

      {/* Colors */}
      <div className="flex items-center gap-2 border-r border-gray-300 pr-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Background:</span>
          <input
            type="color"
            value={currentCell?.backgroundColor || '#ffffff'}
            onChange={(e) => onBackgroundColor(e.target.value)}
            className="w-8 h-8 border-2 border-gray-300 rounded cursor-pointer hover:border-blue-400 transition-colors"
            title="Background Color"
          />
          <div className="flex gap-1">
            {['#ffffff', '#fef3c7', '#d1fae5', '#dbeafe', '#fce7f3', '#f3e8ff'].map((color) => (
              <button
                key={color}
                onClick={() => onBackgroundColor(color)}
                className={`w-6 h-6 rounded border-2 ${
                  currentCell?.backgroundColor === color ? 'border-blue-500' : 'border-gray-300'
                } hover:border-blue-400 transition-colors`}
                style={{ backgroundColor: color }}
                title={`Set background to ${color}`}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Text:</span>
          <input
            type="color"
            value={currentCell?.textColor || '#000000'}
            onChange={(e) => onTextColor(e.target.value)}
            className="w-8 h-8 border-2 border-gray-300 rounded cursor-pointer hover:border-blue-400 transition-colors"
            title="Text Color"
          />
          <div className="flex gap-1">
            {['#000000', '#dc2626', '#059669', '#2563eb', '#7c3aed', '#db2777'].map((color) => (
              <button
                key={color}
                onClick={() => onTextColor(color)}
                className={`w-6 h-6 rounded border-2 ${
                  currentCell?.textColor === color ? 'border-blue-500' : 'border-gray-300'
                } hover:border-blue-400 transition-colors`}
                style={{ backgroundColor: color }}
                title={`Set text color to ${color}`}
              />
            ))}
          </div>
        </div>
        <button
          onClick={onClearFormatting}
          className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded transition-colors"
          title="Clear All Formatting"
        >
          Clear
        </button>
      </div>

      {/* Data Operations */}
      <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
        <button
          onClick={onSortAsc}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Sort Ascending"
        >
          <SortAsc className="w-4 h-4" />
        </button>
        <button
          onClick={onSortDesc}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Sort Descending"
        >
          <SortDesc className="w-4 h-4" />
        </button>
        <button
          onClick={onFilter}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Filter"
        >
          <Filter className="w-4 h-4" />
        </button>
        <button
          onClick={onFind}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Find (Ctrl+F)"
        >
          <Search className="w-4 h-4" />
        </button>
      </div>

      {/* Row/Column Operations */}
      <div className="flex items-center gap-1">
        <button
          onClick={onAddRow}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Add Row"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={onAddColumn}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Add Column"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={onDeleteRow}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Delete Row"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={onDeleteColumn}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Delete Column"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

interface EnhancedSpreadsheetProps {
  initialData?: Matrix<EnhancedCell>;
  onDataChange?: (data: Matrix<EnhancedCell>) => void;
  onSave?: (data: Matrix<EnhancedCell>) => void;
  readOnly?: boolean;
  showToolbar?: boolean;
  showFormulaBar?: boolean;
  showStatusBar?: boolean;
  enableFormulas?: boolean;
  enableFormatting?: boolean;
  enableDataOperations?: boolean;
  enableImportExport?: boolean;
  maxRows?: number;
  maxColumns?: number;
}

const EnhancedSpreadsheet: React.FC<EnhancedSpreadsheetProps> = ({
  initialData = [
    [{ value: "Name" }, { value: "Age" }, { value: "Salary" }, { value: "Department" }],
    [{ value: "John Doe" }, { value: 30 }, { value: 50000 }, { value: "Engineering" }],
    [{ value: "Jane Smith" }, { value: 25 }, { value: 45000 }, { value: "Marketing" }],
    [{ value: "Bob Johnson" }, { value: 35 }, { value: 60000 }, { value: "Sales" }],
    [{ value: "Alice Brown" }, { value: 28 }, { value: 55000 }, { value: "Engineering" }],
  ],
  onDataChange,
  onSave,
  readOnly = false,
  showToolbar = true,
  showFormulaBar = true,
  showStatusBar = true,
  enableFormulas = true,
  enableFormatting = true,
  enableDataOperations = true,
  enableImportExport = true,
  maxRows = 1000,
  maxColumns = 100
}) => {
  const [data, setData] = useState<Matrix<EnhancedCell>>(initialData);
  const [selectedCell, setSelectedCell] = useState<{ row: number; column: number } | null>(null);
  const [formulaBarValue, setFormulaBarValue] = useState("");
  const [history, setHistory] = useState<Matrix<EnhancedCell>[]>([initialData]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [filteredData, setFilteredData] = useState<Matrix<EnhancedCell> | null>(null);

  // History management
  const saveToHistory = useCallback((newData: Matrix<EnhancedCell>) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newData);
    if (newHistory.length > 50) { // Limit history to 50 entries
      newHistory.shift();
    } else {
      setHistoryIndex(historyIndex + 1);
    }
    setHistory(newHistory);
  }, [history, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setData(history[newIndex]);
      onDataChange?.(history[newIndex]);
    }
  }, [history, historyIndex, onDataChange]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setData(history[newIndex]);
      onDataChange?.(history[newIndex]);
    }
  }, [history, historyIndex, onDataChange]);

  // Data operations
  const addRow = useCallback((index?: number) => {
    const newData = [...data];
    const insertIndex = index ?? data.length;
    const newRow = Array(data[0]?.length || 1).fill(null).map(() => ({ value: "" }));
    newData.splice(insertIndex, 0, newRow);
    setData(newData);
    saveToHistory(newData);
    onDataChange?.(newData);
  }, [data, onDataChange, saveToHistory]);

  const addColumn = useCallback((index?: number) => {
    const newData = data.map(row => {
      const newRow = [...row];
      const insertIndex = index ?? row.length;
      newRow.splice(insertIndex, 0, { value: "" });
      return newRow;
    });
    setData(newData);
    saveToHistory(newData);
    onDataChange?.(newData);
  }, [data, onDataChange, saveToHistory]);

  const deleteRow = useCallback((index: number) => {
    if (data.length > 1) {
      const newData = data.filter((_, i) => i !== index);
      setData(newData);
      saveToHistory(newData);
      onDataChange?.(newData);
    }
  }, [data, onDataChange, saveToHistory]);

  const deleteColumn = useCallback((index: number) => {
    if (data[0]?.length > 1) {
      const newData = data.map(row => row.filter((_, i) => i !== index));
      setData(newData);
      saveToHistory(newData);
      onDataChange?.(newData);
    }
  }, [data, onDataChange, saveToHistory]);

  // Formatting functions
  const applyFormatting = useCallback((format: Partial<EnhancedCell>) => {
    if (!selectedCell) return;
    
    const newData = data.map((row, rowIndex) =>
      row.map((cell, colIndex) => {
        if (rowIndex === selectedCell.row && colIndex === selectedCell.column) {
          return { ...cell, ...format };
        }
        return cell;
      })
    );
    setData(newData);
    saveToHistory(newData);
    onDataChange?.(newData);
  }, [data, selectedCell, onDataChange, saveToHistory]);

  // Clear formatting function
  const clearFormatting = useCallback(() => {
    if (!selectedCell) return;
    
    const newData = data.map((row, rowIndex) =>
      row.map((cell, colIndex) => {
        if (rowIndex === selectedCell.row && colIndex === selectedCell.column) {
          return { 
            ...cell, 
            bold: false,
            italic: false,
            underline: false,
            backgroundColor: undefined,
            textColor: undefined,
            alignment: undefined,
            border: undefined
          };
        }
        return cell;
      })
    );
    setData(newData);
    saveToHistory(newData);
    onDataChange?.(newData);
  }, [data, selectedCell, onDataChange, saveToHistory]);

  // Formula parser - temporarily disabled for debugging
  // const formulaParser = useMemo(() => {
  //   if (!enableFormulas) return undefined;
  //   
  //   return (data: Matrix<CellBase>) => createFormulaParser(data);
  // }, [enableFormulas]);

  // Search and filter
  const performSearch = useCallback((term: string) => {
    if (!term.trim()) {
      setFilteredData(null);
      return;
    }

    const filtered = data.map((row, rowIndex) =>
      row.map((cell, colIndex) => {
        const cellValue = String(cell.value || "").toLowerCase();
        const matches = cellValue.includes(term.toLowerCase());
        return matches ? { ...cell, className: "bg-yellow-200" } : cell;
      })
    );
    setFilteredData(filtered);
  }, [data]);

  const sortData = useCallback((columnIndex: number, ascending: boolean = true) => {
    if (data.length <= 1) return; // Don't sort if only header or empty

    const newData = [...data];
    const header = newData[0];
    const dataRows = newData.slice(1);

    dataRows.sort((a, b) => {
      const aVal = a[columnIndex]?.value;
      const bVal = b[columnIndex]?.value;
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return ascending ? aVal - bVal : bVal - aVal;
      }
      
      const aStr = String(aVal || "").toLowerCase();
      const bStr = String(bVal || "").toLowerCase();
      return ascending ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });

    const sortedData = [header, ...dataRows];
    setData(sortedData);
    saveToHistory(sortedData);
    onDataChange?.(sortedData);
  }, [data, onDataChange, saveToHistory]);

  // Import/Export functions
  const exportToCSV = useCallback(() => {
    const csvContent = data
      .map(row => row.map(cell => `"${cell.value || ""}"`).join(","))
      .join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "spreadsheet.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  const importFromCSV = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n");
      const newData = lines.map(line => 
        line.split(",").map(cell => ({ value: cell.replace(/"/g, "") }))
      );
      setData(newData);
      saveToHistory(newData);
      onDataChange?.(newData);
    };
    reader.readAsText(file);
  }, [onDataChange, saveToHistory]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case 's':
          event.preventDefault();
          onSave?.(data);
          break;
        case 'z':
          event.preventDefault();
          undo();
          break;
        case 'y':
          event.preventDefault();
          redo();
          break;
        case 'f':
          event.preventDefault();
          setShowSearch(true);
          break;
        case 'b':
          event.preventDefault();
          if (selectedCell) {
            const currentCell = data[selectedCell.row]?.[selectedCell.column];
            applyFormatting({ bold: !currentCell?.bold });
          }
          break;
        case 'i':
          event.preventDefault();
          if (selectedCell) {
            const currentCell = data[selectedCell.row]?.[selectedCell.column];
            applyFormatting({ italic: !currentCell?.italic });
          }
          break;
        case 'u':
          event.preventDefault();
          if (selectedCell) {
            const currentCell = data[selectedCell.row]?.[selectedCell.column];
            applyFormatting({ underline: !currentCell?.underline });
          }
          break;
      }
    }
  }, [data, selectedCell, undo, redo, applyFormatting, onSave]);

  const handleDataChange = useCallback((newData: Matrix<CellBase>) => {
    const enhancedData = newData.map(row => 
      row.map(cell => ({ ...cell } as EnhancedCell))
    );
    setData(enhancedData);
    saveToHistory(enhancedData);
    onDataChange?.(enhancedData);
  }, [onDataChange, saveToHistory]);

  const currentData = filteredData || data;

  return (
    <div className="w-full h-full flex flex-col" onKeyDown={handleKeyDown} tabIndex={0}>
      {showToolbar && (
        <SpreadsheetToolbar
          onBold={() => {
            const currentCell = selectedCell ? data[selectedCell.row]?.[selectedCell.column] : null;
            applyFormatting({ bold: !currentCell?.bold });
          }}
          onItalic={() => {
            const currentCell = selectedCell ? data[selectedCell.row]?.[selectedCell.column] : null;
            applyFormatting({ italic: !currentCell?.italic });
          }}
          onUnderline={() => {
            const currentCell = selectedCell ? data[selectedCell.row]?.[selectedCell.column] : null;
            applyFormatting({ underline: !currentCell?.underline });
          }}
          onAlignLeft={() => applyFormatting({ alignment: 'left' })}
          onAlignCenter={() => applyFormatting({ alignment: 'center' })}
          onAlignRight={() => applyFormatting({ alignment: 'right' })}
          onBackgroundColor={(color) => applyFormatting({ backgroundColor: color })}
          onTextColor={(color) => applyFormatting({ textColor: color })}
          onClearFormatting={clearFormatting}
          onAddRow={() => addRow()}
          onAddColumn={() => addColumn()}
          onDeleteRow={() => selectedCell && deleteRow(selectedCell.row)}
          onDeleteColumn={() => selectedCell && deleteColumn(selectedCell.column)}
          onSortAsc={() => selectedCell && sortData(selectedCell.column, true)}
          onSortDesc={() => selectedCell && sortData(selectedCell.column, false)}
          onFilter={() => {/* Implement filter dialog */}}
          onFind={() => setShowSearch(true)}
          onExport={exportToCSV}
          onImport={() => document.getElementById('file-input')?.click()}
          onUndo={undo}
          onRedo={redo}
          onSave={() => onSave?.(data)}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < history.length - 1}
          selectedCell={selectedCell}
          data={data}
        />
      )}

      {showFormulaBar && (
        <div className="flex items-center gap-2 p-2 bg-gray-100 border-b">
          <span className="text-sm font-medium">Formula:</span>
          <input
            type="text"
            value={formulaBarValue}
            onChange={(e) => setFormulaBarValue(e.target.value)}
            className="flex-1 px-2 py-1 border rounded text-sm"
            placeholder="Enter formula or value..."
          />
        </div>
      )}

      {showSearch && (
        <div className="flex items-center gap-2 p-2 bg-blue-50 border-b">
          <Search className="w-4 h-4" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              performSearch(e.target.value);
            }}
            className="flex-1 px-2 py-1 border rounded text-sm"
            placeholder="Search in spreadsheet..."
            autoFocus
          />
          <button
            onClick={() => {
              setShowSearch(false);
              setSearchTerm("");
              setFilteredData(null);
            }}
            className="px-2 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
          >
            Close
          </button>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <Spreadsheet
          data={currentData}
          onChange={handleDataChange}
          DataViewer={CustomDataViewer}
          onSelect={(selected) => {
            if (selected.length > 0) {
              setSelectedCell({ row: selected[0].row, column: selected[0].column });
              const cell = currentData[selected[0].row]?.[selected[0].column];
              setFormulaBarValue(cell?.formula || String(cell?.value || ""));
            }
          }}
          className="w-full h-full"
        />
      </div>

      {showStatusBar && (
        <div className="flex items-center justify-between p-2 bg-gray-100 border-t text-sm text-gray-600">
          <div className="flex items-center gap-4">
            <span>Rows: {data.length}</span>
            <span>Columns: {data[0]?.length || 0}</span>
            {selectedCell && (
              <span>Selected: {String.fromCharCode(65 + selectedCell.column)}{selectedCell.row + 1}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span>Ready</span>
          </div>
        </div>
      )}

      <input
        id="file-input"
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={importFromCSV}
        className="hidden"
      />
    </div>
  );
};

export default EnhancedSpreadsheet;
