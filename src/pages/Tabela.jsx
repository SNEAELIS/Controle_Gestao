import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
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
  Filter,
  ChevronDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../services/supabaseClient';

// ────────────────────────────────────────────────
// UTILITÁRIOS DE FORMATAÇÃO
// ────────────────────────────────────────────────

const cleanDotZero = (val) => (val == null ? '' : String(val).replace(/\.0$/, ''));

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
  ].join('-');
};

// ────────────────────────────────────────────────
// REGRAS DE EDIÇÃO (CONFORME SEU CÓDIGO)
// ────────────────────────────────────────────────

const EDITABLE_COLUMNS = new Set([
  'AJUSTE',
  'CANCELAR EMPENHO',
  'REJEITAR NO TRANSFEREGOV',
  'SOB LIMINAR',
  'NECESSIDADE DE ADITIVO',
  'INSTRUÇÃO PROCESSUAL',
  'DATA DA PUBLICAÇÃO',
  'EQUIPE',
  'TÉCNICO DE FORMALIZAÇÃO',
  'NECESSIDADE DE ADITIVO PARA SUSPENSIVA', // Adicionado conforme seu pedido manual
]);

const SELECT_OPTIONS = {
  'CELEBRADO COM CLAUSULA SUSPENSIVA': ['SIM', 'NÃO', 'NÃO SE APLICA'],
  'PAD - CRONO': ['SIM', 'NÃO', 'PORTARIA 64/2025'],
  'PUBLICAÇÃO TRANSFEREGOV': ['SIM', 'NÃO', 'PROBLEMA', 'NÃO SE APLICA'],
  'PARECER TRANSFEREGOV': ['SIM', 'NÃO', 'NÃO SE APLICA'],
  'AJUSTE': ['PENDENTE', 'REALIZADO', 'NÃO SE APLICA'],
  'TERMO DE REFERÊNCIA': [
    'Aguardando análise de custo',
    'Solicitar TR',
    'Em análise',
    'Solicitado ajuste',
    'Analisado',
    'Solicitado',
    'Não se aplica',
  ],
  'CANCELAR EMPENHO': ['SIM', 'NÃO', 'SOLICITADO', 'NÃO SE APLICA'],
  'REJEITAR NO TRANSFEREGOV': ['CONJUR', 'REJEITAR', 'FORMALIZAR', 'REALIZADO', 'NÃO SE APLICA'],
  'SOB LIMINAR': ['CONJUR', 'REJEITAR', 'FORMALIZAR', 'NÃO SE APLICA'],
  'NECESSIDADE DE ADITIVO': ['SIM', 'NÃO', 'PENDENTE', 'NÃO SE APLICA'],
  'INSTRUÇÃO PROCESSUAL': ['SIM', 'NÃO', 'PENDENTE'],
  'NECESSIDADE DE ADITIVO PARA SUSPENSIVA': ['SIM', 'NÃO', 'NÃO SE APLICA'], // Regra manual
  'TRAMITADO PARA CGAP': ['CGC', 'CGFP', 'CGAP'],
  'EQUIPE': ['EQUIPE 6', 'EQUIPE 7'],
  'TÉCNICO DE FORMALIZAÇÃO': ['THALITA', 'SAMARA', 'GLENDA', 'HELLEN', 'ALINE', 'SUELHY', 'JAQUELINE', 'CLARISSA', 'JÚLIO'],
  'PUBLICAÇÃO NO TRANSFEREGOV': ['THALITA', 'SAMARA', 'GLENDA', 'HELLEN', 'ALINE', 'SUELHY', 'JAQUELINE', 'CLARISSA', 'JÚLIO'],
};

// ────────────────────────────────────────────────
// COMPONENTES DE EDIÇÃO
// ────────────────────────────────────────────────

