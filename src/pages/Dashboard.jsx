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
  TrendingDown, Layout, User, Bell, ArrowUpRight, ChevronDown,
  HelpCircle, BarChart2, LineChart as LineIcon, AlertTriangle
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

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURAÇÕES GLOBAIS E CONSTANTES DO SISTEMA
// ─────────────────────────────────────────────────────────────────────────────
const GEO_JSON_URL = "https://raw.githubusercontent.com/giuliano-macedo/geodata-br-states/main/geojson/br_states.json";

const UI_THEME = {
  background: '#f8fafc',
  sidebar: '#020617',
  primary: '#2563eb',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#f43f5e',
  info: '#0ea5e9',
  colors: ['#3b82f6', '#10b981', '#6366f1', '#f59e0b', '#06b6d4', '#ec4899', '#f43f5e', '#8b5cf6'],
  neutral: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
    950: '#020617'
  }
};

const COMPLETED_STATUSES = ['SIM', 'PAGO', 'CONCLUÍDO', 'FINALIZADO', 'APROVADO', 'EXECUTADO', 'REALIZADO', 'EFETIVADO'];

const DEFAULT_PAGE_SIZE = 15;

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTES DE UI MODULARES
// ─────────────────────────────────────────────────────────────────────────────

const KpiCard = ({ icon: Icon, title, value, subtitle, color = 'primary', isActive = false, onClick, tooltip }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div 
      onClick={onClick}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      className={`relative overflow-hidden group bg-white rounded-3xl p-6 shadow-md border transition-all duration-300 cursor-pointer
        ${isActive ? 'border-2 border-blue-500 shadow-xl scale-105' : 'border-neutral-200 hover:border-blue-300 hover:shadow-lg'}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl font-bold text-neutral-800">{value}</h3>
          {subtitle && (
            <p className={`text-xs font-medium ${subtitle.color} flex items-center gap-1`}>
              {subtitle.icon} {subtitle.text}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-xl bg-${color}-100 text-${color}-600`}>
          <Icon size={24} />
        </div>
      </div>
      <div className={`absolute bottom-0 left-0 w-full h-1 bg-${color}-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left`} />
      {showTooltip && tooltip && (
        <div className="absolute z-10 top-full left-0 mt-2 bg-white p-3 rounded-lg shadow-lg border border-neutral-200 text-xs max-w-xs">
          {tooltip}
        </div>
      )}
    </div>
  );
};

