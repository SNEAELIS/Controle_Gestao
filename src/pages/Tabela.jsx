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
  Filter
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../services/supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// UTILITÁRIOS DE FORMATAÇÃO (REGRAS SOLICITADAS)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Remove o sufixo ".0" que o banco de dados costuma retornar em campos numéricos
 */
const cleanDotZero = (val) => {
  if (val === null || val === undefined) return '';
  return String(val).replace(/\.0$/, '');
};

/**
 * Formata CNPJ removendo o .0 e aplicando a máscara 00.000.000/0000-00
 */
const formatCNPJ = (val) => {
  if (!val) return '—';
  const clean = cleanDotZero(val).replace(/\D/g, '');
  return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
};

/**
 * Formata valores para Moeda Brasileira (R$)
 */
const formatCurrency = (val) => {
  if (val === null || val === undefined || val === '') return '—';
  const n = Number(cleanDotZero(val));
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

/**
 * Formata data para o padrão DD-MM-AAAA conforme solicitado
 */
const formatDateBR = (val) => {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

// Opções para os menus suspensos
const SELECT_OPTIONS = {
  "CELEBRADO COM CLAUSULA SUSPENSIVA": ["SIM", "NÃO", "NÃO SE APLICA"],
  "PAD - CRONO": ["SIM", "NÃO", "PORTARIA 64/2025"],
  "PUBLICAÇÃO TRANSFEREGOV": ["SIM", "NÃO", "PROBLEMA", "NÃO SE APLICA"],
  "PARECER TRANSFEREGOV": ["SIM", "NÃO", "NÃO SE APLICA"],
  "AJUSTE": ["PENDENTE", "REALIZADO", "NÃO SE APLICA"],
  "TERMO DE REFERÊNCIA": ["Aguardando análise de custo", "Solicitar TR", "Em análise", "Solicitado ajuste", "Analisado", "Solicitado", "Não se aplica"],
  "CANCELAR EMPENHO": ["SIM", "NÃO", "SOLICITADO", "NÃO SE APLICA"],
  "REJEITAR NO TRANSFEREGOV": ["CONJUR", "REJEITAR", "FORMALIZAR", "REALIZADO", "NÃO SE APLICA"],
  "SOB LIMINAR": ["CONJUR", "REJEITAR", "FORMALIZAR", "NÃO SE APLICA"],
  "NECESSIDADE DE ADITIVO": ["SIM", "NÃO", "PENDENTE", "NÃO SE APLICA"],
  "INSTRUÇÃO PROCESSUAL": ["SIM", "NÃO", "PENDENTE"],
  "TRAMITADO PARA CGAP": ["CGC", "CGFP", "CGAP"],
  "EQUIPE": ["EQUIPE 6", "EQUIPE 7"],
  "TÉCNICO DE FORMALIZAÇÃO": ["THALITA", "SAMARA", "GLENDA", "HELLEN", "ALINE", "SUELHY", "JAQUELINE", "CLARISSA", "JÚLIO"],
  "PUBLICAÇÃO NO TRANSFEREGOV": ["THALITA", "SAMARA", "GLENDA", "HELLEN", "ALINE", "SUELHY", "JAQUELINE", "CLARISSA", "JÚLIO"],
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTES AUXILIARES
// ─────────────────────────────────────────────────────────────────────────────

const EditableSelect = ({ value, options, onChange, isEdited }) => {
  const getStyle = (val) => {
    if (['SIM', 'REALIZADO', 'ANALISADO', 'SIM'].includes(val)) return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (['NÃO', 'PENDENTE', 'PROBLEMA', 'REJEITAR'].includes(val)) return 'bg-rose-100 text-rose-800 border-rose-300';
    return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  };

  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full px-2 py-1.5 text-[11px] font-bold rounded border transition-all cursor-pointer shadow-sm
        ${isEdited ? 'ring-2 ring-amber-400 border-amber-500' : 'hover:bg-white'} 
        ${getStyle(value)}`}
    >
      <option value="" className="bg-white text-gray-900">Selecione...</option>
      {options.map(opt => <option key={opt} value={opt} className="bg-white text-gray-900">{opt}</option>)}
    </select>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL: TabelaGerencial
// ─────────────────────────────────────────────────────────────────────────────

export default function TabelaGerencial() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [editedCells, setEditedCells] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  // Função para carregar toda a base (Burlado o limite de 1000)
  const loadFullDatabase = useCallback(async () => {
    setLoading(true);
    try {
      let allRecords = [];
      let from = 0;
      const step = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: chunk, error } = await supabase
          .from('formalizacoes')
          .select('*')
          .order('id', { ascending: true })
          .range(from, from + step - 1);

        if (error) throw error;
        if (!chunk || chunk.length === 0) {
          hasMore = false;
        } else {
          allRecords = [...allRecords, ...chunk];
          from += step;
          if (chunk.length < step) hasMore = false;
        }
      }
      setData(allRecords);
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', text: 'Erro ao conectar com o Supabase.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFullDatabase(); }, [loadFullDatabase]);

  // Definição das colunas com tratamento de tipos
  const columns = useMemo(() => {
    if (data.length === 0) return [];
    
    // Filtra as colunas que não queremos exibir
    const ignore = ['id', 'vazia_1', 'vazia_2', 'Coluna1'];
    const keys = Object.keys(data[0]).filter(k => !ignore.includes(k));

    return keys.map((key) => ({
      accessorKey: key,
      header: key,
      size: 180,
      cell: ({ getValue, row }) => {
        const rawValue = getValue();
        const cellId = `${row.original.id}::${key}`;
        const editedValue = editedCells[cellId];
        const displayValue = editedValue !== undefined ? editedValue : rawValue;

        // Se for uma coluna de seleção
        if (SELECT_OPTIONS[key]) {
          return (
            <EditableSelect 
              value={displayValue} 
              options={SELECT_OPTIONS[key]} 
              onChange={(v) => setEditedCells(prev => ({ ...prev, [cellId]: v }))}
              isEdited={editedValue !== undefined}
            />
          );
        }

        // Regras específicas de exibição
        if (key === 'CNPJ') {
          return <span className="font-mono text-slate-500 text-xs">{formatCNPJ(displayValue)}</span>;
        }
        if (key === 'VALOR REPASSE') {
          return <span className="font-bold text-emerald-700">{formatCurrency(displayValue)}</span>;
        }
        if (['TÉRMINO DA VIGÊNCIA', 'CUSTO INICIADO EM', 'DATA DA PUBLICAÇÃO'].includes(key)) {
          return <span className="text-indigo-600 font-bold">{formatDateBR(displayValue)}</span>;
        }
        if (['ANO', 'Nº', 'EXECUÇÃO % EM CUSTOS'].includes(key)) {
          return <span className="font-mono font-bold text-slate-700">{cleanDotZero(displayValue)}{key.includes('%') ? '%' : ''}</span>;
        }

        return (
          <span className="text-slate-600 truncate block max-w-xs" title={String(displayValue)}>
            {cleanDotZero(displayValue) || '—'}
          </span>
        );
      }
    }));
  }, [data, editedCells]);

  // Filtro de pesquisa global
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const lowerSearch = searchTerm.toLowerCase();
    return data.filter(row => 
      Object.values(row).some(v => String(v).toLowerCase().includes(lowerSearch))
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

  // Função para salvar alterações no Supabase
  const handleBatchSave = async () => {
    if (Object.keys(editedCells).length === 0) return;
    setSaving(true);
    setFeedback({ type: 'info', text: 'Sincronizando alterações...' });

    try {
      const updates = {};
      Object.entries(editedCells).forEach(([cellKey, value]) => {
        const [id, field] = cellKey.split('::');
        if (!updates[id]) updates[id] = {};
        updates[id][field] = value;
      });

      const updatePromises = Object.entries(updates).map(([id, payload]) =>
        supabase.from('formalizacoes').update(payload).eq('id', id)
      );

      await Promise.all(updatePromises);
      setEditedCells({});
      setFeedback({ type: 'success', text: 'Base de dados atualizada com sucesso!' });
      setTimeout(() => setFeedback(null), 5000);
      loadFullDatabase();
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', text: 'Erro ao salvar. Verifique sua conexão.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-[#0f172a] text-white">
      <div className="relative mb-6">
        <div className="h-20 w-20 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
        <Database className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-400" size={30} />
      </div>
      <h2 className="text-2xl font-black italic tracking-tighter">CARREGANDO TABELA_GERENCIAL...</h2>
      <p className="text-indigo-300 animate-pulse mt-2 font-bold uppercase text-xs">Acessando 1.821 registros via Supabase</p>
    </div>
  );

  return (
    <div className="flex flex-col h-screen w-full bg-[#f8fafc]">
      {/* CABEÇALHO TOTALMENTE EXTENSO */}
      <header className="bg-[#1e293b] text-white shadow-2xl z-30">
        <div className="w-full px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/40">
              <Database className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter italic leading-none">TABELA_GERENCIAL</h1>
              <span className="text-[10px] text-indigo-300 font-black uppercase tracking-[0.3em]">Sistema de Gestão 2026</span>
            </div>
          </div>

          {/* Barra de Busca Central */}
          <div className="flex-1 max-w-2xl relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Pesquisar em todos os campos..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-2xl py-3 pl-12 pr-4 text-sm outline-none focus:ring-2 ring-indigo-500 transition-all text-white font-medium"
            />
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold text-xs transition-all">
              <ArrowLeft size={16} /> VOLTAR
            </button>
            <button 
              onClick={() => {
                const ws = XLSX.utils.json_to_sheet(data);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Geral');
                XLSX.writeFile(wb, 'Tabela_Gerencial_Completa_2026.xlsx');
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-xs transition-all shadow-lg shadow-emerald-900/20"
            >
              <Download size={16} /> EXCEL
            </button>
            {Object.keys(editedCells).length > 0 && (
              <button 
                onClick={handleBatchSave} 
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 text-amber-950 hover:bg-amber-400 rounded-xl font-black text-xs transition-all shadow-xl animate-pulse"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                SALVAR {Object.keys(editedCells).length} ALTERAÇÕES
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ÁREA DA TABELA: CANTO A CANTO */}
      <main className="flex-1 overflow-hidden flex flex-col w-full">
        {feedback && (
          <div className={`mx-6 mt-4 p-4 rounded-2xl border-2 flex items-center gap-4 animate-in slide-in-from-top-2 shadow-lg
            ${feedback.type === 'success' ? 'bg-emerald-50 border-emerald-400 text-emerald-900' : 'bg-rose-50 border-rose-400 text-rose-900'}`}>
            {feedback.type === 'success' ? <CheckCircle2 className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
            <span className="font-bold text-sm tracking-tight">{feedback.text}</span>
          </div>
        )}

        <div className="flex-1 mt-4 bg-white border-t border-slate-200 overflow-hidden flex flex-col w-full">
          {/* Scroll da Tabela */}
          <div className="flex-1 overflow-x-auto overflow-y-auto w-full">
            <table className="w-full border-collapse table-auto min-w-max">
              <thead className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                {table.getHeaderGroups().map(hg => (
                  <tr key={hg.id}>
                    {hg.headers.map(header => (
                      <th 
                        key={header.id} 
                        onClick={header.column.getToggleSortingHandler()}
                        className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 border-b border-slate-200 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <span className="text-indigo-500 font-bold">
                            {{ asc: ' ▲', desc: ' ▼' }[header.column.getIsSorted()] || <Filter size={10} className="opacity-20" />}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-slate-100">
                {table.getRowModel().rows.length > 0 ? (
                  table.getRowModel().rows.map(row => (
                    <tr key={row.id} className="hover:bg-indigo-50/40 transition-colors group">
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="px-6 py-3 text-[12px] text-slate-600 font-medium whitespace-nowrap border-r border-slate-50/50 last:border-0">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={columns.length} className="h-64 text-center">
                      <div className="flex flex-col items-center text-slate-400 italic">
                        <Search size={48} className="mb-2 opacity-20" />
                        Nenhum registro encontrado para sua pesquisa.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* RODAPÉ E PAGINAÇÃO MODERNA */}
          <footer className="bg-white border-t border-slate-200 px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Exibir</span>
                <select 
                  value={table.getState().pagination.pageSize}
                  onChange={e => table.setPageSize(Number(e.target.value))}
                  className="bg-slate-100 border-none rounded-lg px-3 py-1 text-xs font-bold text-slate-700 outline-none focus:ring-2 ring-indigo-500"
                >
                  {[10, 25, 50, 100].map(s => <option key={s} value={s}>{s} linhas</option>)}
                </select>
              </div>
              <div className="h-4 w-[1px] bg-slate-200"></div>
              <p className="text-[11px] font-bold text-slate-500">
                Mostrando <span className="text-indigo-600">{table.getRowModel().rows.length}</span> de {filteredData.length} registros
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => table.previousPage()} 
                disabled={!table.getCanPreviousPage()}
                className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 disabled:opacity-30 transition-all shadow-sm"
              >
                <ChevronLeft size={18} />
              </button>
              
              <div className="flex items-center bg-indigo-50 px-5 py-2 rounded-xl border border-indigo-100">
                <span className="text-xs font-black text-indigo-400 mr-2 uppercase">Página</span>
                <span className="text-sm font-black text-indigo-700">{table.getState().pagination.pageIndex + 1}</span>
                <span className="mx-2 text-indigo-300 font-bold">/</span>
                <span className="text-sm font-black text-indigo-700">{table.getPageCount()}</span>
              </div>

              <button 
                onClick={() => table.nextPage()} 
                disabled={!table.getCanNextPage()}
                className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 disabled:opacity-30 transition-all shadow-sm"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="hidden lg:block">
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Sincronizado com Supabase Cloud • 2026</span>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}