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
  Plus,
  Trash2,
  Info,
  AlertTriangle,
  RefreshCw,
  FileSpreadsheet,
  UploadCloud,
  Check,
  Zap
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../services/supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURAÇÕES DE COLUNAS
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
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export default function TabelaGerencial() {
  const navigate = useNavigate();
  
  // Estados de Dados
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [editedCells, setEditedCells] = useState({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [syncProgress, setSyncProgress] = useState(0);

  // Estados de Modais e Fluxos
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionStep, setActionStep] = useState('choice'); // choice, manual, mapping
  const [isDelModalOpen, setIsDelModalOpen] = useState(false);
  
  // Estados de Importação Excel
  const [excelRows, setExcelRows] = useState([]);
  const [excelCols, setExcelCols] = useState([]);
  const [selectedPropCol, setSelectedPropCol] = useState('');
  
  // Estados de Proposta e Exclusão
  const [newProposta, setNewProposta] = useState('');
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const fileInputRef = useRef(null);

  // 1. CARREGAMENTO RECURSIVO (BUSCA TUDO SEM LIMITE)
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setSyncProgress(0);
    try {
      let allRecords = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: chunk, error, count } = await supabase
          .from('formalizacoes')
          .select('*', { count: 'exact' })
          .order('id', { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) throw error;
        allRecords = [...allRecords, ...chunk];
        from += pageSize;
        if (chunk?.length < pageSize) hasMore = false;
        if (count) setSyncProgress(Math.round((allRecords.length / count) * 100));
      }
      setData(allRecords);
    } catch (err) {
      notify('error', 'Falha ao sincronizar com o banco.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  // 2. UTILITÁRIOS
  const notify = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const closeModals = () => {
    setIsActionModalOpen(false);
    setActionStep('choice');
    setIsDelModalOpen(false);
    setNewProposta('');
    setDeleteConfirmText('');
    setItemToDelete(null);
    setExcelRows([]);
    setSelectedPropCol('');
  };

  // 3. EXPORTAR EXCEL (CORRIGIDO)
  const handleExportExcel = () => {
    try {
      const exportData = table.getFilteredRowModel().rows.map(row => {
        const obj = { ...row.original };
        delete obj.id; // Remove IDs internos se necessário
        return obj;
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Dados_Gerenciais");
      XLSX.writeFile(wb, `MESP_Relatorio_${new Date().toISOString().slice(0,10)}.xlsx`);
      notify('success', 'Relatório gerado com sucesso!');
    } catch (err) {
      notify('error', 'Erro ao processar arquivo para exportação.');
    }
  };

  // 4. IMPORTAR EXCEL (CORRIGIDO)
  const onFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws);
        if (json.length > 0) {
          setExcelRows(json);
          setExcelCols(Object.keys(json[0]));
          setActionStep('mapping');
        } else {
          notify('error', 'Planilha vazia!');
        }
      } catch (err) { notify('error', 'Erro ao ler arquivo.'); }
    };
    reader.readAsBinaryString(file);
    e.target.value = null;
  };

  const bulkInsert = async () => {
    if (!selectedPropCol) return;
    setSaving(true);
    try {
      const payload = excelRows.map(row => {
        let val = String(row[selectedPropCol] || '').replace(/\D/g, '');
        if (val.length >= 10) return { PROPOSTA: val.slice(0, 6) + '/' + val.slice(6, 10), SITUACIONAL: 'FILA_ROBO' };
        return null;
      }).filter(Boolean);

      if (!payload.length) throw new Error("Nenhuma proposta válida XXXXXX/AAAA encontrada.");
      
      const { error } = await supabase.from('formalizacoes').insert(payload);
      if (error) throw error;
      notify('success', `${payload.length} propostas enviadas para o Robô!`);
      closeModals();
      fetchAllData();
    } catch (err) { notify('error', err.message); } finally { setSaving(false); }
  };

  // 5. INSERÇÃO E EXCLUSÃO (CORRIGIDAS)
  const handleManualInsert = async () => {
    if (newProposta.length < 11) {
      notify('error', 'Formato incompleto! Use 000000/0000');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('formalizacoes').insert([{ PROPOSTA: newProposta, SITUACIONAL: 'FILA_ROBO' }]);
      if (error) throw error;
      notify('success', 'Salvo com sucesso na fila do robô!');
      closeModals();
      fetchAllData();
    } catch (err) { notify('error', 'Erro ao salvar.'); } finally { setSaving(false); }
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirmText !== 'CONCORDO EM EXCLUIR') return;
    setSaving(true);
    try {
      const { error } = await supabase.from('formalizacoes').delete().eq('id', itemToDelete.id);
      if (error) throw error;
      notify('success', 'Registro removido permanentemente.');
      closeModals();
      fetchAllData();
    } catch (err) { notify('error', 'Erro na exclusão.'); } finally { setSaving(false); }
  };

  const handleSaveEdits = async () => {
    if (!Object.keys(editedCells).length) return;
    setSaving(true);
    try {
      const updates = {};
      Object.entries(editedCells).forEach(([key, val]) => {
        const [id, field] = key.split('::');
        if (!updates[id]) updates[id] = {};
        updates[id][field] = val;
      });
      await Promise.all(Object.entries(updates).map(([id, changes]) => supabase.from('formalizacoes').update(changes).eq('id', id)));
      setEditedCells({});
      notify('success', 'Células atualizadas no banco.');
      fetchAllData();
    } catch (err) { notify('error', 'Erro ao salvar edições.'); } finally { setSaving(false); }
  };

  // 6. COLUNAS
  const columns = useMemo(() => {
    if (!data.length) return [];
    return [
      {
        id: 'excluir_btn',
        header: '',
        cell: ({ row }) => (
          <button onClick={() => { setItemToDelete(row.original); setIsDelModalOpen(true); }} className="p-2 text-slate-300 hover:text-rose-600 transition-colors">
            <Trash2 size={16} />
          </button>
        ),
        size: 50
      },
      {
        accessorKey: 'PROPOSTA',
        header: 'PROPOSTA',
        cell: info => <span className="font-bold text-indigo-700">{info.getValue()}</span>,
        size: 150
      },
      ...Object.keys(data[0]).filter(k => !['id', 'created_at', 'PROPOSTA', 'vazia_1', 'vazia_2', 'SITUACIONAL', 'Coluna1'].includes(k))
      .map(key => ({
        accessorKey: key,
        header: () => <span className="text-[10px] font-black text-slate-500 uppercase">{key}</span>,
        cell: ({ getValue, row }) => {
          const raw = getValue();
          const cellId = `${row.original.id}::${key}`;
          const current = editedCells[cellId] !== undefined ? editedCells[cellId] : raw;
          if (EDITABLE_COLUMNS.has(key) && SELECT_OPTIONS[key]) {
            return (
              <select 
                value={current ?? ''} onChange={e => setEditedCells(p => ({...p, [cellId]: e.target.value}))}
                className={`w-full h-10 px-3 text-xs font-bold border-none outline-none bg-transparent cursor-pointer ${editedCells[cellId] !== undefined ? 'bg-amber-100 ring-2 ring-amber-500 rounded' : ''}`}
              >
                <option value="">—</option>
                {SELECT_OPTIONS[key].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            );
          }
          return <div className="px-5 py-4 text-xs text-slate-600 truncate max-w-[300px]">{current || '—'}</div>;
        },
        size: 200
      }))
    ];
  }, [data, editedCells]);

  const table = useReactTable({
    data, columns, state: { globalFilter }, onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(), getSortedRowModel: getSortedRowModel(),
  });

  if (loading && !data.length) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-900 text-white">
        <Zap className="animate-pulse text-indigo-500 mb-4" size={56} />
        <p className="font-black text-xs uppercase tracking-widest">Sincronizando MESP... {syncProgress}%</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden font-sans">
      
      {/* CABEÇALHO */}
      <header className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0 shadow-2xl z-50 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg">
            <Database size={24} />
          </div>
          <h1 className="text-xl font-black uppercase tracking-tighter">Gerencial <span className="text-indigo-400">MESP</span></h1>
        </div>

        <div className="flex-1 max-w-xl px-12 relative">
          <Search className="absolute left-16 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input 
            value={globalFilter} onChange={e => setGlobalFilter(e.target.value)}
            placeholder="Pesquisar propostas ou técnicos..."
            className="w-full bg-slate-800 border-none rounded-xl pl-12 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => setIsActionModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 px-5 py-3 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg active:scale-95 transition-all">
            <Plus size={18} /> Nova Proposta
          </button>
          
          <button onClick={handleExportExcel} className="bg-slate-800 hover:bg-slate-700 px-4 py-3 rounded-2xl font-bold text-xs border border-slate-700 flex items-center gap-2">
            <Download size={16} /> Excel
          </button>

          {!!Object.keys(editedCells).length && (
            <button onClick={handleSaveEdits} className="bg-amber-500 text-slate-900 px-6 py-3 rounded-2xl font-black text-xs animate-bounce flex items-center gap-2 shadow-xl">
              <Save size={16} /> Salvar ({Object.keys(editedCells).length})
            </button>
          )}

          <div className="h-8 w-[1px] bg-slate-700 mx-1" />
          <button onClick={() => fetchAllData()} className="p-3 bg-slate-800 rounded-xl hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"><RefreshCw size={18} /></button>
          <button onClick={() => navigate(-1)} className="p-3 bg-slate-800 rounded-xl hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"><ArrowLeft size={18} /></button>
        </div>
      </header>

      {/* GRADE ZEBRA */}
      <main className="flex-1 overflow-auto bg-slate-200 p-2 scrollbar-thin scrollbar-thumb-slate-400">
        <div className="bg-white rounded border border-slate-300 min-w-max shadow-sm">
          <table className="w-full border-separate border-spacing-0">
            <thead className="sticky top-0 z-40 bg-slate-50 shadow-sm">
              {table.getHeaderGroups().map(hg => (
                <tr key={hg.id}>
                  {hg.headers.map(header => (
                    <th key={header.id} className="border-b border-r border-slate-300 px-5 py-4 text-left hover:bg-slate-200 transition-colors">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row, idx) => (
                <tr key={row.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'} hover:bg-indigo-50 transition-colors`}>
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="border-b border-r border-slate-100 h-14">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-300 px-6 py-3 flex items-center justify-between text-[11px] font-bold text-slate-500 shrink-0">
        <div className="flex items-center gap-6">
          <span className="bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">Sincronizados: {data.length}</span>
          <div className="flex items-center gap-2">
            Mostrar:
            <select value={table.getState().pagination.pageSize} onChange={e => table.setPageSize(Number(e.target.value))} className="bg-slate-50 border rounded-lg px-2 py-1 outline-none">
              {[100, 500, 1000].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-4 text-indigo-600">
          <button disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()} className="p-2 border rounded-lg hover:bg-slate-50 disabled:opacity-20 transition-all"><ChevronLeft size={16}/></button>
          <span className="font-black px-4 uppercase tracking-widest">Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}</span>
          <button disabled={!table.getCanNextPage()} onClick={() => table.nextPage()} className="p-2 border rounded-lg hover:bg-slate-50 disabled:opacity-20 transition-all"><ChevronRight size={16}/></button>
        </div>
      </footer>

      {/* MODAL MESTRE: ADICIONAR / IMPORTAR */}
      {isActionModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200">
            <div className="px-10 py-8 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-black text-xl tracking-tighter uppercase">Nova Inserção Ministerial</h3>
              <button onClick={closeModals} className="p-2 hover:bg-slate-800 rounded-full transition-colors"><X size={24}/></button>
            </div>
            
            <div className="p-10">
              {actionStep === 'choice' ? (
                <div className="grid grid-cols-2 gap-6">
                  <button onClick={() => setActionStep('manual')} className="flex flex-col items-center gap-5 p-10 rounded-[2rem] border-2 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50 transition-all group active:scale-95 shadow-sm">
                    <div className="bg-indigo-100 p-5 rounded-full group-hover:bg-indigo-600 group-hover:text-white transition-colors"><Zap size={40}/></div>
                    <span className="font-black text-[10px] uppercase tracking-widest text-slate-500 text-center">Inserção Manual Unitária</span>
                  </button>
                  <button onClick={() => fileInputRef.current.click()} className="flex flex-col items-center gap-5 p-10 rounded-[2rem] border-2 border-slate-100 hover:border-emerald-500 hover:bg-emerald-50 transition-all group active:scale-95 shadow-sm">
                    <input type="file" ref={fileInputRef} onChange={onFileSelect} accept=".xlsx,.xls" className="hidden" />
                    <div className="bg-emerald-100 p-5 rounded-full group-hover:bg-emerald-600 group-hover:text-white transition-colors"><FileSpreadsheet size={40}/></div>
                    <span className="font-black text-[10px] uppercase tracking-widest text-slate-500 text-center">Importar Planilha Excel</span>
                  </button>
                </div>
              ) : actionStep === 'manual' ? (
                <div className="space-y-8">
                  <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 flex gap-4 text-xs text-blue-700 italic">
                    <Info size={24} className="shrink-0 text-blue-500" />
                    <span>O <strong>robô MESP</strong> buscará todos os dados do TransfereGov automaticamente. Use o formato: XXXXXX/AAAA.</span>
                  </div>
                  <input 
                    autoFocus value={newProposta} 
                    onChange={e => {
                      let v = e.target.value.replace(/\D/g, '');
                      if (v.length > 6) v = v.slice(0, 6) + '/' + v.slice(6, 10);
                      setNewProposta(v);
                    }}
                    placeholder="000000/2026" className="w-full px-8 py-6 bg-slate-50 border-2 border-slate-100 rounded-3xl text-4xl font-mono text-center tracking-[0.2em] focus:border-indigo-500 outline-none shadow-inner" 
                  />
                  <div className="flex justify-end gap-4 pt-4">
                    <button onClick={() => setActionStep('choice')} className="px-8 py-4 font-bold text-slate-400 hover:text-slate-600">VOLTAR</button>
                    <button onClick={handleManualInsert} disabled={saving || newProposta.length < 11} className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-200 active:scale-95 transition-all">SALVAR AGORA</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 flex gap-4 text-xs text-emerald-800 leading-relaxed italic shadow-sm">
                    <FileSearch size={28} className="shrink-0 text-emerald-500" />
                    <span>Arquivo carregado! Encontramos <strong>{excelRows.length} linhas</strong>. Selecione a coluna que contém o número da <strong>PROPOSTA</strong>.</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-2 scrollbar-thin p-1">
                    {excelCols.map(c => (
                      <button 
                        key={c} onClick={() => setSelectedPropCol(c)}
                        className={`px-5 py-4 rounded-2xl border-2 text-xs font-black truncate transition-all flex items-center justify-between ${selectedPropCol === c ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-md ring-2 ring-emerald-500/20' : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200'}`}
                      >
                        {c} {selectedPropCol === c && <Check size={18} />}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-end gap-4 pt-6 border-t border-slate-100">
                    <button onClick={() => setActionStep('choice')} className="px-8 py-4 font-bold text-slate-400">VOLTAR</button>
                    <button onClick={bulkInsert} disabled={!selectedPropCol || saving} className="px-12 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-200 flex items-center gap-3 active:scale-95 transition-all">
                      {saving ? <Loader2 className="animate-spin" /> : <UploadCloud size={18} />} DESCARREGAR LOTE
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EXCLUSÃO DE SEGURANÇA */}
      {isDelModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl border-t-8 border-rose-500 overflow-hidden">
            <div className="p-10 text-center space-y-6">
              <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto shadow-inner"><AlertTriangle size={40} /></div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tighter uppercase leading-none px-4">Confirma Exclusão?</h3>
              <p className="text-xs text-slate-500 leading-relaxed italic px-8">A proposta <strong>{itemToDelete?.PROPOSTA}</strong> será eliminada permanentemente. Esta ação não tem volta.</p>
              
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 shadow-inner">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">Digite a frase de segurança:</p>
                <p className="text-rose-600 font-black mb-5 text-[10px] select-none tracking-[0.3em] uppercase underline decoration-2 underline-offset-4">CONCORDO EM EXCLUIR</p>
                <input 
                  value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value.toUpperCase())} 
                  className="w-full px-5 py-4 border-2 border-slate-200 rounded-2xl text-center font-bold focus:border-rose-500 outline-none transition-all uppercase text-xs tracking-widest shadow-sm" 
                  placeholder="CONFIRMAR..." 
                />
              </div>
            </div>
            <div className="px-10 py-6 bg-slate-50 flex justify-end gap-4 border-t">
              <button onClick={closeModals} className="px-6 py-3 font-bold text-slate-400 hover:text-slate-600 uppercase text-[10px] tracking-widest">CANCELAR</button>
              <button onClick={handleConfirmDelete} disabled={deleteConfirmText !== 'CONCORDO EM EXCLUIR' || saving} className="px-12 py-4 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-rose-200 disabled:opacity-30 transition-all hover:bg-rose-700">EXCLUIR AGORA</button>
            </div>
          </div>
        </div>
      )}

      {/* NOTIFICAÇÃO FLUTUANTE */}
      {message && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] px-10 py-5 rounded-[2rem] shadow-2xl flex items-center gap-5 text-white animate-in slide-in-from-bottom duration-300
          ${message.type === 'success' ? 'bg-emerald-600 shadow-emerald-500/20' : 'bg-rose-600 shadow-rose-500/20'}`}>
          {message.type === 'success' ? <CheckCircle2 size={24} className="animate-bounce" /> : <AlertCircle size={24} className="animate-pulse" />}
          <span className="font-black uppercase tracking-widest text-[11px] shadow-sm">{message.text}</span>
        </div>
      )}

    </div>
  );
}