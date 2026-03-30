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
  Sparkles, ShieldCheck, Zap,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../services/supabaseClient';

// ─── CONSTANTS ──────────────────────────────────────────────────────────────
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

// ── Colunas que a planilha possui e que devem ser importadas ──
// Mapeamento: header Excel → coluna do banco
const MAPA_COLUNAS_EXCEL = {
  'Nº':                              'Nº',
  'ANO':                             'ANO',
  'INSTRUMENTO':                     'INSTRUMENTO',
  'NOME PARLAMENTAR':                'NOME PARLAMENTAR',
  'PROCESSO':                        'PROCESSO',
  'PROPOSTA':                        'PROPOSTA',
  'ENTIDADE':                        'ENTIDADE',
  'UF':                              'UF',
  'Nº INSTRUMENTO':                  'Nº INSTRUMENTO',
  'VALOR REPASSE':                   'VALOR REPASSE',
  'DATA DA PUBLICAÇÃO DOU':          'DATA DA PUBLICAÇÃO DOU',
  'CELEBRADO COM CLAUSULA SUSPENSIVA': 'CELEBRADO COM CLAUSULA SUSPENSIVA',
  'PAD - CRONO':                     'PAD - CRONO',
  'PUBLICAÇÃO TRANSFEREGOV':         'PUBLICAÇÃO TRANSFEREGOV',
  'PARECER TRANSFEREGOV':            'PARECER TRANSFEREGOV',
  'AJUSTE':                          'AJUSTE',
  'TÉRMINO DA VIGÊNCIA':             'TÉRMINO DA VIGÊNCIA',
  'TERMO DE REFERÊNCIA':             'TERMO DE REFERÊNCIA',
  'DATA LIMITE PARA SANEAMENTO':     'DATA LIMITE PARA SANEAMENTO',
  'CANCELAR EMPENHO':                'CANCELAR EMPENHO',
  'REJEITAR NO TRANSFEREGOV':        'REJEITAR NO TRANSFEREGOV',
  'SOB LIMINAR':                     'SOB LIMINAR',
  'DATA DO ADITIVO':                 'DATA DO ADITIVO',
  'NECESSIDADE DE ADITIVO':          'NECESSIDADE DE ADITIVO',
  'INSTRUÇÃO PROCESSUAL':            'INSTRUÇÃO PROCESSUAL',
  'TRAMITADO PARA CGAP':             'TRAMITADO PARA CGAP',
  'EQUIPE':                          'EQUIPE',
  'TÉCNICO DE FORMALIZAÇÃO':         'TÉCNICO DE FORMALIZAÇÃO',
  'PUBLICAÇÃO NO TRANSFEREGOV':      'PUBLICAÇÃO NO TRANSFEREGOV',
  'DATA DA PUBLICAÇÃO':              'DATA DA PUBLICAÇÃO',
  'SITUACIONAL':                     'SITUACIONAL',
};

// Colunas protegidas - nunca sobrescrever no banco
const COLUNAS_PROTEGIDAS = new Set([
  'id', 'created_at', 'updated_at', 'CUSTO', 'vazia_1', 'vazia_2', 'ultima_coluna_editada',
]);

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = iso => {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return null; }
};

const isCellEmpty = v => v === null || v === undefined || String(v).trim() === '' || String(v).trim() === '—';

/**
 * Limpa um valor lido do Excel:
 * - Remove espaços extras
 * - Converte datas serializadas do Excel para ISO
 * - Descarta fórmulas (strings que começam com "=")
 * - Normaliza null/NaN/undefined → null
 */
const limparValorExcel = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(/\r?\n|\t/g, ' ');
  if (s === '' || ['nan', 'nat', 'none', 'null'].includes(s.toLowerCase())) return null;
  // Descartar fórmulas Excel que não foram resolvidas
  if (s.startsWith('=')) return null;
  // Tentar parsear data dd/mm/yyyy
  const dateMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dateMatch) {
    const [, d, m, y] = dateMatch;
    return `${y}-${m}-${d}`;
  }
  return s;
};

/**
 * Normaliza valores de colunas com SELECT para uppercase,
 * tentando mapear variações comuns.
 */
const normalizarSelect = (colKey, valor) => {
  if (!valor) return valor;
  const v = String(valor).trim().toUpperCase();
  // Mapeamentos de variação → padrão
  const MAP = {
    'PENDENTE':        'PENDENTE',
    'REALIZADO':       'REALIZADO',
    'NÃO SE APLICA':   'NÃO SE APLICA',
    'NAO SE APLICA':   'NÃO SE APLICA',
    'SIM':             'SIM',
    'NÃO':             'NÃO',
    'NAO':             'NÃO',
    'CONVÊNIO':        'CONVÊNIO',
    'CONVENIO':        'CONVÊNIO',
    'TERMO DE FOMENTO':'TERMO DE FOMENTO',
    'TED':             'TERMO DE EXECUÇÃO DESCENTRALIZADA',
    'EQUIPE 6':        'EQUIPE 6',
    'EQUIPE 7':        'EQUIPE 7',
  };
  if (SELECT_OPTIONS[colKey]) {
    // Tenta match exato (case insensitive)
    const match = SELECT_OPTIONS[colKey].find(opt => opt.toUpperCase() === v);
    if (match) return match;
    // Tenta match via MAP
    if (MAP[v] && SELECT_OPTIONS[colKey].includes(MAP[v])) return MAP[v];
  }
  return valor; // retorna original se não conseguir normalizar
};

// ─── BADGE ──────────────────────────────────────────────────────────────────
function Badge({ value }) {
  if (!value || value === '—') return <span className="empty-dash">—</span>;
  const v = String(value).toUpperCase().trim();
  let cls = 'neutral';
  if (['SIM', 'REALIZADO', 'FORMALIZAR'].includes(v))        cls = 'success';
  else if (['NÃO', 'REJEITAR'].includes(v))                   cls = 'danger';
  else if (['PENDENTE', 'SOLICITADO', 'CONJUR'].includes(v))  cls = 'warning';
  else if (v === 'NÃO SE APLICA')                             cls = 'muted';
  else if (['PORTARIA 64/2025'].includes(v))                  cls = 'info';
  return <span className={`badge b-${cls}`}>{value}</span>;
}

// ─── SELECT CELL ─────────────────────────────────────────────────────────────
function SelectCell({ value, colKey, rowId, editedCells, setEditedCells }) {
  const cellId = `${rowId}::${colKey}`;
  const cur = editedCells[cellId] !== undefined ? editedCells[cellId] : (value ?? '');
  const isDirty = editedCells[cellId] !== undefined;
  const isEmpty = isCellEmpty(cur);
  const options = SELECT_OPTIONS[colKey] || [];

  const getColor = (val) => {
    const v = String(val).toUpperCase();
    if (['SIM', 'REALIZADO', 'FORMALIZAR'].includes(v)) return 'sel-green';
    if (['NÃO', 'REJEITAR'].includes(v)) return 'sel-red';
    if (['PENDENTE', 'SOLICITADO', 'CONJUR'].includes(v)) return 'sel-amber';
    if (v === 'NÃO SE APLICA') return 'sel-gray';
    return '';
  };

  return (
    <div className={`sel-container ${isDirty ? 'sel-dirty' : ''}`}>
      <select
        className={`cell-select ${getColor(cur)} ${isEmpty ? 'sel-empty' : ''}`}
        value={cur}
        onChange={e => setEditedCells(p => ({ ...p, [cellId]: e.target.value }))}
      >
        <option value="">— Selecione —</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      {isDirty && <span className="dirty-dot" title="Não salvo" />}
    </div>
  );
}

