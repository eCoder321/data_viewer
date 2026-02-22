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
  ArrowLeft
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
    if (!searchQuery) return data.rows;
    
    const query = searchQuery.toLowerCase();
    return data.rows.filter(row => 
      Object.values(row).some(val => 
        String(val).toLowerCase().includes(query)
      )
    );
  }, [data, searchQuery]);

  const handleRowClick = (index: number) => {
    setSelectedIndex(index);
    setIsPanelOpen(true);
  };

  const navigateRecord = (direction: 'prev' | 'next') => {
    if (selectedIndex === null) return;
    const newIndex = direction === 'prev' 
      ? Math.max(0, selectedIndex - 1) 
      : Math.min(filteredRows.length - 1, selectedIndex + 1);
    setSelectedIndex(newIndex);
  };

  const resetApp = () => {
    setData(null);
    setSearchQuery('');
    setSelectedIndex(null);
    setIsPanelOpen(false);
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

        <div className="w-[100px]" /> {/* Spacer for balance */}
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative bg-stone-50">
        <div className="min-w-full inline-block align-middle">
          <table className="min-w-full border-separate border-spacing-0">
            <thead className="sticky top-0 z-10">
              <tr className="bg-stone-100">
                {data.headers.map((header) => (
                  <th
                    key={header}
                    className="px-4 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider border-b border-stone-200 whitespace-nowrap"
                  >
                    {header}
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
                  {data.headers.map((header) => (
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
                    {String(filteredRows[selectedIndex][data.headers[0]] ?? 'Detail View')}
                  </h3>
                </div>
                <button
                  onClick={() => setIsPanelOpen(false)}
                  className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-400 hover:text-black"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {data.headers.map((header) => (
                  <div key={header} className="space-y-2">
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                      {header}
                    </label>
                    <div className="text-lg leading-relaxed text-stone-800 font-normal whitespace-pre-wrap">
                      {String(filteredRows[selectedIndex][header] ?? '—')}
                    </div>
                  </div>
                ))}
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
    </div>
  );
}