const FilterSelect = ({ label, value, onChange, options, icon: Icon = Filter }) => (
  <div className="relative">
    <Icon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
    <select 
      value={value || ''}
      onChange={e => onChange(e.target.value || null)}
      className="appearance-none bg-white border border-neutral-200 rounded-xl px-4 py-2 pr-10 text-sm font-medium text-neutral-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 pl-10"
    >
      <option value="">{label}</option>
      {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
    </select>
    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" size={16} />
  </div>
);

const ErrorAlert = ({ message, onRetry }) => (
  <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex flex-col items-center gap-4 text-red-800 max-w-lg mx-auto text-center">
    <AlertTriangle size={48} />
    <p className="text-lg font-medium">{message}</p>
    <button 
      onClick={onRetry}
      className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
    >
      Tentar Novamente
    </button>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE DO MAPA – VERSÃO CORRIGIDA E ROBUSTA
// ─────────────────────────────────────────────────────────────────────────────
const BrazilMap = ({ 
  features, 
  data, 
  selectedUf, 
  onSelectUf, 
  hoveredState, 
  onHoverUf, 
  maxValue 
}) => {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [tooltip, setTooltip] = useState(null);
  const [mapReady, setMapReady] = useState(false);

  // ResizeObserver com debounce
  useEffect(() => {
    let timeoutId;

    const updateDimensions = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        if (clientWidth > 50 && clientHeight > 50) {
          setDimensions({ width: clientWidth, height: clientHeight });
        }
      }
    };

    const debouncedUpdate = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(updateDimensions, 150);
    };

    const resizeObserver = new ResizeObserver(debouncedUpdate);

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
      // Primeira medição imediata
      updateDimensions();
    }

    return () => {
      clearTimeout(timeoutId);
      if (containerRef.current) {
        resizeObserver.unobserve(containerRef.current);
      }
    };
  }, []);

  // Controla quando o mapa está pronto para renderizar
  useEffect(() => {
    if (dimensions.width > 100 && dimensions.height > 100 && features?.length > 0) {
      setMapReady(true);
    }
  }, [dimensions, features]);

  if (!mapReady || !features || features.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-neutral-500 space-y-4">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500 border-b-transparent"></div>
        <p className="text-xl font-medium">Carregando mapa do Brasil...</p>
        <p className="text-sm opacity-70">Aguarde a leitura do GeoJSON e ajuste automático de tamanho</p>
      </div>
    );
  }

  // Projeção com margens de segurança
  const projection = geoMercator().fitExtent(
    [[40, 40], [dimensions.width - 40, dimensions.height - 40]],
    { type: 'FeatureCollection', features }
  );

  const pathGenerator = geoPath().projection(projection);

  const colorScale = scaleLinear()
    .domain([0, maxValue || 1])
    .range(['#e0f2fe', '#1e40af']);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full relative overflow-hidden bg-gradient-to-br from-slate-50 to-white"
    >
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
      >
        <g>
          {features.map((feature, index) => {
            const siglaRaw = feature.properties.SIGLA || feature.properties.sigla || feature.properties.UF || '';
            const sigla = String(siglaRaw).toUpperCase().trim();

            const ufData = data.find(u => u.uf === sigla);
            const count = ufData?.qtd ?? 0;
            const isSelected = selectedUf === sigla;
            const isHovered = hoveredState === sigla;

            const fillColor = isSelected 
              ? '#1d4ed8' 
              : isHovered 
                ? '#60a5fa' 
                : count > 0 
                  ? colorScale(count) 
                  : '#f1f5f9';

            return (
              <path
                key={`state-${sigla}-${index}`}
                d={pathGenerator(feature)}
                fill={fillColor}
                stroke="#94a3b8"
                strokeWidth={isSelected || isHovered ? 2 : 0.7}
                className="transition-all duration-200 ease-out cursor-pointer hover:brightness-110"
                onClick={() => onSelectUf(isSelected ? null : sigla)}
                onMouseEnter={(e) => {
                  onHoverUf(sigla);
                  const rect = svgRef.current?.getBoundingClientRect();
                  if (rect) {
                    setTooltip({
                      x: e.clientX - rect.left + 20,
                      y: e.clientY - rect.top + 20,
                      sigla,
                      count
                    });
                  }
                }}
                onMouseMove={(e) => {
                  const rect = svgRef.current?.getBoundingClientRect();
                  if (rect && tooltip) {
                    setTooltip(prev => ({
                      ...prev,
                      x: e.clientX - rect.left + 20,
                      y: e.clientY - rect.top + 20
                    }));
                  }
                }}
                onMouseLeave={() => {
                  onHoverUf(null);
                  setTooltip(null);
                }}
              />
            );
          })}
        </g>
      </svg>

      {/* Tooltip relativo ao container SVG */}
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-white/95 backdrop-blur-md px-5 py-3 rounded-xl shadow-2xl border border-slate-200 text-sm z-50 min-w-[160px]"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
            transform: 'translate(-50%, -120%)'
          }}
        >
          <div className="font-bold text-slate-900 text-base">{tooltip.sigla}</div>
          <div className="text-slate-700 mt-1 flex items-center gap-2">
            <span className="font-semibold">{tooltip.count.toLocaleString('pt-BR')}</span>
            <span>processos</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTES RESTANTES (mantidos iguais, mas com pequenas otimizações)
// ─────────────────────────────────────────────────────────────────────────────