// ─── EDITABLE TEXT CELL ──────────────────────────────────────────────────────
function EditableCell({ value, colKey, rowId, editedCells, setEditedCells }) {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState('');
  const inputRef = useRef(null);
  const cellId = `${rowId}::${colKey}`;
  const cur = editedCells[cellId] !== undefined ? editedCells[cellId] : (value ?? '');
  const isDirty = editedCells[cellId] !== undefined;
  const isEmpty = isCellEmpty(cur);

  if (SELECT_OPTIONS[colKey]) {
    return <SelectCell value={value} colKey={colKey} rowId={rowId} editedCells={editedCells} setEditedCells={setEditedCells} />;
  }

  const startEdit = () => { setLocalVal(cur); setEditing(true); setTimeout(() => inputRef.current?.focus(), 30); };
  const commit = () => { setEditedCells(p => ({ ...p, [cellId]: localVal })); setEditing(false); };
  const discard = () => setEditing(false);

  if (editing) {
    return (
      <div className="edit-active">
        <input
          ref={inputRef}
          className="edit-input"
          value={localVal}
          onChange={e => setLocalVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') discard(); }}
          onBlur={commit}
        />
        <div className="edit-actions">
          <button className="ea-btn ea-ok" onMouseDown={e => { e.preventDefault(); commit(); }}><Check size={11} /></button>
          <button className="ea-btn ea-no" onMouseDown={e => { e.preventDefault(); discard(); }}><XCircle size={11} /></button>
        </div>
      </div>
    );
  }

  return (
    <div className={`txt-cell ${isDirty ? 'tc-dirty' : ''} ${isEmpty ? 'tc-empty' : ''}`} onClick={startEdit}>
      {isEmpty
        ? <span className="tc-placeholder">Clique para preencher</span>
        : <span className="tc-value">{cur}</span>
      }
      <Edit3 size={10} className="tc-pencil" />
      {isDirty && <span className="dirty-dot" />}
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function TabelaGerencialMaster() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState(null);
  const [editedCells, setEditedCells] = useState({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [confirmModal, setConfirmModal] = useState(null);
  const [newModal, setNewModal] = useState(false);
  const [newTab, setNewTab] = useState('manual');
  const [newProposta, setNewProposta] = useState('');
  const [excelFile, setExcelFile] = useState(null);
  const [excelError, setExcelError] = useState('');
  const [excelDuplicates, setExcelDuplicates] = useState([]);
  const [excelSyncing, setExcelSyncing] = useState(false);
  const [excelSyncLog, setExcelSyncLog] = useState([]);
  const [dragover, setDragover] = useState(false);
  const [colVisibility, setColVisibility] = useState({});
  const [activeTab, setActiveTab] = useState('filters');
  const fileRef = useRef(null);
  const syncLogRef = useRef(null);

  const [filters, setFilters] = useState({
    proposta: '', instrumento: 'Todos', ajuste: 'Todos',
    empenho: 'Todos', tecnico: 'Todos', uf: 'Todos',
    processo: '', entidade: '', ano: 'Todos',
    emptyCols: [], filledCols: [],
  });

  // ── Fetch ──
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

  useEffect(() => {
    if (syncLogRef.current) syncLogRef.current.scrollTop = syncLogRef.current.scrollHeight;
  }, [excelSyncLog]);

  const notify = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const addLog = (msg) => setExcelSyncLog(p => [...p, { ts: new Date().toLocaleTimeString('pt-BR'), msg }]);

  // ── All editable cols ──
  const allEditableCols = useMemo(() => {
    if (!data.length) return [];
    return Object.keys(data[0]).filter(k => !HIDDEN_COLS.includes(k));
  }, [data]);

  // ── Filtered ──
  const filteredData = useMemo(() => data.filter(row => {
    const f = filters;
    if (f.proposta && !String(row['PROPOSTA'] || '').toLowerCase().includes(f.proposta.toLowerCase())) return false;
    if (f.instrumento !== 'Todos') {
      const inst = String(row['INSTRUMENTO'] || '').toUpperCase();
      const filtInst = f.instrumento.toUpperCase();
      if (!inst.includes(filtInst) && inst !== filtInst) return false;
    }
    if (f.ajuste !== 'Todos') {
      const aj = String(row['AJUSTE'] || '').toUpperCase();
      if (aj !== f.ajuste.toUpperCase()) return false;
    }
    if (f.empenho !== 'Todos') {
      const e = String(row['CANCELAR EMPENHO'] || '').toUpperCase();
      if (f.empenho === 'SIM' && e !== 'SIM') return false;
      if (f.empenho === 'NÃO' && e !== 'NÃO') return false;
    }
    if (f.tecnico !== 'Todos' && String(row['TÉCNICO DE FORMALIZAÇÃO'] || '').toUpperCase() !== f.tecnico.toUpperCase()) return false;
    if (f.uf !== 'Todos' && row['UF'] !== f.uf) return false;
    if (f.processo && !String(row['PROCESSO'] || '').toLowerCase().includes(f.processo.toLowerCase())) return false;
    if (f.entidade && !String(row['ENTIDADE'] || '').toLowerCase().includes(f.entidade.toLowerCase())) return false;
    if (f.ano !== 'Todos') {
      const prop = String(row['PROPOSTA'] || '');
      const match = prop.match(/\/(\d{4})$/);
      if (!match || match[1] !== f.ano) return false;
    }
    for (const col of f.emptyCols) { if (!isCellEmpty(row[col])) return false; }
    for (const col of f.filledCols) { if (isCellEmpty(row[col])) return false; }
    if (globalFilter) {
      const gf = globalFilter.toLowerCase();
      return Object.values(row).some(v => String(v || '').toLowerCase().includes(gf));
    }
    return true;
  }), [data, filters, globalFilter]);

  // ── Stats ──
  const stats = useMemo(() => {
    const total = data.length;
    const pendentes = data.filter(d => String(d['AJUSTE'] || '').toUpperCase() === 'PENDENTE').length;
    const realizados = data.filter(d => String(d['AJUSTE'] || '').toUpperCase() === 'REALIZADO').length;
    const valorTotal = data.reduce((s, r) => s + (parseFloat(r['VALOR REPASSE']) || 0), 0);
    const emptyStats = {};
    for (const col of allEditableCols) {
      emptyStats[col] = data.filter(r => isCellEmpty(r[col])).length;
    }
    const byYear = data.reduce((acc, r) => {
      const prop = String(r['PROPOSTA'] || '');
      const match = prop.match(/\/(\d{4})$/);
      const year = match ? match[1] : 'Outro';
      acc[year] = (acc[year] || 0) + 1;
      return acc;
    }, {});
    return { total, pendentes, realizados, valorTotal, emptyStats, byYear };
  }, [data, allEditableCols]);

  // ── Columns ──
  const columns = useMemo(() => {
    const allKeys = data.length > 0 ? Object.keys(data[0]) : [];
    const fixed = ['PROPOSTA', 'INSTRUMENTO', 'VALOR REPASSE'];
    const dyn = allKeys.filter(k => !HIDDEN_COLS.includes(k) && !fixed.includes(k) && k !== 'Nº' && k !== 'ANO');

    return [
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
      {
        accessorKey: 'PROPOSTA', header: 'PROPOSTA', size: 155,
        cell: ({ getValue, row }) => (
          <EditableCell value={getValue()} colKey="PROPOSTA" rowId={row.original.id}
            editedCells={editedCells} setEditedCells={setEditedCells} />
        ),
      },
      {
        accessorKey: 'INSTRUMENTO', header: 'INSTRUMENTO', size: 230,
        cell: ({ getValue, row }) => {
          const v = String(getValue() || '').toUpperCase();
          const cls = v === 'CONVÊNIO' ? 'conv' : v.includes('FOMENTO') ? 'fom' : v.includes('DESC') || v === 'TED' ? 'ted' : '';
          if (v) return <span className={`inst-tag it-${cls}`}>{getValue()}</span>;
          return <EditableCell value={getValue()} colKey="INSTRUMENTO" rowId={row.original.id}
            editedCells={editedCells} setEditedCells={setEditedCells} />;
        },
      },
      {
        accessorKey: 'VALOR REPASSE', header: 'VALOR REPASSE', size: 155,
        cell: ({ getValue, row }) => (
          <EditableCell value={getValue()} colKey="VALOR REPASSE" rowId={row.original.id}
            editedCells={editedCells} setEditedCells={setEditedCells} />
        ),
      },
      {
        id: 'audit', size: 195,
        header: () => <span className="hdr-aud"><Clock size={10} /> ÚLTIMA EDIÇÃO</span>,
        cell: ({ row }) => {
          const upd = row.original.updated_at;
          const col = row.original.ultima_coluna_editada;
          if (!upd) return <span className="empty-dash">—</span>;
          return (
            <div className="audit-cell">
              <span className="aud-ts">{fmtDate(upd)}</span>
              {col && <span className="aud-col">{col}</span>}
            </div>
          );
        },
      },
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
              if (isRobo) return <span className="cell-robo" title={val || ''}>{val || <span className="empty-dash">—</span>}</span>;
              return (
                <EditableCell value={val} colKey={key} rowId={row.original.id}
                  editedCells={editedCells} setEditedCells={setEditedCells} />
              );
            },
          };
        }),
      {
        id: 'del', size: 50, header: '',
        cell: ({ row }) => (
          <button className="del-btn" title="Excluir registro"
            onClick={() => setConfirmModal({
              type: 'delete-single', payload: row.original,
              title: 'Excluir Registro',
              message: <>Excluir permanentemente a proposta <strong>{row.original.PROPOSTA}</strong>?</>,
              confirmLabel: 'Excluir', confirmClass: 'btn-danger',
            })}>
            <Trash2 size={13} />
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
    initialState: { pagination: { pageSize: 25 } },
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  const totalFiltered = filteredData.length;
  const pageCount = table.getPageCount();
  const dirtyCount = Object.keys(editedCells).length;

  // ── Save ──
  const handleSave = () => {
    if (!dirtyCount) return;
    setConfirmModal({
      type: 'save', title: 'Salvar Alterações',
      message: <>Salvar <strong>{dirtyCount} alteração(ões)</strong> pendentes no banco de dados?</>,
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
      notify('success', `${Object.keys(upd).length} registro(s) salvo(s) com sucesso.`);
      fetchAllData();
    } catch { notify('error', 'Erro ao salvar. Tente novamente.'); }
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
    XLSX.writeFile(wb, `Formalizacoes_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleNewManual = async () => {
    const p = newProposta.trim();
    if (!p) return;
    const { error } = await supabase.from('formalizacoes').insert([{ PROPOSTA: p }]);
    if (error) { notify('error', 'Erro ao criar proposta.'); return; }
    notify('success', `Proposta ${p} criada com sucesso!`);
    setNewModal(false); setNewProposta(''); fetchAllData();
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // ── IMPORTAÇÃO EXCEL CORRIGIDA ────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────────
  const processExcelFile = (file) => {
    setExcelError(''); setExcelFile(null); setExcelDuplicates([]); setExcelSyncLog([]);
    const reader = new FileReader();
  
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
  
        // 1. Localiza a aba correta
        let wsName = wb.SheetNames.find(n => 
          n.toLowerCase().includes('controle') || n.toLowerCase().includes('formaliz')
        ) || wb.SheetNames[0];
  
        const ws = wb.Sheets[wsName];
        const rawRows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });
  
        if (!rawRows.length) { 
          setExcelError('Planilha vazia ou sem dados.'); 
          return; 
        }
  
        // 2. Busca TODOS os registros do banco (Paginado para ignorar o limite de 1000)
        addLog("🔍 Verificando registros existentes no banco de dados...");
        let allExisting = [];
        let from = 0;
        const step = 1000;
        
        while (true) {
          const { data: chunk, error } = await supabase
            .from('formalizacoes')
            .select('PROPOSTA')
            .range(from, from + step - 1);
          
          if (error) throw error;
          if (!chunk || chunk.length === 0) break;
          
          allExisting = [...allExisting, ...chunk];
          if (chunk.length < step) break;
          from += step;
        }
  
        // Criar um Set para busca rápida (Limpando espaços e convertendo para Maiúsculo)
        const existingPropostasSet = new Set(
          allExisting
            .map(r => String(r.PROPOSTA || '').trim().toUpperCase())
            .filter(val => val !== '')
        );
  
        // 3. Processamento e Normalização
        const toInsert = [];
        const toUpdate = [];
        const duplicatesFound = [];
        const propostasNaPlanilhaAtual = new Set(); // Para evitar duplicados dentro da própria planilha
  
        rawRows.forEach((row) => {
          // Pega a proposta independente de espaços no nome da coluna/header
          const headerProposta = Object.keys(row).find(k => k.trim().toUpperCase() === 'PROPOSTA');
          const propRaw = headerProposta ? row[headerProposta] : null;
          const propClean = String(limparValorExcel(propRaw) || '').trim();
  
          // Pula se a proposta estiver vazia
          if (!propClean || propClean === '') return;
  
          // Pula se já processamos essa mesma proposta nesta importação (evita duplicar se a planilha estiver suja)
          if (propostasNaPlanilhaAtual.has(propClean.toUpperCase())) return;
          propostasNaPlanilhaAtual.add(propClean.toUpperCase());
  
          // Monta o objeto de dados (Payload)
          const payload = {};
          for (const [headerExcel, colBanco] of Object.entries(MAPA_COLUNAS_EXCEL)) {
            const keyInRow = Object.keys(row).find(k => k.trim() === headerExcel);
            if (!keyInRow) continue;
  
            let val = limparValorExcel(row[keyInRow]);
            if (val === null) continue;
  
            payload[colBanco] = normalizarSelect(colBanco, val);
          }
  
          // Garante que a proposta salva está limpa e remove colunas protegidas
          payload['PROPOSTA'] = propClean;
          COLUNAS_PROTEGIDAS.forEach(cp => delete payload[cp]);
  
          // 4. Decide se é Novo ou Atualização
          if (existingPropostasSet.has(propClean.toUpperCase())) {
            duplicatesFound.push(propClean);
            toUpdate.push({ propKey: propClean, payload });
          } else {
            toInsert.push(payload);
          }
        });
  
        if (toInsert.length === 0 && toUpdate.length === 0) {
          setExcelError('Nenhuma proposta válida encontrada para importar.');
          return;
        }
  
        setExcelFile({
          name: file.name,
          wsName,
          toInsert,
          toUpdate,
          total: toInsert.length + toUpdate.length,
        });
        setExcelDuplicates(duplicatesFound.map(p => ({ proc: p })));
  
      } catch (err) {
        console.error(err);
        setExcelError('Erro ao processar arquivo: ' + err.message);
      }
    };
  
    reader.readAsArrayBuffer(file);
  };

  const handleExcelSync = async (updateDuplicates = false) => {
    if (!excelFile) return;
    setExcelSyncing(true);
    setExcelSyncLog([]);
    const now = new Date().toISOString();

    try {
      let inserted = 0, updated = 0, skipped = 0;
      const BATCH = 30;

      // INSERT novos
      if (excelFile.toInsert.length > 0) {
        addLog(`📥 Inserindo ${excelFile.toInsert.length} novo(s) registro(s)...`);
        for (let i = 0; i < excelFile.toInsert.length; i += BATCH) {
          const batch = excelFile.toInsert.slice(i, i + BATCH).map(p => ({
            ...p, created_at: now, updated_at: now,
          }));
          const { error } = await supabase.from('formalizacoes').insert(batch);
          if (error) {
            addLog(`   ⚠️ Erro no lote ${Math.ceil(i / BATCH) + 1}: ${error.message}`);
          } else {
            inserted += batch.length;
            addLog(`   ✅ ${inserted}/${excelFile.toInsert.length} inseridos`);
          }
          await new Promise(r => setTimeout(r, 80));
        }
      } else {
        addLog(`ℹ️ Nenhum registro novo para inserir.`);
      }

      // UPDATE duplicatas (se usuário escolheu)
      if (updateDuplicates && excelFile.toUpdate.length > 0) {
        addLog(`\n🔄 Atualizando ${excelFile.toUpdate.length} registro(s) existente(s)...`);
        for (const { proc, procKey, payload } of excelFile.toUpdate) {
          const updatePayload = { ...payload, updated_at: now };
          const { error } = await supabase.from('formalizacoes')
            .update(updatePayload).eq('PROCESSO', procKey);
          if (error) {
            addLog(`   ⚠️ Erro em ${proc}: ${error.message}`);
          } else {
            updated++;
          }
          await new Promise(r => setTimeout(r, 50));
        }
        addLog(`   ✅ ${updated} registro(s) atualizado(s).`);
      } else if (!updateDuplicates && excelFile.toUpdate.length > 0) {
        skipped = excelFile.toUpdate.length;
        addLog(`⏭️ ${skipped} duplicata(s) ignorada(s) (dados do banco preservados).`);
      }

      addLog(`\n🎉 SINCRONIZAÇÃO CONCLUÍDA!`);
      addLog(`   📥 Inseridos: ${inserted} | 📝 Atualizados: ${updated} | ⏭️ Ignorados: ${skipped}`);

      setTimeout(() => {
        notify('success', `Importação concluída: ${inserted} inseridos, ${updated} atualizados.`);
        setNewModal(false);
        setExcelFile(null);
        setExcelDuplicates([]);
        setExcelSyncLog([]);
        setExcelSyncing(false);
        fetchAllData();
      }, 1500);

    } catch (err) {
      addLog(`❌ ERRO CRÍTICO: ${err.message}`);
      notify('error', 'Erro durante a importação.');
      setExcelSyncing(false);
    }
  };
  // ─────────────────────────────────────────────────────────────────────────────

  const clearFilters = () => {
    setFilters({ proposta: '', instrumento: 'Todos', ajuste: 'Todos', empenho: 'Todos', tecnico: 'Todos', uf: 'Todos', processo: '', entidade: '', ano: 'Todos', emptyCols: [], filledCols: [] });
    setGlobalFilter('');
  };

  const hasFilters = filters.proposta || filters.instrumento !== 'Todos' || filters.ajuste !== 'Todos' ||
    filters.empenho !== 'Todos' || filters.tecnico !== 'Todos' || filters.uf !== 'Todos' ||
    filters.processo || filters.entidade || filters.ano !== 'Todos' ||
    filters.emptyCols.length || filters.filledCols.length || globalFilter;

  const toggleEmptyCol = col => setFilters(p => ({
    ...p,
    emptyCols: p.emptyCols.includes(col) ? p.emptyCols.filter(c => c !== col) : [...p.emptyCols, col],
    filledCols: p.filledCols.filter(c => c !== col),
  }));

  const toggleFilledCol = col => setFilters(p => ({
    ...p,
    filledCols: p.filledCols.includes(col) ? p.filledCols.filter(c => c !== col) : [...p.filledCols, col],
    emptyCols: p.emptyCols.filter(c => c !== col),
  }));

  // ── Loading ──
  if (loading && !data.length) return (
    <>
      <style>{CSS}</style>
      <div className="load-screen">
        <div className="load-brand">
          <div className="load-logo"><span>F</span></div>
          <div className="load-title">Formalizações MESP</div>
        </div>
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
        <aside className={`sidebar ${sidebarOpen ? '' : 'sb-closed'}`}>
          <div className="sb-head">
            <div className="sb-brand">
              <div className="sb-logo"><span>F</span></div>
              {sidebarOpen && (
                <div>
                  <div className="sb-name">Formalizações</div>
                  <div className="sb-sub">MESP · Controle</div>
                </div>
              )}
            </div>
            <button className="sb-toggle" onClick={() => setSidebarOpen(p => !p)}>
              {sidebarOpen ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
            </button>
          </div>

          {sidebarOpen && (
            <>
              <div className="sb-kpis">
                <div className="kpi-mini">
                  <span className="km-val">{stats.total.toLocaleString('pt-BR')}</span>
                  <span className="km-lbl">Total</span>
                </div>
                <div className="kpi-mini warn">
                  <span className="km-val">{stats.pendentes}</span>
                  <span className="km-lbl">Pendentes</span>
                </div>
                <div className="kpi-mini ok">
                  <span className="km-val">{stats.realizados}</span>
                  <span className="km-lbl">Realizados</span>
                </div>
              </div>

              <div className="sb-tabs">
                {[
                  { id: 'filters', icon: <Filter size={11} />, label: 'Filtros' },
                  { id: 'empty',   icon: <AlertOctagon size={11} />, label: 'Vazios' },
                  { id: 'columns', icon: <Columns size={11} />, label: 'Colunas' },
                ].map(t => (
                  <button key={t.id} className={`sb-tab ${activeTab === t.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(t.id)}>
                    {t.icon}{t.label}
                  </button>
                ))}
              </div>

              <div className="sb-body">

                {/* FILTERS TAB */}
                {activeTab === 'filters' && (
                  <div className="filter-group">
                    {[
                      { label: 'Nº Proposta', key: 'proposta', ph: 'Ex: 024721/2025' },
                      { label: 'Processo',    key: 'processo', ph: 'Nº do processo' },
                      { label: 'Entidade',    key: 'entidade', ph: 'Nome da entidade' },
                    ].map(({ label, key, ph }) => (
                      <div className="ff" key={key}>
                        <label className="fl">{label}</label>
                        <div className="fi-wrap">
                          <input className="fi" placeholder={ph} value={filters[key]}
                            onChange={e => setFilters(p => ({ ...p, [key]: e.target.value }))} />
                          {filters[key] && <button className="fi-clear" onClick={() => setFilters(p => ({ ...p, [key]: '' }))}><X size={9} /></button>}
                        </div>
                      </div>
                    ))}

                    <div className="ff">
                      <label className="fl"><Calendar size={9} /> Ano</label>
                      <div className="year-pills">
                        {ANOS.map(a => (
                          <button key={a}
                            className={`year-pill ${filters.ano === a ? 'active' : ''}`}
                            onClick={() => setFilters(p => ({ ...p, ano: a }))}>
                            {a}
                          </button>
                        ))}
                      </div>
                    </div>

                    {Object.keys(stats.byYear).length > 0 && (
                      <div className="year-bdown">
                        {Object.entries(stats.byYear).sort((a, b) => b[0].localeCompare(a[0])).map(([yr, cnt]) => (
                          <div key={yr} className="yb-row">
                            <span className="yb-label">{yr}</span>
                            <div className="yb-track"><div className="yb-bar" style={{ width: `${(cnt / stats.total) * 100}%` }} /></div>
                            <span className="yb-cnt">{cnt}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {[
                      { label: 'Instrumento', key: 'instrumento', opts: ['Todos', 'CONVÊNIO', 'TERMO DE FOMENTO', 'TERMO DE EXECUÇÃO DESCENTRALIZADA'] },
                      { label: 'Ajuste',      key: 'ajuste',      opts: ['Todos', 'PENDENTE', 'REALIZADO', 'NÃO SE APLICA'] },
                      { label: 'Empenho',     key: 'empenho',     opts: ['Todos', 'SIM', 'NÃO'] },
                      { label: 'Técnico',     key: 'tecnico',     opts: ['Todos', ...SELECT_OPTIONS['TÉCNICO DE FORMALIZAÇÃO']] },
                      { label: 'UF',          key: 'uf',          opts: ['Todos', 'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'] },
                    ].map(({ label, key, opts }) => (
                      <div className="ff" key={key}>
                        <label className="fl">{label}</label>
                        <select className="fs" value={filters[key]}
                          onChange={e => setFilters(p => ({ ...p, [key]: e.target.value }))}>
                          {opts.map(o => <option key={o}>{o}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                )}

                {/* EMPTY TAB */}
                {activeTab === 'empty' && (
                  <div className="empty-tab">
                    <p className="tab-hint">Filtre registros com campos <strong>vazios</strong> ou <strong>preenchidos</strong>.</p>
                    {allEditableCols.map(col => {
                      const emptyCount = stats.emptyStats[col] || 0;
                      const pct = stats.total > 0 ? Math.round((emptyCount / stats.total) * 100) : 0;
                      const isEmptyFlt = filters.emptyCols.includes(col);
                      const isFilledFlt = filters.filledCols.includes(col);
                      return (
                        <div key={col} className={`ec-row ${isEmptyFlt ? 'ec-amber' : ''} ${isFilledFlt ? 'ec-green' : ''}`}>
                          <div className="ec-info">
                            <span className="ec-name" title={col}>{col}</span>
                            <div className="ec-bar"><div className="ec-fill" style={{ width: `${100 - pct}%` }} /></div>
                            <span className="ec-stat">
                              {emptyCount > 0
                                ? <span style={{ color: 'var(--amber)' }}>{emptyCount} vazio(s) · {pct}%</span>
                                : <span style={{ color: 'var(--green)' }}>100% preenchido ✓</span>
                              }
                            </span>
                          </div>
                          <div className="ec-btns">
                            <button className={`ec-btn ${isEmptyFlt ? 'ecb-amber' : ''}`} onClick={() => toggleEmptyCol(col)} title="Mostrar apenas vazios">∅</button>
                            <button className={`ec-btn ${isFilledFlt ? 'ecb-green' : ''}`} onClick={() => toggleFilledCol(col)} title="Mostrar apenas preenchidos">✓</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* COLUMNS TAB */}
                {activeTab === 'columns' && (
                  <div className="col-tab">
                    <p className="tab-hint">Mostrar ou ocultar colunas na tabela.</p>
                    <div className="col-actions">
                      <button className="col-act-btn" onClick={() => {
                        const hidden = {};
                        allEditableCols.filter(k => !['PROPOSTA', 'INSTRUMENTO', 'VALOR REPASSE'].includes(k)).forEach(k => { hidden[k] = false; });
                        setColVisibility(hidden);
                      }}>Ocultar todas</button>
                      <button className="col-act-btn" onClick={() => setColVisibility({})}>Mostrar todas</button>
                    </div>
                    {allEditableCols.filter(k => !['PROPOSTA', 'INSTRUMENTO', 'VALOR REPASSE'].includes(k)).map(col => (
                      <div key={col} className="col-row">
                        <span className="col-name" title={col}>{col}</span>
                        <button
                          className={`col-toggle ${colVisibility[col] === false ? 'ct-hidden' : 'ct-visible'}`}
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
                  <button className="clear-filters-btn" onClick={clearFilters}>
                    <X size={10} />Limpar Filtros
                  </button>
                )}
                <div className="sb-count-label">
                  <span className="scl-filtered">{totalFiltered.toLocaleString('pt-BR')}</span>
                  <span className="scl-sep"> de </span>
                  <span className="scl-total">{stats.total.toLocaleString('pt-BR')}</span>
                  <span className="scl-word"> registros</span>
                </div>
              </div>
            </>
          )}
        </aside>

        {/* ─── MAIN ─── */}
        <main className="main">

          {/* KPI Bar */}
          <div className="kpi-row">
            {[
              { icon: <BarChart2 size={18} />, val: stats.total.toLocaleString('pt-BR'), lbl: 'Total de Propostas', cls: 'blue' },
              { icon: <AlertTriangle size={18} />, val: stats.pendentes, lbl: 'Ajustes Pendentes', sub: `${stats.total > 0 ? ((stats.pendentes / stats.total) * 100).toFixed(1) : 0}% do total`, cls: 'amber' },
              { icon: <CheckCircle2 size={18} />, val: stats.realizados, lbl: 'Ajustes Realizados', sub: `${stats.total > 0 ? ((stats.realizados / stats.total) * 100).toFixed(1) : 0}% do total`, cls: 'green' },
              { icon: <TrendingUp size={18} />, val: stats.valorTotal.toLocaleString('pt-BR', { notation: 'compact', style: 'currency', currency: 'BRL', maximumFractionDigits: 1 }), lbl: 'Valor Total em Repasse', cls: 'indigo' },
            ].map((k, i) => (
              <div key={i} className={`kpi-card kc-${k.cls}`}>
                <div className="kc-icon">{k.icon}</div>
                <div>
                  <div className="kc-val">{k.val}</div>
                  <div className="kc-lbl">{k.lbl}</div>
                  {k.sub && <div className="kc-sub">{k.sub}</div>}
                </div>
              </div>
            ))}
          </div>

          {/* Table Card */}
          <div className="tcard">

            {/* Toolbar */}
            <div className="toolbar">
              <div className="tl-left">
                <h2 className="tcard-title">Registro de Formalizações</h2>
                <span className="count-badge">{totalFiltered.toLocaleString('pt-BR')} registros</span>
                {hasFilters && <span className="filter-badge"><Filter size={9} />Filtros ativos</span>}
                {dirtyCount > 0 && <span className="dirty-badge"><Zap size={10} />{dirtyCount} não salva(s)</span>}
              </div>
              <div className="tl-right">
                <div className="search-wrap">
                  <Search size={13} className="search-ico" />
                  <input
                    className="search-in"
                    placeholder="Buscar em tudo..."
                    value={globalFilter}
                    onChange={e => setGlobalFilter(e.target.value)}
                  />
                  {globalFilter && <button className="search-clr" onClick={() => setGlobalFilter('')}><X size={10} /></button>}
                </div>

                <button className="icon-btn" onClick={fetchAllData} title="Atualizar dados"><RefreshCw size={13} /></button>
                <button className="icon-btn" onClick={exportToExcel} title="Exportar Excel"><Download size={13} /></button>

                {selectedRows.size > 0 && (
                  <button className="btn btn-del-sel" onClick={() => setConfirmModal({
                    type: 'delete-many',
                    title: `Excluir ${selectedRows.size} Registro(s)`,
                    message: <>Excluir permanentemente <strong>{selectedRows.size} registros</strong>? Essa ação é irreversível.</>,
                    confirmLabel: `Excluir ${selectedRows.size}`, confirmClass: 'btn-danger',
                  })}>
                    <Trash2 size={12} />Excluir ({selectedRows.size})
                  </button>
                )}

                {dirtyCount > 0 && (
                  <button className="btn btn-save" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 size={12} className="spin" /> : <Save size={12} />}
                    Salvar {dirtyCount}
                  </button>
                )}

                <button className="btn btn-primary" onClick={() => {
                  setNewModal(true); setNewTab('manual');
                  setNewProposta(''); setExcelFile(null); setExcelError('');
                  setExcelDuplicates([]); setExcelSyncLog([]);
                }}>
                  <Plus size={13} />Nova Proposta
                </button>
              </div>
            </div>

            {/* Active filter pills */}
            {(filters.emptyCols.length > 0 || filters.filledCols.length > 0 || filters.ano !== 'Todos') && (
              <div className="active-pills">
                {filters.ano !== 'Todos' && (
                  <span className="ap ap-blue">Ano: {filters.ano}<button onClick={() => setFilters(p => ({ ...p, ano: 'Todos' }))}><X size={8} /></button></span>
                )}
                {filters.emptyCols.map(col => (
                  <span key={col} className="ap ap-amber">∅ {col}<button onClick={() => toggleEmptyCol(col)}><X size={8} /></button></span>
                ))}
                {filters.filledCols.map(col => (
                  <span key={col} className="ap ap-green">✓ {col}<button onClick={() => toggleFilledCol(col)}><X size={8} /></button></span>
                ))}
              </div>
            )}

            {/* Table */}
            <div className="tscroll">
              <table>
                <thead>
                  <tr>
                    {table.getHeaderGroups()[0]?.headers.map(h => {
                      const key = h.column.columnDef.accessorKey;
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
                            <span className="sort-ico">
                              {h.column.getIsSorted() === 'asc' ? <ChevronUp size={9} /> :
                               h.column.getIsSorted() === 'desc' ? <ChevronDown size={9} /> :
                               <span className="sort-neutral">⇅</span>}
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
                      className={[selectedRows.has(row.original.id) ? 'row-sel' : '', i % 2 !== 0 ? 'row-stripe' : ''].filter(Boolean).join(' ')}>
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                      ))}
                    </tr>
                  ))}
                  {table.getRowModel().rows.length === 0 && (
                    <tr>
                      <td colSpan={columns.length} className="empty-state">
                        <div className="es-icon">🔎</div>
                        <div className="es-title">Nenhum registro encontrado</div>
                        <div className="es-sub">Tente ajustar os filtros ou a busca.</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="tfoot">
              <div className="page-info">
                Mostrando <strong>{Math.min(pageIndex * pageSize + 1, totalFiltered)}–{Math.min((pageIndex + 1) * pageSize, totalFiltered)}</strong> de <strong>{totalFiltered.toLocaleString('pt-BR')}</strong> registros
              </div>
              <div className="page-ctrl">
                <label className="pg-lbl">Linhas por página</label>
                <select className="pg-sel" value={pageSize}
                  onChange={e => table.setPageSize(Number(e.target.value))}>
                  {[15, 25, 50, 100].map(s => <option key={s}>{s}</option>)}
                </select>
                <button className="pg-btn" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                  <ChevronLeft size={13} /> Anterior
                </button>
                <span className="pg-pages">Pág. {pageIndex + 1} / {pageCount || 1}</span>
                <button className="pg-btn pg-btn-next" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                  Próxima <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* ─── CONFIRM MODAL ─── */}
      {confirmModal && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setConfirmModal(null)}>
          <div className="modal">
            <div className={`modal-icon ${confirmModal.confirmClass === 'btn-danger' ? 'mi-red' : 'mi-blue'}`}>
              {confirmModal.confirmClass === 'btn-danger' ? <AlertTriangle size={22} /> : <ShieldCheck size={22} />}
            </div>
            <h3 className="modal-title">{confirmModal.title}</h3>
            <p className="modal-desc">{confirmModal.message}</p>
            <div className="modal-acts">
              <button className="btn btn-ghost" onClick={() => setConfirmModal(null)}>Cancelar</button>
              <button className={`btn ${confirmModal.confirmClass}`} onClick={handleConfirm}>{confirmModal.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── NEW RECORD MODAL ─── */}
      {newModal && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && !excelSyncing && setNewModal(false)}>
          <div className="modal modal-lg">
            <h3 className="modal-title">Nova Proposta</h3>
            <p className="modal-desc">Cadastre manualmente ou importe a planilha <strong>Controle Geral de Formalização</strong>.</p>

            <div className="modal-tabs">
              {[
                { id: 'manual', icon: <Hash size={11} />, label: 'Manual' },
                { id: 'excel',  icon: <FileSpreadsheet size={11} />, label: 'Importar Excel' },
              ].map(t => (
                <button key={t.id} className={`mtab ${newTab === t.id ? 'active' : ''}`}
                  onClick={() => !excelSyncing && setNewTab(t.id)}>
                  {t.icon}{t.label}
                </button>
              ))}
            </div>

            {/* MANUAL */}
            {newTab === 'manual' && (
              <>
                <div className="notice ni-info">
                  <Sparkles size={14} />
                  <span>Informe o número da proposta <strong>(ex: 024721/2025)</strong>. Os demais campos podem ser preenchidos diretamente na tabela.</span>
                </div>
                <div className="form-group">
                  <label className="form-lbl">Número da Proposta *</label>
                  <input className="form-in" placeholder="024721/2025"
                    value={newProposta} autoFocus
                    onChange={e => setNewProposta(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleNewManual()} />
                </div>
                <div className="modal-acts">
                  <button className="btn btn-ghost" onClick={() => setNewModal(false)}>Cancelar</button>
                  <button className="btn btn-primary" disabled={!newProposta.trim()} onClick={handleNewManual}>
                    <Plus size={12} />Criar Proposta
                  </button>
                </div>
              </>
            )}

            {/* EXCEL IMPORT */}
            {newTab === 'excel' && (
              <>
                {!excelSyncing && !excelFile && (
                  <>
                    <div className="notice ni-info">
                      <Bot size={14} />
                      <div>
                        <strong>Importação inteligente:</strong> o sistema lê apenas as colunas mapeadas do arquivo
                        (<em>Controle Geral de Formalização</em>), ignora colunas extras e fórmulas Excel,
                        e detecta automaticamente duplicatas por PROCESSO.
                      </div>
                    </div>
                    <div
                      className={`dropzone ${dragover ? 'dz-over' : ''}`}
                      onClick={() => fileRef.current?.click()}
                      onDragOver={e => { e.preventDefault(); setDragover(true); }}
                      onDragLeave={() => setDragover(false)}
                      onDrop={e => { e.preventDefault(); setDragover(false); const f = e.dataTransfer.files[0]; if (f) processExcelFile(f); }}
                    >
                      <Upload size={30} className="dz-ico" />
                      <div className="dz-text">Arraste o arquivo aqui ou clique para selecionar</div>
                      <div className="dz-hint">.xlsx · .xls aceitos · Aba "Controle Geral" detectada automaticamente</div>
                      <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
                        onChange={e => { if (e.target.files[0]) processExcelFile(e.target.files[0]); }} />
                    </div>
                    {excelError && <div className="notice ni-danger"><AlertCircle size={14} />{excelError}</div>}
                  </>
                )}

                {/* Análise do arquivo */}
                {excelFile && !excelSyncing && (
                  <>
                    <div className="excel-analysis">
                      <div className="ea-header">
                        <FileSpreadsheet size={16} />
                        <div>
                          <span className="ea-filename">{excelFile.name}</span>
                          <span className="ea-wsname">Aba: {excelFile.wsName}</span>
                        </div>
                      </div>

                      <div className="ea-stats">
                        <div className="ea-stat ea-total">
                          <span className="eas-val">{excelFile.total}</span>
                          <span className="eas-lbl">Linhas válidas</span>
                        </div>
                        <div className="ea-stat ea-new">
                          <span className="eas-val">{excelFile.toInsert.length}</span>
                          <span className="eas-lbl">Novos registros</span>
                        </div>
                        <div className="ea-stat ea-dup">
                          <span className="eas-val">{excelFile.toUpdate.length}</span>
                          <span className="eas-lbl">Já existem no banco</span>
                        </div>
                      </div>

                      {excelDuplicates.length > 0 && (
                        <div className="dup-section">
                          <div className="dup-header">
                            <AlertTriangle size={13} />
                            <span>{excelDuplicates.length} registro(s) já existem no banco:</span>
                          </div>
                          <div className="dup-list">
                            {excelDuplicates.slice(0, 8).map((d, i) => (
                              <span key={i} className="dup-tag">{d.proc}</span>
                            ))}
                            {excelDuplicates.length > 8 && <span className="dup-more">+{excelDuplicates.length - 8} mais</span>}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="modal-acts" style={{ flexDirection: 'column', gap: 8 }}>
                      {excelFile.toInsert.length > 0 && (
                        <button className="btn btn-primary" style={{ justifyContent: 'center' }}
                          onClick={() => handleExcelSync(false)}>
                          <Plus size={12} />
                          Inserir apenas {excelFile.toInsert.length} novo(s) · ignorar duplicatas
                        </button>
                      )}
                      {excelFile.toUpdate.length > 0 && (
                        <button className="btn btn-amber" style={{ justifyContent: 'center' }}
                          onClick={() => handleExcelSync(true)}>
                          <RefreshCw size={12} />
                          Inserir novos + atualizar {excelFile.toUpdate.length} duplicata(s)
                        </button>
                      )}
                      {excelFile.toInsert.length === 0 && excelFile.toUpdate.length === 0 && (
                        <div className="notice ni-info"><Info size={14} />Todos os registros já existem no banco e nenhuma ação foi solicitada.</div>
                      )}
                      <button className="btn btn-ghost" style={{ justifyContent: 'center' }}
                        onClick={() => { setExcelFile(null); setExcelDuplicates([]); setExcelError(''); }}>
                        Escolher outro arquivo
                      </button>
                    </div>
                  </>
                )}

                {/* Progresso da sincronização */}
                {excelSyncing && (
                  <div className="sync-progress">
                    <div className="sync-header">
                      <Loader2 size={16} className="spin" />
                      <span>Sincronizando com o banco de dados...</span>
                    </div>
                    <div className="sync-log" ref={syncLogRef}>
                      {excelSyncLog.map((entry, i) => (
                        <div key={i} className="sync-line">
                          <span className="sync-ts">{entry.ts}</span>
                          <span className="sync-msg">{entry.msg}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── TOAST ─── */}
      {message && (
        <div className={`toast t-${message.type}`}>
          {message.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          {message.text}
        </div>
      )}
    </>
  );
}

// ─── CSS ─────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

:root{
  --bg:#F0F2F7;
  --surface:#FFFFFF;
  --surface2:#F7F8FC;
  --surface3:#EEF0F7;
  --border:#E2E6F0;
  --border2:#C8CEE0;

  --blue:#1D4ED8;
  --blue-lt:#EFF4FF;
  --blue-md:#BFCFFE;
  --blue-dk:#1740C0;

  --green:#15803D;
  --green-lt:#F0FDF4;
  --green-md:#86EFAC;

  --amber:#B45309;
  --amber-lt:#FFFBEB;
  --amber-md:#FCD34D;

  --red:#DC2626;
  --red-lt:#FEF2F2;
  --red-md:#FECACA;

  --indigo:#4F46E5;
  --indigo-lt:#EEF2FF;
  --indigo-md:#C7D2FE;

  --sky:#0284C7;
  --sky-lt:#F0F9FF;
  --sky-bd:#7DD3FC;

  --violet:#7C3AED;

  --c1:#0A0E1A;
  --c2:#2D3748;
  --c3:#64748B;
  --c4:#94A3B8;
  --c5:#CBD5E1;

  --font:'Geist',system-ui,sans-serif;
  --mono:'Geist Mono',monospace;

  --r-xs:4px;
  --r-sm:8px;
  --r:12px;
  --r-lg:16px;
  --r-xl:20px;
  --sh-xs:0 1px 2px rgba(0,0,0,.04);
  --sh-sm:0 2px 8px rgba(0,0,0,.06);
  --sh:0 4px 20px rgba(0,0,0,.08);
  --sh-lg:0 20px 60px rgba(0,0,0,.18);
}

html,body,#root{font-family:var(--font);background:var(--bg);height:100vh;overflow:hidden;color:var(--c1);font-size:13px;}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border2);border-radius:10px}
::-webkit-scrollbar-thumb:hover{background:var(--c5)}

.app{display:flex;height:100vh;overflow:hidden;}
.main{flex:1;display:flex;flex-direction:column;overflow:hidden;padding:16px;gap:14px;min-width:0;}

.sidebar{width:280px;flex-shrink:0;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden;transition:width .22s cubic-bezier(.4,0,.2,1);}
.sidebar.sb-closed{width:54px;}
.sb-head{padding:15px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
.sb-brand{display:flex;align-items:center;gap:10px;}
.sb-logo{width:36px;height:36px;border-radius:10px;flex-shrink:0;background:linear-gradient(145deg,#1D4ED8,#4F46E5);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(29,78,216,.35);}
.sb-logo span{color:#fff;font-weight:700;font-size:17px;letter-spacing:-.03em;}
.sb-name{font-size:13px;font-weight:700;color:var(--c1);letter-spacing:-.02em;}
.sb-sub{font-size:10px;color:var(--c4);margin-top:2px;}
.sb-toggle{width:28px;height:28px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--c4);transition:all .14s;flex-shrink:0;}
.sb-toggle:hover{background:var(--blue-lt);color:var(--blue);border-color:var(--blue-md);}

.sb-kpis{display:flex;border-bottom:1px solid var(--border);flex-shrink:0;}
.kpi-mini{flex:1;padding:12px 6px;text-align:center;border-right:1px solid var(--border);}
.kpi-mini:last-child{border-right:none;}
.km-val{display:block;font-size:18px;font-weight:700;color:var(--c1);letter-spacing:-.03em;}
.km-lbl{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--c4);margin-top:2px;}
.kpi-mini.warn .km-val{color:var(--amber);}
.kpi-mini.ok .km-val{color:var(--green);}

.sb-tabs{display:flex;gap:2px;padding:8px;background:var(--surface2);border-bottom:1px solid var(--border);flex-shrink:0;}
.sb-tab{flex:1;padding:6px 2px;border:1px solid transparent;border-radius:var(--r-sm);font-size:10px;font-weight:600;font-family:var(--font);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;color:var(--c3);background:transparent;transition:all .12s;}
.sb-tab.active{background:var(--surface);color:var(--blue);border-color:var(--border);box-shadow:var(--sh-xs);}

.sb-body{flex:1;overflow-y:auto;padding:10px;}
.filter-group{display:flex;flex-direction:column;gap:1px;}
.ff{margin-bottom:8px;}
.fl{display:flex;align-items:center;gap:3px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--c3);margin-bottom:4px;}
.fi-wrap{position:relative;display:flex;align-items:center;}
.fi{width:100%;padding:7px 10px;border:1.5px solid var(--border);border-radius:var(--r-sm);font-size:12px;font-family:var(--font);color:var(--c1);background:var(--surface2);outline:none;transition:border-color .14s,box-shadow .14s;}
.fi:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(29,78,216,.1);background:#fff;}
.fi::placeholder{color:var(--c5);}
.fi-clear{position:absolute;right:7px;background:none;border:none;cursor:pointer;color:var(--c4);display:flex;padding:2px;border-radius:4px;}
.fi-clear:hover{color:var(--c1);}
.fs{width:100%;padding:7px 28px 7px 10px;border:1.5px solid var(--border);border-radius:var(--r-sm);font-size:12px;font-family:var(--font);color:var(--c1);background:var(--surface2);outline:none;appearance:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 8px center;transition:border-color .14s;}
.fs:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(29,78,216,.1);}

.year-pills{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;}
.year-pill{padding:3px 11px;border:1.5px solid var(--border);border-radius:20px;font-size:11px;font-weight:600;font-family:var(--font);cursor:pointer;background:var(--surface2);color:var(--c3);transition:all .12s;}
.year-pill.active{background:var(--blue);color:#fff;border-color:var(--blue);box-shadow:0 2px 6px rgba(29,78,216,.3);}

.year-bdown{margin-bottom:8px;display:flex;flex-direction:column;gap:5px;}
.yb-row{display:flex;align-items:center;gap:7px;}
.yb-label{font-size:10px;font-weight:600;color:var(--c3);width:32px;flex-shrink:0;}
.yb-track{flex:1;height:5px;background:var(--border);border-radius:10px;overflow:hidden;}
.yb-bar{height:100%;background:linear-gradient(90deg,var(--blue),var(--indigo));border-radius:10px;transition:width .5s ease;}
.yb-cnt{font-size:10px;font-weight:700;color:var(--c2);width:28px;text-align:right;flex-shrink:0;}

.tab-hint{font-size:11px;color:var(--c3);line-height:1.6;margin-bottom:10px;}
.ec-row{display:flex;align-items:center;gap:6px;padding:7px 8px;border-radius:var(--r-sm);border:1.5px solid var(--border);margin-bottom:4px;background:var(--surface2);transition:all .12s;}
.ec-row.ec-amber{border-color:var(--amber);background:var(--amber-lt);}
.ec-row.ec-green{border-color:var(--green);background:var(--green-lt);}
.ec-info{flex:1;min-width:0;}
.ec-name{display:block;font-size:10px;font-weight:700;color:var(--c2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px;}
.ec-bar{height:3px;background:var(--border);border-radius:10px;overflow:hidden;margin-bottom:3px;}
.ec-fill{height:100%;background:var(--green);border-radius:10px;}
.ec-stat{font-size:9px;}
.ec-btns{display:flex;gap:3px;flex-shrink:0;}
.ec-btn{width:24px;height:24px;border-radius:6px;border:1.5px solid var(--border);background:var(--surface);font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--c3);transition:all .12s;}
.ec-btn.ecb-amber{background:var(--amber);color:#fff;border-color:var(--amber);}
.ec-btn.ecb-green{background:var(--green);color:#fff;border-color:var(--green);}

.col-actions{display:flex;gap:5px;margin-bottom:8px;}
.col-act-btn{flex:1;padding:5px;border:1.5px solid var(--border);border-radius:var(--r-sm);font-size:10px;font-weight:600;font-family:var(--font);cursor:pointer;background:var(--surface2);color:var(--c3);transition:all .12s;}
.col-act-btn:hover{background:var(--blue-lt);color:var(--blue);border-color:var(--blue-md);}
.col-row{display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:var(--r-sm);border:1.5px solid var(--border);background:var(--surface2);margin-bottom:3px;}
.col-name{flex:1;font-size:10px;font-weight:600;color:var(--c2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.col-toggle{padding:4px 8px;border-radius:6px;border:1.5px solid var(--border);background:var(--surface);cursor:pointer;display:flex;align-items:center;gap:3px;font-size:10px;color:var(--c3);transition:all .12s;}
.col-toggle.ct-visible{color:var(--blue);border-color:var(--blue-md);background:var(--blue-lt);}
.col-toggle.ct-hidden{color:var(--c5);}

.sb-foot{padding:10px;border-top:1px solid var(--border);flex-shrink:0;}
.clear-filters-btn{width:100%;padding:8px;margin-bottom:8px;background:var(--red-lt);color:var(--red);border:1.5px solid var(--red-md);border-radius:var(--r-sm);font-size:11px;font-weight:700;font-family:var(--font);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;transition:background .12s;}
.clear-filters-btn:hover{background:#FEE2E2;}
.sb-count-label{font-size:11px;text-align:center;color:var(--c4);}
.scl-filtered{font-weight:700;color:var(--blue);}
.scl-total{font-weight:700;color:var(--c2);}

.kpi-row{display:flex;gap:12px;flex-shrink:0;}
.kpi-card{flex:1;min-width:0;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:16px;display:flex;align-items:center;gap:14px;border-left:4px solid transparent;box-shadow:var(--sh-xs);transition:transform .14s,box-shadow .14s;}
.kpi-card:hover{transform:translateY(-2px);box-shadow:var(--sh-sm);}
.kc-blue{border-left-color:var(--blue);}
.kc-amber{border-left-color:var(--amber);}
.kc-green{border-left-color:var(--green);}
.kc-indigo{border-left-color:var(--indigo);}
.kc-icon{width:40px;height:40px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.kc-blue .kc-icon{background:var(--blue-lt);color:var(--blue);}
.kc-amber .kc-icon{background:var(--amber-lt);color:var(--amber);}
.kc-green .kc-icon{background:var(--green-lt);color:var(--green);}
.kc-indigo .kc-icon{background:var(--indigo-lt);color:var(--indigo);}
.kc-val{font-size:24px;font-weight:700;color:var(--c1);letter-spacing:-.04em;line-height:1;}
.kc-lbl{font-size:11px;font-weight:500;color:var(--c3);margin-top:4px;}
.kc-sub{font-size:10px;color:var(--c4);margin-top:2px;}

.tcard{flex:1;min-height:0;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);display:flex;flex-direction:column;overflow:hidden;box-shadow:var(--sh-xs);}

.toolbar{padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;flex-shrink:0;}
.tl-left{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.tcard-title{font-size:14px;font-weight:700;color:var(--c1);letter-spacing:-.02em;}
.count-badge{font-size:11px;font-weight:700;background:var(--blue-lt);color:var(--blue);border:1.5px solid var(--blue-md);border-radius:20px;padding:2px 10px;}
.filter-badge{display:flex;align-items:center;gap:4px;font-size:10px;font-weight:700;background:var(--indigo-lt);color:var(--indigo);border:1.5px solid var(--indigo-md);border-radius:20px;padding:2px 10px;}
.dirty-badge{display:flex;align-items:center;gap:4px;font-size:10px;font-weight:700;background:var(--amber-lt);color:var(--amber);border:1.5px solid var(--amber-md);border-radius:20px;padding:2px 10px;animation:pulse 2s infinite;}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.65}}

.tl-right{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
.search-wrap{position:relative;display:flex;align-items:center;}
.search-ico{position:absolute;left:10px;color:var(--c4);pointer-events:none;}
.search-in{padding:8px 30px 8px 32px;border:1.5px solid var(--border);border-radius:var(--r-sm);font-size:12px;font-family:var(--font);color:var(--c1);width:230px;outline:none;background:var(--surface2);transition:border-color .14s,box-shadow .14s;}
.search-in:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(29,78,216,.08);background:#fff;width:270px;}
.search-in::placeholder{color:var(--c4);}
.search-clr{position:absolute;right:8px;background:none;border:none;cursor:pointer;color:var(--c4);display:flex;padding:2px;border-radius:4px;}
.search-clr:hover{color:var(--c1);}

.icon-btn{padding:8px;border:1.5px solid var(--border);border-radius:var(--r-sm);background:var(--surface);cursor:pointer;color:var(--c2);display:flex;align-items:center;transition:all .12s;}
.icon-btn:hover{background:var(--surface2);border-color:var(--border2);}

.btn{display:inline-flex;align-items:center;gap:5px;padding:8px 14px;border-radius:var(--r-sm);font-size:12px;font-weight:700;font-family:var(--font);cursor:pointer;border:1.5px solid transparent;transition:all .14s;}
.btn-primary{background:var(--blue);color:#fff;border-color:var(--blue);}
.btn-primary:hover{background:var(--blue-dk);}
.btn-primary:disabled{opacity:.5;cursor:not-allowed;}
.btn-save{background:var(--green);color:#fff;border-color:var(--green);}
.btn-save:hover{background:#136835;}
.btn-save:disabled{opacity:.5;cursor:not-allowed;}
.btn-danger{background:var(--red);color:#fff;border-color:var(--red);}
.btn-danger:hover{background:#B91C1C;}
.btn-success{background:var(--green);color:#fff;border-color:var(--green);}
.btn-success:hover{background:#136835;}
.btn-ghost{background:var(--surface2);color:var(--c2);border-color:var(--border);}
.btn-ghost:hover{background:var(--border);}
.btn-del-sel{background:var(--red-lt);color:var(--red);border-color:var(--red-md);}
.btn-del-sel:hover{background:#FEE2E2;}
.btn-amber{background:#D97706;color:#fff;border-color:#D97706;}
.btn-amber:hover{background:#B45309;}

.active-pills{padding:7px 16px;border-bottom:1px solid var(--border);display:flex;gap:5px;flex-wrap:wrap;background:var(--surface2);flex-shrink:0;}
.ap{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;border-radius:20px;padding:3px 9px;border:1.5px solid transparent;}
.ap button{display:flex;align-items:center;border:none;background:none;cursor:pointer;opacity:.6;padding:0;}
.ap button:hover{opacity:1;}
.ap-blue{background:var(--blue-lt);color:var(--blue);border-color:var(--blue-md);}
.ap-amber{background:var(--amber-lt);color:var(--amber);border-color:var(--amber-md);}
.ap-green{background:var(--green-lt);color:var(--green);border-color:var(--green-md);}

.tscroll{flex:1;overflow:auto;}
table{width:100%;border-collapse:collapse;}
thead th{position:sticky;top:0;z-index:10;background:var(--surface2);padding:10px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--c3);border-bottom:2px solid var(--border);white-space:nowrap;user-select:none;}
thead th.sortable{cursor:pointer;transition:background .1s;}
thead th.sortable:hover{background:var(--blue-lt);color:var(--blue);}
thead th.th-bot{color:var(--sky);background:var(--sky-lt);}
thead th.th-bot:hover{background:#E0F2FE;}
thead th.th-aud{color:var(--violet);background:#F5F3FF;}
.th-inner{display:flex;align-items:center;gap:5px;}
.hdr-aud{display:flex;align-items:center;gap:5px;}
.sort-ico{margin-left:2px;opacity:.4;}
.sort-neutral{opacity:.2;}
.robo-chip{display:inline-flex;align-items:center;gap:2px;font-size:8px;font-weight:700;background:var(--sky-lt);color:var(--sky);border:1px solid var(--sky-bd);border-radius:4px;padding:1px 4px;}

tbody tr{border-bottom:1px solid #F1F5F9;transition:background .07s;}
tbody tr:hover{background:#F7F9FE;}
tbody tr.row-stripe{background:#FAFBFC;}
tbody tr.row-sel{background:var(--blue-lt)!important;}
tbody td{padding:8px 12px;vertical-align:middle;}

.empty-dash{color:var(--c5);font-size:11px;}
.dirty-dot{position:absolute;top:2px;right:2px;width:7px;height:7px;border-radius:50%;background:var(--amber);border:2px solid #fff;flex-shrink:0;}

.sel-container{position:relative;display:inline-flex;align-items:center;}
.cell-select{padding:5px 26px 5px 10px;border:1.5px solid var(--border);border-radius:var(--r-sm);font-size:11px;font-weight:500;font-family:var(--font);color:var(--c1);background:#fff;cursor:pointer;outline:none;appearance:none;min-width:130px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 7px center;transition:border-color .12s,box-shadow .12s;}
.cell-select:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(29,78,216,.12);}
.cell-select:hover{border-color:var(--border2);}
.cell-select.sel-green{background-color:var(--green-lt);color:var(--green);border-color:var(--green-md);font-weight:700;}
.cell-select.sel-red{background-color:var(--red-lt);color:var(--red);border-color:var(--red-md);font-weight:700;}
.cell-select.sel-amber{background-color:var(--amber-lt);color:var(--amber);border-color:var(--amber-md);font-weight:700;}
.cell-select.sel-gray{background-color:var(--surface3);color:var(--c3);}
.cell-select.sel-empty{border-color:var(--red-md);background:var(--red-lt);}
.sel-container.sel-dirty .cell-select{border-color:var(--amber)!important;}

.txt-cell{display:flex;align-items:center;gap:5px;cursor:pointer;padding:5px 7px;border-radius:var(--r-sm);border:1.5px solid transparent;min-width:80px;transition:all .12s;position:relative;}
.txt-cell:hover{border-color:var(--border);background:var(--surface2);}
.tc-value{font-size:12px;color:var(--c1);flex:1;word-break:break-word;}
.tc-placeholder{font-size:11px;color:var(--c5);font-style:italic;flex:1;}
.tc-pencil{color:var(--c5);flex-shrink:0;opacity:0;transition:opacity .12s;}
.txt-cell:hover .tc-pencil{opacity:1;}
.txt-cell.tc-dirty{border-color:var(--amber)!important;background:var(--amber-lt)!important;}
.txt-cell.tc-empty{border-color:#FDA29B;background:#FFF8F7;}

.edit-active{display:flex;align-items:center;gap:4px;}
.edit-input{padding:5px 9px;border:2px solid var(--blue);border-radius:var(--r-sm);font-size:12px;font-family:var(--font);color:var(--c1);outline:none;background:#fff;min-width:110px;box-shadow:0 0 0 3px rgba(29,78,216,.12);}
.edit-actions{display:flex;gap:3px;}
.ea-btn{width:24px;height:24px;border-radius:6px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .12s;}
.ea-ok{background:var(--green-lt);color:var(--green);}
.ea-ok:hover{background:var(--green-md);}
.ea-no{background:var(--red-lt);color:var(--red);}
.ea-no:hover{background:var(--red-md);}

.inst-tag{display:inline-flex;align-items:center;padding:4px 10px;border-radius:20px;font-size:10px;font-weight:700;white-space:nowrap;letter-spacing:.01em;}
.it-conv{background:var(--blue-lt);color:var(--blue);}
.it-fom{background:var(--green-lt);color:var(--green);}
.it-ted{background:var(--indigo-lt);color:var(--indigo);}

.cell-robo{font-size:11px;color:var(--sky);display:block;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}

.audit-cell{display:flex;flex-direction:column;gap:3px;}
.aud-ts{font-size:10px;color:var(--violet);font-family:var(--mono);}
.aud-col{display:inline-flex;font-size:9px;font-weight:700;background:#F5F3FF;color:var(--violet);border:1px solid #DDD6FE;border-radius:12px;padding:1px 7px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}

.del-btn{opacity:0;padding:6px;background:none;border:none;color:var(--c4);cursor:pointer;border-radius:7px;display:flex;align-items:center;transition:opacity .12s,background .12s,color .12s;}
tbody tr:hover .del-btn{opacity:1;}
.del-btn:hover{background:var(--red-lt);color:var(--red);}

.cb{width:15px;height:15px;cursor:pointer;accent-color:var(--blue);}

.empty-state{text-align:center;padding:70px 20px;}
.es-icon{font-size:36px;margin-bottom:12px;}
.es-title{font-size:15px;font-weight:700;color:var(--c1);margin-bottom:6px;}
.es-sub{font-size:13px;color:var(--c3);}

.tfoot{padding:11px 16px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;background:var(--surface2);}
.page-info{font-size:12px;color:var(--c3);}
.page-info strong{color:var(--c1);}
.page-ctrl{display:flex;align-items:center;gap:8px;}
.pg-lbl{font-size:11px;color:var(--c4);font-weight:600;}
.pg-sel{padding:5px 10px;border:1.5px solid var(--border);border-radius:var(--r-sm);font-size:12px;font-family:var(--font);background:#fff;cursor:pointer;outline:none;color:var(--c1);}
.pg-btn{padding:6px 12px;border:1.5px solid var(--border);border-radius:var(--r-sm);font-size:12px;font-weight:600;background:#fff;color:var(--c2);cursor:pointer;display:flex;align-items:center;gap:4px;transition:all .12s;font-family:var(--font);}
.pg-btn:hover:not(:disabled){background:var(--blue);color:#fff;border-color:var(--blue);}
.pg-btn:disabled{opacity:.3;cursor:not-allowed;}
.pg-btn-next{background:var(--blue);color:#fff;border-color:var(--blue);}
.pg-btn-next:hover:not(:disabled){background:var(--blue-dk);}
.pg-pages{font-size:12px;color:var(--c2);font-weight:600;padding:0 4px;}

.overlay{position:fixed;inset:0;z-index:400;background:rgba(10,14,26,.65);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;}
.modal{background:var(--surface);border-radius:var(--r-xl);padding:28px;width:100%;max-width:460px;box-shadow:var(--sh-lg);animation:mIn .22s cubic-bezier(.34,1.56,.64,1);}
.modal.modal-lg{max-width:580px;}
@keyframes mIn{from{opacity:0;transform:scale(.92) translateY(14px)}}

.modal-icon{width:56px;height:56px;border-radius:16px;display:flex;align-items:center;justify-content:center;margin:0 auto 18px;}
.mi-red{background:var(--red-lt);color:var(--red);}
.mi-blue{background:var(--blue-lt);color:var(--blue);}
.modal-title{font-size:18px;font-weight:700;text-align:center;color:var(--c1);margin-bottom:8px;letter-spacing:-.03em;}
.modal-desc{font-size:13px;color:var(--c3);text-align:center;line-height:1.7;margin-bottom:24px;}
.modal-desc strong{color:var(--c1);}
.modal-acts{display:flex;gap:8px;margin-top:20px;}
.modal-acts .btn{flex:1;justify-content:center;padding:11px;font-size:13px;}

.modal-tabs{display:flex;background:var(--surface2);border-radius:var(--r);padding:3px;margin-bottom:20px;border:1.5px solid var(--border);}
.mtab{flex:1;padding:9px;border:none;border-radius:9px;font-size:12px;font-weight:700;font-family:var(--font);cursor:pointer;background:transparent;color:var(--c3);display:flex;align-items:center;justify-content:center;gap:6px;transition:all .14s;}
.mtab.active{background:#fff;color:var(--c1);box-shadow:0 1px 5px rgba(0,0,0,.1);}

.notice{border-radius:var(--r);padding:12px 14px;display:flex;align-items:flex-start;gap:10px;font-size:12px;line-height:1.6;margin-bottom:16px;}
.notice svg{flex-shrink:0;margin-top:1px;}
.ni-info{background:var(--blue-lt);border:1.5px solid var(--blue-md);color:var(--blue);}
.ni-danger{background:var(--red-lt);border:1.5px solid var(--red-md);color:var(--red);}

.form-group{margin-bottom:16px;}
.form-lbl{display:block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--c2);margin-bottom:6px;}
.form-in{width:100%;padding:11px 13px;border:2px solid var(--border);border-radius:var(--r);font-size:14px;font-family:var(--font);color:var(--c1);background:var(--surface2);outline:none;transition:border-color .14s,box-shadow .14s;}
.form-in:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(29,78,216,.1);background:#fff;}
.form-in::placeholder{color:var(--c4);}

.dropzone{border:2px dashed var(--border2);border-radius:var(--r-lg);padding:32px 20px;text-align:center;cursor:pointer;transition:all .16s;background:var(--surface2);margin-bottom:16px;}
.dropzone:hover,.dropzone.dz-over{border-color:var(--blue);background:var(--blue-lt);}
.dz-ico{color:var(--c4);margin:0 auto 12px;display:block;}
.dz-text{font-size:13px;font-weight:600;color:var(--c2);}
.dz-hint{font-size:11px;color:var(--c4);margin-top:4px;}

.excel-analysis{border:1.5px solid var(--border);border-radius:var(--r-lg);overflow:hidden;margin-bottom:16px;}
.ea-header{display:flex;align-items:center;gap:8px;padding:12px 16px;background:var(--surface2);border-bottom:1px solid var(--border);}
.ea-filename{font-size:12px;font-weight:700;color:var(--c1);word-break:break-all;display:block;}
.ea-wsname{font-size:10px;color:var(--c4);display:block;margin-top:2px;}
.ea-stats{display:flex;border-bottom:1px solid var(--border);}
.ea-stat{flex:1;padding:14px;text-align:center;border-right:1px solid var(--border);}
.ea-stat:last-child{border-right:none;}
.ea-total{background:var(--surface2);}
.ea-new{background:var(--green-lt);}
.ea-dup{background:var(--amber-lt);}
.eas-val{display:block;font-size:22px;font-weight:700;letter-spacing:-.04em;color:var(--c1);}
.ea-new .eas-val{color:var(--green);}
.ea-dup .eas-val{color:var(--amber);}
.eas-lbl{display:block;font-size:10px;font-weight:600;color:var(--c3);margin-top:3px;}

.dup-section{padding:12px 16px;}
.dup-header{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;color:var(--amber);margin-bottom:8px;}
.dup-list{display:flex;flex-wrap:wrap;gap:4px;}
.dup-tag{font-size:10px;font-weight:600;background:var(--amber-lt);color:var(--amber);border:1px solid var(--amber-md);border-radius:6px;padding:3px 8px;font-family:var(--mono);}
.dup-more{font-size:10px;color:var(--c4);font-style:italic;display:flex;align-items:center;padding:3px 8px;}

.sync-progress{border:1.5px solid var(--border);border-radius:var(--r-lg);overflow:hidden;margin-bottom:16px;}
.sync-header{display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--surface2);border-bottom:1px solid var(--border);font-size:12px;font-weight:700;color:var(--c1);}
.sync-log{height:180px;overflow-y:auto;padding:12px;background:#0A0E1A;display:flex;flex-direction:column;gap:4px;}
.sync-line{display:flex;gap:8px;font-family:var(--mono);font-size:11px;}
.sync-ts{color:#475569;flex-shrink:0;}
.sync-msg{color:#67E8F9;}

.toast{position:fixed;bottom:20px;right:20px;z-index:999;padding:14px 18px;border-radius:var(--r);display:flex;align-items:center;gap:10px;font-size:13px;font-weight:600;box-shadow:var(--sh-lg);animation:tIn .25s cubic-bezier(.34,1.56,.64,1);max-width:380px;}
.t-success{background:#0A0E1A;color:#fff;}
.t-error  {background:var(--red);color:#fff;}
@keyframes tIn{from{opacity:0;transform:translateY(12px) scale(.95)}}

.load-screen{height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:var(--bg);}
.load-brand{display:flex;align-items:center;gap:12px;margin-bottom:8px;}
.load-logo{width:44px;height:44px;border-radius:13px;background:linear-gradient(145deg,#1D4ED8,#4F46E5);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(29,78,216,.4);}
.load-logo span{color:#fff;font-weight:700;font-size:22px;letter-spacing:-.03em;}
.load-title{font-size:18px;font-weight:700;color:var(--c1);letter-spacing:-.03em;}
.load-ring{width:40px;height:40px;border:3px solid var(--border);border-top-color:var(--blue);border-radius:50%;animation:spin .7s linear infinite;}
@keyframes spin{to{transform:rotate(360deg)}}
.load-label{font-size:11px;font-weight:700;color:var(--c4);text-transform:uppercase;letter-spacing:.1em;}
.load-track{width:200px;height:4px;background:var(--border);border-radius:10px;overflow:hidden;}
.load-fill{height:100%;background:linear-gradient(90deg,var(--blue),var(--indigo));border-radius:10px;transition:width .3s ease;}

.spin{animation:spin .65s linear infinite;}
`;