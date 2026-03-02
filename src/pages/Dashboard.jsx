import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Database, DollarSign, MapPin, Search,
  ChevronLeft, ChevronRight, BarChart3, PieChart as PieIcon,
  Filter, X, Table as TableIcon, Download, AlertCircle, 
  TrendingUp, Activity, FileText, Globe, MousePointer2,
  ShieldCheck, RefreshCw, Layers, ExternalLink, Info,
  Box, Target, Zap, Maximize2, List, Settings, Lock, CloudSync,
  TrendingDown, Layout, User, Bell, ArrowUpRight, ChevronDown,
  HelpCircle, BarChart2, LineChart as LineIcon, AlertTriangle,
  UserCheck
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area, LineChart, Line
} from 'recharts';
import { geoPath, geoMercator } from 'd3-geo';
import { scaleLinear } from 'd3-scale';
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  getPaginationRowModel, flexRender, getFilteredRowModel
} from '@tanstack/react-table';
import * as XLSX from 'xlsx';
import { supabase } from '../services/supabaseClient';

const GEO_JSON_URL = "https://raw.githubusercontent.com/giuliano-macedo/geodata-br-states/main/geojson/br_states.json";

const UI_THEME = {
  colors: ['#3b82f6', '#10b981', '#6366f1', '#f59e0b', '#06b6d4', '#ec4899', '#f43f5e', '#8b5cf6'],
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTES AUXILIARES
// ─────────────────────────────────────────────────────────────────────────────

const KpiCard = ({ icon: Icon, title, value, color = 'blue' }) => (
  <div className="bg-white rounded-3xl p-6 shadow-md border border-neutral-100 flex items-center justify-between">
    <div>
      <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1">{title}</p>
      <h3 className="text-2xl font-black text-neutral-800">{value}</h3>
    </div>
    <div className={`p-4 rounded-2xl bg-${color}-50 text-${color}-600`}>
      <Icon size={24} />
    </div>
  </div>
);

const FilterSelect = ({ label, value, onChange, options }) => (
  <div className="relative">
    <select 
      value={value || ''}
      onChange={e => onChange(e.target.value || null)}
      className="appearance-none bg-white border border-neutral-200 rounded-xl px-4 py-2 pr-10 text-sm font-bold text-neutral-700 focus:ring-2 focus:ring-blue-500"
    >
      <option value="">{label}</option>
      {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
    </select>
    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" size={16} />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD COMPLETO
// ─────────────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [geoFeatures, setGeoFeatures] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedState, setSelectedState] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [tableGlobalFilter, setTableGlobalFilter] = useState('');

  const loadAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Carregar GeoJSON
      const geoRes = await fetch(GEO_JSON_URL);
      const geoJson = await geoRes.json();
      setGeoFeatures(geoJson.features);

      // 2. Loop para burlar o limite de 1000 e trazer TODOS (1821+)
      let allRecords = [];
      let from = 0;
      let to = 999;
      let hasMore = true;

      while (hasMore) {
        const { data: chunk, error: dbError } = await supabase
          .from('formalizacoes')
          .select('*')
          .range(from, to);

        if (dbError) throw dbError;
        
        allRecords = [...allRecords, ...chunk];
        
        if (chunk.length < 1000) {
          hasMore = false;
        } else {
          from += 1000;
          to += 1000;
        }
      }

      // 3. Normalização e Limpeza (Removendo .0 e tratando N/A)
      const normalized = allRecords.map(item => ({
        ...item,
        // Remove .0 de números que vêm como float do banco
        num_instrumento: String(item['Nº INSTRUMENTO'] || 'N/A').replace(/\.0$/, ''),
        proposta: String(item.PROPOSTA || 'N/A').replace(/\.0$/, ''),
        ano: String(item.ANO || 'N/A').replace(/\.0$/, ''),
        valor: parseFloat(String(item['VALOR REPASSE'] || 0).replace(/[^\d.-]/g, '')) || 0,
        uf: String(item.UF || 'ND').trim().toUpperCase(),
        entidade: item.ENTIDADE || 'N/A',
        parlamentar: item['NOME PARLAMENTAR'] || 'N/A',
        instrumento: item.INSTRUMENTO || 'N/A'
      }));

      setData(normalized);
    } catch (err) {
      setError("Erro ao carregar base de dados completa.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadAllData(); }, [loadAllData]);

  // Filtros Dinâmicos
  const filteredData = useMemo(() => 
    data.filter(row => {
      const matchSearch = !searchQuery || Object.values(row).some(v => String(v).toLowerCase().includes(searchQuery.toLowerCase()));
      const matchState = !selectedState || row.uf === selectedState;
      const matchYear = !selectedYear || row.ano === selectedYear;
      return matchSearch && matchState && matchYear;
    }),
  [data, searchQuery, selectedState, selectedYear]);

  // Métricas para Gráficos e KPIs
  const metrics = useMemo(() => {
    const totalFinanceiro = filteredData.reduce((acc, curr) => acc + curr.valor, 0);
    const totalRegistros = filteredData.length;
    
    // Agrupamento por Instrumento (Substituindo Status)
    const instrumentAgg = filteredData.reduce((acc, r) => {
      acc[r.instrumento] = (acc[r.instrumento] || 0) + 1;
      return acc;
    }, {});

    const pieData = Object.entries(instrumentAgg).map(([name, value]) => ({ name, value }));

    return {
      totalFinanceiro: totalFinanceiro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      totalRegistros: totalRegistros.toLocaleString('pt-BR'),
      pieData,
      years: [...new Set(data.map(d => d.ano))].sort().reverse()
    };
  }, [filteredData, data]);

  // Colunas da Tabela (Foco em Proposta e Instrumento)
  const columns = useMemo(() => [
    { accessorKey: 'proposta', header: 'Proposta (ID)' },
    { accessorKey: 'entidade', header: 'Entidade Benfeitora' },
    { accessorKey: 'instrumento', header: 'Tipo Instrumento' },
    { accessorKey: 'uf', header: 'UF' },
    { accessorKey: 'valor', header: 'Repasse', cell: info => info.getValue().toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
    { accessorKey: 'num_instrumento', header: 'Nº Instrumento' },
    { accessorKey: 'parlamentar', header: 'Parlamentar' }
  ], []);

  if (isLoading) return <div className="h-screen flex items-center justify-center font-bold text-blue-600 animate-pulse">CARREGANDO TODOS OS REGISTROS...</div>;

  return (
    <div className="flex h-screen bg-slate-50">
      {/* SIDEBAR COM LINK PARA TABELA */}
      <aside className="w-64 bg-slate-900 text-white p-6 flex flex-col">
        <div className="mb-10 flex items-center gap-2">
          <Database className="text-blue-400" />
          <span className="font-black text-xl tracking-tighter">SNEAELIS</span>
        </div>
        
        <nav className="flex-1 space-y-2">
          <button className="w-full flex items-center gap-3 p-3 rounded-xl bg-blue-600 font-bold">
            <LayoutDashboard size={20} /> Dashboard
          </button>
          {/* LINK PARA tabela.jsx */}
          <button 
            onClick={() => navigate('/tabela')} 
            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-all font-bold"
          >
            <TableIcon size={20} /> Tabela Completa
          </button>
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        {/* HEADER & FILTROS */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Pesquisa rápida na base..." 
              className="w-full pl-10 pr-4 py-3 rounded-2xl border-none shadow-sm focus:ring-2 focus:ring-blue-500"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <FilterSelect label="Filtrar Ano" options={metrics.years} value={selectedYear} onChange={setSelectedYear} />
            <button onClick={loadAllData} className="p-3 bg-white rounded-xl shadow-sm hover:bg-slate-100"><RefreshCw size={18}/></button>
          </div>
        </div>

        {/* CARDS DE IMPACTO */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <KpiCard title="Volume Total Repassado" value={metrics.totalFinanceiro} icon={DollarSign} color="emerald" />
          <KpiCard title="Total de Registros (Base)" value={metrics.totalRegistros} icon={Box} color="blue" />
          <KpiCard title="Cidades/UFs Atendidas" value={[...new Set(filteredData.map(d => d.uf))].length} icon={MapPin} color="orange" />
        </div>

        {/* GRÁFICOS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2"><PieIcon size={18}/> Distribuição por Instrumento</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={metrics.pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5}>
                    {metrics.pieData.map((_, index) => <Cell key={index} fill={UI_THEME.colors[index % UI_THEME.colors.length]} />)}
                  </Pie>
                  <RechartsTooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2"><BarChart3 size={18}/> Top 5 Estados</h3>
            {/* O componente de Mapa ou Barra entraria aqui conforme sua lógica de ranking */}
            <div className="h-80 flex items-center justify-center text-slate-300 italic">
              Gráfico de Barras por UF (Total de 1821 registros carregados)
            </div>
          </div>
        </div>

        {/* TABELA DE DADOS DETALHADA */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-black text-slate-800 uppercase tracking-tighter">Registros Detalhados</h3>
            <span className="text-xs font-bold bg-blue-100 text-blue-700 px-3 py-1 rounded-full">Sincronizado com Supabase</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-widest">
                <tr>
                  {columns.map(col => <th key={col.accessorKey} className="px-6 py-4">{col.header}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.slice(0, 15).map((row, i) => (
                  <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-blue-600">{row.proposta}</td>
                    <td className="px-6 py-4 text-slate-600 truncate max-w-[200px]">{row.entidade}</td>
                    <td className="px-6 py-4"><span className="bg-slate-100 px-2 py-1 rounded text-[10px] font-bold">{row.instrumento}</span></td>
                    <td className="px-6 py-4 font-bold">{row.uf}</td>
                    <td className="px-6 py-4 font-mono text-emerald-600">{row.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td className="px-6 py-4 text-slate-500">{row.num_instrumento}</td>
                    <td className="px-6 py-4 text-xs italic">{row.parlamentar}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-slate-50 text-center">
            <button onClick={() => navigate('/tabela')} className="text-blue-600 font-bold text-sm hover:underline">
              Ver todos os {filteredData.length} registros na tabela completa →
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}