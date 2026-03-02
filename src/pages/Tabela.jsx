// src/pages/Tabela.jsx
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
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../services/supabaseClient';

// ────────────────────────────────────────────────
// UTILITÁRIOS DE FORMATAÇÃO
// ────────────────────────────────────────────────

const cleanDotZero = (val) => {
  if (val == null) return '';
  return String(val).replace(/\.0$/, '');
};

const formatCNPJ = (val) => {
  if (!val) return '—';
  const clean = cleanDotZero(val).replace(/\D/g, '');
  return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
};

const formatCurrency = (val) => {
  if (val == null || val === '') return '—';
  const n = Number(cleanDotZero(val));
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatDateBR = (val) => {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '—';
  return [
    String(d.getDate()).padStart(2, '0'),
    String(d.getMonth() + 1).padStart(2, '0'),
    d.getFullYear(),
  ].join('-');
};

// ────────────────────────────────────────────────
// OPÇÕES DOS SELECTS
// ────────────────────────────────────────────────

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
  'TRAMITADO PARA CGAP': ['CGC', 'CGFP', 'CGAP'],
  'EQUIPE': ['EQUIPE 6', 'EQUIPE 7'],
  'TÉCNICO DE FORMALIZAÇÃO': [
    'THALITA',
    'SAMARA',
    'GLENDA',
    'HELLEN',
    'ALINE',
    'SUELHY',
    'JAQUELINE',
    'CLARISSA',
    'JÚLIO',
  ],
  'PUBLICAÇÃO NO TRANSFEREGOV': [
    'THALITA',
    'SAMARA',
    'GLENDA',
    'HELLEN',
    'ALINE',
    'SUELHY',
    'JAQUELINE',
    'CLARISSA',
    'JÚLIO',
  ],
};

// ────────────────────────────────────────────────
// COMPONENTE DE SELECT EDITÁVEL
// ────────────────────────────────────────────────