const UfRanking = ({ ranking, selectedUf, onSelectUf, maxValue }) => (
  <div className="space-y-3 overflow-y-auto pr-4 h-full custom-scrollbar">
    {ranking.map(({ uf, qtd }) => {
      const isSelected = selectedUf === uf;
      const percentage = maxValue > 0 ? (qtd / maxValue) * 100 : 0;
      return (
        <div 
          key={uf}
          onClick={() => onSelectUf(isSelected ? null : uf)}
          className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all duration-300
            ${isSelected ? 'bg-blue-50 border border-blue-200 shadow-md' : 'hover:bg-neutral-50 hover:shadow-sm'}`}
        >
          <div className="w-12 h-12 rounded-lg bg-neutral-100 flex items-center justify-center font-bold text-lg text-neutral-700 shadow-sm">
            {uf}
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-neutral-600">Processos</span>
              <span className="text-sm font-bold text-neutral-800">{qtd.toLocaleString('pt-BR')}</span>
            </div>
            <div className="h-2.5 bg-neutral-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-600 transition-all duration-700 ease-out"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        </div>
      );
    })}
    {ranking.length === 0 && (
      <div className="text-center text-neutral-500 py-12 italic">Nenhum dado para exibir no ranking</div>
    )}
  </div>
);

const SituacaoPieChart = ({ data, selectedSituacao, onSelectSituacao, colors }) => {
  if (data.length === 0) return <div className="h-full flex items-center justify-center text-neutral-500">Sem dados</div>;

  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={320}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius="55%"
          outerRadius="85%"
          paddingAngle={3}
          dataKey="value"
          label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
          labelLine={false}
        >
          {data.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={colors[index % colors.length]}
              stroke={selectedSituacao === entry.name ? '#2563eb' : 'none'}
              strokeWidth={4}
              onClick={() => onSelectSituacao(selectedSituacao === entry.name ? null : entry.name)}
              className="cursor-pointer transition-opacity duration-200 hover:opacity-90"
            />
          ))}
        </Pie>
        <RechartsTooltip />
        <Legend verticalAlign="bottom" height={50} iconSize={12} />
      </PieChart>
    </ResponsiveContainer>
  );
};

const YearlyLineChart = ({ data }) => {
  if (data.length === 0) return <div className="h-full flex items-center justify-center text-neutral-500">Sem dados anuais</div>;

  const formatNumber = (value) => value.toLocaleString('pt-BR');

  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={320}>
      <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="ano" stroke="#64748b" />
        <YAxis stroke="#64748b" tickFormatter={formatNumber} />
        <RechartsTooltip formatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`} />
        <Legend verticalAlign="top" height={40} />
        <Line type="monotone" dataKey="valor" stroke="#2563eb" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 8 }} />
      </LineChart>
    </ResponsiveContainer>
  );
};

