// src/pages/Dashboard.jsx
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Database, DollarSign, MapPin, Search,
  ChevronLeft, ChevronRight, BarChart3, PieChart as PieIcon,
  Filter, X, Table as TableIcon, Download, AlertCircle, 
  TrendingUp, Activity, FileText, Globe, MousePointer2,
  ShieldCheck, RefreshCw, Layers, ExternalLink, Info,
  Box, Target, Zap, Maximize2, List, Settings, Lock, CloudSync
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
// CONFIGURAÇÕES DE MOTOR E ESTÉTICA
// ─────────────────────────────────────────────────────────────────────────────

const GEO_URL = "https://raw.githubusercontent.com/giuliano-macedo/geodata-br-states/main/geojson/br_states.json";

const THEME_2026 = {
  dark: '#020617',
  blue: '#2563eb',
  emerald: '#10b981',
  amber: '#f59e0b',
  indigo: '#6366f1',
  slate: '#64748b'
};

const PALETTE = ['#3b82f6', '#10b981', '#6366f1', '#f59e0b', '#06b6d4', '#ec4899', '#f43f5e', '#8b5cf6'];

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTES DE UI PREMIUM
// ─────────────────────────────────────────────────────────────────────────────

const KpiContainer = ({ icon: Icon, title, value, label, color, active, onClick }) => (
  <div 
    onClick={onClick}
    className={`relative overflow-hidden group bg-white rounded-[2.5rem] p-7 shadow-sm border transition-all duration-500 cursor-pointer
      ${active ? 'border-blue-500 ring-[12px] ring-blue-50 scale-[1.03] shadow-2xl' : 'border-slate-100 hover:border-blue-200 hover:shadow-xl'}`}
  >
    <div className="relative z-10 flex items-center gap-6">
      <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center bg-${color}-50 text-${color}-600 shadow-inner group-hover:rotate-12 transition-all`}>
        <Icon size={30} />
      </div>
      <div className="min-w-0">
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mb-1">{title}</p>
        <h3 className="text-3xl font-black text-slate-800 tracking-tighter truncate leading-none">{value}</h3>
        {label && <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-widest italic">{label}</p>}
      </div>
    </div>
    <div className={`absolute -bottom-10 -right-10 w-32 h-32 bg-${color}-50/30 rounded-full blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity`} />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD CORE ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardSneaElis() {
  const navigate = useNavigate();
  
  // ─── ESTADOS DE DADOS ───
  const [rawData, setRawData] = useState([]);
  const [geoData, setGeoData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState("Sincronizado");

  // ─── FILTROS CRUZADOS ───
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUf, setSelectedUf] = useState(null);
  const [selectedSituacao, setSelectedSituacao] = useState(null);
  const [selectedAno, setSelectedAno] = useState(null);
  const [mapHover, setMapHover] = useState(null);

  // ─── CARREGAMENTO DO ECOSSISTEMA ───
  const bootEngine = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Carregar Geometria do Brasil
      const geoResponse = await fetch(GEO_URL);
      const geoJson = await geoResponse.json();
      setGeoData(geoJson);

      // 2. Carregar Dados do Supabase com Varredura Completa
      let batch = [];
      let offset = 0;
      let hasData = true;

      while (hasData) {
        const { data, error } = await supabase
          .from('formalizacoes')
          .select('*')
          .order('id', { ascending: true })
          .range(offset, offset + 999);

        if (error) throw error;
        if (!data || data.length === 0) {
          hasData = false;
        } else {
          batch = [...batch, ...data];
          offset += 1000;
          if (data.length < 1000) hasData = false;
        }
      }

      // 3. Normalização e Limpeza de Dados
      const normalized = batch.map(row => ({
        ...row,
        valor: parseFloat(String(row["VALOR REPASSE"] || 0).replace(/[^\d.-]/g, '')) || 0,
        uf: String(row.UF || 'ND').toUpperCase().trim().replace('.0', ''),
        situacao: String(row.SITUACIONAL || row["SITUACIONAL "] || 'PENDENTE').trim().toUpperCase(),
        ano: String(row.ANO || 'S/A').replace('.0', ''),
        processo: String(row.PROCESSO || 'N/A').replace('.0', ''),
        entidade: (row.ENTIDADE || 'NÃO INFORMADO').toUpperCase()
      }));

      setRawData(normalized);
    } catch (err) {
      console.error("Critical BI Failure:", err);
      setSyncStatus("Erro de Conexão");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { bootEngine(); }, [bootEngine]);

  // ─── ENGINE DE FILTRAGEM ───
  const dataset = useMemo(() => {
    return rawData.filter(row => {
      const matchSearch = !searchTerm || Object.values(row).some(v => String(v).toLowerCase().includes(searchTerm.toLowerCase()));
      const matchUf = !selectedUf || row.uf === selectedUf;
      const matchSit = !selectedSituacao || row.situacao === selectedSituacao;
      const matchAno = !selectedAno || row.ano === selectedAno;
      return matchSearch && matchUf && matchSit && matchAno;
    });
  }, [rawData, searchTerm, selectedUf, selectedSituacao, selectedAno]);

  // ─── CÁLCULOS ANALÍTICOS ───
  const metrics = useMemo(() => {
    const totalRepasse = dataset.reduce((acc, c) => acc + c.valor, 0);
    const totalRegistros = dataset.length;
    
    const ufDist = dataset.reduce((acc, r) => { acc[r.uf] = (acc[r.uf] || 0) + 1; return acc; }, {});
    const sitDist = dataset.reduce((acc, r) => { acc[r.situacao] = (acc[r.situacao] || 0) + 1; return acc; }, {});
    const anoDist = dataset.reduce((acc, r) => { acc[r.ano] = (acc[r.ano] || 0) + r.valor; return acc; }, {});

    const concluidos = dataset.filter(r => ['SIM', 'PAGO', 'CONCLUÍDO', 'REALIZADO'].includes(r.situacao)).length;

    return {
      totalRepasse,
      totalRegistros,
      ticketMedio: totalRegistros > 0 ? totalRepasse / totalRegistros : 0,
      taxaSucesso: totalRegistros > 0 ? ((concluidos / totalRegistros) * 100).toFixed(1) : 0,
      rankingUf: Object.entries(ufDist).map(([uf, qtd]) => ({ uf, qtd })).sort((a,b) => b.qtd - a.qtd),
      situacaoGrafico: Object.entries(sitDist).map(([name, value]) => ({ name, value })),
      anualGrafico: Object.entries(anoDist).map(([ano, valor]) => ({ ano, valor })).sort((a,b) => a.ano - b.ano),
      maxUf: Math.max(...Object.values(ufDist), 0),
      menuAnos: [...new Set(rawData.map(r => r.ano))].sort().reverse(),
      menuStatus: [...new Set(rawData.map(r => r.situacao))].sort()
    };
  }, [dataset, rawData]);

  // ─── MOTOR DE MAPA VETORIAL D3 (CUSTOM) ───
  const BrazilMap = () => {
    if (!geoData) return null;

    // Configuração de Projeção Mercator focada no Brasil
    const projection = geoMercator().center([-55, -15]).scale(750).translate([380, 280]);
    const pathGenerator = geoPath().projection(projection);
    const colorScale = scaleLinear().domain([0, metrics.maxUf || 1]).range(["#f8fafc", "#2563eb"]);

    return (
      <svg viewBox="0 0 800 600" className="w-full h-full drop-shadow-2xl transition-all duration-700">
        <g>
          {geoData.features.map((feature, i) => {
            const sigla = (feature.properties.sigla || feature.properties.UF || "").toUpperCase();
            const dataUf = metrics.rankingUf.find(u => u.uf === sigla);
            const isSelected = selectedUf === sigla;
            const isHovered = mapHover === sigla;

            return (
              <path
                key={`${sigla}-${i}`}
                d={pathGenerator(feature)}
                fill={isSelected ? THEME_2026.dark : isHovered ? THEME_2026.blue : (dataUf ? colorScale(dataUf.qtd) : "#f1f5f9")}
                stroke={isSelected ? "#fff" : "#cbd5e1"}
                strokeWidth={isSelected ? 2.5 : 0.6}
                className="transition-all duration-300 cursor-pointer outline-none"
                onMouseEnter={() => setMapHover(sigla)}
                onMouseLeave={() => setMapHover(null)}
                onClick={() => setSelectedUf(selectedUf === sigla ? null : sigla)}
              />
            );
          })}
        </g>
      </svg>
    );
  };

  // ─── TABELA DE DADOS (TANSTACK) ───
  const columns = useMemo(() => [
    { accessorKey: 'processo', header: 'PROCESSO', cell: i => <span className="font-mono text-slate-400 font-black">#{i.getValue()}</span> },
    { accessorKey: 'entidade', header: 'ENTIDADE', cell: i => <div className="max-w-[200px] truncate font-black text-slate-800 text-[10px] uppercase">{i.getValue()}</div> },
    { accessorKey: 'uf', header: 'UF', cell: i => <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-lg font-black text-[10px]">{i.getValue()}</span> },
    { 
      accessorKey: 'valor', 
      header: 'VALOR REPASSE', 
      cell: i => <span className="font-black text-emerald-600">
        {i.getValue().toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </span> 
    },
    { 
      accessorKey: 'situacao', 
      header: 'STATUS',
      cell: i => {
        const val = i.getValue();
        const isOk = ['SIM', 'PAGO', 'CONCLUÍDO'].includes(val);
        return (
          <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border
            ${isOk ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
            {val}
          </span>
        );
      }
    }
  ], []);

  const table = useReactTable({
    data: dataset,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 8 } }
  });

  if (loading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-950">
      <div className="h-32 w-32 rounded-[2.5rem] border-[10px] border-blue-500/10 border-t-blue-600 animate-spin mb-8" />
      <h2 className="text-white font-black text-2xl italic tracking-[0.4em] animate-pulse">SNEAELIS HUB 2026</h2>
      <p className="text-slate-500 text-[10px] mt-4 font-bold uppercase tracking-widest">Sincronizando Cluster Supabase...</p>
    </div>
  );

  return (
    <div className="h-screen bg-[#f8fafc] flex w-full font-sans text-slate-900 overflow-hidden select-none">
      
      {/* SIDEBAR CORPORATIVA */}
      <aside className="w-24 lg:w-80 bg-slate-950 flex flex-col z-[100] shadow-2xl transition-all duration-700">
        <div className="p-10 border-b border-white/5 flex items-center gap-5">
          <div className="bg-blue-600 p-4 rounded-[1.5rem] shadow-2xl shadow-blue-500/40 shrink-0 transform hover:scale-110 transition-transform">
            <Layers className="text-white" size={30} />
          </div>
          <div className="hidden lg:block">
            <h1 className="text-white font-black text-2xl italic tracking-tighter">SNEAELIS</h1>
            <p className="text-[10px] text-blue-400 font-black uppercase tracking-[0.4em] mt-1">Intelligence Hub</p>
          </div>
        </div>

        <nav className="flex-1 p-8 space-y-4">
          <button className="w-full flex items-center gap-5 p-5 rounded-[1.5rem] bg-blue-600 text-white font-black shadow-xl shadow-blue-900/20">
            <LayoutDashboard size={24} /> <span className="hidden lg:block text-[12px] uppercase tracking-widest">Dashboard BI</span>
          </button>
          <button onClick={() => navigate('/tabela')} className="w-full flex items-center gap-5 p-5 rounded-[1.5rem] text-slate-500 hover:bg-white/5 hover:text-white transition-all font-bold">
            <TableIcon size={24} /> <span className="hidden lg:block text-[12px] uppercase tracking-widest">Base de Dados</span>
          </button>
          <button className="w-full flex items-center gap-5 p-5 rounded-[1.5rem] text-slate-500 hover:bg-white/5 transition-all font-bold">
            <Target size={24} /> <span className="hidden lg:block text-[12px] uppercase tracking-widest">Metas & KPIs</span>
          </button>
        </nav>

        <div className="p-10 border-t border-white/5">
           <div className="hidden lg:flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
              <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center font-black text-white italic">PD</div>
              <div className="min-w-0">
                <p className="text-white text-[11px] font-black truncate leading-none">Pedro Dias</p>
                <p className="text-slate-500 text-[8px] font-black uppercase mt-1">SneaElis v4.9.2</p>
              </div>
            </div>
        </div>
      </aside>

      {/* ÁREA DE CONTEÚDO */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto custom-scrollbar bg-slate-50">
        
        {/* TOPBAR COM FILTROS */}
        <header className="bg-white/90 backdrop-blur-3xl border-b border-slate-200 p-8 sticky top-0 z-[90] flex flex-col lg:flex-row items-center justify-between gap-8 shadow-sm">
          <div className="flex-1 w-full max-w-2xl relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600" size={20} />
            <input 
              type="text" 
              placeholder="Pesquisar por processo ou entidade..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-100/50 border-2 border-transparent rounded-[1.5rem] py-4 pl-16 pr-8 text-xs font-black outline-none focus:bg-white focus:border-blue-500/20 transition-all shadow-inner"
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-[1.2rem] shadow-2xl">
              <select className="bg-transparent text-[10px] font-black uppercase px-4 py-2 text-white outline-none cursor-pointer" value={selectedAno || ''} onChange={e => setSelectedAno(e.target.value || null)}>
                <option value="" className="text-black">Anos</option>
                {metrics.menuAnos.map(a => <option key={a} value={a} className="text-black">{a}</option>)}
              </select>
              <div className="h-5 w-[1px] bg-white/20" />
              <select className="bg-transparent text-[10px] font-black uppercase px-4 py-2 text-white outline-none cursor-pointer" value={selectedSituacao || ''} onChange={e => setSelectedSituacao(e.target.value || null)}>
                <option value="" className="text-black">Status</option>
                {metrics.menuStatus.map(s => <option key={s} value={s} className="text-black">{s}</option>)}
              </select>
            </div>
            <button onClick={() => { setSearchTerm(''); setSelectedUf(null); setSelectedSituacao(null); setSelectedAno(null); }} className="p-4 bg-white border border-slate-200 text-slate-400 rounded-2xl hover:bg-rose-50 hover:text-rose-600 transition-all shadow-sm">
              <RefreshCw size={20} />
            </button>
            <button onClick={() => {
              const ws = XLSX.utils.json_to_sheet(dataset);
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "SNEAELIS_BI");
              XLSX.writeFile(wb, `SNEAELIS_EXTRACT_${new Date().toLocaleDateString()}.xlsx`);
            }} className="flex items-center gap-3 px-8 py-4 bg-emerald-600 text-white rounded-[1.5rem] font-black text-[11px] uppercase hover:bg-emerald-700 shadow-xl shadow-emerald-900/30 transition-all">
              <FileText size={20} /> Relatório
            </button>
          </div>
        </header>

        {/* CONTAINER DINÂMICO DE DASHBOARD */}
        <div className="p-10 space-y-10 max-w-[1700px] mx-auto w-full">
          
          {/* SEÇÃO 1: MÉTRICAS CHAVE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <KpiContainer icon={DollarSign} title="Total Repasse" value={metrics.totalRepasse.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })} label="Volume Financeiro Global" color="emerald" />
            <KpiContainer icon={Box} title="Total Registros" value={metrics.totalRegistros} label="Processos no Banco" color="blue" />
            <KpiContainer icon={Target} title="Taxa Entrega" value={`${metrics.taxaSucesso}%`} label="Eficiência de Conclusão" color="indigo" />
            <KpiContainer icon={MapPin} title="Abrangência" value={metrics.rankingUf.length} label="Estados Vinculados" color="amber" active={!!selectedUf} onClick={() => setSelectedUf(null)} />
          </div>

          {/* SEÇÃO 2: MAPA E RANKING GEOGRÁFICO */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 items-start">
            
            {/* MAPA D3 MASTER (7/12) */}
            <div className="xl:col-span-7 bg-white rounded-[3.5rem] p-10 shadow-sm border border-slate-100 flex flex-col h-[560px] relative overflow-hidden group">
              <div className="flex justify-between items-start mb-8 z-10">
                <div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tighter italic uppercase flex items-center gap-4">
                    <Globe className="text-blue-600 animate-spin-slow" size={30} /> Geolocalização BI
                  </h3>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.4em] mt-2">Visão Territorial por Estado</p>
                </div>
                {selectedUf && (
                  <div className="bg-slate-950 text-white px-6 py-3 rounded-[1.2rem] text-[11px] font-black uppercase tracking-widest shadow-2xl flex items-center gap-3 animate-in zoom-in">
                    <MapPin size={14} className="text-blue-500" /> Vínculo: {selectedUf}
                  </div>
                )}
              </div>

              <div className="flex-1 bg-slate-50/50 rounded-[3rem] overflow-hidden relative border border-slate-200 shadow-inner flex items-center justify-center">
                <BrazilMap />
                
                {mapHover && (
                  <div className="absolute top-8 right-8 bg-slate-950/95 backdrop-blur-2xl text-white px-8 py-5 rounded-[1.8rem] text-[12px] font-black uppercase tracking-widest shadow-3xl border border-white/10">
                    <div className="text-blue-400 mb-2 flex items-center gap-2 font-black italic"><Database size={14}/> {mapHover}</div>
                    <div className="text-3xl tracking-tighter tabular-nums font-black">{metrics.rankingUf.find(u => u.uf === mapHover)?.qtd || 0} <span className="text-[12px] opacity-40">Reg.</span></div>
                  </div>
                )}
              </div>
            </div>

            {/* PERFORMANCE POR UF (5/12) */}
            <div className="xl:col-span-5 bg-white rounded-[3.5rem] p-10 shadow-sm border border-slate-100 flex flex-col h-[560px]">
              <div className="flex items-center justify-between mb-10">
                <h3 className="text-[12px] font-black text-slate-800 uppercase tracking-[0.3em]">Top Estados (Volume)</h3>
                <Activity size={24} className="text-blue-500" />
              </div>
              <div className="flex-1 space-y-5 overflow-y-auto pr-6 custom-scrollbar">
                {metrics.rankingUf.slice(0, 15).map((u, i) => (
                  <div 
                    key={u.uf} 
                    onClick={() => setSelectedUf(selectedUf === u.uf ? null : u.uf)} 
                    className={`group flex items-center gap-6 p-5 rounded-[1.8rem] cursor-pointer transition-all duration-500
                      ${selectedUf === u.uf ? 'bg-slate-950 text-white shadow-3xl scale-[1.02]' : 'hover:bg-slate-50 border border-transparent hover:border-slate-200'}`}
                  >
                    <div className={`w-14 h-14 rounded-[1.4rem] flex items-center justify-center font-black text-lg shadow-md
                      ${selectedUf === u.uf ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-600'}`}>
                      {u.uf}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[11px] font-black uppercase tracking-widest opacity-40">Registros</span>
                        <span className="text-lg font-black tabular-nums">{u.qtd}</span>
                      </div>
                      <div className={`h-2.5 rounded-full ${selectedUf === u.uf ? 'bg-white/10' : 'bg-slate-100 shadow-inner'}`}>
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ease-out ${selectedUf === u.uf ? 'bg-blue-400' : 'bg-blue-600 shadow-[0_0_10px_rgba(59,130,246,0.5)]'}`} 
                          style={{ width: `${(u.qtd / metrics.maxUf) * 100}%` }} 
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SEÇÃO 3: STATUS E TABELA SINCRONIZADA */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 pb-24">
            
            {/* STATUS DO PROCESSO (4/12) */}
            <div className="lg:col-span-4 bg-white rounded-[3.5rem] p-10 shadow-sm border border-slate-100 h-[560px] flex flex-col group relative overflow-hidden">
              <h3 className="text-[12px] font-black text-slate-400 uppercase tracking-[0.4em] mb-12 flex items-center gap-3">
                <PieIcon size={18} className="text-indigo-500" /> Distribuição de Status
              </h3>
              <div className="flex-1 min-h-0 relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={metrics.situacaoGrafico} 
                      cx="50%" cy="45%" 
                      innerRadius={90} outerRadius={125} 
                      paddingAngle={12} 
                      dataKey="value" 
                      onClick={(d) => setSelectedSituacao(selectedSituacao === d.name ? null : d.name)}
                    >
                      {metrics.situacaoGrafico.map((e, idx) => (
                        <Cell 
                          key={idx} 
                          fill={PALETTE[idx % PALETTE.length]} 
                          strokeWidth={selectedSituacao === e.name ? 12 : 0} 
                          stroke={THEME_2026.dark} 
                          cursor="pointer" 
                          className="outline-none transition-all duration-700 hover:scale-110" 
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '28px', border: 'none', boxShadow: '0 35px 60px -15px rgba(0,0,0,0.4)', fontWeight: '900', fontSize: '11px', padding: '20px', background: '#fff' }} 
                    />
                    <Legend iconType="circle" verticalAlign="bottom" wrapperStyle={{ fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '2px', paddingTop: '40px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* TABELA MESTRE (8/12) */}
            <div className="lg:col-span-8 bg-white rounded-[3.5rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col h-[560px]">
              <div className="p-10 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-5">
                  <div className="p-4 bg-white rounded-[1.2rem] shadow-sm text-blue-600 border border-slate-100"><List size={26} /></div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tighter italic uppercase leading-none">Registros Sincronizados</h3>
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-2 flex items-center gap-2">
                       <CloudSync size={12} className="text-emerald-500" /> Live Supabase Link 2026
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-x-auto custom-scrollbar">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-white/95 backdrop-blur-2xl border-b border-slate-200 z-10">
                    {table.getHeaderGroups().map(hg => (
                      <tr key={hg.id}>
                        {hg.headers.map(header => (
                          <th key={header.id} className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] cursor-pointer hover:text-blue-600 transition-colors" onClick={header.column.getToggleSortingHandler()}>
                            <div className="flex items-center gap-3">
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              <Maximize2 size={12} className="opacity-20" />
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
                      <tr><td colSpan={columns.length} className="h-64 text-center text-slate-300 font-black italic uppercase tracking-[0.4em]">Filtro vazio no cluster</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <footer className="p-10 bg-slate-50 border-t flex flex-col sm:flex-row justify-between items-center gap-8">
                <div className="flex items-center gap-5">
                  <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="p-4 bg-white rounded-2xl border border-slate-200 disabled:opacity-20 hover:shadow-xl transition-all"><ChevronLeft size={20} /></button>
                  <span className="text-[12px] font-black uppercase tracking-widest text-slate-500">Página <span className="text-blue-600 font-black">{table.getState().pagination.pageIndex + 1}</span> de {table.getPageCount() || 1}</span>
                  <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="p-4 bg-white rounded-2xl border border-slate-200 disabled:opacity-20 hover:shadow-xl transition-all"><ChevronRight size={20} /></button>
                </div>
                <div className="flex items-center gap-3 px-6 py-3 bg-emerald-50 rounded-2xl border border-emerald-100 shadow-sm">
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                  <span className="text-[10px] font-black text-emerald-800 uppercase tracking-[0.3em]">Status: {syncStatus}</span>
                </div>
              </footer>
            </div>
          </div>
        </div>

        {/* FOOTER MASTER 2026 */}
        <footer className="relative mt-auto overflow-hidden bg-slate-950 border-t border-white/5 p-16 lg:p-24 shrink-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-px bg-gradient-to-r from-transparent via-blue-500/60 to-transparent" />
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[350px] bg-blue-600/10 blur-[180px] rounded-full" />

          <div className="relative z-10 max-w-7xl mx-auto">
            <div className="flex flex-col items-center gap-14">
              
              <div className="flex flex-wrap justify-center gap-x-20 gap-y-8">
                <div className="flex items-center gap-4">
                  <div className="relative h-4 w-4">
                    <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.6)]"></span>
                  </div>
                  <span className="text-[12px] font-black text-slate-400 uppercase tracking-[0.4em]">Live Cluster Ativo</span>
                </div>

                <div className="flex items-center gap-4 border-x border-white/10 px-20">
                  <Lock size={20} className="text-blue-500 shadow-blue-500/40" />
                  <span className="text-[12px] font-black text-slate-400 uppercase tracking-[0.4em]">Criptografia Militar AES-256</span>
                </div>

                <div className="flex items-center gap-4">
                  <Globe size={20} className="text-amber-500 animate-spin-slow" />
                  <span className="text-[12px] font-black text-slate-400 uppercase tracking-[0.4em]">Cloud Engine Hub 2026</span>
                </div>
              </div>

              <div className="flex flex-col items-center gap-5">
                <div className="flex items-center gap-6 group cursor-default">
                  <div className="h-px w-16 bg-slate-800 group-hover:w-28 group-hover:bg-blue-500 transition-all duration-1000" />
                  <h2 className="text-white font-black text-3xl tracking-[1em] uppercase italic group-hover:scale-110 transition-all">
                    SneaElis <span className="text-blue-500">Intelligence</span>
                  </h2>
                  <div className="h-px w-16 bg-slate-800 group-hover:w-28 group-hover:bg-blue-500 transition-all duration-1000" />
                </div>
                <p className="text-[11px] text-slate-500 font-bold uppercase tracking-[0.6em] opacity-50 flex items-center gap-3">
                   Governança & Análise Financeira • v4.9.2 Build 2026
                </p>
              </div>

              <div className="pt-14 border-t border-white/5 w-full flex flex-col md:flex-row justify-between items-center gap-10">
                <div className="flex flex-col gap-2 text-center md:text-left">
                  <span className="text-[11px] text-slate-600 font-black uppercase tracking-[0.3em]">© 2026 SneaElis Intelligence Platform.</span>
                  <span className="text-[10px] text-slate-700 font-bold uppercase tracking-widest italic leading-none">Powered by Supabase Cloud Infrastructure</span>
                </div>
                <div className="flex gap-12">
                  <a href="#" className="text-[11px] text-slate-500 hover:text-blue-400 transition-all font-black uppercase tracking-widest hover:translate-y-[-2px]">Segurança</a>
                  <a href="#" className="text-[11px] text-slate-500 hover:text-blue-400 transition-all font-black uppercase tracking-widest hover:translate-y-[-2px]">API Gateway</a>
                  <a href="#" className="text-[11px] text-slate-500 hover:text-blue-400 transition-all font-black uppercase tracking-widest hover:translate-y-[-2px]">Suporte</a>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}