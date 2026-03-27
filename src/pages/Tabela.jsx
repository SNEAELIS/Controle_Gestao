import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table';
import {
  Download, Save, CheckCircle2, AlertCircle, Loader2,
  ChevronLeft, ChevronRight, Search, Plus, Trash2,
  AlertTriangle, RefreshCw, Filter, X, Bot, FileSpreadsheet,
  Hash, Upload, Clock, ChevronUp, ChevronDown,
  Edit3, Check, XCircle, Info, BarChart2, TrendingUp,
  Calendar, AlertOctagon, Columns, Eye, EyeOff,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../services/supabaseClient';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const SELECT_OPTIONS = {
  'CELEBRADO COM CLAUSULA SUSPENSIVA':      ['SIM', 'NÃO', 'NÃO SE APLICA'],
  'NECESSIDADE DE ADITIVO PARA SUSPENSIVA': ['SIM', 'NÃO', 'NÃO SE APLICA'],
  'PAD - CRONO':                            ['SIM', 'NÃO', 'PORTARIA 64/2025'],
  'PARECER TRANSFEREGOV':                   ['SIM', 'NÃO', 'NÃO SE APLICA'],
  'AJUSTE':                                 ['PENDENTE', 'REALIZADO', 'NÃO SE APLICA'],
  'CANCELAR EMPENHO':                       ['SIM', 'NÃO', 'SOLICITADO', 'NÃO SE APLICA'],
  'REJEITAR NO TRANSFEREGOV':               ['CONJUR', 'REJEITAR', 'FORMALIZAR', 'REALIZADO', 'NÃO SE APLICA'],
  'SOB LIMINAR':                            ['CONJUR', 'REJEITAR', 'FORMALIZAR', 'NÃO SE APLICA'],
  'NECESSIDADE DE ADITIVO':                 ['SIM', 'NÃO', 'PENDENTE', 'NÃO SE APLICA'],
  'INSTRUÇÃO PROCESSUAL':                   ['SIM', 'NÃO', 'PENDENTE'],
  'EQUIPE':                                 ['EQUIPE 6', 'EQUIPE 7'],
  'TÉCNICO DE FORMALIZAÇÃO':                ['THALITA', 'SAMARA', 'GLENDA', 'HELLEN', 'ALINE', 'SUELHY', 'JAQUELINE', 'CLARISSA', 'JÚLIO'],
  'CUSTO':                                  ['SIM', 'NÃO', 'NÃO SE APLICA'],
  'PUBLICAÇÃO NO TRANSFEREGOV':             ['SIM', 'NÃO'],
  'TRAMITADO PARA CGAP':                    ['SIM', 'NÃO', 'NÃO SE APLICA'],
};

const ROBO_COLS = ['INSTRUMENTO', 'PUBLICAÇÃO NO TRANSFEREGOV', 'ENTIDADE', 'PROCESSO', 'DATA DA PUBLICAÇÃO'];
const HIDDEN_COLS = ['id', 'created_at', 'vazia_1', 'vazia_2', 'updated_at', 'ultima_coluna_editada'];

const ANOS = ['Todos', '2023', '2024', '2025', '2026'];

const fmtDate = iso => {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return null; }
};