const AdvancedDataTable = ({ data, columns, globalFilter, setGlobalFilter }) => {
  const table = useReactTable({
    data,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: DEFAULT_PAGE_SIZE } },
  });

  return (
    <div className="flex flex-col h-full">
      <div className="overflow-auto flex-1">
        <table className="w-full text-sm text-left text-neutral-700 divide-y divide-neutral-200">
          <thead className="bg-neutral-50 sticky top-0 z-10">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th 
                    key={header.id}
                    className="px-6 py-4 font-semibold text-neutral-600 uppercase tracking-wider cursor-pointer hover:text-blue-600"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() && (header.column.getIsSorted() === 'desc' ? ' ▼' : ' ▲')}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map(row => (
                <tr key={row.id} className="hover:bg-blue-50/50 transition-colors">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-6 py-4 whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="text-center py-12 text-neutral-500 italic">
                  Nenhum registro encontrado com os filtros aplicados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between items-center p-5 border-t border-neutral-200 bg-neutral-50">
        <button 
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          className="px-5 py-2 bg-white border border-neutral-300 rounded-lg disabled:opacity-40 hover:bg-neutral-100 flex items-center gap-2"
        >
          <ChevronLeft size={16} /> Anterior
        </button>
        <span className="text-sm font-medium text-neutral-600">
          Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount() || 1}
        </span>
        <button 
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          className="px-5 py-2 bg-white border border-neutral-300 rounded-lg disabled:opacity-40 hover:bg-neutral-100 flex items-center gap-2"
        >
          Próxima <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function DashboardSneaElis() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [geoFeatures, setGeoFeatures] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedState, setSelectedState] = useState(null);
  const [selectedSituacao, setSelectedSituacao] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [hoveredState, setHoveredState] = useState(null);
  const [tableGlobalFilter, setTableGlobalFilter] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const geoRes = await fetch(GEO_JSON_URL);
      if (!geoRes.ok) throw new Error(`GeoJSON: ${geoRes.status}`);
      const geoJson = await geoRes.json();
      setGeoFeatures(geoJson.features || []);

      let allData = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: chunk, error } = await supabase
          .from('formalizacoes')
          .select('*')
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw error;
        allData = [...allData, ...chunk];
        hasMore = chunk.length === pageSize;
        page++;
      }

    const normalized = allData.map(item => {
      let anoStr = String(item.ANO || item.ano || 'ND').trim();
      const ano = /\d{4}/.test(anoStr) ? parseInt(anoStr, 10).toString() : 'ND';

      // ──── Correção aqui ────
      const situacionalRaw = item['SITUACIONAL '] || item.SITUACIONAL || '';
      let situacao = String(situacionalRaw).trim().toUpperCase();

      // Opcional: padronizar alguns valores parecidos
      if (situacao.includes('PUBLICADA SEM'))    situacao = 'PUBLICADA SEM CUSTOS';
      if (situacao.includes('PUBLICADA COM'))    situacao = 'PUBLICADA COM CUSTOS';
      if (situacao.includes('PENDENTE DE PUB'))  situacao = 'PENDENTE DE PUBLICAÇÃO';
      if (situacao.includes('CONCLUÍDA') || situacao.includes('CONCLUIDA')) situacao = 'CONCLUÍDA';

      return {
        ...item,
        valor: parseFloat(String(item['VALOR REPASSE'] || 0).replace(/[^\d.-]/g, '')) || 0,
        uf: String(item.UF || item.uf || 'ND').toUpperCase().trim(),
        situacao,   // ← agora vem correto
        ano,
        processo: String(item.PROCESSO || item.processo || 'ND').trim(),
        entidade: String(item.ENTIDADE || item.entidade || 'DESCONHECIDA').trim()
      };
    });

      setData(normalized);
    } catch (err) {
      setError(err.message || 'Falha ao carregar dados');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredData = useMemo(() => 
    data.filter(row => {
      const searchMatch = !searchQuery || Object.values(row).some(v => 
        String(v).toLowerCase().includes(searchQuery.toLowerCase())
      );
      const stateMatch = !selectedState || row.uf === selectedState;
      const situacaoMatch = !selectedSituacao || row.situacao === selectedSituacao;
      const yearMatch = !selectedYear || row.ano === selectedYear;
      return searchMatch && stateMatch && situacaoMatch && yearMatch;
    }),
  [data, searchQuery, selectedState, selectedSituacao, selectedYear]);

  const metrics = useMemo(() => {
    const totalValue = filteredData.reduce((sum, r) => sum + r.valor, 0);
    const totalCount = filteredData.length;
    const completed = filteredData.filter(r => COMPLETED_STATUSES.includes(r.situacao)).length;
    const efficiency = totalCount > 0 ? (completed / totalCount * 100).toFixed(1) : '0.0';

    const stateAgg = filteredData.reduce((acc, r) => {
      acc[r.uf] = (acc[r.uf] || 0) + 1;
      return acc;
    }, {});

    const situacaoAgg = filteredData.reduce((acc, r) => {
      acc[r.situacao] = (acc[r.situacao] || 0) + 1;
      return acc;
    }, {});

    const yearAgg = filteredData.reduce((acc, r) => {
      acc[r.ano] = (acc[r.ano] || 0) + r.valor;
      return acc;
    }, {});

    const stateRanking = Object.entries(stateAgg)
      .map(([uf, qtd]) => ({ uf, qtd }))
      .sort((a, b) => b.qtd - a.qtd);

    const situacaoData = Object.entries(situacaoAgg)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const yearlyData = Object.entries(yearAgg)
      .map(([ano, valor]) => ({ ano, valor }))
      .sort((a, b) => (parseInt(a.ano) || 9999) - (parseInt(b.ano) || 9999));

    let yearlyGrowth = 'N/A';
    let growthColor = 'text-neutral-500';
    let growthIcon = <HelpCircle size={12} />;
    if (yearlyData.length >= 2) {
      const last = yearlyData[yearlyData.length - 1].valor;
      const prev = yearlyData[yearlyData.length - 2].valor;
      const growth = prev > 0 ? ((last - prev) / prev * 100).toFixed(1) : '∞';
      yearlyGrowth = `${growth}%`;
      growthColor = parseFloat(growth) > 0 ? 'text-green-600' : 'text-red-600';
      growthIcon = parseFloat(growth) > 0 ? <ArrowUpRight size={12} /> : <TrendingDown size={12} />;
    }

    const maxStateValue = Math.max(...Object.values(stateAgg), 1);

    const filterOptions = {
      years: [...new Set(data.map(r => r.ano).filter(Boolean))].sort((a,b) => b.localeCompare(a)),
      situacoes: [...new Set(data.map(r => r.situacao).filter(Boolean))].sort()
    };

    return {
      totalValue: totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }),
      totalCount: totalCount.toLocaleString('pt-BR'),
      averageValue: totalCount > 0 ? (totalValue / totalCount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00',
      efficiency: `${efficiency}%`,
      yearlyGrowth,
      growthColor,
      growthIcon,
      stateRanking,
      situacaoData,
      yearlyData,
      maxStateValue,
      filterOptions
    };
  }, [filteredData, data]);

  const tableColumns = useMemo(() => [
    { accessorKey: 'processo', header: 'Processo', cell: ({ getValue }) => <span className="font-mono">{getValue()}</span> },
    { accessorKey: 'entidade', header: 'Entidade', cell: ({ getValue }) => <span className="truncate max-w-xs">{getValue()}</span> },
    { accessorKey: 'uf', header: 'UF', cell: ({ getValue }) => <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium">{getValue()}</span> },
    { accessorKey: 'valor', header: 'Valor', cell: ({ getValue }) => getValue().toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
    { 
      accessorKey: 'situacao', 
      header: 'Situação',
      cell: ({ getValue }) => {
        const v = getValue();
        const done = COMPLETED_STATUSES.includes(v);
        return <span className={`px-3 py-1 rounded-full text-xs font-medium ${done ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{v}</span>;
      }
    },
    { accessorKey: 'ano', header: 'Ano' }
  ], []);

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Formalizacoes");
    XLSX.writeFile(wb, `SNEAELIS_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-700">Carregando SNEAELIS Intelligence</h2>
          <p className="text-gray-500 mt-2">Acessando Supabase e GeoJSON...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorAlert message={error} onRetry={loadData} />;
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* SIDEBAR */}
      <aside className="w-72 bg-slate-950 text-white flex flex-col">
        <div className="p-6 border-b border-slate-800 flex items-center gap-4">
          <Layers className="text-blue-500" size={32} />
          <div>
            <h1 className="text-2xl font-bold">SNEAELIS</h1>
            <p className="text-sm text-slate-400">Intelligence PRO</p>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button className="w-full flex items-center gap-4 p-4 rounded-xl bg-blue-600 text-white font-medium">
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <button onClick={() => navigate('/tabela')} className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-slate-800 transition-colors">
            <TableIcon size={20} /> Tabela Completa
          </button>
          {/* outros botões... */}
        </nav>
        <div className="p-6 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold">PD</div>
            <div>
              <p className="font-medium">Pedro Dias</p>
              <p className="text-sm text-slate-400">Analista Sênior</p>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto p-8 space-y-8">
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="relative flex-1 max-w-2xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por processo, entidade, UF ou situação..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <FilterSelect label="Ano" value={selectedYear} onChange={setSelectedYear} options={metrics.filterOptions.years} />
            <FilterSelect label="Situação" value={selectedSituacao} onChange={setSelectedSituacao} options={metrics.filterOptions.situacoes} />
            <button onClick={() => {
              setSearchQuery('');
              setSelectedState(null);
              setSelectedSituacao(null);
              setSelectedYear(null);
              setTableGlobalFilter('');
            }} className="p-3 bg-gray-100 rounded-xl hover:bg-gray-200">
              <RefreshCw size={20} />
            </button>
            <button onClick={exportToExcel} className="px-6 py-3 bg-blue-600 text-white rounded-xl flex items-center gap-2 hover:bg-blue-700">
              <Download size={20} /> Exportar
            </button>
          </div>
        </header>

        {/* KPIs */}
        <section className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
          <KpiCard icon={DollarSign} title="Valor Total" value={metrics.totalValue} color="success" />
          <KpiCard icon={Box} title="Processos" value={metrics.totalCount} color="primary" />
          <KpiCard icon={Target} title="Eficiência" value={metrics.efficiency} color="warning" />
          <KpiCard icon={MapPin} title="Estados" value={metrics.stateRanking.length} isActive={!!selectedState} onClick={() => setSelectedState(null)} />
          <KpiCard icon={TrendingUp} title="Evolução" value={metrics.yearlyGrowth} color="info" subtitle={{ text: 'vs anterior', color: metrics.growthColor, icon: metrics.growthIcon }} />
        </section>

        {/* MAPA + RANKING */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 h-[650px] flex flex-col">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-3">
              <Globe className="text-blue-600" size={24} /> Mapa do Brasil
            </h3>
            <BrazilMap
              features={geoFeatures}
              data={metrics.stateRanking}
              selectedUf={selectedState}
              onSelectUf={setSelectedState}
              hoveredState={hoveredState}
              onHoverUf={setHoveredState}
              maxValue={metrics.maxStateValue}
            />
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 h-[650px] flex flex-col">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-3">
              <BarChart3 className="text-indigo-600" size={24} /> Ranking UF
            </h3>
            <UfRanking
              ranking={metrics.stateRanking}
              selectedUf={selectedState}
              onSelectUf={setSelectedState}
              maxValue={metrics.maxStateValue}
            />
          </div>
        </section>

        {/* GRÁFICOS */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 h-[500px]">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-3">
              <PieIcon className="text-purple-600" size={24} /> Distribuição de Situações
            </h3>
            <SituacaoPieChart
              data={metrics.situacaoData}
              selectedSituacao={selectedSituacao}
              onSelectSituacao={setSelectedSituacao}
              colors={UI_THEME.colors}
            />
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 h-[500px]">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-3">
              <LineIcon className="text-green-600" size={24} /> Evolução Anual
            </h3>
            <YearlyLineChart data={metrics.yearlyData} />
          </div>
        </section>

        {/* TABELA */}
        <section className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-xl font-bold flex items-center gap-3">
              <List className="text-orange-600" size={24} /> Registros Detalhados
            </h3>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Filtrar tabela..."
                value={tableGlobalFilter}
                onChange={e => setTableGlobalFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="h-[600px]">
            <AdvancedDataTable
              data={filteredData}
              columns={tableColumns}
              globalFilter={tableGlobalFilter}
              setGlobalFilter={setTableGlobalFilter}
            />
          </div>
        </section>
      </main>
    </div>
  );
}