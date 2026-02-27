// src/pages/Dashboard.jsx
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Database, DollarSign, MapPin, Search,
  ChevronLeft, ChevronRight, BarChart3, PieChart as PieIcon,
  Filter, X, Table as TableIcon, Download, AlertCircle, 
  TrendingUp, Activity, FileText, Globe, MousePointer2,
  ShieldCheck, RefreshCw, Layers, ExternalLink, Info,
  Box, Target, Zap, Maximize2, ChevronUp, ChevronDown,
  Calendar, Briefcase, List
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { scaleLinear } from 'd3-scale';
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  getPaginationRowModel, flexRender
} from '@tanstack/react-table';
import * as XLSX from 'xlsx';
import { supabase } from '../services/supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURAÇÕES GLOBAIS - SNEAELIS BI ENGINE 2026
// ─────────────────────────────────────────────────────────────────────────────

const geoUrl = "https://raw.githubusercontent.com/giuliano-macedo/geodata-br-states/main/geojson/br_states.json";

const SNEAELIS_THEME = {
  primary: '#0f172a',
  accent: '#3b82f6',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#ef4444',
  slate: '#64748b'
};

const CHART_PALETTE = ['#3b82f6', '#10b981', '#6366f1', '#f59e0b', '#06b6d4', '#ec4899', '#f43f5e', '#8b5cf6'];

// ─────────────────────────────────────────────────────────────────────────────
// MINI-COMPONENTES DE UI (KPIs EM MINIATURA)
// ─────────────────────────────────────────────────────────────────────────────

