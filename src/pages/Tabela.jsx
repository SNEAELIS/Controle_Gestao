// src/pages/TabelaGerencial.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table';
import {
  ArrowLeft,
  Download,
  Save,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Database,
  Search,
  ChevronDown,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../services/supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// UTILITÁRIOS DE FORMATAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

const cleanDotZero = (val) => (val == null ? '' : String(val).replace(/\.0$/, '').trim());

const formatCNPJ = (val) => {
  if (!val) return '—';
  const clean = cleanDotZero(val).replace(/\D/g, '');
  return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') || '—';
};

const formatCurrency = (val) => {
  if (val == null || val === '') return '—';
  const n = Number(cleanDotZero(val));
  return isNaN(n) ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatDateBR = (val) => {
  if (!val || val === '—') return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return [
    String(d.getDate()).padStart(2, '0'),
    String(d.getMonth() + 1).padStart(2, '0'),
    d.getFullYear()
  ].join('/');
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
  'TERMO DE REFERÊNCIA': ['Aguardando análise de custo', 'Solicitar TR', 'Em análise', 'Solicitado ajuste', 'Analisado', 'Solicitado', 'Não se aplica'],
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
// COMPONENTES DE CÉLULA
// ─────────────────────────────────────────────────────────────────────────────

const EditableSelect = ({ value, options, onChange, isEdited }) => {
  const getStyle = (val) => {
    if (['SIM', 'REALIZADO', 'ANALISADO'].includes(val)) return 'bg-emerald-100 text-emerald-800 border-emerald-400';
    if (['NÃO', 'PENDENTE', 'PROBLEMA', 'REJEITAR'].includes(val)) return 'bg-rose-100 text-rose-800 border-rose-400';
    return 'bg-indigo-100 text-indigo-800 border-indigo-400';
  };

  return (
    <div className="relative w-full min-w-[160px]">
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-4 py-2 text-sm font-medium rounded-lg border-2 appearance-none transition-all
          ${isEdited ? 'ring-2 ring-amber-400 border-amber-500' : 'border-slate-300'} ${getStyle(value)}`}
      >
        <option value="">Selecione...</option>
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
      <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600" />
    </div>
  );
};

const EditableDate = ({ value, onChange, isEdited }) => {
  const toInputFormat = (str) => {
    if (!str || str === '—') return '';
    if (str.includes('-')) return str;
    const parts = str.split('/');
    return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : '';
  };

  return (
    <input
      type="date"
      value={toInputFormat(value)}
      onChange={(e) => onChange(e.target.value ? e.target.value.split('-').reverse().join('/') : '—')}
      className={`w-full px-4 py-2 text-sm rounded-lg border-2 ${isEdited ? 'ring-2 ring-amber-400 border-amber-500' : 'border-slate-300'}`}
    />
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
  const [feedback, setFeedback] = useState(null);
  const [editedCells, setEditedCells] = useState({});
  const [searchTerm, setSearchTerm] = useState(''); // Corrigido nome do state
  const [columnFilters, setColumnFilters] = useState([]);

  const loadFullDatabase = useCallback(async () => {
    setLoading(true);
    try {
      let allRecords = [];
      let from = 0;
      const step = 1000;
      while (true) {
        const { data: chunk, error } = await supabase
          .from('formalizacoes')
          .select('*')
          .order('id', { ascending: true })
          .range(from, from + step - 1);
        if (error) throw error;
        if (!chunk?.length) break;
        allRecords = [...allRecords, ...chunk];
        from += step;
        if (chunk.length < step) break;
      }
      setData(allRecords);
    } catch (err) {
      setFeedback({ type: 'error', text: 'Falha ao carregar dados.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFullDatabase(); }, [loadFullDatabase]);

  const columns = useMemo(() => {
    if (!data.length) return [];
    const ignore = ['id', 'vazia_1', 'vazia_2', 'created_at', 'SITUACIONAL', 'Coluna1'];
    let keys = Object.keys(data[0]).filter(k => !ignore.includes(k));

    // Reordenação
    keys = keys.filter(k => k !== 'NECESSIDADE DE ADITIVO PARA SUSPENSIVA');
    const idx = keys.indexOf('INSTRUÇÃO PROCESSUAL');
    if (idx !== -1) keys.splice(idx + 1, 0, 'NECESSIDADE DE ADITIVO PARA SUSPENSIVA');

    return keys.map(key => ({
      accessorKey: key,
      header: () => (
        <div className="flex flex-col gap-2 min-w-[170px]">
          <span className="text-[10px] font-black uppercase text-slate-500">{key}</span>
          <input
            type="text"
            placeholder="Filtrar..."
            value={columnFilters.find(f => f.id === key)?.value ?? ''}
            onChange={e => setColumnFilters(old => {
              const next = old.filter(f => f.id !== key);
              if (e.target.value) next.push({ id: key, value: e.target.value });
              return next;
            })}
            className="px-2 py-1 text-xs border border-slate-300 rounded focus:ring-2 focus:ring-indigo-400 outline-none font-normal"
          />
        </div>
      ),
      cell: ({ getValue, row }) => {
        const rawValue = getValue();
        const cellId = `${row.original.id}::${key}`;
        const editedValue = editedCells[cellId];
        const displayValue = editedValue !== undefined ? editedValue : rawValue;

        if (EDITABLE_COLUMNS.has(key)) {
          if (key === 'DATA DA PUBLICAÇÃO') return (
            <EditableDate value={displayValue} isEdited={editedValue !== undefined}
              onChange={v => setEditedCells(p => ({ ...p, [cellId]: v }))} />
          );
          if (SELECT_OPTIONS[key]) return (
            <EditableSelect value={displayValue} options={SELECT_OPTIONS[key]} isEdited={editedValue !== undefined}
              onChange={v => setEditedCells(p => ({ ...p, [cellId]: v }))} />
          );
        }

        if (key === 'CNPJ ') return <span className="font-mono text-sm">{formatCNPJ(displayValue)}</span>;
        if (key === 'VALOR REPASSE') return <span className="font-bold text-emerald-700">{formatCurrency(displayValue)}</span>;
        if (['TÉRMINO DA VIGÊNCIA', 'DATA DA PUBLICAÇÃO DOU'].includes(key)) 
          return <span className="text-indigo-700 font-medium">{formatDateBR(displayValue)}</span>;

        return <span className="text-sm truncate block max-w-[300px]">{cleanDotZero(displayValue) || '—'}</span>;
      }
    }));
  }, [data, editedCells, columnFilters]);

  const table = useReactTable({
    data, // Corrigido: usando data diretamente
    columns,
    state: { globalFilter: searchTerm, columnFilters },
    onGlobalFilterChange: setSearchTerm,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const handleBatchSave = async () => {
    setSaving(true);
    try {
      const updates = {};
      Object.entries(editedCells).forEach(([cellKey, value]) => {
        const [id, field] = cellKey.split('::');
        updates[id] = { ...updates[id], [field]: value };
      });
      await Promise.all(Object.entries(updates).map(([id, payload]) =>
        supabase.from('formalizacoes').update(payload).eq('id', id)
      ));
      setEditedCells({});
      setFeedback({ type: 'success', text: 'Salvo com sucesso!' });
      setTimeout(() => setFeedback(null), 3000);
      loadFullDatabase();
    } catch (err) {
      setFeedback({ type: 'error', text: 'Erro ao salvar.' });
    } finally {
      setSaving(false);
    }
  };

  const exportToExcel = () => {
    // Corrigido: Exporta apenas o que está filtrado na tela
    const filteredRows = table.getFilteredRowModel().rows.map(r => r.original);
    const ws = XLSX.utils.json_to_sheet(filteredRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dados");
    XLSX.writeFile(wb, `Relatorio_${new Date().toLocaleDateString()}.xlsx`);
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="animate-spin text-indigo-600" size={48} />
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <header className="bg-slate-900 text-white p-6 flex items-center justify-between gap-4 shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <Database className="text-indigo-400" />
          <h1 className="font-black text-xl tracking-tight">GERENCIAL</h1>
        </div>
        
        <div className="flex-1 max-w-2xl relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Busca global..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800 rounded-xl pl-12 pr-10 py-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
          {searchTerm && <X className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer hover:text-white" size={18} onClick={() => setSearchTerm('')} />}
        </div>

        <div className="flex gap-3">
          <button onClick={() => navigate(-1)} className="p-3 bg-slate-700 rounded-xl hover:bg-slate-600"><ArrowLeft size={20}/></button>
          <button onClick={exportToExcel} className="flex items-center gap-2 bg-emerald-600 px-5 py-3 rounded-xl font-bold hover:bg-emerald-700"><Download size={20}/> EXCEL</button>
          {Object.keys(editedCells).length > 0 && (
            <button onClick={handleBatchSave} disabled={saving} className="flex items-center gap-2 bg-amber-500 px-5 py-3 rounded-xl font-bold text-slate-900 hover:bg-amber-600">
              {saving ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>} SALVAR ({Object.keys(editedCells).length})
            </button>
          )}
        </div>
      </header>

      {feedback && (
        <div className={`fixed top-24 right-8 z-50 px-6 py-4 rounded-xl shadow-2xl text-white flex items-center gap-3 animate-bounce ${feedback.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          {feedback.type === 'success' ? <CheckCircle2 size={20}/> : <AlertCircle size={20}/>} {feedback.text}
        </div>
      )}

      <div className="flex-1 overflow-auto border-b border-slate-200">
        <table className="w-full border-separate border-spacing-0">
          <thead className="sticky top-0 z-10 bg-slate-100 shadow-sm">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(header => (
                  <th key={header.id} className="px-4 py-4 border-b border-slate-200 text-left">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white">
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className="hover:bg-indigo-50/30 transition-colors">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-4 py-3 border-b border-slate-100 border-r last:border-r-0">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="p-4 bg-white flex items-center justify-between border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-4 text-sm text-slate-500">
          <select 
            value={table.getState().pagination.pageSize} 
            onChange={e => table.setPageSize(Number(e.target.value))}
            className="border rounded p-1 outline-none"
          >
            {[50, 100, 200].map(s => <option key={s} value={s}>{s} itens</option>)}
          </select>
          <span>Mostrando <b>{table.getRowModel().rows.length}</b> de <b>{table.getFilteredRowModel().rows.length}</b> registros</span>
        </div>

        <div className="flex items-center gap-2">
          <button disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()} className="p-2 border rounded hover:bg-slate-100 disabled:opacity-30"><ChevronLeft/></button>
          <span className="text-sm font-bold bg-indigo-50 px-3 py-1 rounded text-indigo-700">Pág {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}</span>
          <button disabled={!table.getCanNextPage()} onClick={() => table.nextPage()} className="p-2 border rounded hover:bg-slate-100 disabled:opacity-30"><ChevronRight/></button>
        </div>
      </footer>
    </div>
  );
}