"use client";
import React, { useState } from "react";
import EnhancedSpreadsheet from "./EnhancedSpreadsheet";
import { Matrix, CellBase } from "react-spreadsheet";

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

export default function SpreadsheetEditor() {
  const [data, setData] = useState<Matrix<EnhancedCell>>([
    [{ value: "Name" }, { value: "Age" }, { value: "Salary" }, { value: "Department" }],
    [{ value: "John Doe" }, { value: 30 }, { value: 50000 }, { value: "Engineering" }],
    [{ value: "Jane Smith" }, { value: 25 }, { value: 45000 }, { value: "Marketing" }],
    [{ value: "Bob Johnson" }, { value: 35 }, { value: 60000 }, { value: "Sales" }],
    [{ value: "Alice Brown" }, { value: 28 }, { value: 55000 }, { value: "Engineering" }],
    [{ value: "Charlie Wilson" }, { value: 32 }, { value: 48000 }, { value: "HR" }],
    [{ value: "Diana Prince" }, { value: 29 }, { value: 52000 }, { value: "Finance" }],
  ]);

  const handleSave = (data: Matrix<EnhancedCell>) => {
    console.log("Saving data:", data);
    // Here you would typically save to a backend or local storage
    alert("Data saved successfully!");
  };

  return (
    <div className="w-full h-screen flex flex-col">
      <div className="p-4 bg-white border-b">
        <h1 className="text-2xl font-bold text-gray-800">Enhanced Spreadsheet Editor</h1>
        <p className="text-gray-600 mt-1">
          A comprehensive spreadsheet component with Excel/Google Sheets-like features
        </p>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <EnhancedSpreadsheet
          initialData={data}
          onDataChange={setData}
          onSave={handleSave}
          showToolbar={true}
          showFormulaBar={true}
          showStatusBar={true}
          enableFormulas={true}
          enableFormatting={true}
          enableDataOperations={true}
          enableImportExport={true}
        />
      </div>
    </div>
  );
}