const MiniKpiCard = ({ icon: Icon, title, value, color, onClick, active }) => (
  <div 
    onClick={onClick}
    className={`relative group bg-white rounded-2xl p-4 shadow-sm border transition-all duration-300 cursor-pointer flex items-center gap-4
      ${active ? 'border-blue-500 ring-4 ring-blue-50 shadow-md' : 'border-slate-100 hover:border-blue-200 hover:shadow-lg'}`}
  >
    <div className={`p-2.5 rounded-xl bg-${color}-50 text-${color}-600 shadow-sm`}>
      <Icon size={20} />
    </div>
    <div className="min-w-0">
      <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest leading-none mb-1">{title}</p>
      <h3 className="text-base font-black text-slate-800 tracking-tighter truncate">{value}</h3>
    </div>
    {active && <div className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-blue-500 animate-ping" />}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardSneaElis() {
  const navigate = useNavigate();
  
  // ─── ESTADOS DE DADOS ───
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // ─── ESTADOS DE FILTRAGEM DINÂMICA ───
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUf, setSelectedUf] = useState(null);
  const [selectedSituacao, setSelectedSituacao] = useState(null);
  const [selectedAno, setSelectedAno] = useState(null);
  const [mapTooltip, setMapTooltip] = useState({ content: '', visible: false });

  // ─── CARREGAMENTO DE DADOS (PAGINAÇÃO SUPABASE) ───
  const loadMasterData = useCallback(async () => {
    setLoading(true);
    let allRecords = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    try {
      while (hasMore) {
        const { data: chunk, error } = await supabase
          .from('formalizacoes')
          .select('*')
          .order('id', { ascending: true })
          .range(from, from + step - 1);

        if (error) throw error;
        if (!chunk?.length) { hasMore = false; } 
        else {
          allRecords = [...allRecords, ...chunk];
          from += step;
          if (chunk.length < step) hasMore = false;
        }
      }

      const normalized = allRecords.map(row => {
        const rawValor = row["VALOR REPASSE"] || 0;
        return {
          ...row,
          valor: typeof rawValor === 'string' ? parseFloat(rawValor.replace('.0', '')) : rawValor,
          situacao: (row.SITUACIONAL || row["SITUACIONAL "] || 'Pendente').trim(),
          uf: String(row.UF || 'N/A').toUpperCase().trim().replace('.0', ''),
          ano: String(row.ANO || 'S/A').replace('.0', ''),
          processo: String(row.PROCESSO || '—').replace('.0', ''),
          entidade: (row.ENTIDADE || 'Desconhecida').toUpperCase()
        };
      });
      setRawData(normalized);
    } catch (err) { console.error("BI Load Error:", err); } 
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadMasterData(); }, [loadMasterData]);

  // ─── ENGINE DE FILTRAGEM CRUZADA ───
  const filteredData = useMemo(() => {
    return rawData.filter(row => {
      const matchSearch = !searchTerm || Object.values(row).some(v => String(v).toLowerCase().includes(searchTerm.toLowerCase()));
      const matchUf = !selectedUf || row.uf === selectedUf;
      const matchSit = !selectedSituacao || row.situacao === selectedSituacao;
      const matchAno = !selectedAno || row.ano === selectedAno;
      return matchSearch && matchUf && matchSit && matchAno;
    });
  }, [rawData, searchTerm, selectedUf, selectedSituacao, selectedAno]);

  // ─── CÁLCULO DE ESTATÍSTICAS (RESOLVENDO ERRO ReferenceError: stats is not defined) ───
  const dashboardStats = useMemo(() => {
    const totalFinanceiro = filteredData.reduce((acc, c) => acc + c.valor, 0);
    const count = filteredData.length;
    
    const ufMap = filteredData.reduce((acc, r) => { acc[r.uf] = (acc[r.uf] || 0) + 1; return acc; }, {});
    const sitMap = filteredData.reduce((acc, r) => { acc[r.situacao] = (acc[r.situacao] || 0) + 1; return acc; }, {});
    const anoMap = filteredData.reduce((acc, r) => { acc[r.ano] = (acc[r.ano] || 0) + r.valor; return acc; }, {});

    const concluidas = filteredData.filter(r => ['SIM', 'CONCLUÍDO', 'REALIZADO', 'ASSINADO'].includes(r.situacao?.toUpperCase())).length;

    return {
      totalFinanceiro,
      count,
      ticketMedio: count > 0 ? totalFinanceiro / count : 0,
      concluidas,
      percEficiencia: count > 0 ? (concluidas / count * 100).toFixed(1) : 0,
      rankingUf: Object.entries(ufMap).map(([uf, qtd]) => ({ uf, qtd })).sort((a,b) => b.qtd - a.qtd),
      distSituacao: Object.entries(sitMap).map(([name, value]) => ({ name, value })),
      tendenciaAnual: Object.entries(anoMap).map(([ano, valor]) => ({ ano, valor })).sort((a,b) => a.ano - b.ano),
      maxUfValue: Math.max(...Object.values(ufMap), 0),
      filtrosAno: [...new Set(rawData.map(r => r.ano))].sort(),
      filtrosSit: [...new Set(rawData.map(r => r.situacao))].sort()
    };
  }, [filteredData, rawData]);

  const mapScale = scaleLinear().domain([0, dashboardStats.maxUfValue || 1]).range(["#f0f9ff", "#2563eb"]);

  // ─── CONFIGURAÇÃO DA TABELA DRILL-DOWN ───
  const columns = useMemo(() => [
    { accessorKey: 'processo', header: 'Processo' },
    { accessorKey: 'entidade', header: 'Entidade', cell: i => <div className="max-w-[180px] truncate font-bold text-slate-800 text-[10px]">{i.getValue()}</div> },
    { accessorKey: 'uf', header: 'UF', cell: i => <span className="font-black text-blue-600 text-[11px]">{i.getValue()}</span> },
    { 
      accessorKey: 'valor', 
      header: 'Repasse', 
      cell: i => <span className="font-black text-emerald-600 text-[11px]">
        {i.getValue().toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </span> 
    },
    { 
      accessorKey: 'situacao', 
      header: 'Status',
      cell: i => (
        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter border ${['SIM', 'CONCLUÍDO'].includes(i.getValue()?.toUpperCase()) ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
          {i.getValue()}
        </span>
      )
    }
  ], []);

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 8 } }
  });

  const resetBI = () => { setSearchTerm(''); setSelectedUf(null); setSelectedSituacao(null); setSelectedAno(null); };

  if (loading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-[#0f172a]">
      <div className="relative">
        <div className="h-32 w-32 rounded-full border-[8px] border-blue-500/10 border-t-blue-500 animate-spin" />
        <Database className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-400" size={40} />
      </div>
      <h2 className="text-white font-black text-2xl italic tracking-tighter mt-8 animate-pulse uppercase">SNEAELIS HUB 2026</h2>
    </div>
  );

  return (
    <div className="h-screen bg-[#f8fafc] flex w-full font-sans text-slate-900 overflow-hidden select-none">
      
      {/* SIDEBAR COMPACTA */}
      <aside className="w-20 lg:w-64 bg-slate-950 flex flex-col z-[100] shadow-2xl overflow-hidden shrink-0">
        <div className="p-6 border-b border-white/5 flex items-center gap-3">
          <div className="bg-blue-600 p-2.5 rounded-2xl shadow-xl shadow-blue-500/30 shrink-0">
            <Layers className="text-white" size={24} />
          </div>
          <div className="hidden lg:block min-w-0">
            <h1 className="text-white font-black text-xl italic leading-none truncate">SNEAELIS</h1>
            <p className="text-[8px] text-slate-500 font-black uppercase tracking-[0.3em] mt-1">BI Engine</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button className="w-full flex items-center gap-4 p-3 rounded-xl bg-blue-600/10 text-blue-500 font-black border border-blue-500/20">
            <Activity size={18} /> <span className="hidden lg:block text-[11px] uppercase tracking-widest">Painel BI</span>
          </button>
          <button onClick={() => navigate('/tabela')} className="w-full flex items-center gap-4 p-3 rounded-xl text-slate-400 hover:bg-white/5 transition-all font-bold">
            <TableIcon size={18} /> <span className="hidden lg:block text-[11px] uppercase tracking-widest">Gerencial</span>
          </button>
          <button onClick={() => window.location.reload()} className="w-full flex items-center gap-4 p-3 rounded-xl text-slate-400 hover:bg-white/5 transition-all font-bold">
            <RefreshCw size={18} /> <span className="hidden lg:block text-[11px] uppercase tracking-widest">Sincronizar</span>
          </button>
        </nav>

        <div className="p-6 border-t border-white/5 opacity-40">
          <div className="hidden lg:block text-[9px] text-slate-500 font-black uppercase leading-relaxed">
            SNEAELIS v4.9 • 2026<br />
            Supabase Cloud Cluster
          </div>
        </div>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto custom-scrollbar">
        
        {/* HEADER DE FILTROS MINIMALISTA */}
        <header className="bg-white/70 backdrop-blur-3xl border-b border-slate-200 p-4 sticky top-0 z-[90] flex flex-col lg:flex-row items-center justify-between gap-4 shadow-sm shrink-0">
          <div className="flex-1 w-full max-w-2xl relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600" size={18} />
            <input 
              type="text" 
              placeholder="Pesquisar registros..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-100/50 border border-transparent rounded-xl py-2.5 pl-12 pr-6 text-xs font-bold outline-none focus:bg-white focus:border-blue-500/20 transition-all"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl shadow-xl">
              <select className="bg-transparent text-[9px] font-black uppercase px-3 py-2 outline-none text-white cursor-pointer" value={selectedAno || ''} onChange={e => setSelectedAno(e.target.value || null)}>
                <option value="" className="text-black">Anos</option>
                {dashboardStats.filtrosAno.map(a => <option key={a} value={a} className="text-black">{a}</option>)}
              </select>
              <div className="h-4 w-[1px] bg-white/20" />
              <select className="bg-transparent text-[9px] font-black uppercase px-3 py-2 outline-none text-white cursor-pointer" value={selectedSituacao || ''} onChange={e => setSelectedSituacao(e.target.value || null)}>
                <option value="" className="text-black">Status</option>
                {dashboardStats.filtrosSit.map(s => <option key={s} value={s} className="text-black">{s}</option>)}
              </select>
            </div>

            <button onClick={resetBI} className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-all shadow-sm">
              <X size={16} />
            </button>
            <button onClick={() => {
              const ws = XLSX.utils.json_to_sheet(filteredData);
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "SNEAELIS_DATA");
              XLSX.writeFile(wb, "Relatorio_SNEAELIS_2026.xlsx");
            }} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-black text-[9px] uppercase hover:bg-emerald-700 shadow-xl transition-all">
              <FileText size={16} /> Exportar
            </button>
          </div>
        </header>

        {/* CONTAINER DINÂMICO */}
        <div className="p-6 space-y-6">
          
          {/* SEÇÃO 1: KPIs EM MINIATURA (Ocupam menos espaço vertical) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MiniKpiCard icon={DollarSign} title="Volume Repasse" value={dashboardStats.totalFinanceiro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })} color="emerald" />
            <MiniKpiCard icon={Box} title="Total Propostas" value={dashboardStats.count} color="blue" />
            <MiniKpiCard icon={Target} title="Indice Entrega" value={`${dashboardStats.percEficiencia}%`} color="indigo" />
            <MiniKpiCard icon={MapPin} title="Abrangência" value={dashboardStats.rankingUf.length} color="amber" active={!!selectedUf} onClick={() => setSelectedUf(null)} />
          </div>

          {/* SEÇÃO 2: MAPA E RANKING (CALIBRADOS) */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            
            {/* MAPA - PROPORÇÃO 7/12 */}
            <div className="xl:col-span-7 bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100 flex flex-col h-[460px] relative overflow-hidden group">
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div>
                  <h3 className="text-base font-black text-slate-800 tracking-tighter italic uppercase leading-none">Geolocalização</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Interatividade Regional</p>
                </div>
                {selectedUf && (
                  <div className="bg-blue-600 text-white px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2 animate-in zoom-in">
                    <MapPin size={10} /> {selectedUf}
                  </div>
                )}
              </div>

              <div className="flex-1 bg-slate-50/50 rounded-3xl overflow-hidden relative border border-slate-100 shadow-inner">
                <ComposableMap 
                  projection="geoMercator" 
                  projectionConfig={{ scale: 880, center: [-54, -15] }} 
                  style={{ width: "100%", height: "100%" }}
                >
                  <Geographies geography={geoUrl}>
                    {({ geographies }) => geographies.map(geo => {
                      const sigla = geo.properties.sigla || geo.properties.UF || geo.id;
                      const ufData = dashboardStats.rankingUf.find(u => u.uf === sigla);
                      const isSelected = selectedUf === sigla;

                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill={isSelected ? '#1e40af' : (ufData ? mapScale(ufData.qtd) : "#f8fafc")}
                          stroke={isSelected ? "#fff" : "#cbd5e1"}
                          strokeWidth={isSelected ? 3 : 0.6}
                          onMouseEnter={() => setMapTooltip({ content: `${sigla}: ${ufData?.qtd || 0} Registros`, visible: true })}
                          onMouseLeave={() => setMapTooltip({ content: '', visible: false })}
                          onClick={() => setSelectedUf(selectedUf === sigla ? null : sigla)}
                          style={{
                            default: { outline: "none", transition: "all 300ms ease" },
                            hover: { fill: "#3b82f6", cursor: "pointer", outline: "none" },
                            pressed: { fill: "#1e3a8a", outline: "none" }
                          }}
                        />
                      );
                    })}
                  </Geographies>
                </ComposableMap>

                {mapTooltip.visible && (
                  <div className="absolute top-4 right-4 bg-slate-900/90 backdrop-blur-md text-white px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-2xl border border-white/10">
                    <Database size={12} className="inline mr-2 text-blue-400" /> {mapTooltip.content}
                  </div>
                )}
              </div>
            </div>

            {/* RANKING - PROPORÇÃO 5/12 */}
            <div className="xl:col-span-5 bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100 flex flex-col h-[460px]">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                <Activity size={16} className="text-blue-600" /> Performance Regional
              </h3>
              <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                {dashboardStats.rankingUf.slice(0, 15).map((u, i) => (
                  <div 
                    key={u.uf} 
                    onClick={() => setSelectedUf(selectedUf === u.uf ? null : u.uf)} 
                    className={`group flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all duration-300
                      ${selectedUf === u.uf ? 'bg-slate-900 text-white shadow-xl scale-102' : 'hover:bg-slate-50 border border-transparent hover:border-slate-200'}`}
                  >
                    <span className={`text-[10px] font-black w-6 ${selectedUf === u.uf ? 'text-blue-400' : 'text-slate-300'}`}>0{i+1}</span>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs transition-all
                      ${selectedUf === u.uf ? 'bg-blue-600' : 'bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-600'}`}>
                      {u.uf}
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <div className="flex justify-between items-end">
                        <span className="text-[9px] font-black uppercase tracking-tighter opacity-50">Volume</span>
                        <span className="text-sm font-black">{u.qtd}</span>
                      </div>
                      <div className={`h-1.5 rounded-full ${selectedUf === u.uf ? 'bg-white/10' : 'bg-slate-100 shadow-inner'}`}>
                        <div className={`h-full rounded-full transition-all duration-1000 ${selectedUf === u.uf ? 'bg-blue-400' : 'bg-blue-600'}`} style={{ width: `${(u.qtd / dashboardStats.maxUfValue) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SEÇÃO 3: GRÁFICOS E TABELA DINÂMICA */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-20">
            
            {/* PIE CHART - 4/12 */}
            <div className="lg:col-span-4 bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100 h-[480px] flex flex-col group">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8">Status Processual</h3>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={dashboardStats.distSituacao} 
                      cx="50%" cy="50%" 
                      innerRadius={70} outerRadius={95} 
                      paddingAngle={8} 
                      dataKey="value" 
                      onClick={(d) => setSelectedSituacao(selectedSituacao === d.name ? null : d.name)}
                    >
                      {dashboardStats.distSituacao.map((e, idx) => (
                        <Cell 
                          key={idx} 
                          fill={CHART_PALETTE[idx % CHART_PALETTE.length]} 
                          strokeWidth={selectedSituacao === e.name ? 8 : 0} 
                          stroke="#1e40af" 
                          cursor="pointer" 
                          className="outline-none transition-all duration-500 hover:scale-105" 
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', fontWeight: '900', fontSize: '10px' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px', paddingTop: '20px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* TABELA - 8/12 */}
            <div className="lg:col-span-8 bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col h-[480px]">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white rounded-xl shadow-sm text-blue-600"><List size={18} /></div>
                  <h3 className="text-base font-black text-slate-800 tracking-tighter italic">REGISTROS SINCRONIZADOS</h3>
                </div>
                <div className="flex items-center gap-2">
                   {selectedUf && <span className="bg-blue-600 text-white text-[8px] font-black px-2 py-1 rounded-lg">UF: {selectedUf}</span>}
                </div>
              </div>
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                    {table.getHeaderGroups().map(hg => (
                      <tr key={hg.id}>
                        {hg.headers.map(header => (
                          <th key={header.id} className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-blue-600" onClick={header.column.getToggleSortingHandler()}>
                            <div className="flex items-center gap-2">
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              <Maximize2 size={10} className="opacity-20" />
                            </div>
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {table.getRowModel().rows.length > 0 ? (
                      table.getRowModel().rows.map(row => (
                        <tr key={row.id} className="hover:bg-blue-50/50 transition-all group">
                          {row.getVisibleCells().map(cell => (
                            <td key={cell.id} className="px-6 py-4 text-[11px] text-slate-600 font-bold leading-tight truncate">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={columns.length} className="h-64 text-center text-slate-300 font-black italic">Sem resultados para os filtros</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <footer className="p-6 bg-slate-50 border-t flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                  <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="p-2.5 bg-white rounded-xl border border-slate-200 disabled:opacity-20"><ChevronLeft size={16} /></button>
                  <span className="text-[10px] font-black uppercase">Pág. <span className="text-blue-600">{table.getState().pagination.pageIndex + 1}</span> de {table.getPageCount() || 1}</span>
                  <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="p-2.5 bg-white rounded-xl border border-slate-200 disabled:opacity-20"><ChevronRight size={16} /></button>
                </div>
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">SNEAELIS • SINCRONIZADO v4.9</div>
              </footer>
            </div>
          </div>
        </div>

        {/* FOOTER MASTER 2026 */}
        <footer className="relative mt-auto overflow-hidden bg-[#020617] border-t border-white/5 p-12 lg:p-16">
          {/* Efeito de iluminação de fundo */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-blue-600/10 blur-[120px] rounded-full" />

          <div className="relative z-10 max-w-7xl mx-auto">
            <div className="flex flex-col items-center gap-8">
              
              {/* Grid de Status e Segurança */}
              <div className="flex flex-wrap justify-center gap-x-12 gap-y-4">
                <div className="flex items-center gap-2">
                  <div className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizado via Supabase</span>
                </div>

                <div className="flex items-center gap-2 border-x border-white/10 px-12">
                  <ShieldCheck size={14} className="text-blue-500" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocolo de Segurança AES-256</span>
                </div>

                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-amber-500" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Uptime 99.9%</span>
                </div>
              </div>

              {/* Marca Principal */}
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-3 opacity-80 group cursor-default">
                  <div className="h-px w-8 bg-slate-700 group-hover:w-12 transition-all" />
                  <h2 className="text-white font-black text-xs tracking-[0.5em] uppercase">
                    SneaElis <span className="text-blue-500 italic">Intelligence</span>
                  </h2>
                  <div className="h-px w-8 bg-slate-700 group-hover:w-12 transition-all" />
                </div>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.3em]">
                  Plataforma de Governança de Dados • Versão 4.9.2 Build 2026
                </p>
              </div>

              {/* Copyright e Legal */}
              <div className="pt-8 border-t border-white/5 w-full flex flex-col md:flex-row justify-between items-center gap-4">
                <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">
                  © 2026 SneaElis. Todos os direitos reservados.
                </span>
                <div className="flex gap-6">
                  <a href="#" className="text-[9px] text-slate-500 hover:text-blue-400 transition-colors font-bold uppercase tracking-widest">Termos de Uso</a>
                  <a href="#" className="text-[9px] text-slate-500 hover:text-blue-400 transition-colors font-bold uppercase tracking-widest">Privacidade</a>
                  <a href="#" className="text-[9px] text-slate-500 hover:text-blue-400 transition-colors font-bold uppercase tracking-widest">Suporte Técnico</a>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}