"use client";
import React, { useState, useCallback, useRef, useEffect } from "react";
import Spreadsheet from "react-spreadsheet";
import { Button } from "./ui/button";
import { useTheme } from "next-themes";

// Custom styles for the spreadsheet with enhanced dark mode support
const spreadsheetStyles = `
  .spreadsheet-wrapper {
    width: 100% !important;
    height: 100% !important;
    overflow: hidden !important;
    background-color: hsl(var(--background)) !important;
    position: relative !important;
  }
  
  .spreadsheet-container {
    width: 100% !important;
    height: 100% !important;
    overflow: auto !important;
    background-color: hsl(var(--background)) !important;
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
  }
  
  .react-spreadsheet {
    background-color: hsl(var(--background)) !important;
    color: hsl(var(--foreground)) !important;
    display: inline-block !important;
    min-width: fit-content !important;
    min-height: fit-content !important;
  }
  
  .react-spreadsheet .react-spreadsheet-container {
    background-color: hsl(var(--background)) !important;
    display: inline-block !important;
  }
  
  .react-spreadsheet .react-spreadsheet-cell {
    background-color: hsl(var(--background)) !important;
    color: hsl(var(--foreground)) !important;
    border-color: hsl(var(--border)) !important;
    min-width: 80px !important;
    width: 80px !important;
    max-width: 80px !important;
    transition: background-color 0.15s ease !important;
  }
  
  .react-spreadsheet .react-spreadsheet-cell input {
    background-color: transparent !important;
    color: hsl(var(--foreground)) !important;
    width: 100% !important;
    min-width: 0 !important;
    border: none !important;
    outline: none !important;
    padding: 4px 8px !important;
    font-size: 14px !important;
    line-height: 1.4 !important;
  }
  
  .react-spreadsheet .react-spreadsheet-cell:hover {
    background-color: hsl(var(--accent)) !important;
  }
  
  .react-spreadsheet .react-spreadsheet-cell.selected {
    background-color: hsl(var(--accent)) !important;
    box-shadow: inset 0 0 0 2px hsl(var(--ring)) !important;
  }
  
  .react-spreadsheet .react-spreadsheet-cell.selected input {
    background-color: transparent !important;
  }
  
  /* Dark mode specific enhancements */
  .dark .react-spreadsheet .react-spreadsheet-cell {
    border-color: hsl(var(--border)) !important;
  }
  
  .dark .react-spreadsheet .react-spreadsheet-cell:hover {
    background-color: hsl(var(--accent)) !important;
  }
  
  .dark .react-spreadsheet .react-spreadsheet-cell.selected {
    background-color: hsl(var(--accent)) !important;
    box-shadow: inset 0 0 0 2px hsl(var(--ring)) !important;
  }
  
  /* System theme preference support */
  @media (prefers-color-scheme: dark) {
    .spreadsheet-wrapper,
    .spreadsheet-container,
    .react-spreadsheet,
    .react-spreadsheet .react-spreadsheet-container {
      background-color: hsl(var(--background)) !important;
      color: hsl(var(--foreground)) !important;
    }
    
    .react-spreadsheet .react-spreadsheet-cell {
      background-color: hsl(var(--background)) !important;
      color: hsl(var(--foreground)) !important;
      border-color: hsl(var(--border)) !important;
    }
    
    .react-spreadsheet .react-spreadsheet-cell input {
      background-color: transparent !important;
      color: hsl(var(--foreground)) !important;
    }
    
    .react-spreadsheet .react-spreadsheet-cell:hover {
      background-color: hsl(var(--accent)) !important;
    }
    
    .react-spreadsheet .react-spreadsheet-cell.selected {
      background-color: hsl(var(--accent)) !important;
      box-shadow: inset 0 0 0 2px hsl(var(--ring)) !important;
    }
    
    .react-spreadsheet .react-spreadsheet-row-header,
    .react-spreadsheet .react-spreadsheet-column-header {
      background-color: hsl(var(--muted)) !important;
      color: hsl(var(--muted-foreground)) !important;
      border-color: hsl(var(--border)) !important;
    }
    
    .react-spreadsheet .react-spreadsheet-corner {
      background-color: hsl(var(--muted)) !important;
      border-color: hsl(var(--border)) !important;
    }
    
    .spreadsheet-container::-webkit-scrollbar-track {
      background: hsl(var(--muted)) !important;
    }
    
    .spreadsheet-container::-webkit-scrollbar-thumb {
      background: hsl(var(--border)) !important;
    }
    
    .spreadsheet-container::-webkit-scrollbar-thumb:hover {
      background: hsl(var(--muted-foreground)) !important;
    }
  }
  
  /* Light mode system preference support */
  @media (prefers-color-scheme: light) {
    .spreadsheet-wrapper,
    .spreadsheet-container,
    .react-spreadsheet,
    .react-spreadsheet .react-spreadsheet-container {
      background-color: hsl(var(--background)) !important;
      color: hsl(var(--foreground)) !important;
    }
    
    .react-spreadsheet .react-spreadsheet-cell {
      background-color: hsl(var(--background)) !important;
      color: hsl(var(--foreground)) !important;
      border-color: hsl(var(--border)) !important;
    }
    
    .react-spreadsheet .react-spreadsheet-cell input {
      background-color: transparent !important;
      color: hsl(var(--foreground)) !important;
    }
    
    .react-spreadsheet .react-spreadsheet-cell:hover {
      background-color: hsl(var(--accent)) !important;
    }
    
    .react-spreadsheet .react-spreadsheet-cell.selected {
      background-color: hsl(var(--accent)) !important;
      box-shadow: inset 0 0 0 2px hsl(var(--ring)) !important;
    }
    
    .react-spreadsheet .react-spreadsheet-row-header,
    .react-spreadsheet .react-spreadsheet-column-header {
      background-color: hsl(var(--muted)) !important;
      color: hsl(var(--muted-foreground)) !important;
      border-color: hsl(var(--border)) !important;
    }
    
    .react-spreadsheet .react-spreadsheet-corner {
      background-color: hsl(var(--muted)) !important;
      border-color: hsl(var(--border)) !important;
    }
  }
  
  /* Row and column headers */
  .react-spreadsheet .react-spreadsheet-row-header,
  .react-spreadsheet .react-spreadsheet-column-header {
    background-color: hsl(var(--muted)) !important;
    color: hsl(var(--muted-foreground)) !important;
    border-color: hsl(var(--border)) !important;
    font-weight: 500 !important;
    font-size: 12px !important;
  }
  
  .dark .react-spreadsheet .react-spreadsheet-row-header,
  .dark .react-spreadsheet .react-spreadsheet-column-header {
    background-color: hsl(var(--muted)) !important;
    color: hsl(var(--muted-foreground)) !important;
  }
  
  /* Corner cell */
  .react-spreadsheet .react-spreadsheet-corner {
    background-color: hsl(var(--muted)) !important;
    border-color: hsl(var(--border)) !important;
  }
  
  .dark .react-spreadsheet .react-spreadsheet-corner {
    background-color: hsl(var(--muted)) !important;
  }
  
  /* Focus states for better accessibility */
  .react-spreadsheet .react-spreadsheet-cell:focus-within {
    outline: 2px solid hsl(var(--ring)) !important;
    outline-offset: -2px !important;
  }
  
  /* Scrollbar styling for dark mode */
  .spreadsheet-container::-webkit-scrollbar {
    width: 8px !important;
    height: 8px !important;
  }
  
  .spreadsheet-container::-webkit-scrollbar-track {
    background: hsl(var(--muted)) !important;
  }
  
  .spreadsheet-container::-webkit-scrollbar-thumb {
    background: hsl(var(--border)) !important;
    border-radius: 4px !important;
  }
  
  .spreadsheet-container::-webkit-scrollbar-thumb:hover {
    background: hsl(var(--muted-foreground)) !important;
  }
  
`;

