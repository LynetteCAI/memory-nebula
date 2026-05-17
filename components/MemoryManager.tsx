/**
 * v0.3.4: Memory Library Manager — full web-based memory management panel.
 *
 * Supports:
 * - Batch photo upload with metadata entry
 * - Edit existing memory metadata
 * - Single and batch delete
 * - Import/export JSON backup
 * - Deep glassmorphism visual style
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { MemoryPhoto, MemoryType } from '../types';
import { fileToCompressedDataUrl, generateId, fileNameWithoutExt } from '../utils/imageUtils';

// ---------------------------------------------------------------------------
//  Constants
// ---------------------------------------------------------------------------

const TYPE_OPTIONS: { value: MemoryType; label: string }[] = [
  { value: 'travel', label: '旅行' },
  { value: 'food', label: '美食' },
  { value: 'movie', label: '电影' },
  { value: 'daily', label: '日常' },
  { value: 'anniversary', label: '纪念日' },
  { value: 'other', label: '其他' },
];

const TYPE_COLORS: Record<MemoryType, string> = {
  travel: 'border-blue-400/40 text-blue-200 bg-blue-900/60',
  food: 'border-red-400/40 text-red-200 bg-red-900/60',
  movie: 'border-purple-400/40 text-purple-200 bg-purple-900/60',
  daily: 'border-emerald-400/40 text-emerald-200 bg-emerald-900/60',
  anniversary: 'border-amber-400/40 text-amber-200 bg-amber-900/60',
  other: 'border-slate-500/40 text-slate-300 bg-slate-800/60',
};

const TYPE_LABELS: Record<MemoryType, string> = {
  travel: '旅行',
  food: '美食',
  movie: '电影',
  daily: '日常',
  anniversary: '纪念日',
  other: '其他',
};

export interface DraftMemory {
  file: File;
  title: string;
  date: string;
  location: string;
  type: MemoryType;
  description: string;
  story: string;
  previewUrl: string;
}

// ---------------------------------------------------------------------------
//  Props
// ---------------------------------------------------------------------------

interface MemoryManagerProps {
  open: boolean;
  memories: MemoryPhoto[];
  onClose: () => void;
  onCreateMany: (memories: MemoryPhoto[]) => Promise<void>;
  onUpdate: (memory: MemoryPhoto) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDeleteMany: (ids: string[]) => Promise<void>;
  onClearAll?: () => Promise<void>;
  /** v0.3.4: Optional — open editor for a specific memory */
  editTargetId?: string | null;
}

// ---------------------------------------------------------------------------
//  Sub-components
// ---------------------------------------------------------------------------