const fmtCurrency = v => {
  const n = parseFloat(v) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const isCellEmpty = v => v === null || v === undefined || String(v).trim() === '' || String(v).trim() === '—';

// ─── BADGE ───────────────────────────────────────────────────────────────────
function Badge({ value }) {
  if (!value || value === '—') return <span className="empty-dash">—</span>;
  const v = String(value).toUpperCase().trim();
  let cls = 'neutral';
  if (['SIM', 'REALIZADO', 'FORMALIZAR'].includes(v))          cls = 'success';
  else if (['NÃO', 'REJEITAR'].includes(v))                     cls = 'danger';
  else if (['PENDENTE', 'SOLICITADO', 'CONJUR'].includes(v))    cls = 'warning';
  else if (v === 'NÃO SE APLICA')                               cls = 'muted';
  else if (['PORTARIA 64/2025'].includes(v))                    cls = 'info';
  return <span className={`badge b-${cls}`}>{value}</span>;
}

// ─── EDITABLE CELL ───────────────────────────────────────────────────────────
function EditableCell({ value, colKey, rowId, editedCells, setEditedCells }) {
  const [editing, setEditing]   = useState(false);
  const [localVal, setLocalVal] = useState('');
  const inputRef = useRef(null);
  const cellId   = `${rowId}::${colKey}`;
  const cur      = editedCells[cellId] !== undefined ? editedCells[cellId] : (value ?? '');
  const isDirty  = editedCells[cellId] !== undefined;
  const isSelect = !!SELECT_OPTIONS[colKey];
  const isEmpty  = isCellEmpty(cur);

  const startEdit = () => { setLocalVal(cur); setEditing(true); setTimeout(() => inputRef.current?.focus(), 40); };
  const commit    = () => { setEditedCells(p => ({ ...p, [cellId]: localVal })); setEditing(false); };
  const discard   = () => setEditing(false);

  if (isSelect) {
    return (
      <div className={`sel-wrap${isDirty ? ' dirty' : ''}${isEmpty ? ' empty-val' : ''}`}>
        <select
          value={cur}
          className="cell-sel"
          onChange={e => setEditedCells(p => ({ ...p, [cellId]: e.target.value }))}
        >
          <option value="">—</option>
          {SELECT_OPTIONS[colKey].map(o => <option key={o}>{o}</option>)}
        </select>
        {isDirty && <span className="dot-dirty" />}
      </div>
    );
  }

  if (editing) {
    return (
      <div className="ie-wrap">
        <input
          ref={inputRef}
          className="ie-input"
          value={localVal}
          onChange={e => setLocalVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') discard(); }}
        />
        <button className="ie-btn ok" onClick={commit}><Check size={10} /></button>
        <button className="ie-btn no" onClick={discard}><XCircle size={10} /></button>
      </div>
    );
  }

  return (
    <div
      className={`txt-cell${isDirty ? ' dirty' : ''}${isEmpty ? ' empty-val' : ''}`}
      onClick={startEdit}
      title="Clique para editar"
    >
      {isEmpty
        ? <span className="empty-dash clickable">Clique para preencher</span>
        : <span className="txt-val">{cur}</span>
      }
      <Edit3 size={9} className="pencil" />
      {isDirty && <span className="dot-dirty" />}
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function TabelaGerencialMaster() {
  const [data, setData]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [progress, setProgress]       = useState(0);
  const [message, setMessage]         = useState(null);
  const [editedCells, setEditedCells] = useState({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [sidebarOpen, setSidebarOpen]   = useState(true);
  const [confirmModal, setConfirmModal] = useState(null);
  const [newModal, setNewModal]         = useState(false);
  const [newTab, setNewTab]             = useState('manual');
  const [newProposta, setNewProposta]   = useState('');
  const [excelFile, setExcelFile]       = useState(null);
  const [excelError, setExcelError]     = useState('');
  const [dragover, setDragover]         = useState(false);
  const [colVisibility, setColVisibility] = useState({});
  const [showColPanel, setShowColPanel]   = useState(false);
  const [activeTab, setActiveTab]         = useState('filters'); // 'filters' | 'empty' | 'columns'
  const fileRef = useRef(null);

  const [filters, setFilters] = useState({
    proposta: '', instrumento: 'Todos', ajuste: 'Todos',
    empenho: 'Todos', tecnico: 'Todos', uf: 'Todos',
    processo: '', entidade: '', ano: 'Todos',
    emptyCols: [],   // columns that must be empty
    filledCols: [],  // columns that must be filled
  });

  // ── fetch ──
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      let all = [], from = 0, ps = 1000;
      while (true) {
        const { data: chunk, error, count } = await supabase
          .from('formalizacoes').select('*', { count: 'exact' })
          .order('id', { ascending: false }).range(from, from + ps - 1);
        if (error) throw error;
        all = [...all, ...chunk];
        from += ps;
        if (count) setProgress(Math.round((all.length / count) * 100));
        if (chunk.length < ps) break;
      }
      setData(all);
    } catch { notify('error', 'Falha na conexão com o Supabase.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  const notify = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4500);
  };

  // ── all visible columns for empty/filled filter ──
  const allEditableCols = useMemo(() => {
    if (!data.length) return [];
    return Object.keys(data[0]).filter(k => !HIDDEN_COLS.includes(k));
  }, [data]);

  // ── filtered ──
  const filteredData = useMemo(() => data.filter(row => {
    const f = filters;
    if (f.proposta && !String(row['PROPOSTA'] || '').toLowerCase().includes(f.proposta.toLowerCase())) return false;
    if (f.instrumento !== 'Todos' && row['INSTRUMENTO'] !== f.instrumento) return false;
    if (f.ajuste !== 'Todos' && row['AJUSTE'] !== f.ajuste) return false;
    if (f.empenho !== 'Todos') {
      const e = String(row['CANCELAR EMPENHO'] || '').toUpperCase();
      if (f.empenho === 'SIM' && e !== 'SIM') return false;
      if (f.empenho === 'NÃO' && e !== 'NÃO') return false;
    }
    if (f.tecnico !== 'Todos' && row['TÉCNICO DE FORMALIZAÇÃO'] !== f.tecnico) return false;
    if (f.uf !== 'Todos' && row['UF'] !== f.uf) return false;
    if (f.processo && !String(row['PROCESSO'] || '').toLowerCase().includes(f.processo.toLowerCase())) return false;
    if (f.entidade && !String(row['ENTIDADE'] || '').toLowerCase().includes(f.entidade.toLowerCase())) return false;

    // Year filter — extracts year from PROPOSTA (e.g. "024721/2025")
    if (f.ano !== 'Todos') {
      const prop = String(row['PROPOSTA'] || '');
      const match = prop.match(/\/(\d{4})$/);
      if (!match || match[1] !== f.ano) return false;
    }

    // Empty / Filled column filters
    for (const col of f.emptyCols) {
      if (!isCellEmpty(row[col])) return false;
    }
    for (const col of f.filledCols) {
      if (isCellEmpty(row[col])) return false;
    }

    if (globalFilter) {
      const gf = globalFilter.toLowerCase();
      return Object.values(row).some(v => String(v || '').toLowerCase().includes(gf));
    }
    return true;
  }), [data, filters, globalFilter]);

  // ── stats ──
  const stats = useMemo(() => {
    const total = data.length;
    const byInstrumento = data.reduce((acc, r) => {
      const k = r['INSTRUMENTO'] || 'Outros';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    const pendentes = data.filter(d => d['AJUSTE'] === 'PENDENTE').length;
    const realizados = data.filter(d => d['AJUSTE'] === 'REALIZADO').length;
    const valorTotal = data.reduce((s, r) => s + (parseFloat(r['VALOR REPASSE']) || 0), 0);

    // Empty stats per column
    const emptyStats = {};
    for (const col of allEditableCols) {
      emptyStats[col] = data.filter(r => isCellEmpty(r[col])).length;
    }

    // By year
    const byYear = data.reduce((acc, r) => {
      const prop  = String(r['PROPOSTA'] || '');
      const match = prop.match(/\/(\d{4})$/);
      const year  = match ? match[1] : 'Outro';
      acc[year] = (acc[year] || 0) + 1;
      return acc;
    }, {});

    return { total, byInstrumento, pendentes, realizados, valorTotal, emptyStats, byYear };
  }, [data, allEditableCols]);

  // ── columns ──
  const columns = useMemo(() => {
    const allKeys = data.length > 0 ? Object.keys(data[0]) : [];
    const fixed   = ['PROPOSTA', 'INSTRUMENTO', 'VALOR REPASSE'];
    const dyn     = allKeys.filter(k =>
      !HIDDEN_COLS.includes(k) && !fixed.includes(k) && k !== 'Nº' && k !== 'ANO'
    );

    return [
      // checkbox
      {
        id: 'sel', size: 44,
        header: () => (
          <input type="checkbox" className="cb"
            checked={selectedRows.size === filteredData.length && filteredData.length > 0}
            onChange={e => {
              if (e.target.checked) setSelectedRows(new Set(filteredData.map(r => r.id)));
              else setSelectedRows(new Set());
            }} />
        ),
        cell: ({ row }) => (
          <input type="checkbox" className="cb"
            checked={selectedRows.has(row.original.id)}
            onChange={e => {
              const s = new Set(selectedRows);
              e.target.checked ? s.add(row.original.id) : s.delete(row.original.id);
              setSelectedRows(s);
            }} />
        ),
      },
      // row number
      {
        id: 'rownum', size: 50,
        header: () => <span style={{ color: 'var(--c3)' }}>#</span>,
        cell: ({ row }) => <span className="row-num">{row.index + 1}</span>,
      },
      // proposta
      {
        accessorKey: 'PROPOSTA', header: 'PROPOSTA', size: 150,
        cell: ({ getValue, row }) => (
          <EditableCell value={getValue()} colKey="PROPOSTA" rowId={row.original.id}
            editedCells={editedCells} setEditedCells={setEditedCells} />
        ),
      },
      // instrumento
      {
        accessorKey: 'INSTRUMENTO', header: 'INSTRUMENTO', size: 220,
        cell: ({ getValue, row }) => {
          const v = getValue() || '';
          const cls = v === 'CONVÊNIO' ? 'conv' : v.includes('FOMENTO') ? 'fom' : v.includes('DESC') ? 'ted' : '';
          return (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {v && <span className={`inst-tag ${cls}`}>{v}</span>}
              {!v && <EditableCell value={v} colKey="INSTRUMENTO" rowId={row.original.id}
                editedCells={editedCells} setEditedCells={setEditedCells} />}
            </div>
          );
        },
      },
      // valor
      {
        accessorKey: 'VALOR REPASSE', header: 'VALOR REPASSE', size: 160,
        cell: ({ getValue, row }) => (
          <EditableCell value={getValue()} colKey="VALOR REPASSE" rowId={row.original.id}
            editedCells={editedCells} setEditedCells={setEditedCells} />
        ),
      },
      // audit
      {
        id: 'audit', size: 200,
        header: () => <span className="hdr-audit"><Clock size={10} />ÚLTIMA EDIÇÃO</span>,
        cell: ({ row }) => {
          const upd = row.original.updated_at;
          const col = row.original.ultima_coluna_editada;
          if (!upd) return <span className="empty-dash">—</span>;
          return (
            <div className="audit-cell">
              <span className="audit-ts">{fmtDate(upd)}</span>
              {col && <span className="audit-col">{col}</span>}
            </div>
          );
        },
      },
      // dynamic
      ...dyn
        .filter(key => colVisibility[key] !== false)
        .map(key => {
          const isRobo = ROBO_COLS.includes(key);
          return {
            accessorKey: key,
            size: 200,
            header: () => (
              <span className="th-inner">
                {key}
                {isRobo && <span className="robo-chip"><Bot size={7} />BOT</span>}
              </span>
            ),
            cell: ({ getValue, row }) => {
              const val = getValue();
              if (isRobo) return (
                <span className="cell-robo" title={val || ''}>{val || <span className="empty-dash">—</span>}</span>
              );
              return (
                <EditableCell
                  value={val}
                  colKey={key}
                  rowId={row.original.id}
                  editedCells={editedCells}
                  setEditedCells={setEditedCells}
                />
              );
            },
          };
        }),
      // delete
      {
        id: 'del', size: 50,
        header: '',
        cell: ({ row }) => (
          <button className="del-btn" title="Excluir"
            onClick={() => setConfirmModal({
              type: 'delete-single', payload: row.original,
              title: 'Excluir Registro',
              message: <>Excluir permanentemente a proposta <strong>{row.original.PROPOSTA}</strong>? Não é possível desfazer.</>,
              confirmLabel: 'Excluir', confirmClass: 'btn-danger',
            })}>
            <Trash2 size={12} />
          </button>
        ),
      },
    ];
  }, [data, editedCells, selectedRows, filteredData, colVisibility]);

  const table = useReactTable({
    data: filteredData, columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  const totalFiltered = filteredData.length;
  const pageCount     = table.getPageCount();
  const dirtyCount    = Object.keys(editedCells).length;

  // ── save ──
  const handleSave = () => {
    if (!dirtyCount) return;
    setConfirmModal({
      type: 'save', title: 'Salvar Alterações',
      message: <>Salvar <strong>{dirtyCount} alteração(ões)</strong> pendentes?</>,
      confirmLabel: 'Salvar', confirmClass: 'btn-success',
    });
  };

  const executeSave = async () => {
    setSaving(true);
    try {
      const upd = {};
      for (const [cellId, value] of Object.entries(editedCells)) {
        const [id, key] = cellId.split('::');
        if (!upd[id]) upd[id] = { id };
        upd[id][key] = value;
        upd[id]['ultima_coluna_editada'] = key;
      }
      for (const u of Object.values(upd)) {
        const { id, ...fields } = u;
        await supabase.from('formalizacoes').update(fields).eq('id', id);
      }
      setEditedCells({});
      notify('success', `${Object.keys(upd).length} registro(s) salvo(s).`);
      fetchAllData();
    } catch { notify('error', 'Erro ao salvar.'); }
    finally { setSaving(false); }
  };

  const executeDelete = async (payload) => {
    if (payload) {
      await supabase.from('formalizacoes').delete().eq('id', payload.id);
      setSelectedRows(s => { const n = new Set(s); n.delete(payload.id); return n; });
      notify('success', `Proposta ${payload.PROPOSTA} excluída.`);
    } else {
      const ids = Array.from(selectedRows);
      await supabase.from('formalizacoes').delete().in('id', ids);
      setSelectedRows(new Set());
      notify('success', `${ids.length} registro(s) excluído(s).`);
    }
    fetchAllData();
  };

  const handleConfirm = async () => {
    const m = confirmModal;
    setConfirmModal(null);
    if (m.type === 'save')          await executeSave();
    if (m.type === 'delete-single') await executeDelete(m.payload);
    if (m.type === 'delete-many')   await executeDelete(null);
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Formalizações');
    XLSX.writeFile(wb, `Formalizacoes_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const handleNewManual = async () => {
    const p = newProposta.trim();
    if (!p) return;
    const { error } = await supabase.from('formalizacoes').insert([{ PROPOSTA: p }]);
    if (error) { notify('error', 'Erro ao criar.'); return; }
    notify('success', `Proposta ${p} criada.`);
    setNewModal(false); setNewProposta(''); fetchAllData();
  };

  const processExcel = file => {
    setExcelError(''); setExcelFile(null);
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb   = XLSX.read(e.target.result, { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        const col  = Object.keys(rows[0] || {}).find(k => k.toLowerCase().includes('proposta'));
        if (!col) { setExcelError('Coluna "PROPOSTA" não encontrada.'); return; }
        setExcelFile({ name: file.name, col, rows: rows.filter(r => r[col]) });
      } catch { setExcelError('Erro ao ler arquivo. Use .xlsx ou .xls válido.'); }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleNewExcel = async () => {
    if (!excelFile) return;
    const inserts = excelFile.rows.map(r => ({ PROPOSTA: String(r[excelFile.col]).trim() }));
    const { error } = await supabase.from('formalizacoes').insert(inserts);
    if (error) { notify('error', 'Erro ao importar.'); return; }
    notify('success', `${inserts.length} proposta(s) importada(s).`);
    setNewModal(false); setExcelFile(null); fetchAllData();
  };

  const clearFilters = () => {
    setFilters({ proposta:'', instrumento:'Todos', ajuste:'Todos', empenho:'Todos', tecnico:'Todos', uf:'Todos', processo:'', entidade:'', ano:'Todos', emptyCols:[], filledCols:[] });
    setGlobalFilter('');
  };

  const hasFilters = filters.proposta || filters.instrumento !== 'Todos' || filters.ajuste !== 'Todos' ||
    filters.empenho !== 'Todos' || filters.tecnico !== 'Todos' || filters.uf !== 'Todos' ||
    filters.processo || filters.entidade || filters.ano !== 'Todos' ||
    filters.emptyCols.length || filters.filledCols.length || globalFilter;

  const toggleEmptyCol = col => setFilters(p => {
    const arr = p.emptyCols.includes(col) ? p.emptyCols.filter(c => c !== col) : [...p.emptyCols, col];
    return { ...p, emptyCols: arr, filledCols: p.filledCols.filter(c => c !== col) };
  });

  const toggleFilledCol = col => setFilters(p => {
    const arr = p.filledCols.includes(col) ? p.filledCols.filter(c => c !== col) : [...p.filledCols, col];
    return { ...p, filledCols: arr, emptyCols: p.emptyCols.filter(c => c !== col) };
  });

  // ── loading screen ──
  if (loading && !data.length) return (
    <>
      <style>{CSS}</style>
      <div className="load-screen">
        <div className="load-ring" />
        <div className="load-label">Carregando dados — {progress}%</div>
        <div className="load-track"><div className="load-fill" style={{ width: `${progress}%` }} /></div>
      </div>
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      <div className="app">

        {/* ─── SIDEBAR ─── */}
        <aside className={`sidebar${sidebarOpen ? '' : ' sb-collapsed'}`}>
          <div className="sb-head">
            <div className="sb-brand">
              <div className="sb-logo">
                <span>F</span>
              </div>
              {sidebarOpen && (
                <div>
                  <div className="sb-name">Formalizações</div>
                  <div className="sb-sub">MESP · Painel de Controle</div>
                </div>
              )}
            </div>
            <button className="sb-toggle-btn" onClick={() => setSidebarOpen(p => !p)}>
              {sidebarOpen ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
            </button>
          </div>

          {sidebarOpen && (
            <>
              {/* mini KPIs */}
              <div className="sb-kpis">
                <div className="sb-kpi">
                  <span className="sk-v">{stats.total.toLocaleString('pt-BR')}</span>
                  <span className="sk-l">Total</span>
                </div>
                <div className="sb-kpi warn">
                  <span className="sk-v">{stats.pendentes}</span>
                  <span className="sk-l">Pendentes</span>
                </div>
                <div className="sb-kpi ok">
                  <span className="sk-v">{stats.realizados}</span>
                  <span className="sk-l">Realizados</span>
                </div>
              </div>

              {/* tab pills */}
              <div className="sb-tabs">
                {[
                  { id: 'filters', icon: <Filter size={11} />, label: 'Filtros' },
                  { id: 'empty',   icon: <AlertOctagon size={11} />, label: 'Dados Vazios' },
                  { id: 'columns', icon: <Columns size={11} />, label: 'Colunas' },
                ].map(t => (
                  <button
                    key={t.id}
                    className={`sb-tab${activeTab === t.id ? ' active' : ''}`}
                    onClick={() => setActiveTab(t.id)}
                  >
                    {t.icon}{t.label}
                  </button>
                ))}
              </div>

              <div className="sb-body">

                {/* ── TAB: FILTERS ── */}
                {activeTab === 'filters' && (
                  <>
                    {[
                      { label: 'Nº Proposta', key: 'proposta', ph: '024721/2025' },
                      { label: 'Processo',    key: 'processo', ph: 'Nº do processo' },
                      { label: 'Entidade',    key: 'entidade', ph: 'Nome da entidade' },
                    ].map(({ label, key, ph }) => (
                      <div className="ff" key={key}>
                        <label className="fl">{label}</label>
                        <input className="fi" placeholder={ph} value={filters[key]}
                          onChange={e => setFilters(p => ({ ...p, [key]: e.target.value }))} />
                      </div>
                    ))}

                    {/* Ano */}
                    <div className="ff">
                      <label className="fl"><Calendar size={9} /> Ano</label>
                      <div className="year-pills">
                        {ANOS.map(a => (
                          <button
                            key={a}
                            className={`year-pill${filters.ano === a ? ' active' : ''}`}
                            onClick={() => setFilters(p => ({ ...p, ano: a }))}
                          >{a}</button>
                        ))}
                      </div>
                    </div>

                    {/* Por ano breakdown */}
                    {Object.keys(stats.byYear).length > 0 && (
                      <div className="year-breakdown">
                        {Object.entries(stats.byYear).sort((a, b) => b[0].localeCompare(a[0])).map(([yr, cnt]) => (
                          <div key={yr} className="yr-row">
                            <span className="yr-label">{yr}</span>
                            <div className="yr-bar-wrap">
                              <div className="yr-bar" style={{ width: `${(cnt / stats.total) * 100}%` }} />
                            </div>
                            <span className="yr-count">{cnt}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {[
                      { label: 'Instrumento', key: 'instrumento', opts: ['Todos','CONVÊNIO','TERMO DE FOMENTO','TERMO DE EXECUÇÃO DESCENTRALIZADA'] },
                      { label: 'Ajuste',      key: 'ajuste',      opts: ['Todos','PENDENTE','REALIZADO','NÃO SE APLICA'] },
                      { label: 'Empenho',     key: 'empenho',     opts: ['Todos','SIM','NÃO'] },
                      { label: 'Técnico',     key: 'tecnico',     opts: ['Todos', ...SELECT_OPTIONS['TÉCNICO DE FORMALIZAÇÃO']] },
                      { label: 'UF',          key: 'uf',          opts: ['Todos','AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'] },
                    ].map(({ label, key, opts }) => (
                      <div className="ff" key={key}>
                        <label className="fl">{label}</label>
                        <select className="fs" value={filters[key]}
                          onChange={e => setFilters(p => ({ ...p, [key]: e.target.value }))}>
                          {opts.map(o => <option key={o}>{o}</option>)}
                        </select>
                      </div>
                    ))}
                  </>
                )}

                {/* ── TAB: EMPTY DATA ── */}
                {activeTab === 'empty' && (
                  <div className="empty-tab">
                    <p className="empty-tab-hint">
                      Filtre registros com campos <strong>vazios</strong> ou <strong>preenchidos</strong> por coluna.
                    </p>
                    {allEditableCols.slice(0,30).map(col => {
                      const emptyCount  = stats.emptyStats[col] || 0;
                      const pct         = stats.total > 0 ? Math.round((emptyCount / stats.total) * 100) : 0;
                      const isEmptyFlt  = filters.emptyCols.includes(col);
                      const isFilledFlt = filters.filledCols.includes(col);
                      return (
                        <div key={col} className={`ec-row${isEmptyFlt ? ' ec-empty' : ''}${isFilledFlt ? ' ec-filled' : ''}`}>
                          <div className="ec-info">
                            <span className="ec-name" title={col}>{col}</span>
                            <span className="ec-stat">
                              {emptyCount > 0
                                ? <span className="ec-empty-cnt">{emptyCount} vazio{emptyCount !== 1 ? 's' : ''} ({pct}%)</span>
                                : <span className="ec-full-cnt">Completo ✓</span>
                              }
                            </span>
                            <div className="ec-bar-wrap">
                              <div className="ec-bar-fill" style={{ width: `${100 - pct}%` }} />
                            </div>
                          </div>
                          <div className="ec-btns">
                            <button
                              className={`ec-btn${isEmptyFlt ? ' active-empty' : ''}`}
                              onClick={() => toggleEmptyCol(col)}
                              title="Mostrar apenas vazios"
                            >∅</button>
                            <button
                              className={`ec-btn${isFilledFlt ? ' active-filled' : ''}`}
                              onClick={() => toggleFilledCol(col)}
                              title="Mostrar apenas preenchidos"
                            >✓</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── TAB: COLUMNS ── */}
                {activeTab === 'columns' && (
                  <div className="col-tab">
                    <p className="empty-tab-hint">Mostrar ou ocultar colunas na tabela.</p>
                    {allEditableCols
                      .filter(k => !['PROPOSTA','INSTRUMENTO','VALOR REPASSE'].includes(k))
                      .map(col => (
                        <div key={col} className="col-row">
                          <span className="col-name" title={col}>{col}</span>
                          <button
                            className={`toggle-col${colVisibility[col] === false ? ' hidden' : ' visible'}`}
                            onClick={() => setColVisibility(p => ({ ...p, [col]: p[col] === false ? true : false }))}
                          >
                            {colVisibility[col] === false ? <EyeOff size={11} /> : <Eye size={11} />}
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="sb-foot">
                {hasFilters && (
                  <button className="clear-btn" onClick={clearFilters}>
                    <X size={11} />Limpar Filtros
                  </button>
                )}
                <div className="sb-count">
                  {totalFiltered.toLocaleString('pt-BR')} / {stats.total.toLocaleString('pt-BR')} registros
                </div>
              </div>
            </>
          )}
        </aside>

        {/* ─── MAIN ─── */}
        <main className="main">

          {/* KPI bar */}
          <div className="kpi-bar">
            <div className="kpi-card blue">
              <div className="kc-icon"><BarChart2 size={16} /></div>
              <div>
                <div className="kc-val">{stats.total.toLocaleString('pt-BR')}</div>
                <div className="kc-lbl">Total de Propostas</div>
              </div>
            </div>
            <div className="kpi-card amber">
              <div className="kc-icon"><AlertTriangle size={16} /></div>
              <div>
                <div className="kc-val">{stats.pendentes}</div>
                <div className="kc-lbl">Ajustes Pendentes</div>
                <div className="kc-sub">{stats.total > 0 ? ((stats.pendentes/stats.total)*100).toFixed(1) : 0}% do total</div>
              </div>
            </div>
            <div className="kpi-card green">
              <div className="kc-icon"><CheckCircle2 size={16} /></div>
              <div>
                <div className="kc-val">{stats.realizados}</div>
                <div className="kc-lbl">Ajustes Realizados</div>
                <div className="kc-sub">{stats.total > 0 ? ((stats.realizados/stats.total)*100).toFixed(1) : 0}% do total</div>
              </div>
            </div>
            <div className="kpi-card indigo">
              <div className="kc-icon"><TrendingUp size={16} /></div>
              <div>
                <div className="kc-val">{stats.valorTotal.toLocaleString('pt-BR', { notation:'compact', style:'currency', currency:'BRL', maximumFractionDigits:1 })}</div>
                <div className="kc-lbl">Valor Total em Repasse</div>
              </div>
            </div>
          </div>

          {/* Table card */}
          <div className="tcard">

            {/* Toolbar */}
            <div className="toolbar">
              <div className="tl-left">
                <h2 className="tcard-title">Registro de Formalizações</h2>
                <span className="count-chip">{totalFiltered.toLocaleString('pt-BR')} registros</span>
                {hasFilters && <span className="filter-chip"><Filter size={9} />Filtros ativos</span>}
                {dirtyCount > 0 && (
                  <span className="dirty-chip">
                    <Edit3 size={10} />{dirtyCount} não salva(s)
                  </span>
                )}
              </div>
              <div className="tl-right">
                <div className="search-box">
                  <Search size={12} className="search-icon" />
                  <input
                    className="search-in"
                    placeholder="Buscar em todos os campos..."
                    value={globalFilter}
                    onChange={e => setGlobalFilter(e.target.value)}
                  />
                  {globalFilter && (
                    <button className="search-x" onClick={() => setGlobalFilter('')}><X size={10} /></button>
                  )}
                </div>

                <button className="icon-btn" onClick={fetchAllData} title="Atualizar">
                  <RefreshCw size={13} />
                </button>
                <button className="icon-btn" onClick={exportToExcel} title="Exportar Excel">
                  <Download size={13} />
                </button>

                {selectedRows.size > 0 && (
                  <button className="btn btn-outline-red" onClick={() => setConfirmModal({
                    type: 'delete-many',
                    title: `Excluir ${selectedRows.size} Registro(s)`,
                    message: <>Excluir permanentemente <strong>{selectedRows.size} registros</strong>?</>,
                    confirmLabel: `Excluir ${selectedRows.size}`,
                    confirmClass: 'btn-danger',
                  })}>
                    <Trash2 size={12} />Excluir ({selectedRows.size})
                  </button>
                )}

                {dirtyCount > 0 && (
                  <button className="btn btn-save" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 size={12} className="spin" /> : <Save size={12} />}
                    Salvar ({dirtyCount})
                  </button>
                )}

                <button className="btn btn-primary" onClick={() => {
                  setNewModal(true); setNewTab('manual');
                  setNewProposta(''); setExcelFile(null); setExcelError('');
                }}>
                  <Plus size={13} />Nova Proposta
                </button>
              </div>
            </div>

            {/* Active filter badges */}
            {(filters.emptyCols.length > 0 || filters.filledCols.length > 0 || filters.ano !== 'Todos') && (
              <div className="active-filters">
                {filters.ano !== 'Todos' && (
                  <span className="af-pill blue">
                    Ano: {filters.ano}
                    <button onClick={() => setFilters(p => ({ ...p, ano: 'Todos' }))}><X size={9} /></button>
                  </span>
                )}
                {filters.emptyCols.map(col => (
                  <span key={col} className="af-pill amber">
                    ∅ {col}
                    <button onClick={() => toggleEmptyCol(col)}><X size={9} /></button>
                  </span>
                ))}
                {filters.filledCols.map(col => (
                  <span key={col} className="af-pill green">
                    ✓ {col}
                    <button onClick={() => toggleFilledCol(col)}><X size={9} /></button>
                  </span>
                ))}
              </div>
            )}

            {/* Table */}
            <div className="tscroll">
              <table>
                <thead>
                  <tr>
                    {table.getHeaderGroups()[0]?.headers.map(h => {
                      const key   = h.column.columnDef.accessorKey;
                      const isBot = ROBO_COLS.includes(key);
                      const isAud = h.column.id === 'audit';
                      return (
                        <th key={h.id}
                          className={[h.column.getCanSort() ? 'sortable' : '', isBot ? 'th-bot' : '', isAud ? 'th-aud' : ''].filter(Boolean).join(' ')}
                          style={{ width: h.column.columnDef.size, minWidth: h.column.columnDef.size }}
                          onClick={h.column.getToggleSortingHandler()}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {h.column.getCanSort() && (
                            <span className="sort-icon">
                              {h.column.getIsSorted() === 'asc' ? <ChevronUp size={9} /> :
                               h.column.getIsSorted() === 'desc' ? <ChevronDown size={9} /> :
                               <span style={{ opacity: .25 }}>⇅</span>}
                            </span>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row, i) => (
                    <tr key={row.id}
                      className={[
                        selectedRows.has(row.original.id) ? 'row-sel' : '',
                        i % 2 !== 0 ? 'row-stripe' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {table.getRowModel().rows.length === 0 && (
                    <tr>
                      <td colSpan={columns.length} className="no-data">
                        <div className="no-data-icon">🔎</div>
                        <div className="no-data-title">Nenhum registro encontrado</div>
                        <div className="no-data-sub">Ajuste os filtros ou a busca.</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="tfoot">
              <div className="page-info">
                <strong>{pageIndex * pageSize + 1}</strong>–<strong>{Math.min((pageIndex + 1) * pageSize, totalFiltered)}</strong> de <strong>{totalFiltered.toLocaleString('pt-BR')}</strong>
              </div>
              <div className="page-ctrl">
                <label className="pg-lbl">Linhas</label>
                <select className="pg-sel" value={pageSize}
                  onChange={e => table.setPageSize(Number(e.target.value))}>
                  {[10,15,20,25,50,100].map(s => <option key={s}>{s}</option>)}
                </select>
                <button className="pg-btn" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>«</button>
                <button className="pg-btn" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}><ChevronLeft size={12} /></button>
                <span className="pg-cur">Pág. {pageIndex + 1} / {pageCount || 1}</span>
                <button className="pg-btn" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}><ChevronRight size={12} /></button>
                <button className="pg-btn" onClick={() => table.setPageIndex(pageCount - 1)} disabled={!table.getCanNextPage()}>»</button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* ─── CONFIRM MODAL ─── */}
      {confirmModal && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setConfirmModal(null)}>
          <div className="modal">
            <div className={`modal-ico ${confirmModal.confirmClass === 'btn-danger' ? 'red' : 'blue'}`}>
              {confirmModal.confirmClass === 'btn-danger' ? <AlertTriangle size={20} /> : <Info size={20} />}
            </div>
            <h3 className="modal-title">{confirmModal.title}</h3>
            <p className="modal-desc">{confirmModal.message}</p>
            <div className="modal-acts">
              <button className="btn btn-ghost" onClick={() => setConfirmModal(null)}>Cancelar</button>
              <button className={`btn ${confirmModal.confirmClass}`} onClick={handleConfirm}>
                {confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── NEW RECORD MODAL ─── */}
      {newModal && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setNewModal(false)}>
          <div className="modal modal-lg">
            <h3 className="modal-title">Nova Proposta</h3>
            <p className="modal-desc">Insira manualmente ou importe via Excel.</p>
            <div className="modal-tabs">
              {[
                { id: 'manual', icon: <Hash size={11} />, label: 'Manual' },
                { id: 'excel',  icon: <FileSpreadsheet size={11} />, label: 'Importar Excel' },
              ].map(t => (
                <button key={t.id} className={`mtab${newTab === t.id ? ' active' : ''}`}
                  onClick={() => setNewTab(t.id)}>
                  {t.icon}{t.label}
                </button>
              ))}
            </div>

            {newTab === 'manual' && (
              <>
                <div className="notice info">
                  <Bot size={14} />
                  <span>Informe o número da proposta (ex: <strong>024721/2025</strong>). Os demais campos serão preenchidos depois.</span>
                </div>
                <div className="form-field">
                  <label className="form-lbl">Número da Proposta *</label>
                  <input className="form-in" placeholder="024721/2025"
                    value={newProposta} autoFocus
                    onChange={e => setNewProposta(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleNewManual()} />
                </div>
                <div className="modal-acts">
                  <button className="btn btn-ghost" onClick={() => setNewModal(false)}>Cancelar</button>
                  <button className="btn btn-primary" disabled={!newProposta.trim()} onClick={handleNewManual}>
                    <Plus size={12} />Criar
                  </button>
                </div>
              </>
            )}

            {newTab === 'excel' && (
              <>
                <div className="notice success">
                  <FileSpreadsheet size={14} />
                  <span>Upload de <strong>.xlsx</strong> com coluna <strong>PROPOSTA</strong>.</span>
                </div>
                <div
                  className={`dropzone${dragover ? ' dz-over' : ''}`}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragover(true); }}
                  onDragLeave={() => setDragover(false)}
                  onDrop={e => { e.preventDefault(); setDragover(false); const f = e.dataTransfer.files[0]; if (f) processExcel(f); }}
                >
                  <Upload size={26} className="dz-ico" />
                  <div className="dz-t">{excelFile ? excelFile.name : 'Clique ou arraste o arquivo aqui'}</div>
                  <div className="dz-s">.xlsx · .xls</div>
                  <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display:'none' }}
                    onChange={e => { if (e.target.files[0]) processExcel(e.target.files[0]); }} />
                </div>
                {excelError && <div className="notice danger">{excelError}</div>}
                {excelFile && !excelError && (
                  <div className="preview">
                    <div className="preview-meta">Coluna: <strong>{excelFile.col}</strong> · <strong>{excelFile.rows.length}</strong> proposta(s)</div>
                    <div className="preview-scroll">
                      <table className="preview-table">
                        <thead><tr><th>#</th><th>PROPOSTA</th></tr></thead>
                        <tbody>
                          {excelFile.rows.slice(0,6).map((r, i) => (
                            <tr key={i}><td>{i+1}</td><td>{String(r[excelFile.col])}</td></tr>
                          ))}
                          {excelFile.rows.length > 6 && (
                            <tr><td colSpan={2} className="prev-more">+{excelFile.rows.length - 6} mais…</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                <div className="modal-acts">
                  <button className="btn btn-ghost" onClick={() => setNewModal(false)}>Cancelar</button>
                  <button className="btn btn-primary" disabled={!excelFile || !!excelError} onClick={handleNewExcel}>
                    <Upload size={12} />Importar {excelFile ? `(${excelFile.rows.length})` : ''}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── TOAST ─── */}
      {message && (
        <div className={`toast t-${message.type}`}>
          {message.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {message.text}
        </div>
      )}
    </>
  );
}

// ─── CSS ─────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

:root{
  --bg:       #F2F4F8;
  --surface:  #FFFFFF;
  --surface2: #F7F8FC;
  --border:   #E3E7EF;
  --border2:  #CDD3DF;

  --blue:     #1A56DB;
  --blue-lt:  #EFF4FF;
  --blue-md:  #C3D4F8;
  --blue-dk:  #1447C5;

  --green:    #057A55;
  --green-lt: #ECFDF5;
  --green-md: #A7F3D0;

  --amber:    #B45309;
  --amber-lt: #FFFBEB;
  --amber-md: #FDE68A;

  --red:      #C81E1E;
  --red-lt:   #FEF2F2;
  --red-md:   #FECACA;

  --indigo:   #5145CD;
  --indigo-lt:#EEF2FF;
  --indigo-md:#C7D2FE;

  --sky:      #0369A1;
  --sky-lt:   #F0F9FF;
  --sky-bd:   #BAE6FD;

  --c1:  #0D1117;
  --c2:  #374151;
  --c3:  #6B7280;
  --c4:  #9CA3AF;
  --c5:  #D1D5DB;

  --font: 'DM Sans', sans-serif;
  --mono: 'DM Mono', monospace;

  --r-sm: 6px;
  --r:    10px;
  --r-lg: 14px;
  --sh-sm: 0 1px 3px rgba(0,0,0,.05), 0 1px 2px rgba(0,0,0,.04);
  --sh:    0 4px 16px rgba(0,0,0,.07);
  --sh-lg: 0 16px 48px rgba(0,0,0,.15);
}

html,body,#root{font-family:var(--font);background:var(--bg);height:100vh;overflow:hidden;color:var(--c1);}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border2);border-radius:10px}

/* ── LAYOUT ── */
.app{display:flex;height:100vh;overflow:hidden;}
.main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;padding:16px;gap:12px;}

/* ── SIDEBAR ── */
.sidebar{
  width:272px;flex-shrink:0;
  background:var(--surface);
  border-right:1px solid var(--border);
  display:flex;flex-direction:column;overflow:hidden;
  transition:width .2s ease;
}
.sidebar.sb-collapsed{width:52px;}

.sb-head{
  padding:14px;
  border-bottom:1px solid var(--border);
  display:flex;align-items:center;justify-content:space-between;flex-shrink:0;
}
.sb-brand{display:flex;align-items:center;gap:10px;}
.sb-logo{
  width:34px;height:34px;border-radius:10px;
  background:linear-gradient(135deg,#1A56DB 0%,#5145CD 100%);
  display:flex;align-items:center;justify-content:center;flex-shrink:0;
}
.sb-logo span{color:#fff;font-weight:700;font-size:16px;letter-spacing:-.02em;}
.sb-name{font-size:13px;font-weight:700;color:var(--c1);}
.sb-sub{font-size:10px;color:var(--c4);margin-top:1px;}
.sb-toggle-btn{
  width:28px;height:28px;border-radius:8px;
  border:1px solid var(--border);background:var(--surface2);
  cursor:pointer;display:flex;align-items:center;justify-content:center;
  color:var(--c4);transition:all .12s;flex-shrink:0;
}
.sb-toggle-btn:hover{background:var(--blue-lt);color:var(--blue);border-color:var(--blue-md);}

.sb-kpis{display:flex;border-bottom:1px solid var(--border);flex-shrink:0;}
.sb-kpi{flex:1;padding:10px 8px;text-align:center;border-right:1px solid var(--border);}
.sb-kpi:last-child{border-right:none;}
.sk-v{display:block;font-size:17px;font-weight:700;color:var(--c1);}
.sk-l{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--c4);margin-top:2px;}
.sb-kpi.warn .sk-v{color:var(--amber);}
.sb-kpi.ok .sk-v{color:var(--green);}

.sb-tabs{
  display:flex;gap:2px;padding:8px;border-bottom:1px solid var(--border);flex-shrink:0;
  background:var(--surface2);
}
.sb-tab{
  flex:1;padding:6px 4px;
  border:1px solid transparent;border-radius:var(--r-sm);
  font-size:10px;font-weight:600;font-family:var(--font);cursor:pointer;
  display:flex;align-items:center;justify-content:center;gap:4px;
  color:var(--c3);background:transparent;transition:all .12s;
}
.sb-tab.active{background:var(--surface);color:var(--blue);border-color:var(--border);box-shadow:var(--sh-sm);}

.sb-body{flex:1;overflow-y:auto;padding:10px;}

/* filter fields */
.ff{margin-bottom:8px;}
.fl{display:flex;align-items:center;gap:4px;font-size:10px;font-weight:600;color:var(--c3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px;}
.fi,.fs{
  width:100%;padding:7px 10px;
  border:1px solid var(--border);border-radius:var(--r-sm);
  font-size:12px;font-family:var(--font);color:var(--c1);
  background:var(--surface2);outline:none;
  transition:border-color .12s,box-shadow .12s;
}
.fi:focus,.fs:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(26,86,219,.1);background:#fff;}
.fs{appearance:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 8px center;padding-right:26px;}

/* year pills */
.year-pills{display:flex;flex-wrap:wrap;gap:4px;}
.year-pill{
  padding:3px 10px;
  border:1px solid var(--border);border-radius:20px;
  font-size:11px;font-weight:600;font-family:var(--font);
  cursor:pointer;background:var(--surface2);color:var(--c3);
  transition:all .12s;
}
.year-pill.active{background:var(--blue);color:#fff;border-color:var(--blue);}

/* year breakdown bars */
.year-breakdown{margin-bottom:8px;display:flex;flex-direction:column;gap:4px;}
.yr-row{display:flex;align-items:center;gap:6px;}
.yr-label{font-size:10px;font-weight:600;color:var(--c3);width:32px;flex-shrink:0;}
.yr-bar-wrap{flex:1;height:6px;background:var(--border);border-radius:10px;overflow:hidden;}
.yr-bar{height:100%;background:var(--blue);border-radius:10px;transition:width .4s ease;}
.yr-count{font-size:10px;font-weight:600;color:var(--c2);width:28px;text-align:right;flex-shrink:0;}

/* empty tab */
.empty-tab-hint{font-size:11px;color:var(--c3);line-height:1.5;margin-bottom:8px;}
.ec-row{
  display:flex;align-items:center;gap:6px;
  padding:6px 8px;
  border-radius:var(--r-sm);border:1px solid var(--border);
  margin-bottom:4px;background:var(--surface2);
  transition:border-color .12s,background .12s;
}
.ec-row.ec-empty{border-color:var(--amber);background:var(--amber-lt);}
.ec-row.ec-filled{border-color:var(--green);background:var(--green-lt);}
.ec-info{flex:1;min-width:0;}
.ec-name{display:block;font-size:10px;font-weight:600;color:var(--c2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ec-stat{display:block;font-size:9px;margin-top:1px;}
.ec-empty-cnt{color:var(--amber);}
.ec-full-cnt{color:var(--green);}
.ec-bar-wrap{margin-top:3px;height:3px;background:var(--border);border-radius:4px;overflow:hidden;}
.ec-bar-fill{height:100%;background:var(--green);border-radius:4px;}
.ec-btns{display:flex;gap:3px;flex-shrink:0;}
.ec-btn{
  width:22px;height:22px;border-radius:5px;
  border:1px solid var(--border);background:var(--surface);
  font-size:11px;font-weight:700;cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  color:var(--c3);transition:all .12s;
}
.ec-btn.active-empty{background:var(--amber);color:#fff;border-color:var(--amber);}
.ec-btn.active-filled{background:var(--green);color:#fff;border-color:var(--green);}

/* col visibility tab */
.col-tab{display:flex;flex-direction:column;gap:4px;}
.col-row{
  display:flex;align-items:center;gap:6px;
  padding:5px 8px;border-radius:var(--r-sm);
  border:1px solid var(--border);background:var(--surface2);
}
.col-name{flex:1;font-size:10px;font-weight:600;color:var(--c2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.toggle-col{
  padding:3px 7px;border-radius:5px;
  border:1px solid var(--border);background:var(--surface);
  cursor:pointer;display:flex;align-items:center;gap:3px;
  font-size:10px;color:var(--c3);transition:all .12s;
}
.toggle-col.visible{color:var(--blue);border-color:var(--blue-md);background:var(--blue-lt);}
.toggle-col.hidden{color:var(--c4);border-color:var(--border);}

.sb-foot{padding:8px 10px 12px;border-top:1px solid var(--border);flex-shrink:0;}
.clear-btn{
  width:100%;padding:8px;margin-bottom:6px;
  background:var(--red-lt);color:var(--red);
  border:1px solid var(--red-md);border-radius:var(--r-sm);
  font-size:11px;font-weight:600;font-family:var(--font);cursor:pointer;
  display:flex;align-items:center;justify-content:center;gap:5px;
  transition:background .12s;
}
.clear-btn:hover{background:#FEE2E2;}
.sb-count{font-size:10px;color:var(--c4);text-align:center;font-weight:500;}

/* ── KPI BAR ── */
.kpi-bar{display:flex;gap:12px;flex-shrink:0;}
.kpi-card{
  flex:1;min-width:0;
  background:var(--surface);
  border:1px solid var(--border);border-radius:var(--r);
  padding:14px 16px;
  display:flex;align-items:center;gap:12px;
  border-left:4px solid transparent;
  box-shadow:var(--sh-sm);
  transition:transform .14s,box-shadow .14s;
}
.kpi-card:hover{transform:translateY(-2px);box-shadow:var(--sh);}
.kpi-card.blue  {border-left-color:var(--blue);}
.kpi-card.amber {border-left-color:var(--amber);}
.kpi-card.green {border-left-color:var(--green);}
.kpi-card.indigo{border-left-color:var(--indigo);}
.kc-icon{width:36px;height:36px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.kpi-card.blue   .kc-icon{background:var(--blue-lt);color:var(--blue);}
.kpi-card.amber  .kc-icon{background:var(--amber-lt);color:var(--amber);}
.kpi-card.green  .kc-icon{background:var(--green-lt);color:var(--green);}
.kpi-card.indigo .kc-icon{background:var(--indigo-lt);color:var(--indigo);}
.kc-val{font-size:22px;font-weight:700;color:var(--c1);letter-spacing:-.03em;line-height:1;}
.kc-lbl{font-size:11px;font-weight:600;color:var(--c3);margin-top:3px;}
.kc-sub{font-size:10px;color:var(--c4);margin-top:2px;}

/* ── TABLE CARD ── */
.tcard{
  flex:1;min-height:0;
  background:var(--surface);
  border:1px solid var(--border);border-radius:var(--r-lg);
  display:flex;flex-direction:column;overflow:hidden;
  box-shadow:var(--sh-sm);
}

/* ── TOOLBAR ── */
.toolbar{
  padding:11px 16px;border-bottom:1px solid var(--border);
  display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;
  gap:8px;flex-shrink:0;background:var(--surface);
}
.tl-left{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.tcard-title{font-size:14px;font-weight:700;color:var(--c1);letter-spacing:-.02em;}
.count-chip{
  font-size:11px;font-weight:600;
  background:var(--blue-lt);color:var(--blue);
  border:1px solid var(--blue-md);border-radius:20px;padding:2px 9px;
}
.filter-chip{
  display:flex;align-items:center;gap:4px;
  font-size:10px;font-weight:600;
  background:var(--indigo-lt);color:var(--indigo);
  border:1px solid var(--indigo-md);border-radius:20px;padding:2px 9px;
}
.dirty-chip{
  display:flex;align-items:center;gap:4px;
  font-size:11px;font-weight:600;
  background:var(--amber-lt);color:var(--amber);
  border:1px solid var(--amber-md);border-radius:20px;padding:2px 9px;
  animation:pulse 2s infinite;
}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.7}}

.tl-right{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end;}

.search-box{position:relative;display:flex;align-items:center;}
.search-icon{position:absolute;left:9px;color:var(--c4);pointer-events:none;}
.search-in{
  padding:7px 28px 7px 30px;
  border:1px solid var(--border);border-radius:var(--r-sm);
  font-size:12px;font-family:var(--font);color:var(--c1);
  width:240px;outline:none;background:var(--surface2);
  transition:border-color .12s,box-shadow .12s;
}
.search-in:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(26,86,219,.08);background:#fff;}
.search-in::placeholder{color:var(--c4);}
.search-x{position:absolute;right:7px;background:none;border:none;cursor:pointer;color:var(--c4);display:flex;align-items:center;padding:2px;border-radius:4px;}
.search-x:hover{color:var(--c1);}

.icon-btn{
  padding:7px;border:1px solid var(--border);border-radius:var(--r-sm);
  background:var(--surface);cursor:pointer;color:var(--c2);
  display:flex;align-items:center;transition:all .12s;
}
.icon-btn:hover{background:var(--surface2);border-color:var(--border2);}

/* ── BUTTONS ── */
.btn{
  display:inline-flex;align-items:center;gap:5px;
  padding:7px 13px;border-radius:var(--r-sm);
  font-size:12px;font-weight:600;font-family:var(--font);
  cursor:pointer;border:1px solid transparent;
  transition:all .12s;
}
.btn-primary{background:var(--blue);color:#fff;}
.btn-primary:hover{background:var(--blue-dk);}
.btn-primary:disabled{opacity:.5;cursor:not-allowed;}
.btn-save{background:var(--green);color:#fff;border-color:var(--green);}
.btn-save:hover{background:#046640;}
.btn-save:disabled{opacity:.5;cursor:not-allowed;}
.btn-danger{background:var(--red);color:#fff;}
.btn-danger:hover{background:#A51B1B;}
.btn-success{background:var(--green);color:#fff;}
.btn-success:hover{background:#046640;}
.btn-ghost{background:var(--surface2);color:var(--c2);border-color:var(--border);}
.btn-ghost:hover{background:var(--border);}
.btn-outline-red{background:var(--red-lt);color:var(--red);border-color:var(--red-md);}
.btn-outline-red:hover{background:#FEE2E2;}

/* active filter pills */
.active-filters{
  padding:6px 16px;border-bottom:1px solid var(--border);
  display:flex;gap:5px;flex-wrap:wrap;background:var(--surface2);
  flex-shrink:0;
}
.af-pill{
  display:inline-flex;align-items:center;gap:4px;
  font-size:10px;font-weight:600;
  border-radius:20px;padding:2px 8px;
  border:1px solid transparent;
}
.af-pill button{display:flex;align-items:center;border:none;background:none;cursor:pointer;opacity:.6;padding:0;}
.af-pill button:hover{opacity:1;}
.af-pill.blue  {background:var(--blue-lt);color:var(--blue);border-color:var(--blue-md);}
.af-pill.amber {background:var(--amber-lt);color:var(--amber);border-color:var(--amber-md);}
.af-pill.green {background:var(--green-lt);color:var(--green);border-color:var(--green-md);}

/* ── TABLE ── */
.tscroll{flex:1;overflow:auto;}
table{width:100%;border-collapse:collapse;font-size:12px;}

thead th{
  position:sticky;top:0;z-index:10;
  background:var(--surface2);
  padding:9px 12px;text-align:left;
  font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;
  color:var(--c3);border-bottom:2px solid var(--border);
  white-space:nowrap;user-select:none;
}
thead th.sortable{cursor:pointer;}
thead th.sortable:hover{background:var(--blue-lt);color:var(--blue);}
thead th.th-bot{color:var(--sky);background:var(--sky-lt);}
thead th.th-bot:hover{background:#E0F2FE;}
thead th.th-aud{color:#7C3AED;background:#F5F3FF;}
.sort-icon{margin-left:3px;opacity:.5;vertical-align:middle;}
.th-inner{display:flex;align-items:center;gap:5px;}
.hdr-audit{display:flex;align-items:center;gap:5px;color:#7C3AED;}
.robo-chip{
  display:inline-flex;align-items:center;gap:2px;
  font-size:8px;font-weight:700;
  background:var(--sky-lt);color:var(--sky);
  border:1px solid var(--sky-bd);border-radius:4px;padding:1px 4px;
}

tbody tr{border-bottom:1px solid #F1F5F9;transition:background .07s;}
tbody tr:hover{background:#FAFBFE;}
tbody tr.row-stripe{background:#FAFBFC;}
tbody tr.row-sel{background:var(--blue-lt)!important;}
tbody td{padding:7px 12px;vertical-align:middle;}

/* ── CELL TYPES ── */
.row-num{font-family:var(--mono);font-size:10px;color:var(--c4);}
.inst-tag{
  display:inline-flex;align-items:center;
  padding:3px 9px;border-radius:20px;
  font-size:10px;font-weight:700;white-space:nowrap;
}
.inst-tag.conv {background:var(--blue-lt);color:var(--blue);}
.inst-tag.fom  {background:var(--green-lt);color:var(--green);}
.inst-tag.ted  {background:var(--indigo-lt);color:var(--indigo);}
.cell-robo{font-size:11px;color:var(--sky);display:block;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}

/* ── BADGES ── */
.badge{
  display:inline-flex;align-items:center;gap:5px;
  padding:3px 9px;border-radius:20px;
  font-size:10px;font-weight:700;white-space:nowrap;
}
.badge::before{content:'';width:5px;height:5px;border-radius:50%;flex-shrink:0;}
.b-success{background:var(--green-lt);color:var(--green);}  .b-success::before{background:var(--green);}
.b-danger {background:var(--red-lt);color:var(--red);}      .b-danger::before{background:var(--red);}
.b-warning{background:var(--amber-lt);color:var(--amber);}  .b-warning::before{background:var(--amber);}
.b-muted  {background:#F1F5F9;color:#64748B;}                .b-muted::before{background:#94A3B8;}
.b-info   {background:var(--indigo-lt);color:var(--indigo);} .b-info::before{background:var(--indigo);}
.b-neutral{background:#F1F5F9;color:var(--c2);}              .b-neutral::before{background:var(--c4);}

/* ── EDITABLE CELLS ── */
.empty-dash{color:var(--c5);font-size:11px;}
.empty-dash.clickable{color:var(--c4);font-style:italic;font-size:10px;}
.dot-dirty{position:absolute;top:-3px;right:-3px;width:7px;height:7px;border-radius:50%;background:var(--amber);border:2px solid #fff;}

.sel-wrap{position:relative;display:inline-flex;align-items:center;}
.cell-sel{
  padding:4px 24px 4px 8px;
  border:1px solid var(--border);border-radius:var(--r-sm);
  font-size:11px;font-family:var(--font);color:var(--c1);
  background:#fff;cursor:pointer;outline:none;appearance:none;
  min-width:120px;transition:border-color .12s,box-shadow .12s;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 6px center;
}
.cell-sel:focus{border-color:var(--blue);box-shadow:0 0 0 2px rgba(26,86,219,.12);}
.sel-wrap.dirty .cell-sel{border-color:var(--amber);background-color:var(--amber-lt);}
.sel-wrap.empty-val .cell-sel{border-color:var(--red-md);background:var(--red-lt);}

.txt-cell{
  display:flex;align-items:center;gap:5px;
  cursor:pointer;padding:4px 7px;
  border-radius:var(--r-sm);border:1px solid transparent;
  min-width:80px;transition:all .12s;position:relative;
}
.txt-cell:hover{border-color:var(--border);background:var(--surface2);}
.txt-val{font-size:11px;color:var(--c1);flex:1;}
.pencil{color:var(--c5);flex-shrink:0;opacity:0;transition:opacity .12s;}
.txt-cell:hover .pencil{opacity:1;}
.txt-cell.dirty{border-color:var(--amber);background:var(--amber-lt);}
.txt-cell.empty-val{border-color:var(--red-md);background:var(--red-lt);}

.ie-wrap{display:flex;align-items:center;gap:3px;}
.ie-input{
  padding:4px 8px;
  border:1.5px solid var(--blue);border-radius:var(--r-sm);
  font-size:11px;font-family:var(--font);color:var(--c1);
  outline:none;background:#fff;min-width:100px;
  box-shadow:0 0 0 3px rgba(26,86,219,.1);
}
.ie-btn{width:22px;height:22px;border-radius:5px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .12s;}
.ie-btn.ok{background:var(--green-lt);color:var(--green);}  .ie-btn.ok:hover{background:var(--green-md);}
.ie-btn.no{background:var(--red-lt);color:var(--red);}      .ie-btn.no:hover{background:var(--red-md);}

/* ── AUDIT ── */
.audit-cell{display:flex;flex-direction:column;gap:2px;}
.audit-ts{font-size:10px;color:#7C3AED;font-family:var(--mono);}
.audit-col{
  display:inline-flex;align-items:center;
  font-size:9px;font-weight:700;
  background:#F5F3FF;color:#7C3AED;
  border:1px solid #DDD6FE;border-radius:12px;padding:1px 7px;
  max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}

/* ── DEL BTN ── */
.del-btn{
  opacity:0;padding:5px;background:none;border:none;
  color:var(--c4);cursor:pointer;border-radius:6px;
  display:flex;align-items:center;
  transition:opacity .12s,background .12s,color .12s;
}
tbody tr:hover .del-btn{opacity:1;}
.del-btn:hover{background:var(--red-lt);color:var(--red);}

/* ── CB ── */
.cb{width:14px;height:14px;cursor:pointer;accent-color:var(--blue);}

/* ── EMPTY STATE ── */
.no-data{text-align:center;padding:60px 20px;}
.no-data-icon{font-size:32px;margin-bottom:10px;}
.no-data-title{font-size:15px;font-weight:700;color:var(--c1);margin-bottom:5px;}
.no-data-sub{font-size:13px;color:var(--c3);}

/* ── TABLE FOOTER ── */
.tfoot{
  padding:10px 16px;border-top:1px solid var(--border);
  display:flex;align-items:center;justify-content:space-between;
  flex-shrink:0;background:var(--surface2);
}
.page-info{font-size:12px;color:var(--c2);}
.page-info strong{color:var(--c1);}
.page-ctrl{display:flex;align-items:center;gap:5px;}
.pg-lbl{font-size:10px;color:var(--c4);font-weight:600;}
.pg-sel{padding:4px 8px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:11px;font-family:var(--font);background:#fff;cursor:pointer;outline:none;}
.pg-btn{
  padding:5px 9px;border:1px solid var(--border);border-radius:var(--r-sm);
  font-size:12px;font-weight:600;background:#fff;color:var(--c2);
  cursor:pointer;display:flex;align-items:center;
  transition:all .12s;font-family:var(--font);
}
.pg-btn:hover:not(:disabled){background:var(--blue);color:#fff;border-color:var(--blue);}
.pg-btn:disabled{opacity:.3;cursor:not-allowed;}
.pg-cur{font-size:11px;color:var(--c2);font-weight:600;padding:0 4px;}

/* ── OVERLAY / MODAL ── */
.overlay{
  position:fixed;inset:0;z-index:400;
  background:rgba(13,17,23,.6);backdrop-filter:blur(6px);
  display:flex;align-items:center;justify-content:center;padding:20px;
}
.modal{
  background:var(--surface);border-radius:var(--r-lg);
  padding:28px;width:100%;max-width:440px;
  box-shadow:var(--sh-lg);
  animation:mIn .2s ease;
}
.modal.modal-lg{max-width:560px;}
@keyframes mIn{from{opacity:0;transform:scale(.95) translateY(8px)}}

.modal-ico{
  width:52px;height:52px;border-radius:14px;
  display:flex;align-items:center;justify-content:center;
  margin:0 auto 16px;
}
.modal-ico.red {background:var(--red-lt);color:var(--red);}
.modal-ico.blue{background:var(--blue-lt);color:var(--blue);}
.modal-title{font-size:17px;font-weight:700;text-align:center;color:var(--c1);margin-bottom:8px;}
.modal-desc{font-size:13px;color:var(--c2);text-align:center;line-height:1.6;margin-bottom:24px;}
.modal-desc strong{color:var(--c1);}
.modal-acts{display:flex;gap:8px;}
.modal-acts .btn{flex:1;justify-content:center;padding:10px;font-size:13px;}

.modal-tabs{display:flex;background:var(--surface2);border-radius:var(--r-sm);padding:3px;margin-bottom:16px;}
.mtab{
  flex:1;padding:8px;border:none;border-radius:7px;
  font-size:12px;font-weight:600;font-family:var(--font);
  cursor:pointer;background:transparent;color:var(--c3);
  display:flex;align-items:center;justify-content:center;gap:6px;
  transition:all .14s;
}
.mtab.active{background:#fff;color:var(--c1);box-shadow:0 1px 4px rgba(0,0,0,.1);}

.form-field{margin-bottom:14px;}
.form-lbl{display:block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--c2);margin-bottom:5px;}
.form-in{
  width:100%;padding:10px 12px;
  border:1.5px solid var(--border);border-radius:var(--r-sm);
  font-size:13px;font-family:var(--font);color:var(--c1);
  background:var(--surface2);outline:none;
  transition:border-color .12s,box-shadow .12s;
}
.form-in:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(26,86,219,.1);background:#fff;}
.form-in::placeholder{color:var(--c4);}

.notice{
  border-radius:var(--r-sm);padding:10px 12px;
  display:flex;align-items:flex-start;gap:8px;
  font-size:12px;line-height:1.5;margin-bottom:14px;
}
.notice svg{flex-shrink:0;margin-top:1px;}
.notice.info   {background:var(--blue-lt);border:1px solid var(--blue-md);color:var(--blue);}
.notice.success{background:var(--green-lt);border:1px solid var(--green-md);color:#065F46;}
.notice.danger {background:var(--red-lt);border:1px solid var(--red-md);color:var(--red);}

.dropzone{
  border:2px dashed var(--border2);border-radius:var(--r);
  padding:24px;text-align:center;cursor:pointer;
  transition:border-color .14s,background .14s;
  margin-bottom:12px;background:var(--surface2);
}
.dropzone:hover,.dropzone.dz-over{border-color:var(--blue);background:var(--blue-lt);}
.dz-ico{color:var(--c4);margin:0 auto 8px;display:block;}
.dz-t{font-size:13px;font-weight:600;color:var(--c2);}
.dz-s{font-size:11px;color:var(--c4);margin-top:3px;}

.preview{margin-bottom:12px;}
.preview-meta{font-size:12px;color:var(--c2);margin-bottom:6px;}
.preview-meta strong{color:var(--c1);}
.preview-scroll{max-height:160px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--r-sm);}
.preview-table{width:100%;border-collapse:collapse;font-size:11px;}
.preview-table th{background:var(--surface2);padding:6px 10px;text-align:left;font-weight:700;color:var(--c3);border-bottom:1px solid var(--border);font-size:10px;text-transform:uppercase;}
.preview-table td{padding:5px 10px;color:var(--c1);border-bottom:1px solid #F1F5F9;}
.prev-more{text-align:center;color:var(--c4);font-style:italic;}

/* ── TOAST ── */
.toast{
  position:fixed;bottom:20px;right:20px;z-index:999;
  padding:12px 18px;border-radius:var(--r);
  display:flex;align-items:center;gap:8px;
  font-size:13px;font-weight:600;
  box-shadow:var(--sh-lg);animation:tIn .25s ease;max-width:360px;
}
.t-success{background:#0D1117;color:#fff;}
.t-error  {background:var(--red);color:#fff;}
@keyframes tIn{from{opacity:0;transform:translateY(10px)}}

/* ── LOADING ── */
.load-screen{
  height:100vh;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:12px;
  background:var(--bg);
}
.load-ring{
  width:38px;height:38px;
  border:3px solid var(--border);border-top-color:var(--blue);
  border-radius:50%;animation:spin .7s linear infinite;
}
@keyframes spin{to{transform:rotate(360deg)}}
.load-label{font-size:11px;font-weight:700;color:var(--c4);text-transform:uppercase;letter-spacing:.1em;}
.load-track{width:180px;height:3px;background:var(--border);border-radius:10px;overflow:hidden;}
.load-fill{height:100%;background:var(--blue);border-radius:10px;transition:width .3s ease;}

.spin{animation:spin .65s linear infinite;}
`;