const EditableSelect = ({ value, options, onChange, isEdited }) => {
  const getStyle = (val) => {
    if (['SIM', 'REALIZADO', 'ANALISADO'].includes(val)) return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    if (['NÃO', 'PENDENTE', 'PROBLEMA', 'REJEITAR'].includes(val)) return 'bg-rose-50 text-rose-800 border-rose-200';
    return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  };

  return (
    <div className="relative">
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-3 py-1.5 text-xs font-medium rounded border focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all cursor-pointer shadow-sm appearance-none
          ${isEdited ? 'ring-2 ring-amber-400 border-amber-500' : 'hover:bg-white/70'}
          ${getStyle(value)}`}
      >
        <option value="">Selecione...</option>
        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
      <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-40" />
    </div>
  );
};

const EditableDate = ({ value, onChange, isEdited }) => {
  const toInputFormat = (str) => {
    if (!str || str === '—') return '';
    if (str.includes('-') && str.split('-')[0].length === 4) return str;
    const parts = str.split('-');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return '';
  };

  const toDisplayFormat = (inputValue) => {
    if (!inputValue) return '—';
    const [y, m, d] = inputValue.split('-');
    return `${d}-${m}-${y}`;
  };

  return (
    <input
      type="date"
      value={toInputFormat(value)}
      onChange={(e) => onChange(toDisplayFormat(e.target.value))}
      className={`w-full px-3 py-1.5 text-xs font-medium rounded border focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all cursor-pointer
        ${isEdited ? 'ring-2 ring-amber-400 border-amber-500' : 'hover:bg-white/70 border-slate-300'}
        bg-white text-slate-800`}
    />
  );
};

// ────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ────────────────────────────────────────────────

export default function TabelaGerencial() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [editedCells, setEditedCells] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

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
        allRecords.push(...chunk);
        from += step;
        if (chunk.length < step) break;
      }
      setData(allRecords);
    } catch (err) {
      setFeedback({ type: 'error', text: 'Erro ao carregar dados.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFullDatabase(); }, [loadFullDatabase]);

  const columns = useMemo(() => {
    if (!data.length) return [];

    const ignore = ['id', 'vazia_1', 'vazia_2', 'created_at', 'SITUACIONAL', 'SITUACIONAL ', 'Coluna1'];
    let keys = Object.keys(data[0]).filter((k) => !ignore.includes(k));

    // REORDENAÇÃO MANUAL: NECESSIDADE DE ADITIVO PARA SUSPENSIVA
    keys = keys.filter(k => k !== 'NECESSIDADE DE ADITIVO PARA SUSPENSIVA');
    const idxInstrucao = keys.indexOf('INSTRUÇÃO PROCESSUAL');
    if (idxInstrucao !== -1) {
      keys.splice(idxInstrucao, 0, 'NECESSIDADE DE ADITIVO PARA SUSPENSIVA');
    }

    return keys.map((key) => ({
      accessorKey: key,
      header: key,
      cell: ({ getValue, row }) => {
        const rawValue = getValue();
        const cellId = `${row.original.id}::${key}`;
        const editedValue = editedCells[cellId];
        const displayValue = editedValue !== undefined ? editedValue : rawValue;

        // VERIFICAÇÃO SE A COLUNA É EDITÁVEL (RESPEITANDO SEU SET)
        if (EDITABLE_COLUMNS.has(key)) {
          if (key === 'DATA DA PUBLICAÇÃO') {
            return (
              <EditableDate
                value={displayValue}
                onChange={(v) => setEditedCells((prev) => ({ ...prev, [cellId]: v }))}
                isEdited={editedValue !== undefined}
              />
            );
          }

          if (SELECT_OPTIONS[key]) {
            return (
              <EditableSelect
                value={displayValue}
                options={SELECT_OPTIONS[key]}
                onChange={(v) => setEditedCells((prev) => ({ ...prev, [cellId]: v }))}
                isEdited={editedValue !== undefined}
              />
            );
          }
        }

        // FORMATAÇÃO DE LEITURA
        if (key === 'CNPJ') return <span className="font-mono text-slate-600">{formatCNPJ(displayValue)}</span>;
        if (key === 'VALOR REPASSE') return <span className="font-bold text-emerald-700">{formatCurrency(displayValue)}</span>;
        if (['TÉRMINO DA VIGÊNCIA', 'CUSTO INICIADO EM', 'DATA DA PUBLICAÇÃO DOU'].includes(key)) 
          return <span className="text-indigo-600 font-medium">{formatDateBR(displayValue)}</span>;

        return (
          <span className="text-slate-600 truncate block max-w-[340px]" title={String(displayValue ?? '')}>
            {cleanDotZero(displayValue) || '—'}
          </span>
        );
      },
    }));
  }, [data, editedCells]);

  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const term = searchTerm.toLowerCase();
    return data.filter((row) =>
      Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(term))
    );
  }, [data, searchTerm]);

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
  });

  const handleBatchSave = async () => {
    if (!Object.keys(editedCells).length) return;
    setSaving(true);
    try {
      const updates = {};
      Object.entries(editedCells).forEach(([cellKey, value]) => {
        const [id, field] = cellKey.split('::');
        updates[id] = { ...updates[id], [field]: value };
      });
      await Promise.all(
        Object.entries(updates).map(([id, payload]) =>
          supabase.from('formalizacoes').update(payload).eq('id', id)
        )
      );
      setEditedCells({});
      setFeedback({ type: 'success', text: 'Alterações salvas com sucesso!' });
      setTimeout(() => setFeedback(null), 3000);
      loadFullDatabase();
    } catch (err) {
      setFeedback({ type: 'error', text: 'Erro ao salvar.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-slate-900 flex items-center justify-center text-white">
        <Loader2 className="animate-spin mr-3" /> <span>CARREGANDO BASE COMPLETA...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      <header className="bg-slate-900 text-white shadow-lg z-30 shrink-0 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Database size={24} className="text-indigo-400" />
          <h1 className="text-xl font-black">TABELA GERENCIAL</h1>
        </div>
        <input
          type="text"
          placeholder="Pesquisar..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-slate-800 border-none rounded-xl px-5 py-2 text-sm w-full max-w-md focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex gap-2">
          <button onClick={() => navigate(-1)} className="px-4 py-2 bg-slate-700 rounded-lg text-sm">Voltar</button>
          {Object.keys(editedCells).length > 0 && (
            <button onClick={handleBatchSave} disabled={saving} className="bg-amber-500 text-amber-950 px-4 py-2 rounded-lg font-bold flex items-center gap-2">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} SALVAR ({Object.keys(editedCells).length})
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-20 bg-slate-100 shadow-sm text-[10px] font-black uppercase text-slate-500 tracking-tighter">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(header => (
                  <th key={header.id} className="px-4 py-3 border-b border-slate-200 text-left">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className="hover:bg-indigo-50/30 transition-colors">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-4 py-2 text-xs border-r border-slate-50 whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* RODAPÉ FIXO DE PAGINAÇÃO */}
      <div className="bg-white border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_-4px_10px_-3px_rgba(0,0,0,0.07)] z-50 sticky bottom-0 shrink-0">
        <div className="flex items-center gap-5 text-sm text-slate-600">
          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          >
            {[10, 20, 30, 50, 80, 100].map((size) => (
              <option key={size} value={size}>{size} linhas</option>
            ))}
          </select>
          <span>Mostrando <strong className="text-indigo-700">{table.getRowModel().rows.length}</strong> de <strong>{filteredData.length}</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <button disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()} className="p-2.5 rounded-lg border border-slate-300 hover:bg-slate-100 disabled:opacity-40 transition">
            <ChevronLeft size={18} />
          </button>
          <div className="px-5 py-2 bg-indigo-50/70 rounded-lg border border-indigo-100 text-sm font-medium">
            Página <span className="font-bold text-indigo-700">{table.getState().pagination.pageIndex + 1}</span> de {table.getPageCount() || 1}
          </div>
          <button disabled={!table.getCanNextPage()} onClick={() => table.nextPage()} className="p-2.5 rounded-lg border border-slate-300 hover:bg-slate-100 disabled:opacity-40 transition">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}