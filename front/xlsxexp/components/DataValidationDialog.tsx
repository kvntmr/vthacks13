"use client";

import React, { useState } from "react";
import { X, Check, AlertCircle } from "lucide-react";

interface DataValidationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (validation: DataValidationRule) => void;
  selectedRange?: { startRow: number; endRow: number; startCol: number; endCol: number };
}

interface DataValidationRule {
  type: 'number' | 'text' | 'date' | 'list' | 'custom';
  operator: 'between' | 'notBetween' | 'equal' | 'notEqual' | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual';
  value1?: string | number;
  value2?: string | number;
  listValues?: string[];
  customFormula?: string;
  showErrorAlert: boolean;
  errorTitle?: string;
  errorMessage?: string;
  showInputMessage: boolean;
  inputTitle?: string;
  inputMessage?: string;
}

const DataValidationDialog: React.FC<DataValidationDialogProps> = ({
  isOpen,
  onClose,
  onApply,
  selectedRange
}) => {
  const [validation, setValidation] = useState<DataValidationRule>({
    type: 'number',
    operator: 'between',
    showErrorAlert: true,
    errorTitle: 'Invalid Input',
    errorMessage: 'The value you entered is not valid.',
    showInputMessage: true,
    inputTitle: 'Data Validation',
    inputMessage: 'Please enter a valid value.'
  });

  const handleApply = () => {
    onApply(validation);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Data Validation</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Validation Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Allow
            </label>
            <select
              value={validation.type}
              onChange={(e) => setValidation({ ...validation, type: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="number">Whole number</option>
              <option value="text">Text length</option>
              <option value="date">Date</option>
              <option value="list">List of items</option>
              <option value="custom">Custom formula</option>
            </select>
          </div>

          {/* Operator */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data
            </label>
            <select
              value={validation.operator}
              onChange={(e) => setValidation({ ...validation, operator: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="between">between</option>
              <option value="notBetween">not between</option>
              <option value="equal">equal to</option>
              <option value="notEqual">not equal to</option>
              <option value="greaterThan">greater than</option>
              <option value="lessThan">less than</option>
              <option value="greaterThanOrEqual">greater than or equal to</option>
              <option value="lessThanOrEqual">less than or equal to</option>
            </select>
          </div>

          {/* Values */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum
              </label>
              <input
                type={validation.type === 'number' ? 'number' : 'text'}
                value={validation.value1 || ''}
                onChange={(e) => setValidation({ ...validation, value1: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter value"
              />
            </div>
            {validation.operator === 'between' || validation.operator === 'notBetween' ? (
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum
                </label>
                <input
                  type={validation.type === 'number' ? 'number' : 'text'}
                  value={validation.value2 || ''}
                  onChange={(e) => setValidation({ ...validation, value2: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter value"
                />
              </div>
            ) : null}
          </div>

          {/* List Values */}
          {validation.type === 'list' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Source
              </label>
              <input
                type="text"
                value={validation.listValues?.join(',') || ''}
                onChange={(e) => setValidation({ 
                  ...validation, 
                  listValues: e.target.value.split(',').map(v => v.trim()).filter(v => v) 
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter values separated by commas"
              />
            </div>
          )}

          {/* Custom Formula */}
          {validation.type === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Formula
              </label>
              <input
                type="text"
                value={validation.customFormula || ''}
                onChange={(e) => setValidation({ ...validation, customFormula: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter formula (e.g., =A1>0)"
              />
            </div>
          )}

          {/* Error Alert */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showErrorAlert"
                checked={validation.showErrorAlert}
                onChange={(e) => setValidation({ ...validation, showErrorAlert: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="showErrorAlert" className="text-sm font-medium text-gray-700">
                Show error alert after invalid data is entered
              </label>
            </div>

            {validation.showErrorAlert && (
              <div className="ml-6 space-y-2">
                <input
                  type="text"
                  value={validation.errorTitle || ''}
                  onChange={(e) => setValidation({ ...validation, errorTitle: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Error title"
                />
                <input
                  type="text"
                  value={validation.errorMessage || ''}
                  onChange={(e) => setValidation({ ...validation, errorMessage: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Error message"
                />
              </div>
            )}
          </div>

          {/* Input Message */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showInputMessage"
                checked={validation.showInputMessage}
                onChange={(e) => setValidation({ ...validation, showInputMessage: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="showInputMessage" className="text-sm font-medium text-gray-700">
                Show input message when cell is selected
              </label>
            </div>

            {validation.showInputMessage && (
              <div className="ml-6 space-y-2">
                <input
                  type="text"
                  value={validation.inputTitle || ''}
                  onChange={(e) => setValidation({ ...validation, inputTitle: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Input title"
                />
                <input
                  type="text"
                  value={validation.inputMessage || ''}
                  onChange={(e) => setValidation({ ...validation, inputMessage: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Input message"
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataValidationDialog;