function GlassInput({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  asTextarea = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  asTextarea?: boolean;
}) {
  const baseClass =
    'w-full bg-black/40 border border-[#D4AF37]/20 rounded px-3 py-2 text-[#F5E6BF] text-sm font-serif placeholder-[#F5E6BF]/30 focus:outline-none focus:border-[#D4AF37]/50 transition-colors';
  return (
    <div className="flex-1 min-w-0">
      <label className="block text-[#D4AF37]/70 text-xs font-serif mb-1 tracking-wide">{label}</label>
      {asTextarea ? (
        <textarea
          className={`${baseClass} resize-none`}
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          className={baseClass}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Main Component
// ---------------------------------------------------------------------------

export const MemoryManager: React.FC<MemoryManagerProps> = ({
  open,
  memories,
  onClose,
  onCreateMany,
  onUpdate,
  onDelete,
  onDeleteMany,
  onClearAll,
  editTargetId,
}) => {
  // ── file input ref ──
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── batch upload state ──
  const [drafts, setDrafts] = useState<DraftMemory[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [isSavingDrafts, setIsSavingDrafts] = useState(false);

  // ── edit state ──
  const [editingMemory, setEditingMemory] = useState<MemoryPhoto | null>(null);

  // ── selection state (for batch delete) ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null); // single delete id
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);

  // ── import/export state ──
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState('');

  // ── v0.3.4: auto-open editor for editTargetId ──
  useEffect(() => {
    if (editTargetId && open) {
      const target = memories.find((m) => m.id === editTargetId);
      if (target) {
        setEditingMemory({ ...target });
      }
    }
  }, [editTargetId, open, memories]);

  // ── file selection → drafts ──
  const handleFilesSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingFiles(true);
    const newDrafts: DraftMemory[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      const previewUrl = URL.createObjectURL(file);
      const timeStr = new Date(file.lastModified).toISOString().slice(0, 10);

      newDrafts.push({
        file,
        title: fileNameWithoutExt(file.name) || `Memory ${i + 1}`,
        date: timeStr,
        location: '',
        type: 'other',
        description: '',
        story: '',
        previewUrl,
      });
    }

    setDrafts(newDrafts);
    setIsProcessingFiles(false);

    // Reset file input so same files can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // ── batch field application ──
  const batchSetField = (field: keyof DraftMemory, value: string | MemoryType) => {
    setDrafts((prev) =>
      prev.map((d) => ({ ...d, [field]: value }))
    );
  };

  // ── save all drafts ──
  const handleSaveDrafts = useCallback(async () => {
    if (drafts.length === 0) return;
    setIsSavingDrafts(true);

    try {
      const newMemories: MemoryPhoto[] = [];
      for (let i = 0; i < drafts.length; i++) {
        const d = drafts[i];
        const compressedUrl = await fileToCompressedDataUrl(d.file);
        const now = Date.now();

        newMemories.push({
          id: generateId(),
          url: compressedUrl,
          title: d.title || `Memory ${i + 1}`,
          date: d.date || undefined,
          location: d.location || undefined,
          description: d.description || undefined,
          story: d.story || undefined,
          type: d.type,
          source: 'uploaded',
          createdAt: now,
          updatedAt: now,
          order: memories.length + i,
          fileName: d.file.name,
        });
      }

      await onCreateMany(newMemories);

      // Clean up blob URLs
      drafts.forEach((d) => URL.revokeObjectURL(d.previewUrl));
      setDrafts([]);
    } catch (err) {
      console.error('Failed to save drafts:', err);
    } finally {
      setIsSavingDrafts(false);
    }
  }, [drafts, memories.length, onCreateMany]);

  const cancelDrafts = () => {
    drafts.forEach((d) => URL.revokeObjectURL(d.previewUrl));
    setDrafts([]);
  };

  // ── single edit save ──
  const handleEditSave = useCallback(async () => {
    if (!editingMemory) return;
    const updated: MemoryPhoto = {
      ...editingMemory,
      updatedAt: Date.now(),
    };
    await onUpdate(updated);
    setEditingMemory(null);
  }, [editingMemory, onUpdate]);

  // ── single delete ──
  const handleDeleteConfirm = useCallback(async () => {
    if (!showDeleteConfirm) return;
    await onDelete(showDeleteConfirm);
    setShowDeleteConfirm(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(showDeleteConfirm);
      return next;
    });
  }, [showDeleteConfirm, onDelete]);

  // ── batch delete ──
  const handleBatchDeleteConfirm = useCallback(async () => {
    if (selectedIds.size === 0) return;
    await onDeleteMany(Array.from(selectedIds));
    setSelectedIds(new Set());
    setShowBatchDeleteConfirm(false);
  }, [selectedIds, onDeleteMany]);

  // ── clear all ──
  const handleClearAllConfirm = useCallback(async () => {
    if (onClearAll) {
      await onClearAll();
    } else {
      const allIds = memories.map((m) => m.id);
      await onDeleteMany(allIds);
    }
    setShowClearAllConfirm(false);
    setSelectedIds(new Set());
  }, [memories, onClearAll, onDeleteMany]);

  // ── selection toggle ──
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === memories.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(memories.map((m) => m.id)));
    }
  };

  // ── export JSON ──
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const json = JSON.stringify(memories, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `memory-nebula-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  }, [memories]);

  // ── import JSON ──
  const handleImport = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setIsImporting(true);
      setImportError('');

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!Array.isArray(data)) {
          setImportError('JSON 格式不正确：需要 MemoryPhoto 数组');
          return;
        }

        // Validate basic structure
        for (const item of data) {
          if (!item.id || !item.url || !item.title) {
            setImportError('JSON 数据缺少必要字段 (id, url, title)');
            return;
          }
        }

        // Import all memories (replaces existing)
        const { importMemories } = await import('../storage/memoryLibraryStore');
        await importMemories(data);
        // Refresh — close and reload page data
        onClose();
        window.location.reload();
      } catch (err: any) {
        setImportError(err.message || '导入失败，请检查 JSON 文件格式');
      } finally {
        setIsImporting(false);
      }
    };
    input.click();
  }, [onClose]);

  if (!open) return null;

  // ── Render modes: draft entry, edit panel, or list ──
  const isInDraftMode = drafts.length > 0;
  const isEditing = editingMemory !== null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isEditing && !isInDraftMode) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

      {/* Main Panel */}
      <div
        className="relative z-10 w-full max-w-4xl max-h-[90vh] mx-4 flex flex-col rounded-lg border border-[#D4AF37]/20 shadow-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(10,10,26,0.95), rgba(13,27,42,0.95))',
          boxShadow: '0 0 80px rgba(212, 175, 55, 0.1), 0 0 200px rgba(10,10,26,0.8)',
        }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D4AF37]/10 shrink-0">
          <h2 className="text-xl md:text-2xl font-serif text-[#D4AF37] tracking-wider">
            回忆管理
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-[#F5E6BF]/50 text-xs font-serif">
              已保存 {memories.length} 段回忆
            </span>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-[#D4AF37]/60 hover:text-[#D4AF37] transition-colors ml-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-[#D4AF37]/10 shrink-0">
          {/* Upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFilesSelected}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessingFiles || isInDraftMode || isEditing}
            className="px-4 py-2 border border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#D4AF37] text-sm font-serif tracking-wide hover:bg-[#D4AF37]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isProcessingFiles ? '处理中...' : '上传回忆照片'}
          </button>

          {/* Batch delete */}
          {selectedIds.size > 0 && (
            <button
              onClick={() => setShowBatchDeleteConfirm(true)}
              disabled={isEditing}
              className="px-4 py-2 border border-red-400/30 bg-red-900/20 text-red-300 text-sm font-serif tracking-wide hover:bg-red-900/30 transition-colors"
            >
              删除已选 ({selectedIds.size})
            </button>
          )}

          {/* Select all / none */}
          {memories.length > 0 && !isEditing && (
            <button
              onClick={toggleSelectAll}
              className="px-3 py-2 text-[#D4AF37]/60 text-xs font-serif hover:text-[#D4AF37] transition-colors"
            >
              {selectedIds.size === memories.length ? '取消全选' : '全选'}
            </button>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Import / Export */}
          <button
            onClick={handleExport}
            disabled={isExporting || memories.length === 0}
            className="px-3 py-2 text-[#D4AF37]/50 text-xs font-serif hover:text-[#D4AF37] transition-colors disabled:opacity-30"
          >
            {isExporting ? '导出中...' : '导出备份'}
          </button>
          <button
            onClick={handleImport}
            disabled={isImporting}
            className="px-3 py-2 text-[#D4AF37]/50 text-xs font-serif hover:text-[#D4AF37] transition-colors disabled:opacity-30"
          >
            {isImporting ? '导入中...' : '导入备份'}
          </button>
        </div>

        {/* ── Content Area ── */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* ── Import Error ── */}
          {importError && (
            <div className="mx-6 mt-3 p-3 bg-red-900/20 border border-red-400/20 rounded text-red-300 text-xs font-serif">
              {importError}
              <button onClick={() => setImportError('')} className="ml-2 underline">关闭</button>
            </div>
          )}

          {/* ═══════════════════════════════════════════ */}
          {/*  DRAFT ENTRY MODE (batch upload metadata)  */}
          {/* ═══════════════════════════════════════════ */}
          {isInDraftMode && (
            <div className="p-6 space-y-6">
              <h3 className="text-lg font-serif text-[#D4AF37] tracking-wide">
                填写回忆信息（{drafts.length} 张照片）
              </h3>

              {/* Batch field application bar */}
              <div className="flex flex-wrap gap-3 p-3 bg-black/30 border border-[#D4AF37]/10 rounded">
                <span className="text-[#F5E6BF]/50 text-xs self-center mr-2">批量设置:</span>
                <input
                  type="date"
                  onChange={(e) => batchSetField('date', e.target.value)}
                  className="bg-black/40 border border-[#D4AF37]/20 rounded px-2 py-1 text-[#F5E6BF] text-xs"
                  placeholder="批量日期"
                />
                <input
                  type="text"
                  onChange={(e) => batchSetField('location', e.target.value)}
                  placeholder="批量地点"
                  className="bg-black/40 border border-[#D4AF37]/20 rounded px-2 py-1 text-[#F5E6BF] text-xs placeholder-[#F5E6BF]/30 w-28"
                />
                <select
                  onChange={(e) => batchSetField('type', e.target.value as MemoryType)}
                  className="bg-black/40 border border-[#D4AF37]/20 rounded px-2 py-1 text-[#F5E6BF] text-xs"
                >
                  <option value="">批量类型...</option>
                  {TYPE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Draft cards */}
              <div className="space-y-4">
                {drafts.map((draft, i) => (
                  <div
                    key={i}
                    className="flex flex-col md:flex-row gap-4 p-4 bg-black/20 border border-[#D4AF37]/10 rounded"
                  >
                    {/* Thumbnail */}
                    <div className="flex-shrink-0 w-24 h-24 bg-gray-800 rounded overflow-hidden border border-[#D4AF37]/20">
                      <img
                        src={draft.previewUrl}
                        alt={`Preview ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Fields */}
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <GlassInput
                        label="标题"
                        value={draft.title}
                        onChange={(v) =>
                          setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, title: v } : d)))
                        }
                        placeholder="回忆标题"
                      />
                      <GlassInput
                        label="日期"
                        type="date"
                        value={draft.date}
                        onChange={(v) =>
                          setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, date: v } : d)))
                        }
                      />
                      <GlassInput
                        label="地点"
                        value={draft.location}
                        onChange={(v) =>
                          setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, location: v } : d)))
                        }
                        placeholder="回忆地点"
                      />
                      <div className="flex-1 min-w-0">
                        <label className="block text-[#D4AF37]/70 text-xs font-serif mb-1 tracking-wide">类型</label>
                        <select
                          value={draft.type}
                          onChange={(e) =>
                            setDrafts((prev) =>
                              prev.map((d, idx) => (idx === i ? { ...d, type: e.target.value as MemoryType } : d))
                            )
                          }
                          className="w-full bg-black/40 border border-[#D4AF37]/20 rounded px-3 py-2 text-[#F5E6BF] text-sm font-serif focus:outline-none focus:border-[#D4AF37]/50"
                        >
                          {TYPE_OPTIONS.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <GlassInput
                          label="一句话描述"
                          value={draft.description}
                          onChange={(v) =>
                            setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, description: v } : d)))
                          }
                          placeholder="用一句话描述这段回忆"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <GlassInput
                          label="故事"
                          value={draft.story}
                          onChange={(v) =>
                            setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, story: v } : d)))
                          }
                          asTextarea
                          placeholder="写下照片背后的故事..."
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Draft actions */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={cancelDrafts}
                  disabled={isSavingDrafts}
                  className="px-5 py-2 border border-[#D4AF37]/20 text-[#F5E6BF]/60 text-sm font-serif hover:text-[#F5E6BF] transition-colors disabled:opacity-40"
                >
                  取消上传
                </button>
                <button
                  onClick={handleSaveDrafts}
                  disabled={isSavingDrafts}
                  className="px-6 py-2 bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#D4AF37] text-sm font-serif tracking-wide hover:bg-[#D4AF37]/25 transition-colors disabled:opacity-40"
                >
                  {isSavingDrafts ? '保存中...' : `保存全部 (${drafts.length})`}
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════ */}
          {/*  EDIT MODE (single memory editing)        */}
          {/* ═══════════════════════════════════════════ */}
          {isEditing && !isInDraftMode && (
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-serif text-[#D4AF37] tracking-wide">编辑回忆</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <GlassInput
                  label="标题"
                  value={editingMemory.title}
                  onChange={(v) => setEditingMemory((prev) => prev ? { ...prev, title: v } : null)}
                />
                <GlassInput
                  label="日期"
                  type="date"
                  value={editingMemory.date || ''}
                  onChange={(v) => setEditingMemory((prev) => prev ? { ...prev, date: v } : null)}
                />
                <GlassInput
                  label="地点"
                  value={editingMemory.location || ''}
                  onChange={(v) => setEditingMemory((prev) => prev ? { ...prev, location: v } : null)}
                />
                <div>
                  <label className="block text-[#D4AF37]/70 text-xs font-serif mb-1 tracking-wide">类型</label>
                  <select
                    value={editingMemory.type || 'other'}
                    onChange={(e) =>
                      setEditingMemory((prev) =>
                        prev ? { ...prev, type: e.target.value as MemoryType } : null
                      )
                    }
                    className="w-full bg-black/40 border border-[#D4AF37]/20 rounded px-3 py-2 text-[#F5E6BF] text-sm font-serif focus:outline-none focus:border-[#D4AF37]/50"
                  >
                    {TYPE_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <GlassInput
                    label="一句话描述"
                    value={editingMemory.description || ''}
                    onChange={(v) => setEditingMemory((prev) => prev ? { ...prev, description: v } : null)}
                    placeholder="用一句话描述这段回忆"
                  />
                </div>
                <div className="md:col-span-2">
                  <GlassInput
                    label="故事"
                    value={editingMemory.story || ''}
                    onChange={(v) => setEditingMemory((prev) => prev ? { ...prev, story: v } : null)}
                    asTextarea
                    placeholder="写下照片背后的故事..."
                  />
                </div>
              </div>

              {/* Memory preview thumbnail */}
              <div className="flex items-center gap-3 p-2">
                <div className="w-16 h-16 bg-gray-800 rounded overflow-hidden border border-[#D4AF37]/20 flex-shrink-0">
                  <img src={editingMemory.url} alt="" className="w-full h-full object-cover" />
                </div>
                <span className="text-[#F5E6BF]/50 text-xs font-serif truncate">
                  {editingMemory.fileName || editingMemory.id}
                </span>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setEditingMemory(null)}
                  className="px-5 py-2 border border-[#D4AF37]/20 text-[#F5E6BF]/60 text-sm font-serif hover:text-[#F5E6BF] transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleEditSave}
                  className="px-6 py-2 bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#D4AF37] text-sm font-serif tracking-wide hover:bg-[#D4AF37]/25 transition-colors"
                >
                  保存修改
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════ */}
          {/*  MEMORY LIST MODE                          */}
          {/* ═══════════════════════════════════════════ */}
          {!isInDraftMode && !isEditing && memories.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <p className="text-[#F5E6BF]/40 font-serif text-lg mb-2">还没有保存回忆</p>
              <p className="text-[#F5E6BF]/25 font-serif text-sm">
                点击"上传回忆照片"添加你的第一段回忆
              </p>
            </div>
          )}

          {!isInDraftMode && !isEditing && memories.length > 0 && (
            <div className="divide-y divide-[#D4AF37]/5">
              {memories.map((memory) => (
                <div
                  key={memory.id}
                  className="flex items-center gap-3 px-6 py-3 hover:bg-[#D4AF37]/3 transition-colors group"
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedIds.has(memory.id)}
                    onChange={() => toggleSelect(memory.id)}
                    className="w-4 h-4 accent-[#D4AF37] cursor-pointer flex-shrink-0"
                  />

                  {/* Thumbnail */}
                  <div className="w-14 h-14 bg-gray-800 rounded overflow-hidden border border-[#D4AF37]/20 flex-shrink-0">
                    <img
                      src={memory.url}
                      alt={memory.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[#F5E6BF] font-serif text-sm truncate">{memory.title}</span>
                      <span
                        className={`inline-block px-2 py-0 text-[10px] rounded-full border font-serif ${TYPE_COLORS[memory.type || 'other']}`}
                      >
                        {TYPE_LABELS[memory.type || 'other']}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[#F5E6BF]/40 text-xs mt-0.5">
                      {memory.date && <span>{memory.date}</span>}
                      {memory.location && <span>{memory.location}</span>}
                      {memory.description && (
                        <span className="truncate italic hidden md:inline">
                          &ldquo;{memory.description}&rdquo;
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setEditingMemory({ ...memory })}
                      className="px-3 py-1.5 text-[#D4AF37]/60 text-xs font-serif border border-[#D4AF37]/20 hover:text-[#D4AF37] hover:border-[#D4AF37]/40 transition-colors"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(memory.id)}
                      className="px-3 py-1.5 text-red-400/60 text-xs font-serif border border-red-400/20 hover:text-red-300 hover:border-red-400/40 transition-colors"
                    >
                      删除
                    </button>
                  </div>

                  {/* Mobile actions (always visible) */}
                  <div className="flex items-center gap-1 flex-shrink-0 md:hidden">
                    <button
                      onClick={() => setEditingMemory({ ...memory })}
                      className="px-2 py-1 text-[#D4AF37]/50 text-xs font-serif"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(memory.id)}
                      className="px-2 py-1 text-red-400/50 text-xs font-serif"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Footer: Danger Zone ── */}
        {memories.length > 0 && !isInDraftMode && !isEditing && (
          <div className="px-6 py-3 border-t border-[#D4AF37]/10 shrink-0 flex justify-end">
            <button
              onClick={() => setShowClearAllConfirm(true)}
              className="px-4 py-2 text-red-400/40 text-xs font-serif border border-red-400/10 hover:text-red-300 hover:border-red-400/30 transition-colors"
            >
              清空全部回忆
            </button>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/*  CONFIRMATION DIALOGS                       */}
      {/* ═══════════════════════════════════════════ */}

      {/* Single delete confirm */}
      {showDeleteConfirm && (
        <ConfirmDialog
          title="删除这段回忆？"
          message="此操作只删除当前浏览器本地保存的数据，无法撤销。"
          confirmLabel="删除"
          confirmDanger
          onConfirm={handleDeleteConfirm}
          onCancel={() => setShowDeleteConfirm(null)}
        />
      )}

      {/* Batch delete confirm */}
      {showBatchDeleteConfirm && (
        <ConfirmDialog
          title={`删除 ${selectedIds.size} 段回忆？`}
          message="此操作只删除当前浏览器本地保存的数据，无法撤销。"
          confirmLabel="批量删除"
          confirmDanger
          onConfirm={handleBatchDeleteConfirm}
          onCancel={() => setShowBatchDeleteConfirm(false)}
        />
      )}

      {/* Clear all confirm */}
      {showClearAllConfirm && (
        <ConfirmDialog
          title="确定删除全部回忆吗？"
          message="此操作只删除当前浏览器本地保存的数据。建议先导出备份。"
          confirmLabel="全部删除"
          confirmDanger
          onConfirm={handleClearAllConfirm}
          onCancel={() => setShowClearAllConfirm(false)}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
//  Confirm Dialog Sub-component
// ---------------------------------------------------------------------------

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  confirmDanger,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  confirmDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="p-6 rounded-lg border border-[#D4AF37]/20 max-w-sm mx-4"
        style={{ background: 'linear-gradient(135deg, rgba(10,10,26,0.98), rgba(13,27,42,0.98))' }}
      >
        <h4 className="text-[#F5E6BF] font-serif text-base mb-2">{title}</h4>
        <p className="text-[#F5E6BF]/60 text-sm font-serif mb-5">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-[#D4AF37]/20 text-[#F5E6BF]/60 text-sm font-serif hover:text-[#F5E6BF] transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-serif border transition-colors ${
              confirmDanger
                ? 'bg-red-900/20 border-red-400/30 text-red-300 hover:bg-red-900/40'
                : 'bg-[#D4AF37]/15 border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/25'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
