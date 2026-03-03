// src/pages/TabelaGerencial.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  flexRender,
} from '@tanstack/react-table';
import {
  ArrowLeft,
  Download,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Database,
  Search,
  ChevronDown,
  X,
  Filter,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../services/supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// UTILITÁRIOS DE FORMATAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

const cleanValue = (val) => (val == null ? '' : String(val).replace(/\.0$/, '').trim());

const formatCNPJ = (val) => {
  if (!val) return '—';
  const digits = cleanValue(val).replace(/\D/g, '');
  const match = digits.match(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/);
  return match ? `${match[1]}.${match[2]}.${match[3]}/${match[4]}-${match[5]}` : '—';
};

const formatCurrency = (val) =>
  val == null || val === ''
    ? '—'
    : Number(cleanValue(val)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || '—';

const formatDateBR = (val) => {
  if (!val || val === '—') return '—';
  const date = new Date(val);
  return isNaN(date.getTime()) ? val : date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
};

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURAÇÕES DE EDIÇÃO
// ─────────────────────────────────────────────────────────────────────────────

const EDITABLE_COLUMNS = new Set([
  'AJUSTE', 'CANCELAR EMPENHO', 'REJEITAR NO TRANSFEREGOV', 'SOB LIMINAR',
  'NECESSIDADE DE ADITIVO', 'INSTRUÇÃO PROCESSUAL', 'DATA DA PUBLICAÇÃO',
  'EQUIPE', 'TÉCNICO DE FORMALIZAÇÃO', 'NECESSIDADE DE ADITIVO PARA SUSPENSIVA',
  'CELEBRADO COM CLAUSULA SUSPENSIVA', 'PAD - CRONO', 'PUBLICAÇÃO TRANSFEREGOV',
  'PARECER TRANSFEREGOV', 'TRAMITADO PARA CGAP',
]);

const SELECT_OPTIONS = {
  'CELEBRADO COM CLAUSULA SUSPENSIVA': ['SIM', 'NÃO', 'NÃO SE APLICA'],
  'PAD - CRONO': ['SIM', 'NÃO', 'PORTARIA 64/2025'],
  'PUBLICAÇÃO TRANSFEREGOV': ['SIM', 'NÃO', 'PROBLEMA', 'NÃO SE APLICA'],
  'PARECER TRANSFEREGOV': ['SIM', 'NÃO', 'NÃO SE APLICA'],
  'AJUSTE': ['PENDENTE', 'REALIZADO', 'NÃO SE APLICA'],
  'CANCELAR EMPENHO': ['SIM', 'NÃO', 'SOLICITADO', 'NÃO SE APLICA'],
  'REJEITAR NO TRANSFEREGOV': ['CONJUR', 'REJEITAR', 'FORMALIZAR', 'REALIZADO', 'NÃO SE APLICA'],
  'SOB LIMINAR': ['CONJUR', 'REJEITAR', 'FORMALIZAR', 'NÃO SE APLICA'],
  'NECESSIDADE DE ADITIVO': ['SIM', 'NÃO', 'PENDENTE', 'NÃO SE APLICA'],
  'INSTRUÇÃO PROCESSUAL': ['SIM', 'NÃO', 'PENDENTE'],
  'NECESSIDADE DE ADITIVO PARA SUSPENSIVA': ['SIM', 'NÃO', 'NÃO SE APLICA'],
  'TRAMITADO PARA CGAP': ['CGC', 'CGFP', 'CGAP'],
  'EQUIPE': ['EQUIPE 6', 'EQUIPE 7'],
  'TÉCNICO DE FORMALIZAÇÃO': ['THALITA', 'SAMARA', 'GLENDA', 'HELLEN', 'ALINE', 'SUELHY', 'JAQUELINE', 'CLARISSA', 'JÚLIO'],
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTES DE CÉLULA EDITÁVEL
// ─────────────────────────────────────────────────────────────────────────────

const EditableSelect = ({ value, options, onChange, isEdited }) => {
  const getStyle = (val) => {
    if (['SIM', 'REALIZADO', 'ANALISADO'].includes(val)) return 'bg-emerald-50 text-emerald-800 border-emerald-300';
    if (['NÃO', 'PENDENTE', 'PROBLEMA', 'REJEITAR'].includes(val)) return 'bg-rose-50 text-rose-800 border-rose-300';
    return 'bg-indigo-50 text-indigo-800 border-indigo-300';
  };

  return (
    <div className="relative w-full min-w-[170px]">
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-3 py-1.5 text-sm font-medium rounded border appearance-none cursor-pointer transition-all
          ${isEdited ? 'ring-2 ring-amber-400 border-amber-500 shadow-sm' : getStyle(value)}`}
      >
        <option value="">Selecione...</option>
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" size={14} />
    </div>
  );
};

const EditableDate = ({ value, onChange, isEdited }) => {
  const toInputFormat = (str) => {
    if (!str || str === '—') return '';
    if (str.includes('-')) return str;
    const [d, m, y] = str.split('/');
    return y && m && d ? `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` : '';
  };

  return (
    <input
      type="date"
      value={toInputFormat(value)}
      onChange={(e) => onChange(e.target.value ? e.target.value.split('-').reverse().join('/') : '—')}
      className={`w-full px-3 py-1.5 text-sm rounded border transition-all
        ${isEdited ? 'ring-2 ring-amber-400 border-amber-500 shadow-sm' : 'border-slate-300 hover:border-slate-400'}`}
    />
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// POPOVER DE FILTRO ESTILO EXCEL (com fallback manual)
// ─────────────────────────────────────────────────────────────────────────────

const ColumnFilterCheckbox = ({ column, table }) => {
  const [open, setOpen] = useState(false);
  const [loadingValues, setLoadingValues] = useState(true);
  const popoverRef = useRef(null);

  // Tenta usar faceted values nativo
  const faceted = column.getFacetedUniqueValues?.() || new Map();

  // Fallback: calcula valores únicos manualmente
  const allRows = table.getPreFilteredRowModel().rows;
  const manualValues = useMemo(() => {
    const values = new Map();
    allRows.forEach(row => {
      const val = row.getValue(column.id);
      const key = val == null || val === '' ? '(vazio)' : String(val);
      values.set(key, (values.get(key) || 0) + 1);
    });
    return values;
  }, [allRows, column.id]);

  // Usa faceted se disponível e não vazio, senão fallback
  const valueMap = faceted.size > 0 ? faceted : manualValues;
  const uniqueValues = Array.from(valueMap.keys()).sort();

  const currentFilter = column.getFilterValue() ?? [];
  const selectedSet = new Set(currentFilter);

  const toggleValue = (val) => {
    const newSet = new Set(selectedSet);
    if (newSet.has(val)) {
      newSet.delete(val);
    } else {
      newSet.add(val);
    }
    column.setFilterValue(newSet.size ? Array.from(newSet) : undefined);
  };

  const selectAllToggle = () => {
    if (selectedSet.size === uniqueValues.length) {
      column.setFilterValue(undefined);
    } else {
      column.setFilterValue(uniqueValues);
    }
  };

  // Fecha ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Simula loading para evitar abrir vazio
  useEffect(() => {
    if (open) {
      setLoadingValues(true);
      setTimeout(() => setLoadingValues(false), 150); // pequeno delay para renderização
    }
  }, [open]);

  const count = (val) => valueMap.get(val === '(vazio)' ? null : val) || 0;

  return (
    <div className="relative inline-block" ref={popoverRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-1 py-0.5 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100"
      >
        <Filter size={14} />
        {currentFilter.length > 0 && (
          <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 rounded-full font-medium">
            {currentFilter.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-72 bg-white border border-slate-200 rounded-lg shadow-2xl max-h-96 overflow-hidden">
          <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-slate-50">
            <span className="font-semibold text-sm text-slate-800">Filtrar {column.id}</span>
            <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-800">
              <X size={16} />
            </button>
          </div>

          <div className="p-2 max-h-72 overflow-y-auto">
            {loadingValues ? (
              <div className="py-6 flex justify-center">
                <Loader2 className="animate-spin text-indigo-500" size={20} />
              </div>
            ) : uniqueValues.length === 0 ? (
              <div className="py-4 text-center text-slate-500 text-sm">Nenhum valor encontrado</div>
            ) : (
              <>
                <label className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100">
                  <input
                    type="checkbox"
                    checked={selectedSet.size === uniqueValues.length && uniqueValues.length > 0}
                    indeterminate={selectedSet.size > 0 && selectedSet.size < uniqueValues.length}
                    onChange={selectAllToggle}
                    className="h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-slate-800">(Selecionar tudo)</span>
                </label>

                {uniqueValues.map((val) => (
                  <label
                    key={val}
                    className="flex items-center justify-between gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedSet.has(val)}
                        onChange={() => toggleValue(val)}
                        className="h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-slate-700 truncate max-w-[180px]">
                        {val}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">({count(val)})</span>
                  </label>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export default function TabelaGerencial() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [editedCells, setEditedCells] = useState({});
  const [globalFilter, setGlobalFilter] = useState('');

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      let allRecords = [];
      let from = 0;
      const pageSize = 1000;

      while (true) {
        const { data: chunk, error } = await supabase
          .from('formalizacoes')
          .select('*')
          .order('id', { ascending: true })
          .range(from, from + pageSize - 1);

        if (error) throw error;
        if (!chunk?.length) break;

        allRecords = [...allRecords, ...chunk];
        from += pageSize;
        if (chunk.length < pageSize) break;
      }

      setData(allRecords);
    } catch (err) {
      setMessage({ type: 'error', text: 'Falha ao carregar os dados.' });
      console.error('Erro ao carregar:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const columns = useMemo(() => {
    if (!data.length) return [];

    const excluded = new Set(['id', 'vazia_1', 'vazia_2', 'created_at', 'SITUACIONAL', 'Coluna1']);
    let keys = Object.keys(data[0] || {}).filter(k => !excluded.has(k));

    // Ordem personalizada
    keys = keys.filter(k => k !== 'NECESSIDADE DE ADITIVO PARA SUSPENSIVA');
    const idx = keys.indexOf('INSTRUÇÃO PROCESSUAL');
    if (idx !== -1) keys.splice(idx + 1, 0, 'NECESSIDADE DE ADITIVO PARA SUSPENSIVA');

    return keys.map(key => ({
      accessorKey: key,
      id: key,
      header: ({ column, header, table }) => (
        <div className="min-w-[160px] px-2 py-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase text-slate-600 truncate">
              {key}
            </span>
            <ColumnFilterCheckbox column={column} table={table} />
          </div>
        </div>
      ),
      cell: ({ getValue, row }) => {
        const raw = getValue();
        const cellId = `${row.original.id}::${key}`;
        const edited = editedCells[cellId];
        const display = edited !== undefined ? edited : raw;

        if (EDITABLE_COLUMNS.has(key)) {
          if (key === 'DATA DA PUBLICAÇÃO') {
            return <EditableDate value={display} onChange={v => setEditedCells(p => ({ ...p, [cellId]: v }))} isEdited={!!edited} />;
          }
          if (SELECT_OPTIONS[key]) {
            return <EditableSelect value={display} options={SELECT_OPTIONS[key]} onChange={v => setEditedCells(p => ({ ...p, [cellId]: v }))} isEdited={!!edited} />;
          }
        }

        if (key === 'CNPJ ') return <span className="font-mono text-sm">{formatCNPJ(display)}</span>;
        if (key === 'VALOR REPASSE') return <span className="font-semibold text-emerald-700">{formatCurrency(display)}</span>;
        if (['TÉRMINO DA VIGÊNCIA', 'DATA DA PUBLICAÇÃO DOU'].includes(key)) {
          return <span className="text-indigo-600 font-medium">{formatDateBR(display)}</span>;
        }

        return <span className="text-sm text-slate-700 truncate block max-w-[340px]">{cleanValue(display) || '—'}</span>;
      },
      filterFn: 'arrIncludesSome',
      enableColumnFilter: true,
      enableSorting: true,
      enableFacetedValues: true,
    }));
  }, [data, editedCells]);

  const table = useReactTable({
    data,
    columns,
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const handleSave = useCallback(async () => {
    if (Object.keys(editedCells).length === 0) return;

    setSaving(true);
    try {
      const updates = {};
      Object.entries(editedCells).forEach(([cellKey, val]) => {
        const [idStr, field] = cellKey.split('::');
        const id = Number(idStr);
        if (!updates[id]) updates[id] = {};
        updates[id][field] = val;
      });

      await Promise.all(
        Object.entries(updates).map(([id, changes]) =>
          supabase.from('formalizacoes').update(changes).eq('id', id)
        )
      );

      setEditedCells({});
      setMessage({ type: 'success', text: 'Alterações salvas com sucesso!' });
      setTimeout(() => setMessage(null), 4000);
      await fetchAllData();
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Erro ao salvar alterações.' });
    } finally {
      setSaving(false);
    }
  }, [editedCells, fetchAllData]);

  const exportToExcel = () => {
    const filtered = table.getFilteredRowModel().rows.map(r => r.original);
    const ws = XLSX.utils.json_to_sheet(filtered);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Formalizações');
    XLSX.writeFile(wb, `Gerencial_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-indigo-600" size={56} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      {/* Cabeçalho */}
      <header className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between gap-6 shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <Database className="text-indigo-400" size={26} />
          <h1 className="font-black text-xl tracking-tight">GERENCIAL</h1>
        </div>

        <div className="flex-1 max-w-3xl relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            value={globalFilter ?? ''}
            onChange={e => setGlobalFilter(e.target.value)}
            placeholder="Busca global em todas as colunas..."
            className="w-full bg-slate-800 text-white pl-12 pr-12 py-3 rounded-xl border border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all"
          />
          {globalFilter && (
            <X
              className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 hover:text-white"
              size={18}
              onClick={() => setGlobalFilter('')}
            />
          )}
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-3 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors"
            title="Voltar"
          >
            <ArrowLeft size={20} />
          </button>

          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 px-6 py-3 rounded-xl font-semibold transition-colors shadow-sm"
          >
            <Download size={18} /> Exportar
          </button>

          {!!Object.keys(editedCells).length && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 px-6 py-3 rounded-xl font-bold text-slate-900 disabled:opacity-60 transition-all shadow-sm"
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              SALVAR ({Object.keys(editedCells).length})
            </button>
          )}
        </div>
      </header>

      {/* Mensagem de feedback */}
      {message && (
        <div
          className={`fixed top-6 right-8 z-50 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 text-white animate-fade-in
            ${message.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}
        >
          {message.type === 'success' ? <CheckCircle2 size={22} /> : <AlertCircle size={22} />}
          <span className="font-medium">{message.text}</span>
        </div>
      )}

      {/* Área da tabela */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-separate border-spacing-0 min-w-max">
          <thead className="sticky top-0 z-20 bg-slate-100/95 backdrop-blur-sm shadow-sm">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(header => (
                  <th
                    key={header.id}
                    className="px-3 py-3 text-left border-b border-slate-200 cursor-pointer select-none group"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    <span className="ml-1 inline-block">
                      {{
                        asc: <span className="text-indigo-600 font-bold">↑</span>,
                        desc: <span className="text-indigo-600 font-bold">↓</span>,
                      }[header.column.getIsSorted()] ?? (
                        <span className="text-slate-300 opacity-0 group-hover:opacity-60 text-xs">↕</span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody className="bg-white divide-y divide-slate-100">
            {table.getRowModel().rows.map((row, idx) => (
              <tr
                key={row.id}
                className={`hover:bg-indigo-50/30 transition-colors duration-150
                  ${idx % 2 === 0 ? 'bg-slate-50/60' : 'bg-white'}`}
              >
                {row.getVisibleCells().map(cell => (
                  <td
                    key={cell.id}
                    className="px-3 py-3 border-r border-slate-100 last:border-r-0 text-sm text-slate-700"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Rodapé */}
      <footer className="bg-white border-t border-slate-200 px-6 py-3.5 flex items-center justify-between text-sm text-slate-600 shadow-sm">
        <div className="flex items-center gap-5">
          <select
            value={table.getState().pagination.pageSize}
            onChange={e => table.setPageSize(Number(e.target.value))}
            className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none"
          >
            {[50, 100, 200, 500, 1000].map(size => (
              <option key={size} value={size}>{size} linhas</option>
            ))}
          </select>

          <span>
            Mostrando <strong>{table.getRowModel().rows.length}</strong> de{' '}
            <strong>{table.getFilteredRowModel().rows.length}</strong>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
            className="p-2.5 rounded border hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={18} />
          </button>

          <span className="px-4 py-1.5 bg-indigo-50 text-indigo-700 font-semibold rounded border border-indigo-100">
            Página {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}
          </span>

          <button
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
            className="p-2.5 rounded border hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </footer>
    </div>
  );
}