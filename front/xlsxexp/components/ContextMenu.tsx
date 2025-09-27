"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Copy, 
  Paste, 
  Cut, 
  Delete, 
  InsertRowAbove, 
  InsertRowBelow,
  InsertColumnLeft,
  InsertColumnRight,
  DeleteRow,
  DeleteColumn,
  FormatBold,
  FormatItalic,
  FormatUnderline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  SortAsc,
  SortDesc,
  Filter,
  MoreHorizontal
} from "lucide-react";

interface ContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onAction: (action: string) => void;
  selectedCell?: { row: number; column: number } | null;
  canPaste?: boolean;
  canCut?: boolean;
  canCopy?: boolean;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  isOpen,
  position,
  onClose,
  onAction,
  selectedCell,
  canPaste = false,
  canCut = false,
  canCopy = false
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const menuItems = [
    {
      group: "Edit",
      items: [
        { id: "copy", label: "Copy", icon: Copy, disabled: !canCopy, shortcut: "Ctrl+C" },
        { id: "cut", label: "Cut", icon: Cut, disabled: !canCut, shortcut: "Ctrl+X" },
        { id: "paste", label: "Paste", icon: Paste, disabled: !canPaste, shortcut: "Ctrl+V" },
        { id: "delete", label: "Delete", icon: Delete, shortcut: "Del" }
      ]
    },
    {
      group: "Insert",
      items: [
        { id: "insertRowAbove", label: "Insert Row Above", icon: InsertRowAbove },
        { id: "insertRowBelow", label: "Insert Row Below", icon: InsertRowBelow },
        { id: "insertColumnLeft", label: "Insert Column Left", icon: InsertColumnLeft },
        { id: "insertColumnRight", label: "Insert Column Right", icon: InsertColumnRight }
      ]
    },
    {
      group: "Delete",
      items: [
        { id: "deleteRow", label: "Delete Row", icon: DeleteRow },
        { id: "deleteColumn", label: "Delete Column", icon: DeleteColumn }
      ]
    },
    {
      group: "Format",
      items: [
        { id: "bold", label: "Bold", icon: FormatBold, shortcut: "Ctrl+B" },
        { id: "italic", label: "Italic", icon: FormatItalic, shortcut: "Ctrl+I" },
        { id: "underline", label: "Underline", icon: FormatUnderline, shortcut: "Ctrl+U" }
      ]
    },
    {
      group: "Align",
      items: [
        { id: "alignLeft", label: "Align Left", icon: AlignLeft },
        { id: "alignCenter", label: "Align Center", icon: AlignCenter },
        { id: "alignRight", label: "Align Right", icon: AlignRight }
      ]
    },
    {
      group: "Data",
      items: [
        { id: "sortAsc", label: "Sort Ascending", icon: SortAsc },
        { id: "sortDesc", label: "Sort Descending", icon: SortDesc },
        { id: "filter", label: "Filter", icon: Filter }
      ]
    }
  ];

  return (
    <div
      ref={menuRef}
      className="fixed bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-50 min-w-48"
      style={{
        left: position.x,
        top: position.y,
        maxHeight: '80vh',
        overflowY: 'auto'
      }}
    >
      {menuItems.map((group, groupIndex) => (
        <div key={group.group}>
          {groupIndex > 0 && <div className="border-t border-gray-100 my-1" />}
          <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {group.group}
          </div>
          {group.items.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onAction(item.id);
                onClose();
              }}
              disabled={item.disabled}
              className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </div>
              {item.shortcut && (
                <span className="text-xs text-gray-400">{item.shortcut}</span>
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
};

export default ContextMenu;
