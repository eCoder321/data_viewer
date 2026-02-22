/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { 
  Upload, 
  Search, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  Table as TableIcon,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Columns,
  Eye,
  EyeOff,
  Check,
  Plus,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { DataRow, SpreadsheetData } from './types';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [data, setData] = useState<SpreadsheetData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string | null; direction: 'asc' | 'desc' }>({
    key: null,
    direction: 'asc'
  });
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set());
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [pendingChanges, setPendingChanges] = useState<Record<string, string | number | boolean | null>>({});
  const [editingField, setEditingField] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback((file: File) => {
    const reader = new FileReader();
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (extension === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const headers = results.meta.fields || [];
          setData({
            headers,
            rows: results.data as DataRow[],
            fileName: file.name
          });
          setVisibleColumns(new Set(headers));
        }
      });
    } else if (extension === 'xlsx' || extension === 'xls') {
      reader.onload = (e) => {
        const bstr = e.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const jsonData = XLSX.utils.sheet_to_json(ws) as DataRow[];
        
        if (jsonData.length > 0) {
          const headers = Object.keys(jsonData[0]);
          setData({
            headers,
            rows: jsonData,
            fileName: file.name
          });
          setVisibleColumns(new Set(headers));
        }
      };
      reader.readAsBinaryString(file);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    
    let rows = data.rows;
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      rows = rows.filter(row => 
        Object.values(row).some(val => 
          String(val).toLowerCase().includes(query)
        )
      );
    }

    // Sort
    if (sortConfig.key) {
      rows = [...rows].sort((a, b) => {
        const aVal = a[sortConfig.key!];
        const bVal = b[sortConfig.key!];
        
        if (aVal === bVal) return 0;
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        const aStr = String(aVal ?? '').toLowerCase();
        const bStr = String(bVal ?? '').toLowerCase();
        
        if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return rows;
  }, [data, searchQuery, sortConfig]);

  const toggleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const toggleColumn = (header: string) => {
    const next = new Set(visibleColumns);
    if (next.has(header)) {
      if (next.size > 1) next.delete(header); // Keep at least one column
    } else {
      next.add(header);
    }
    setVisibleColumns(next);
  };

  const handleRowClick = (index: number) => {
    if (Object.keys(pendingChanges).length > 0) {
      if (!confirm('You have unsaved changes. Do you want to discard them?')) {
        return;
      }
    }
    setSelectedIndex(index);
    setIsPanelOpen(true);
    setPendingChanges({});
    setEditingField(null);
  };

  const navigateRecord = (direction: 'prev' | 'next') => {
    if (selectedIndex === null) return;
    if (Object.keys(pendingChanges).length > 0) {
      if (!confirm('You have unsaved changes. Do you want to discard them?')) {
        return;
      }
    }
    const newIndex = direction === 'prev' 
      ? Math.max(0, selectedIndex - 1) 
      : Math.min(filteredRows.length - 1, selectedIndex + 1);
    setSelectedIndex(newIndex);
    setPendingChanges({});
    setEditingField(null);
  };

  const handleFieldUpdate = (header: string, value: string) => {
    setPendingChanges(prev => ({
      ...prev,
      [header]: value
    }));
    setEditingField(null);
  };

  const saveChanges = () => {
    if (selectedIndex === null || !data) return;
    
    const updatedRows = [...data.rows];
    const targetRow = filteredRows[selectedIndex];
    const originalIndex = data.rows.indexOf(targetRow);
    
    if (originalIndex !== -1) {
      updatedRows[originalIndex] = {
        ...updatedRows[originalIndex],
        ...pendingChanges
      };
      
      setData({
        ...data,
        rows: updatedRows
      });
      setPendingChanges({});
    }
  };

  const addColumn = (name: string) => {
    if (!data || !name.trim()) return;
    const trimmedName = name.trim();
    if (data.headers.includes(trimmedName)) {
      alert('Column already exists');
      return;
    }

    const updatedHeaders = [...data.headers, trimmedName];
    const updatedRows = data.rows.map(row => ({
      ...row,
      [trimmedName]: ''
    }));

    setData({
      ...data,
      headers: updatedHeaders,
      rows: updatedRows
    });
    setVisibleColumns(prev => new Set([...prev, trimmedName]));
    setIsAddingColumn(false);
    setNewColumnName('');
  };

  const downloadCSV = () => {
    if (!data) return;
    const csv = Papa.unparse(data.rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `updated_${data.fileName.replace(/\.[^/.]+$/, "")}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetApp = () => {
    if (Object.keys(pendingChanges).length > 0) {
      if (!confirm('You have unsaved changes. Do you want to discard them?')) {
        return;
      }
    }
    setData(null);
    setSearchQuery('');
    setSelectedIndex(null);
    setIsPanelOpen(false);
    setPendingChanges({});
    setEditingField(null);
  };

  if (!data) {
    return (
      <div className="min-h-screen bg-[#F5F5F4] flex flex-col items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl w-full text-center"
        >
          <div className="mb-8">
            <div className="w-16 h-16 bg-black text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
              <TableIcon size={32} />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-black mb-2">DataLens</h1>
            <p className="text-stone-500 text-lg">Local-first spreadsheet viewer for high-density scanning.</p>
          </div>

          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "relative group cursor-pointer border-2 border-dashed rounded-3xl p-12 transition-all duration-300",
              isDragging 
                ? "border-black bg-stone-100 scale-[1.02]" 
                : "border-stone-300 bg-white hover:border-stone-400 hover:shadow-lg"
            )}
          >
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              accept=".csv,.xlsx,.xls"
              className="hidden"
            />
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Upload className="text-stone-600" size={24} />
              </div>
              <p className="text-lg font-medium text-stone-900">Drop your spreadsheet here</p>
              <p className="text-sm text-stone-500 mt-1">Supports CSV and Excel (.xlsx, .xls)</p>
            </div>
          </div>

          <div className="mt-12 flex items-center justify-center gap-8 text-stone-400">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-medium uppercase tracking-wider">Client-side only</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-xs font-medium uppercase tracking-wider">No data leaves your device</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <header className="h-16 border-bottom border-stone-200 flex items-center justify-between px-6 bg-white shrink-0 z-20">
        <div className="flex items-center gap-4">
          <button 
            onClick={resetApp}
            className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-500"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-stone-400" />
            <h2 className="font-semibold text-stone-900 truncate max-w-[200px]">{data.fileName}</h2>
            <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full font-medium">
              {data.rows.length} rows
            </span>
          </div>
        </div>

        <div className="flex-1 max-w-xl mx-8">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-black transition-colors" size={18} />
            <input
              type="text"
              placeholder="Search across all fields..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-stone-100 border-none rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-black/5 focus:bg-white transition-all outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 relative">
          <button
            onClick={downloadCSV}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-100 transition-all"
            title="Download updated CSV"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Export</span>
          </button>

          <button
            onClick={() => setIsAddingColumn(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-100 transition-all"
            title="Add new column"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Add Column</span>
          </button>

          <button
            onClick={() => setIsColumnMenuOpen(!isColumnMenuOpen)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all",
              isColumnMenuOpen ? "bg-black text-white" : "text-stone-600 hover:bg-stone-100"
            )}
          >
            <Columns size={16} />
            <span>Columns</span>
          </button>

          <AnimatePresence>
            {isColumnMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-30" 
                  onClick={() => setIsColumnMenuOpen(false)} 
                />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-stone-200 z-40 p-2 overflow-hidden"
                >
                  <div className="px-3 py-2 border-b border-stone-100 mb-1">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Display Columns</span>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {data.headers.map(header => (
                      <button
                        key={header}
                        onClick={() => toggleColumn(header)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-stone-50 transition-colors text-sm text-stone-700"
                      >
                        <span className="truncate mr-2">{header}</span>
                        {visibleColumns.has(header) ? (
                          <Check size={14} className="text-emerald-500 shrink-0" />
                        ) : (
                          <div className="w-3.5 h-3.5 border border-stone-300 rounded shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative bg-stone-50">
        <div className="min-w-full inline-block align-middle">
          <table className="min-w-full border-separate border-spacing-0">
            <thead className="sticky top-0 z-10">
              <tr className="bg-stone-100">
                {data.headers.filter(h => visibleColumns.has(h)).map((header) => (
                  <th
                    key={header}
                    onClick={() => toggleSort(header)}
                    className="px-4 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider border-b border-stone-200 whitespace-nowrap cursor-pointer hover:bg-stone-200 transition-colors group/th"
                  >
                    <div className="flex items-center gap-2">
                      {header}
                      <div className={cn(
                        "transition-opacity",
                        sortConfig.key === header ? "opacity-100" : "opacity-0 group-hover/th:opacity-50"
                      )}>
                        {sortConfig.key === header && sortConfig.direction === 'desc' ? (
                          <ArrowDown size={12} />
                        ) : (
                          <ArrowUp size={12} />
                        )}
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredRows.map((row, idx) => (
                <tr
                  key={idx}
                  onClick={() => handleRowClick(idx)}
                  className={cn(
                    "group cursor-pointer transition-colors border-b border-stone-100",
                    selectedIndex === idx ? "bg-blue-50/50" : "hover:bg-stone-50"
                  )}
                >
                  {data.headers.filter(h => visibleColumns.has(h)).map((header) => (
                    <td
                      key={header}
                      className="px-4 py-2.5 text-sm text-stone-600 border-b border-stone-100 max-w-[200px] truncate"
                    >
                      {String(row[header] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredRows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-stone-400">
              <Search size={48} strokeWidth={1} className="mb-4 opacity-20" />
              <p>No records found matching "{searchQuery}"</p>
            </div>
          )}
        </div>
      </main>

      {/* Detail Side Panel */}
      <AnimatePresence>
        {isPanelOpen && selectedIndex !== null && (
          <>
            {/* Backdrop for mobile/small screens if needed, but here we want it to overlay part of the grid */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPanelOpen(false)}
              className="fixed inset-0 bg-black/5 z-30 pointer-events-auto"
            />
            
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-[40%] min-w-[400px] bg-white shadow-2xl z-40 flex flex-col border-l border-stone-200"
            >
              {/* Panel Header */}
              <div className="p-6 border-b border-stone-100 flex items-center justify-between shrink-0">
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1 block">
                    Record {selectedIndex + 1} of {filteredRows.length}
                  </span>
                  <h3 className="text-xl font-bold text-stone-900 truncate">
                    {String(pendingChanges[data.headers[0]] ?? filteredRows[selectedIndex][data.headers[0]] ?? 'Detail View')}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <AnimatePresence>
                    {Object.keys(pendingChanges).length > 0 && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        onClick={saveChanges}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all"
                      >
                        <Check size={16} />
                        Save Changes
                      </motion.button>
                    )}
                  </AnimatePresence>
                  <button
                    onClick={() => {
                      if (Object.keys(pendingChanges).length > 0) {
                        if (!confirm('Discard unsaved changes?')) return;
                      }
                      setIsPanelOpen(false);
                      setPendingChanges({});
                      setEditingField(null);
                    }}
                    className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-400 hover:text-black"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50 mb-4">
                  <p className="text-xs text-blue-600 font-medium flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    Double-click any value below to edit
                  </p>
                </div>
                {data.headers.filter(h => visibleColumns.has(h)).map((header) => {
                  const isEditing = editingField === header;
                  const value = pendingChanges[header] !== undefined 
                    ? pendingChanges[header] 
                    : filteredRows[selectedIndex][header];

                  return (
                    <div key={header} className="space-y-2 group/field">
                      <label className="text-xs font-bold text-stone-400 uppercase tracking-wider flex items-center justify-between">
                        {header}
                        {pendingChanges[header] !== undefined && (
                          <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded uppercase tracking-tighter">Modified</span>
                        )}
                      </label>
                      
                      {isEditing ? (
                        <textarea
                          autoFocus
                          defaultValue={String(value ?? '')}
                          onBlur={(e) => handleFieldUpdate(header, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleFieldUpdate(header, e.currentTarget.value);
                            }
                            if (e.key === 'Escape') setEditingField(null);
                          }}
                          className="w-full text-lg leading-relaxed text-stone-800 font-normal bg-stone-50 border-2 border-black rounded-xl p-3 outline-none min-h-[100px] focus:ring-4 focus:ring-black/5 transition-all"
                        />
                      ) : (
                        <div 
                          onDoubleClick={() => setEditingField(header)}
                          className="text-lg leading-relaxed text-stone-800 font-normal whitespace-pre-wrap cursor-text p-3 -m-3 rounded-xl hover:bg-stone-50 transition-colors border-2 border-transparent hover:border-stone-100"
                        >
                          {String(value ?? '—')}
                        </div>
                      )}
                    </div>
                  );
                })}

                <button
                  onClick={() => setIsAddingColumn(true)}
                  className="w-full py-4 border-2 border-dashed border-stone-200 rounded-2xl text-stone-400 hover:border-stone-400 hover:text-stone-600 transition-all flex items-center justify-center gap-2 font-medium text-sm"
                >
                  <Plus size={18} />
                  Add New Field
                </button>
              </div>

              {/* Panel Footer */}
              <div className="p-6 border-t border-stone-100 bg-stone-50/50 flex items-center justify-between shrink-0">
                <button
                  onClick={() => navigateRecord('prev')}
                  disabled={selectedIndex === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white hover:shadow-sm border border-transparent hover:border-stone-200"
                >
                  <ChevronLeft size={18} />
                  Previous
                </button>
                <button
                  onClick={() => navigateRecord('next')}
                  disabled={selectedIndex === filteredRows.length - 1}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white hover:shadow-sm border border-transparent hover:border-stone-200"
                >
                  Next
                  <ChevronRight size={18} />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add Column Modal */}
      <AnimatePresence>
        {isAddingColumn && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingColumn(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-8"
            >
              <h3 className="text-2xl font-bold text-stone-900 mb-2">Add New Column</h3>
              <p className="text-stone-500 mb-6">This will add a new field to all records in your dataset.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2 block">Column Name</label>
                  <input
                    autoFocus
                    type="text"
                    placeholder="e.g., Priority, Notes, Category"
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addColumn(newColumnName)}
                    className="w-full bg-stone-100 border-none rounded-xl py-3 px-4 text-stone-900 focus:ring-2 focus:ring-black outline-none transition-all"
                  />
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setIsAddingColumn(false)}
                    className="flex-1 px-6 py-3 rounded-xl font-bold text-stone-500 hover:bg-stone-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => addColumn(newColumnName)}
                    disabled={!newColumnName.trim()}
                    className="flex-1 px-6 py-3 bg-black text-white rounded-xl font-bold disabled:opacity-30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Add Column
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
