// src/pages/Dashboard.jsx
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Database, DollarSign, MapPin, Search,
  ChevronLeft, ChevronRight, BarChart3, PieChart as PieIcon,
  Filter, X, Table as TableIcon, Download, AlertCircle, 
  TrendingUp, Activity, FileText, Globe, MousePointer2,
  ShieldCheck, RefreshCw, Layers, ExternalLink, Info,
  Box, Target, Zap, Maximize2, List, Settings, Lock, CloudSync,
  TrendingDown, Layout, User, Bell
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area, LineChart, Line
} from 'recharts';
import { geoPath, geoMercator } from 'd3-geo';
import { scaleLinear } from 'd3-scale';
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  getPaginationRowModel, flexRender
} from '@tanstack/react-table';
import * as XLSX from 'xlsx';
import { supabase } from '../services/supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURAÇÕES GLOBAIS DE ENGINE E DESIGN
// ─────────────────────────────────────────────────────────────────────────────

const GEO_JSON_BR = "https://raw.githubusercontent.com/giuliano-macedo/geodata-br-states/main/geojson/br_states.json";

const SNEAELIS_UI = {
  bg: '#f8fafc',
  sidebar: '#020617',
  accent: '#2563eb',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  palette: ['#3b82f6', '#10b981', '#6366f1', '#f59e0b', '#06b6d4', '#ec4899', '#f43f5e', '#8b5cf6']
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTES DE UI MODULARES
// ─────────────────────────────────────────────────────────────────────────────

const KpiCard = ({ icon: Icon, title, value, growth, color, active, onClick }) => (
  <div 
    onClick={onClick}
    className={`relative overflow-hidden group bg-white rounded-[2.5rem] p-8 shadow-sm border transition-all duration-500 cursor-pointer
      ${active ? 'border-blue-500 ring-[10px] ring-blue-50 scale-[1.03] shadow-2xl' : 'border-slate-100 hover:border-blue-200 hover:shadow-xl'}`}
  >
    <div className="relative z-10 flex items-center gap-6">
      <div className={`w-16 h-16 rounded-[1.6rem] flex items-center justify-center bg-${color}-50 text-${color}-600 shadow-inner group-hover:rotate-12 transition-all duration-500`}>
        <Icon size={32} />
      </div>
      <div className="min-w-0">
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em] mb-1">{title}</p>
        <h3 className="text-3xl font-black text-slate-800 tracking-tighter truncate leading-none">{value}</h3>
        {growth && (
          <div className="flex items-center gap-1 mt-3 font-black text-emerald-500 text-[9px] uppercase tracking-widest">
            <TrendingUp size={12} /> {growth} Eficiência
          </div>
        )}
      </div>
    </div>
    <div className={`absolute -bottom-10 -right-10 w-40 h-40 bg-${color}-50/30 rounded-full blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// CORE DASHBOARD - SNEAELIS INTELLIGENCE
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardSneaElis() {
  const navigate = useNavigate();
  
  // ─── ESTADOS DE DADOS (SUPABASE + GEO) ───
  const [rawData, setRawData] = useState([]);
  const [mapFeatures, setMapFeatures] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date().toLocaleTimeString());
  
  // ─── FILTRAGEM E INTERAÇÃO ───
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUf, setSelectedUf] = useState(null);
  const [selectedSituacao, setSelectedSituacao] = useState(null);
  const [selectedAno, setSelectedAno] = useState(null);
  const [activeHover, setActiveHover] = useState(null);

  // ─── BOOTSTRAP DO SISTEMA ───
  const bootDashboard = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Carregar GeoJSON do Brasil (D3 Engine)
      const geoRes = await fetch(GEO_JSON_BR);
      const geoJson = await geoRes.json();
      setMapFeatures(geoJson.features);

      // 2. Carregar Dados Supabase (Com paginação para > 1000 registros)
      let clusterData = [];
      let offset = 0;
      let keepFetching = true;

      while (keepFetching) {
        const { data, error } = await supabase
          .from('formalizacoes')
          .select('*')
          .order('id', { ascending: true })
          .range(offset, offset + 999);

        if (error) throw error;
        if (!data || data.length === 0) {
          keepFetching = false;
        } else {
          clusterData = [...clusterData, ...data];
          offset += 1000;
          if (data.length < 1000) keepFetching = false;
        }
      }

      // 3. Sanitização e Normalização de Campos (SP, UF, VALOR)
      const normalized = clusterData.map(item => {
        const rawValor = item["VALOR REPASSE"] || 0;
        return {
          ...item,
          valor: typeof rawValor === 'string' ? parseFloat(rawValor.replace(/[^\d.-]/g, '')) || 0 : rawValor,
          uf: String(item.UF || 'ND').toUpperCase().trim().replace('.0', ''),
          situacao: String(item.SITUACIONAL || item["SITUACIONAL "] || 'PENDENTE').trim().toUpperCase(),
          ano: String(item.ANO || 'S/A').replace('.0', ''),
          processo: String(item.PROCESSO || '—').replace('.0', ''),
          entidade: (item.ENTIDADE || 'DESCONHECIDA').toUpperCase()
        };
      });

      setRawData(normalized);
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("Critical Engine Failure:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { bootDashboard(); }, [bootDashboard]);

  // ─── ENGINE DE FILTRAGEM (VÍNCULO MAPA <> TABELA) ───
  const filteredDataset = useMemo(() => {
    return rawData.filter(row => {
      const matchSearch = !searchTerm || Object.values(row).some(v => String(v).toLowerCase().includes(searchTerm.toLowerCase()));
      const matchUf = !selectedUf || row.uf === selectedUf;
      const matchSit = !selectedSituacao || row.situacao === selectedSituacao;
      const matchAno = !selectedAno || row.ano === selectedAno;
      return matchSearch && matchUf && matchSit && matchAno;
    });
  }, [rawData, searchTerm, selectedUf, selectedSituacao, selectedAno]);

  // ─── CÁLCULOS ANALÍTICOS ───
  const analytics = useMemo(() => {
    const totalRepasse = filteredDataset.reduce((acc, c) => acc + c.valor, 0);
    const count = filteredDataset.length;
    
    // Distribuições
    const ufAgg = filteredDataset.reduce((acc, r) => { acc[r.uf] = (acc[r.uf] || 0) + 1; return acc; }, {});
    const sitAgg = filteredDataset.reduce((acc, r) => { acc[r.situacao] = (acc[r.situacao] || 0) + 1; return acc; }, {});
    const anoAgg = filteredDataset.reduce((acc, r) => { acc[r.ano] = (acc[r.ano] || 0) + r.valor; return acc; }, {});

    const concluded = filteredDataset.filter(r => ['SIM', 'PAGO', 'CONCLUÍDO', 'FINALIZADO'].includes(r.situacao)).length;

    return {
      totalRepasse,
      count,
      avgValue: count > 0 ? totalRepasse / count : 0,
      efficiency: count > 0 ? ((concluded / count) * 100).toFixed(1) : 0,
      rankingUf: Object.entries(ufAgg).map(([uf, qtd]) => ({ uf, qtd })).sort((a,b) => b.qtd - a.qtd),
      statusData: Object.entries(sitAgg).map(([name, value]) => ({ name, value })),
      yearlyTrends: Object.entries(anoAgg).map(([ano, valor]) => ({ ano, valor })).sort((a,b) => a.ano - b.ano),
      maxUfValue: Math.max(...Object.values(ufAgg), 0),
      menus: {
        anos: [...new Set(rawData.map(r => r.ano))].sort().reverse(),
        status: [...new Set(rawData.map(r => r.situacao))].sort()
      }
    };
  }, [filteredDataset, rawData]);

  // ─── MOTOR D3 DE MAPA (ESTADOS VETORIAIS) ───
  // Vincula a sigla do GeoJSON com a sigla do Supabase
  const renderBrazilMap = () => {
    if (!mapFeatures) return null;

    const projection = geoMercator().center([-55, -15]).scale(780).translate([400, 300]);
    const pathGenerator = geoPath().projection(projection);
    const colorScale = scaleLinear().domain([0, analytics.maxUfValue || 1]).range(["#f8fafc", "#2563eb"]);

    return (
      <svg viewBox="0 0 800 650" className="w-full h-full drop-shadow-2xl">
        <g>
          {mapFeatures.map((feature, i) => {
            const sigla = (feature.properties.sigla || feature.properties.UF || "").toUpperCase();
            const ufMatch = analytics.rankingUf.find(u => u.uf === sigla);
            const isSelected = selectedUf === sigla;
            const isHovered = activeHover === sigla;

            return (
              <path
                key={`${sigla}-${i}`}
                d={pathGenerator(feature)}
                fill={isSelected ? SNEAELIS_UI.sidebar : isHovered ? SNEAELIS_UI.accent : (ufMatch ? colorScale(ufMatch.qtd) : "#f1f5f9")}
                stroke={isSelected ? "#fff" : "#cbd5e1"}
                strokeWidth={isSelected ? 3 : 0.7}
                className="transition-all duration-300 cursor-pointer outline-none"
                onMouseEnter={() => setActiveHover(sigla)}
                onMouseLeave={() => setActiveHover(null)}
                onClick={() => setSelectedUf(selectedUf === sigla ? null : sigla)}
              />
            );
          })}
        </g>
      </svg>
    );
  };

  // ─── CONFIGURAÇÃO DA TABELA TANSTACK ───
  const columns = useMemo(() => [
    { accessorKey: 'processo', header: 'PROTOCOLO', cell: i => <span className="font-mono text-slate-400 font-black">#{i.getValue()}</span> },
    { accessorKey: 'entidade', header: 'INSTITUIÇÃO BENEFICIÁRIA', cell: i => <div className="max-w-[220px] truncate font-black text-slate-800 text-[10px] uppercase italic leading-none">{i.getValue()}</div> },
    { accessorKey: 'uf', header: 'UF', cell: i => <span className="bg-blue-600 text-white px-3 py-1 rounded-lg font-black text-[10px] shadow-sm">{i.getValue()}</span> },
    { 
      accessorKey: 'valor', 
      header: 'INVESTIMENTO', 
      cell: i => <span className="font-black text-emerald-600 tabular-nums text-[12px]">
        {i.getValue().toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </span> 
    },
    { 
      accessorKey: 'situacao', 
      header: 'STATUS',
      cell: i => {
        const val = i.getValue();
        const done = ['SIM', 'PAGO', 'CONCLUÍDO'].includes(val);
        return (
          <span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-[0.2em] border shadow-sm
            ${done ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
            {val}
          </span>
        );
      }
    }
  ], []);

  const table = useReactTable({
    data: filteredDataset,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 8 } }
  });

  if (loading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-[#020617] relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-transparent to-transparent animate-pulse" />
      <div className="h-32 w-32 rounded-[2.5rem] border-[12px] border-blue-500/5 border-t-blue-500 animate-spin mb-10" />
      <h2 className="text-white font-black text-3xl italic tracking-[0.5em] animate-pulse">SNEAELIS HUB</h2>
      <p className="text-blue-500 text-[10px] mt-4 font-black uppercase tracking-[0.8em]">Acessando Cluster Supabase 2026</p>
    </div>
  );

  return (
    <div className="h-screen bg-[#f8fafc] flex w-full font-sans text-slate-900 overflow-hidden select-none">
      
      {/* SIDEBAR DESIGN SYSTEM */}
      <aside className="w-24 lg:w-80 bg-slate-950 flex flex-col z-[100] shadow-[15px_0_60px_-15px_rgba(0,0,0,0.4)] transition-all duration-700">
        <div className="p-10 border-b border-white/5 flex items-center gap-6">
          <div className="bg-gradient-to-tr from-blue-600 to-blue-400 p-4 rounded-[1.6rem] shadow-2xl shadow-blue-500/40 shrink-0 transform hover:scale-110 transition-transform">
            <Layers className="text-white" size={32} />
          </div>
          <div className="hidden lg:block">
            <h1 className="text-white font-black text-2xl italic tracking-tighter leading-none">SNEAELIS</h1>
            <p className="text-[9px] text-blue-500 font-black uppercase tracking-[0.5em] mt-2 flex items-center gap-2">
              <CloudSync size={10} className="animate-pulse" /> Intelligence
            </p>
          </div>
        </div>

        <nav className="flex-1 p-8 space-y-4">
          <button className="w-full flex items-center gap-5 p-5 rounded-[1.5rem] bg-blue-600 text-white font-black shadow-2xl shadow-blue-900/30">
            <LayoutDashboard size={24} /> <span className="hidden lg:block text-[12px] uppercase tracking-widest">Painel BI</span>
          </button>
          <button onClick={() => navigate('/tabela')} className="w-full flex items-center gap-5 p-5 rounded-[1.5rem] text-slate-500 hover:bg-white/5 hover:text-white transition-all font-bold">
            <TableIcon size={24} /> <span className="hidden lg:block text-[12px] uppercase tracking-widest">Base Gerencial</span>
          </button>
          <button className="w-full flex items-center gap-5 p-5 rounded-[1.5rem] text-slate-500 hover:bg-white/5 transition-all font-bold">
            <Target size={24} /> <span className="hidden lg:block text-[12px] uppercase tracking-widest">Metas Hub</span>
          </button>
        </nav>

        <div className="p-10 border-t border-white/5">
           <div className="hidden lg:flex items-center gap-4 p-5 bg-white/5 rounded-[1.2rem] border border-white/5">
              <div className="h-11 w-11 rounded-full bg-blue-500 flex items-center justify-center font-black text-white italic shadow-lg">PD</div>
              <div className="min-w-0">
                <p className="text-white text-[12px] font-black truncate leading-none">Pedro Dias</p>
                <p className="text-slate-500 text-[9px] font-black uppercase mt-1">IT Analyst Pro</p>
              </div>
            </div>
        </div>
      </aside>

      {/* CORE CONTENT CANVAS */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-50 custom-scrollbar">
        
        {/* TOPBAR COMMAND CENTER */}
        <header className="bg-white/95 backdrop-blur-3xl border-b border-slate-200 p-8 sticky top-0 z-[90] flex flex-col lg:flex-row items-center justify-between gap-8 shadow-sm">
          <div className="flex-1 w-full max-w-2xl relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20} />
            <input 
              type="text" 
              placeholder="Pesquisar por protocolo, UF ou entidade..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-100/50 border-2 border-transparent rounded-[1.5rem] py-4 pl-16 pr-8 text-xs font-black outline-none focus:bg-white focus:border-blue-500/20 transition-all shadow-inner"
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-[1.4rem] shadow-2xl">
              <select className="bg-transparent text-[11px] font-black uppercase px-5 py-2.5 text-white outline-none cursor-pointer" value={selectedAno || ''} onChange={e => setSelectedAno(e.target.value || null)}>
                <option value="" className="text-black">Anos</option>
                {analytics.menus.anos.map(a => <option key={a} value={a} className="text-black">{a}</option>)}
              </select>
              <div className="h-6 w-[1px] bg-white/20" />
              <select className="bg-transparent text-[11px] font-black uppercase px-5 py-2.5 text-white outline-none cursor-pointer" value={selectedSituacao || ''} onChange={e => setSelectedSituacao(e.target.value || null)}>
                <option value="" className="text-black">Status</option>
                {analytics.menus.status.map(s => <option key={s} value={s} className="text-black">{s}</option>)}
              </select>
            </div>
            <button onClick={() => { setSearchTerm(''); setSelectedUf(null); setSelectedSituacao(null); setSelectedAno(null); }} className="p-4 bg-white border border-slate-200 text-slate-400 rounded-2xl hover:bg-rose-50 hover:text-rose-600 transition-all shadow-sm">
              <RefreshCw size={20} />
            </button>
            <button onClick={() => {
              const ws = XLSX.utils.json_to_sheet(filteredDataset);
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "SNEAELIS_BI");
              XLSX.writeFile(wb, `SNEAELIS_REPORT_${new Date().toLocaleDateString()}.xlsx`);
            }} className="flex items-center gap-3 px-8 py-4 bg-emerald-600 text-white rounded-[1.5rem] font-black text-[11px] uppercase hover:bg-emerald-700 shadow-xl shadow-emerald-900/30 transition-all">
              <FileText size={20} /> Relatório
            </button>
          </div>
        </header>

        {/* ANALYTICS GRID CONTAINER */}
        <div className="p-10 space-y-10 max-w-[1700px] mx-auto w-full">
          
          {/* KPI LAYER SECTION */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <KpiCard icon={DollarSign} title="Volume Financeiro" value={analytics.totalRepasse.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })} growth="+12.4%" color="emerald" />
            <KpiCard icon={Box} title="Protocolos Ativos" value={analytics.count.toLocaleString('pt-BR')} color="blue" />
            <KpiCard icon={Target} title="Taxa Entrega" value={`${analytics.efficiency}%`} color="indigo" />
            <KpiCard icon={MapPin} title="Abrangência" value={analytics.rankingUf.length} active={!!selectedUf} color="amber" onClick={() => setSelectedUf(null)} />
          </div>

          {/* GEOINT LAYER SECTION (MAPA E RANKING) */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 items-start">
            
            {/* D3 MAP CORE (7/12) */}
            <div className="xl:col-span-7 bg-white rounded-[3.5rem] p-10 shadow-sm border border-slate-100 flex flex-col h-[580px] relative overflow-hidden group">
              <div className="flex justify-between items-start mb-8 z-10">
                <div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tighter italic uppercase flex items-center gap-4">
                    <Globe className="text-blue-600 animate-spin-slow" size={32} /> Visão Territorial
                  </h3>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.4em] mt-2">Navegação em Tempo Real por UF</p>
                </div>
                {selectedUf && (
                  <div className="bg-slate-950 text-white px-8 py-3 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4">
                    <MapPin size={16} className="text-blue-500" /> Vínculo Ativo: {selectedUf}
                  </div>
                )}
              </div>

              <div className="flex-1 bg-slate-50/50 rounded-[3.5rem] overflow-hidden relative border border-slate-200 shadow-inner flex items-center justify-center p-6">
                {renderBrazilMap()}
                
                {activeHover && (
                  <div className="absolute top-10 right-10 bg-slate-950/95 backdrop-blur-2xl text-white px-10 py-6 rounded-[2rem] text-[12px] font-black uppercase tracking-widest shadow-3xl border border-white/10">
                    <div className="text-blue-400 mb-2 flex items-center gap-2 font-black italic"><Database size={16}/> {activeHover}</div>
                    <div className="text-4xl tracking-tighter tabular-nums font-black">{analytics.rankingUf.find(u => u.uf === activeHover)?.qtd || 0} <span className="text-[12px] opacity-40 uppercase tracking-widest">Proc.</span></div>
                  </div>
                )}
              </div>
            </div>

            {/* PERFORMANCE RANKING CORE (5/12) */}
            <div className="xl:col-span-5 bg-white rounded-[3.5rem] p-10 shadow-sm border border-slate-100 flex flex-col h-[580px]">
              <div className="flex items-center justify-between mb-10">
                <div className="flex flex-col gap-1">
                  <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-[0.4em]">Performance Regional</h3>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic leading-none">Ranking Top 15 UF</span>
                </div>
                <Activity size={26} className="text-blue-500" />
              </div>
              <div className="flex-1 space-y-6 overflow-y-auto pr-8 custom-scrollbar">
                {analytics.rankingUf.slice(0, 15).map((u, i) => (
                  <div 
                    key={u.uf} 
                    onClick={() => setSelectedUf(selectedUf === u.uf ? null : u.uf)} 
                    className={`group flex items-center gap-7 p-6 rounded-[2rem] cursor-pointer transition-all duration-500
                      ${selectedUf === u.uf ? 'bg-slate-950 text-white shadow-3xl scale-[1.03]' : 'hover:bg-slate-50 border border-transparent hover:border-slate-200'}`}
                  >
                    <div className={`w-16 h-16 rounded-[1.6rem] flex items-center justify-center font-black text-xl transition-all shadow-md
                      ${selectedUf === u.uf ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-600'}`}>
                      {u.uf}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-[11px] font-black uppercase tracking-widest opacity-40">Processos</span>
                        <span className="text-xl font-black tabular-nums">{u.qtd}</span>
                      </div>
                      <div className={`h-3 rounded-full ${selectedUf === u.uf ? 'bg-white/10' : 'bg-slate-100 shadow-inner'}`}>
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ease-out ${selectedUf === u.uf ? 'bg-blue-400' : 'bg-blue-600 shadow-[0_0_15px_rgba(59,130,246,0.4)]'}`} 
                          style={{ width: `${(u.qtd / analytics.maxUfValue) * 100}%` }} 
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* DRILL-DOWN ANALYTICS LAYER */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 pb-24">
            
            {/* STATUS PIE CHART CORE (4/12) */}
            <div className="lg:col-span-4 bg-white rounded-[3.5rem] p-10 shadow-sm border border-slate-100 h-[560px] flex flex-col group relative overflow-hidden">
              <h3 className="text-[13px] font-black text-slate-400 uppercase tracking-[0.5em] mb-12 flex items-center gap-4">
                <PieIcon size={20} className="text-indigo-500" /> Status Processual
              </h3>
              <div className="flex-1 min-h-0 relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={analytics.statusData} 
                      cx="50%" cy="45%" 
                      innerRadius={95} outerRadius={135} 
                      paddingAngle={15} 
                      dataKey="value" 
                      onClick={(d) => setSelectedSituacao(selectedSituacao === d.name ? null : d.name)}
                    >
                      {analytics.statusData.map((e, idx) => (
                        <Cell 
                          key={idx} 
                          fill={SNEAELIS_UI.palette[idx % SNEAELIS_UI.palette.length]} 
                          strokeWidth={selectedSituacao === e.name ? 15 : 0} 
                          stroke={SNEAELIS_UI.sidebar} 
                          cursor="pointer" 
                          className="outline-none transition-all duration-700 hover:scale-110" 
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '32px', border: 'none', boxShadow: '0 40px 70px -15px rgba(0,0,0,0.5)', fontWeight: '900', fontSize: '11px', padding: '25px', background: '#fff' }} 
                    />
                    <Legend iconType="circle" verticalAlign="bottom" wrapperStyle={{ fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '2px', paddingTop: '40px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* SYNC MASTER TABLE CORE (8/12) */}
            <div className="lg:col-span-8 bg-white rounded-[3.5rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col h-[560px]">
              <div className="p-10 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-6">
                  <div className="p-4 bg-white rounded-[1.4rem] shadow-lg text-blue-600 border border-slate-100"><List size={28} /></div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tighter italic uppercase leading-none">Registros Sincronizados</h3>
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.4em] mt-3 flex items-center gap-3">
                       <Zap size={14} className="text-emerald-500 animate-pulse" /> SneaElis Engine v4.9.2
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-x-auto custom-scrollbar">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-white/95 backdrop-blur-3xl border-b border-slate-200 z-10">
                    {table.getHeaderGroups().map(hg => (
                      <tr key={hg.id}>
                        {hg.headers.map(header => (
                          <th key={header.id} className="px-10 py-6 text-[12px] font-black text-slate-400 uppercase tracking-[0.2em] cursor-pointer hover:text-blue-600 transition-colors" onClick={header.column.getToggleSortingHandler()}>
                            <div className="flex items-center gap-4">
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              <Maximize2 size={14} className="opacity-20" />
                            </div>
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {table.getRowModel().rows.length > 0 ? (
                      table.getRowModel().rows.map(row => (
                        <tr key={row.id} className="hover:bg-blue-50/40 transition-all group">
                          {row.getVisibleCells().map(cell => (
                            <td key={cell.id} className="px-10 py-6 text-[13px] text-slate-600 font-bold leading-tight truncate transition-colors group-hover:text-blue-900">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={columns.length} className="h-64 text-center text-slate-300 font-black italic uppercase tracking-[0.5em]">Sem dados vinculados ao filtro</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <footer className="p-10 bg-slate-50 border-t flex flex-col sm:flex-row justify-between items-center gap-10">
                <div className="flex items-center gap-6">
                  <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="p-5 bg-white rounded-[1.5rem] border border-slate-200 disabled:opacity-20 hover:shadow-2xl transition-all"><ChevronLeft size={24} /></button>
                  <span className="text-[14px] font-black uppercase tracking-widest text-slate-500 italic">Página <span className="text-blue-600">{table.getState().pagination.pageIndex + 1}</span> de {table.getPageCount() || 1}</span>
                  <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="p-5 bg-white rounded-[1.5rem] border border-slate-200 disabled:opacity-20 hover:shadow-2xl transition-all"><ChevronRight size={24} /></button>
                </div>
                <div className="flex items-center gap-4 px-8 py-4 bg-emerald-50 rounded-[1.4rem] border border-emerald-100 shadow-sm">
                  <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.8)]" />
                  <span className="text-[11px] font-black text-emerald-800 uppercase tracking-[0.4em]">Hub Sincronizado</span>
                </div>
              </footer>
            </div>
          </div>
        </div>

        {/* MASTER FOOTER CORE 2026 */}
        <footer className="relative mt-auto overflow-hidden bg-slate-950 border-t border-white/5 p-20 lg:p-28 shrink-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-px bg-gradient-to-r from-transparent via-blue-500/60 to-transparent shadow-[0_0_20px_rgba(59,130,246,0.5)]" />
          <div className="absolute -top-48 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] bg-blue-600/10 blur-[200px] rounded-full" />

          <div className="relative z-10 max-w-7xl mx-auto">
            <div className="flex flex-col items-center gap-16">
              
              <div className="flex flex-wrap justify-center gap-x-24 gap-y-10">
                <div className="flex items-center gap-5">
                  <div className="relative h-5 w-5">
                    <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-5 w-5 bg-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.6)]"></span>
                  </div>
                  <span className="text-[13px] font-black text-slate-400 uppercase tracking-[0.5em]">Live Data Stream</span>
                </div>

                <div className="flex items-center gap-5 border-x border-white/10 px-24">
                  <ShieldCheck size={24} className="text-blue-500 shadow-blue-500/40" />
                  <span className="text-[13px] font-black text-slate-400 uppercase tracking-[0.5em]">Protocolo Militar AES-256</span>
                </div>

                <div className="flex items-center gap-5">
                  <Globe size={24} className="text-amber-500 animate-spin-slow" />
                  <span className="text-[13px] font-black text-slate-400 uppercase tracking-[0.5em]">Cluster Hub 2026</span>
                </div>
              </div>

              <div className="flex flex-col items-center gap-6">
                <div className="flex items-center gap-8 group cursor-default">
                  <div className="h-px w-20 bg-slate-800 group-hover:w-32 group-hover:bg-blue-500 transition-all duration-1000" />
                  <h2 className="text-white font-black text-4xl tracking-[1.2em] uppercase italic group-hover:scale-110 transition-all">
                    SneaElis <span className="text-blue-500">Intelligence</span>
                  </h2>
                  <div className="h-px w-20 bg-slate-800 group-hover:w-32 group-hover:bg-blue-500 transition-all duration-1000" />
                </div>
                <p className="text-[12px] text-slate-500 font-bold uppercase tracking-[0.8em] opacity-50 flex items-center gap-4 italic leading-none">
                   Governança e BI • Sistema de Controle Master • v4.9.2 PRO
                </p>
              </div>

              <div className="pt-16 border-t border-white/5 w-full flex flex-col md:flex-row justify-between items-center gap-12">
                <div className="flex flex-col gap-3 text-center md:text-left">
                  <span className="text-[12px] text-slate-600 font-black uppercase tracking-[0.4em]">© 2026 SneaElis Intelligence Hub. Todos os direitos reservados.</span>
                  <span className="text-[11px] text-slate-700 font-bold uppercase tracking-widest italic leading-none flex items-center gap-2">
                    <User size={12} /> Developed by Pedro Dias • Ministério do Esporte • Brasília-DF
                  </span>
                </div>
                <div className="flex gap-14">
                  <a href="#" className="text-[12px] text-slate-500 hover:text-blue-400 transition-all font-black uppercase tracking-widest hover:-translate-y-1">Segurança</a>
                  <a href="#" className="text-[12px] text-slate-500 hover:text-blue-400 transition-all font-black uppercase tracking-widest hover:-translate-y-1">Documentação</a>
                  <a href="#" className="text-[12px] text-slate-500 hover:text-blue-400 transition-all font-black uppercase tracking-widest hover:-translate-y-1">Suporte</a>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}