const EditableSelect = ({ value, options, onChange, isEdited }) => {
  const getStyle = (val) => {
    if (['SIM', 'REALIZADO', 'ANALISADO'].includes(val))
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    if (['NÃO', 'PENDENTE', 'PROBLEMA', 'REJEITAR'].includes(val))
      return 'bg-rose-50 text-rose-800 border-rose-200';
    return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  };

  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className={`
        w-full px-3 py-1.5 text-xs font-medium rounded border
        focus:outline-none focus:ring-2 focus:ring-indigo-400
        transition-all cursor-pointer shadow-sm
        ${isEdited ? 'ring-2 ring-amber-400 border-amber-500' : 'hover:bg-white/80'}
        ${getStyle(value)}
      `}
    >
      <option value="" className="bg-white text-gray-700">Selecione...</option>
      {options.map((opt) => (
        <option key={opt} value={opt} className="bg-white text-gray-900">
          {opt}
        </option>
      ))}
    </select>
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

  // ─── Carrega todos os registros (paginação manual) ───
  const loadFullDatabase = useCallback(async () => {
    setLoading(true);
    try {
      let allRecords = [];
      let from = 0;
      const step = 1000;

      // eslint-disable-next-line no-constant-condition
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
      console.error('Erro ao carregar dados:', err);
      setFeedback({ type: 'error', text: 'Falha ao conectar com o Supabase.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFullDatabase();
  }, [loadFullDatabase]);

  // ─── Definição das colunas ───
  const columns = useMemo(() => {
    if (!data.length) return [];

    const ignore = ['id', 'vazia_1', 'vazia_2', 'Coluna1'];
    const keys = Object.keys(data[0]).filter((k) => !ignore.includes(k));

    return keys.map((key) => ({
      accessorKey: key,
      header: key,
      size: 180,

      cell: ({ getValue, row }) => {
        const rawValue = getValue();
        const cellId = `${row.original.id}::${key}`;
        const editedValue = editedCells[cellId];
        const displayValue = editedValue !== undefined ? editedValue : rawValue;

        if (SELECT_OPTIONS[key]) {
          return (
            <EditableSelect
              value={displayValue}
              options={SELECT_OPTIONS[key]}
              onChange={(v) =>
                setEditedCells((prev) => ({ ...prev, [cellId]: v }))
              }
              isEdited={editedValue !== undefined}
            />
          );
        }

        if (key === 'CNPJ') {
          return (
            <span className="font-mono text-xs text-slate-600">
              {formatCNPJ(displayValue)}
            </span>
          );
        }

        if (key === 'VALOR REPASSE') {
          return (
            <span className="font-bold text-emerald-700">
              {formatCurrency(displayValue)}
            </span>
          );
        }

        if (['TÉRMINO DA VIGÊNCIA', 'CUSTO INICIADO EM', 'DATA DA PUBLICAÇÃO'].includes(key)) {
          return (
            <span className="font-medium text-indigo-600">
              {formatDateBR(displayValue)}
            </span>
          );
        }

        if (['ANO', 'Nº', 'EXECUÇÃO % EM CUSTOS'].includes(key)) {
          return (
            <span className="font-mono font-medium text-slate-700">
              {cleanDotZero(displayValue)}
              {key.includes('%') ? '%' : ''}
            </span>
          );
        }

        return (
          <span className="text-slate-600 truncate block max-w-[300px]" title={String(displayValue || '')}>
            {cleanDotZero(displayValue) || '—'}
          </span>
        );
      },
    }));
  }, [data, editedCells]);

  // ─── Filtro global ───
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

  // ─── Salvar alterações em batch ───
  const handleBatchSave = async () => {
    if (!Object.keys(editedCells).length) return;

    setSaving(true);
    setFeedback({ type: 'info', text: 'Salvando alterações...' });

    try {
      const updatesById = {};

      Object.entries(editedCells).forEach(([cellKey, value]) => {
        const [id, field] = cellKey.split('::');
        if (!updatesById[id]) updatesById[id] = {};
        updatesById[id][field] = value;
      });

      await Promise.all(
        Object.entries(updatesById).map(([id, payload]) =>
          supabase.from('formalizacoes').update(payload).eq('id', id)
        )
      );

      setEditedCells({});
      setFeedback({ type: 'success', text: 'Alterações salvas com sucesso!' });
      setTimeout(() => setFeedback(null), 4500);
      await loadFullDatabase();
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', text: 'Erro ao salvar alterações.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="text-center">
          <Loader2 className="h-12 w-12 mx-auto mb-6 animate-spin text-indigo-500" />
          <h2 className="text-2xl font-bold tracking-tight">CARREGANDO TABELA GERENCIAL</h2>
          <p className="text-slate-400 mt-2">Acessando ~1.800 registros...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white shadow-lg">
        <div className="max-w-[1920px] mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600 rounded-xl">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">TABELA_GERENCIAL</h1>
              <p className="text-xs text-indigo-300 uppercase tracking-wider">Gestão 2026</p>
            </div>
          </div>

          <div className="flex-1 max-w-xl relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Pesquisar em qualquer coluna..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition"
            >
              <ArrowLeft size={16} /> Voltar
            </button>

            <button
              onClick={() => {
                const ws = XLSX.utils.json_to_sheet(data);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Dados');
                XLSX.writeFile(wb, 'Tabela_Gerencial_Completa.xlsx');
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition shadow-md"
            >
              <Download size={16} /> Excel
            </button>

            {!!Object.keys(editedCells).length && (
              <button
                onClick={handleBatchSave}
                disabled={saving}
                className={`
                  flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition
                  ${saving
                    ? 'bg-amber-700 text-white cursor-wait'
                    : 'bg-amber-500 hover:bg-amber-600 text-amber-950 shadow-lg'}
                `}
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                SALVAR ({Object.keys(editedCells).length})
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Feedback */}
      {feedback && (
        <div
          className={`
            mx-6 mt-4 p-4 rounded-xl border flex items-center gap-3 shadow
            ${feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : feedback.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-800'
              : 'bg-blue-50 border-blue-300 text-blue-800'}
          `}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : feedback.type === 'error' ? (
            <AlertCircle className="h-5 w-5" />
          ) : null}
          <span className="font-medium">{feedback.text}</span>
        </div>
      )}

      {/* Tabela + Paginação */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse min-w-max">
            <thead className="sticky top-0 z-20 bg-slate-100 shadow-sm">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className="px-5 py-3.5 text-left text-xs font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-200 border-b border-slate-200"
                    >
                      <div className="flex items-center gap-1.5">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <span className="text-indigo-500">
                          {{ asc: ' ↑', desc: ' ↓' }[header.column.getIsSorted()] || (
                            <Filter size={12} className="opacity-40" />
                          )}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>

            <tbody className="divide-y divide-slate-100">
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="h-64 text-center py-12">
                    <Search className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                    <p className="text-slate-500 italic">Nenhum registro encontrado.</p>
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`
                      ${row.index % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}
                      hover:bg-indigo-50/60 transition-colors duration-150
                    `}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-5 py-3 text-sm text-slate-700 border-r border-slate-100 last:border-0 whitespace-nowrap"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className="bg-white border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-sm text-slate-600">
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {[10, 25, 50, 100, 200].map((size) => (
                <option key={size} value={size}>
                  {size} linhas
                </option>
              ))}
            </select>

            <span>
              Mostrando <strong className="text-indigo-700">{table.getRowModel().rows.length}</strong> de{' '}
              {filteredData.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="p-2 rounded-lg border border-slate-300 hover:bg-slate-100 disabled:opacity-40 transition"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="px-4 py-2 bg-indigo-50 rounded-lg border border-indigo-100 text-sm font-medium">
              Página <span className="font-bold text-indigo-700">{table.getState().pagination.pageIndex + 1}</span> de{' '}
              {table.getPageCount()}
            </div>

            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="p-2 rounded-lg border border-slate-300 hover:bg-slate-100 disabled:opacity-40 transition"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}