// Generate initial data with a reasonable starting size
const generateInitialData = () => {
  const rows = 50;
  const cols = 50;
  const data = [];
  
  // Create data rows
  for (let i = 0; i < rows; i++) {
    const row = [];
    for (let j = 0; j < cols; j++) {
      // Add some sample data in first few rows/columns
      if (i === 0 && j === 0) row.push({ value: "Name" });
      else if (i === 0 && j === 1) row.push({ value: "Age" });
      else if (i === 0 && j === 2) row.push({ value: "Department" });
      else if (i === 0 && j === 3) row.push({ value: "Salary" });
      else if (i === 1 && j === 0) row.push({ value: "Alice" });
      else if (i === 1 && j === 1) row.push({ value: "22" });
      else if (i === 1 && j === 2) row.push({ value: "Engineering" });
      else if (i === 1 && j === 3) row.push({ value: "75000" });
      else if (i === 2 && j === 0) row.push({ value: "Bob" });
      else if (i === 2 && j === 1) row.push({ value: "25" });
      else if (i === 2 && j === 2) row.push({ value: "Marketing" });
      else if (i === 2 && j === 3) row.push({ value: "65000" });
      else {
        row.push({ value: "" });
      }
    }
    data.push(row);
  }
  
  return data;
};

export default function SpreadsheetEditor() {
  const [data, setData] = useState(generateInitialData);
  const [selectedCells, setSelectedCells] = useState<any>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { theme, systemTheme } = useTheme();
  const [isSystemDark, setIsSystemDark] = useState(false);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setIsSystemDark(e.matches);
    };
    
    // Set initial value
    setIsSystemDark(mediaQuery.matches);
    
    // Listen for changes
    mediaQuery.addEventListener('change', handleChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  // Handle data changes - allow dynamic expansion
  const handleDataChange = useCallback((newData: any) => {
    // Ensure minimum grid size for usability
    const minRows = 50;
    const minCols = 50;
    
    // Ensure we have at least the minimum number of rows
    while (newData.length < minRows) {
      const newRow = Array(newData[0]?.length || minCols).fill({ value: "" });
      newData.push(newRow);
    }
    
    // Ensure we have at least the minimum number of columns
    const maxCols = Math.max(...newData.map((row: any) => row.length), minCols);
    const expandedData = newData.map((row: any) => {
      while (row.length < maxCols) {
        row.push({ value: "" });
      }
      return row;
    });
    
    setData(expandedData);
  }, []);

  // CSV import functionality
  const handleImportCSV = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      try {
        // Parse CSV data
        const lines = text.split('\n').filter(line => line.trim() !== '');
        const csvData = lines.map(line => {
          // Simple CSV parsing - handles basic cases
          const values = line.split(',').map(value => value.trim().replace(/^"|"$/g, ''));
          return values.map(value => ({ value }));
        });

        // Ensure we have at least some data
        if (csvData.length === 0) {
          alert('No data found in CSV file');
          return;
        }

        // Find the maximum number of columns in the CSV data
        const maxCols = Math.max(...csvData.map(row => row.length));
        const numRows = Math.max(csvData.length, 50);
        const numCols = Math.max(maxCols, 50); // Minimum 10 columns

        // Create a dynamic grid based on CSV data size
        const newData = [];
        for (let i = 0; i < numRows; i++) {
          const row = [];
          for (let j = 0; j < numCols; j++) {
            if (i < csvData.length && j < csvData[i].length) {
              row.push(csvData[i][j]);
            } else {
              row.push({ value: "" });
            }
          }
          newData.push(row);
        }

        setData(newData);
        alert(`CSV imported successfully! Loaded ${csvData.length} rows and ${maxCols} columns.`);
      } catch (error) {
        console.error('Error parsing CSV:', error);
        alert('Error parsing CSV file. Please check the format.');
      }
    };

    reader.readAsText(file);
    
    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Text formatting functions
  const handleBold = useCallback(() => {
    console.log("Bold formatting applied");
    // TODO: Implement bold formatting for selected cells
  }, []);

  const handleItalic = useCallback(() => {
    console.log("Italic formatting applied");
    // TODO: Implement italic formatting for selected cells
  }, []);

  const handleUnderline = useCallback(() => {
    console.log("Underline formatting applied");
    // TODO: Implement underline formatting for selected cells
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: spreadsheetStyles }} />
      <div className="flex flex-col h-full w-full bg-background rounded-lg border border-border shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 p-3 border-b border-border bg-muted/30 rounded-t-lg flex-shrink-0">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={handleImportCSV}>
              Import CSV
            </Button>
          </div>
          
          <div className="w-px h-6 bg-border mx-2" />
          
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={handleBold} className="h-8 w-8 p-0">
              <strong>B</strong>
            </Button>
            <Button variant="outline" size="sm" onClick={handleItalic} className="h-8 w-8 p-0">
              <em>I</em>
            </Button>
            <Button variant="outline" size="sm" onClick={handleUnderline} className="h-8 w-8 p-0">
              <u>U</u>
            </Button>
          </div>
        </div>

        {/* Spreadsheet Container */}
        <div className="flex-1 bg-background rounded-b-lg overflow-hidden">
          <div 
            className={`spreadsheet-wrapper w-full h-full ${theme === 'dark' || (theme === 'system' && isSystemDark) ? 'dark' : ''}`}
            style={{ 
              maxHeight: 'calc(100vh - 200px)',
              maxWidth: '100%'
            }}
          >
            <div className={`spreadsheet-container ${theme === 'dark' || (theme === 'system' && isSystemDark) ? 'dark' : ''}`}>
              <Spreadsheet 
                data={data} 
                onChange={handleDataChange}
                onSelect={(selected: any) => setSelectedCells(selected)}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Hidden file input for CSV import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </>
  );
}