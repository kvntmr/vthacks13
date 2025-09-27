# Enhanced React Spreadsheet

A comprehensive React spreadsheet component built with [react-spreadsheet](https://github.com/iddan/react-spreadsheet) that provides Excel/Google Sheets-like functionality.

## Features

### 🎯 Core Features
- **Full-featured spreadsheet** with Excel/Google Sheets-like interface
- **Formula support** with custom formula parser
- **Cell formatting** (bold, italic, underline, alignment, colors)
- **Data operations** (sort, filter, find/replace)
- **Import/Export** (CSV, Excel support)
- **Keyboard shortcuts** for common operations
- **Undo/Redo** functionality with history management
- **Context menu** with right-click operations
- **Data validation** with custom rules
- **Responsive design** with modern UI

### 🛠️ Technical Features
- **TypeScript support** with full type safety
- **Performance optimized** with efficient rendering
- **Accessible** with proper ARIA attributes
- **Customizable** with extensive configuration options
- **Extensible** architecture for adding new features

## Installation

```bash
npm install react-spreadsheet scheduler lucide-react
```

## Quick Start

```tsx
import React, { useState } from 'react';
import EnhancedSpreadsheet from './components/EnhancedSpreadsheet';

function App() {
  const [data, setData] = useState([
    [{ value: "Name" }, { value: "Age" }, { value: "Salary" }],
    [{ value: "John Doe" }, { value: 30 }, { value: 50000 }],
    [{ value: "Jane Smith" }, { value: 25 }, { value: 45000 }],
  ]);

  return (
    <EnhancedSpreadsheet
      initialData={data}
      onDataChange={setData}
      onSave={(data) => console.log('Saving:', data)}
      showToolbar={true}
      showFormulaBar={true}
      showStatusBar={true}
      enableFormulas={true}
      enableFormatting={true}
      enableDataOperations={true}
      enableImportExport={true}
    />
  );
}
```

## Component Props

### EnhancedSpreadsheet Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `initialData` | `Matrix<EnhancedCell>` | `[]` | Initial spreadsheet data |
| `onDataChange` | `(data: Matrix<EnhancedCell>) => void` | - | Callback when data changes |
| `onSave` | `(data: Matrix<EnhancedCell>) => void` | - | Callback when save is triggered |
| `readOnly` | `boolean` | `false` | Make spreadsheet read-only |
| `showToolbar` | `boolean` | `true` | Show/hide toolbar |
| `showFormulaBar` | `boolean` | `true` | Show/hide formula bar |
| `showStatusBar` | `boolean` | `true` | Show/hide status bar |
| `enableFormulas` | `boolean` | `true` | Enable formula support |
| `enableFormatting` | `boolean` | `true` | Enable cell formatting |
| `enableDataOperations` | `boolean` | `true` | Enable data operations |
| `enableImportExport` | `boolean` | `true` | Enable import/export |
| `maxRows` | `number` | `1000` | Maximum number of rows |
| `maxColumns` | `number` | `100` | Maximum number of columns |

### EnhancedCell Interface

```tsx
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
```

## Features in Detail

### 📊 Formula Support
- Built-in formula parser with support for common functions
- Custom formula functions can be added
- Real-time formula evaluation
- Formula bar for editing complex formulas

```tsx
// Example formulas
=SUM(A1:A10)
=AVERAGE(B1:B5)
=CUSTOM_SUM(C1:C3)
```

### 🎨 Cell Formatting
- **Text formatting**: Bold, italic, underline
- **Alignment**: Left, center, right
- **Colors**: Background and text colors
- **Borders**: Custom border styling
- **Number formats**: Currency, percentage, date

### 📋 Data Operations
- **Sorting**: Ascending/descending by any column
- **Filtering**: Filter data by criteria
- **Search**: Find and highlight matching cells
- **Find/Replace**: Search and replace functionality

### 📁 Import/Export
- **CSV Import/Export**: Full CSV support
- **Excel Import/Export**: XLSX file support (with additional libraries)
- **Data validation**: Ensure data integrity

### ⌨️ Keyboard Shortcuts
- `Ctrl+S`: Save
- `Ctrl+Z`: Undo
- `Ctrl+Y`: Redo
- `Ctrl+F`: Find
- `Ctrl+B`: Bold
- `Ctrl+I`: Italic
- `Ctrl+U`: Underline
- `Ctrl+C`: Copy
- `Ctrl+V`: Paste
- `Ctrl+X`: Cut

### 🖱️ Context Menu
Right-click on any cell to access:
- Copy, Cut, Paste, Delete
- Insert/Delete rows and columns
- Formatting options
- Data operations (sort, filter)
- Alignment options

### ✅ Data Validation
- **Number validation**: Range, equality checks
- **Text validation**: Length, pattern matching
- **Date validation**: Date range validation
- **List validation**: Dropdown with predefined values
- **Custom validation**: Formula-based validation
- **Error messages**: Custom error alerts and input messages

## Advanced Usage

### Custom Formula Functions

```tsx
const customFormulaParser = createFormulaParser(data, {
  CUSTOM_SUM: (args: number[]) => args.reduce((sum, val) => sum + val, 0),
  CUSTOM_AVERAGE: (args: number[]) => {
    const sum = args.reduce((sum, val) => sum + val, 0);
    return sum / args.length;
  }
});

<EnhancedSpreadsheet
  createFormulaParser={customFormulaParser}
  // ... other props
/>
```

### Custom Styling

```tsx
const customCell = {
  value: "Custom Cell",
  bold: true,
  italic: true,
  backgroundColor: "#f0f0f0",
  textColor: "#333",
  alignment: "center" as const,
  border: {
    top: true,
    bottom: true,
    left: true,
    right: true
  }
};
```

### Data Validation Example

```tsx
const validationRule = {
  type: 'number' as const,
  operator: 'between' as const,
  value1: 0,
  value2: 100,
  showErrorAlert: true,
  errorTitle: 'Invalid Input',
  errorMessage: 'Please enter a number between 0 and 100.',
  showInputMessage: true,
  inputTitle: 'Number Validation',
  inputMessage: 'Enter a number between 0 and 100.'
};
```

## Performance Considerations

- **Virtualization**: For large datasets, consider implementing row virtualization
- **Debouncing**: Data changes are debounced to prevent excessive re-renders
- **Memory management**: History is limited to 50 entries to prevent memory leaks
- **Efficient updates**: Only changed cells are re-rendered

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Built with [react-spreadsheet](https://github.com/iddan/react-spreadsheet)
- Icons by [Lucide](https://lucide.dev/)
- Styling with [Tailwind CSS](https://tailwindcss.com/)

## Roadmap

- [ ] Chart integration
- [ ] Collaborative editing
- [ ] Advanced filtering UI
- [ ] Pivot table support
- [ ] Macro recording
- [ ] Plugin system
- [ ] Mobile optimization
- [ ] Accessibility improvements