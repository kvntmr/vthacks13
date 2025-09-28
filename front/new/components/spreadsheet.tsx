"use client";
import React, { useState, useCallback } from "react";
import Spreadsheet from "react-spreadsheet";
import { Button } from "./ui/button";

// Custom styles for the spreadsheet
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
  }
  
  .react-spreadsheet .react-spreadsheet-cell input {
    background-color: hsl(var(--background)) !important;
    color: hsl(var(--foreground)) !important;
    width: 100% !important;
    min-width: 0 !important;
  }
  
  .react-spreadsheet .react-spreadsheet-cell:hover {
    background-color: hsl(var(--accent)) !important;
  }
  
  .react-spreadsheet .react-spreadsheet-cell.selected {
    background-color: hsl(var(--accent)) !important;
  }
`;

// Generate a fixed 50x50 grid
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

  // Handle data changes - keep fixed 50x50 grid
  const handleDataChange = useCallback((newData: any) => {
    setData(newData);
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
            className="spreadsheet-wrapper w-full h-full" 
            style={{ 
              maxHeight: 'calc(100vh - 200px)',
              maxWidth: '100%'
            }}
          >
            <div className="spreadsheet-container">
              <Spreadsheet 
                data={data} 
                onChange={handleDataChange}
                onSelect={(selected: any) => setSelectedCells(selected)}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}