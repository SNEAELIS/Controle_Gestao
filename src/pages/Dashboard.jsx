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
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import { geoPath, geoMercator } from 'd3-geo';
import { scaleLinear } from 'd3-scale';
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  getPaginationRowModel, flexRender, getFilteredRowModel
} from '@tanstack/react-table';
import * as XLSX from 'xlsx';
import { supabase } from '../services/supabaseClient';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// ─────────────────────────────────────────────────────────────────────────────
// TEMA CENTRALIZADO (substitui o antigo UI_THEME)
// Recomendação: mover para arquivo separado (ex: src/config/theme.js)
// ─────────────────────────────────────────────────────────────────────────────
const theme = {
  colors: {
    primary:    '#2563eb',
    primaryDark:'#1d4ed8',
    primaryLight:'#60a5fa',
    success:    '#10b981',
    warning:    '#f59e0b',
    danger:     '#ef4444',
    info:       '#0ea5e9',
    purple:     '#8b5cf6',
    indigo:     '#6366f1',
    teal:       '#14b8a6',
    pink:       '#ec4899',
    orange:     '#f97316',
  },
  neutrals: {
    50:  '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
    950: '#030712',
  },
  background: '#f8fafc',
  sidebar:    '#020617',
  card:       '#ffffff',
  border:     '#e2e8f0',
  text: {
    primary:   '#0f172a',
    secondary: '#475569',
    muted:     '#64748b',
  },
  chartPalette: [
    '#2563eb', '#10b981', '#8b5cf6', '#f59e0b',
    '#0ea5e9', '#ec4899', '#ef4444', '#14b8a6'
  ]
};

// Cores semânticas para componentes (facilita manutenção)
const colorMap = {
  primary:   theme.colors.primary,
  success:   theme.colors.success,
  warning:   theme.colors.warning,
  danger:    theme.colors.danger,
  info:      theme.colors.info,
  purple:    theme.colors.purple,
  indigo:    theme.colors.indigo,
  orange:    theme.colors.orange,
};

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES DO SISTEMA
// ─────────────────────────────────────────────────────────────────────────────
const GEO_JSON_URL = "https://raw.githubusercontent.com/giuliano-macedo/geodata-br-states/main/geojson/br_states.json";

const COMPLETED_STATUSES = [
  'REALIZADO', 'CONCLUÍDO', 'FINALIZADO', 'APROVADO', 'EXECUTADO',
  'EFETIVADO', 'PAGO', 'SIM', 'PUBLICADA COM CUSTOS', 'PUBLICADA SEM CUSTOS'
];

const DEFAULT_PAGE_SIZE = 15;

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTES DE UI
// ─────────────────────────────────────────────────────────────────────────────

const KpiCard = ({ icon: Icon, title, value, subtitle, color = 'primary', isActive = false, onClick, tooltip }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const bgColor   = colorMap[color] || theme.colors.primary;
  const lightBg   = `${color}-50` in theme.colors ? theme.colors[`${color}50`] : `${bgColor}22`;
  const textColor = color === 'warning' ? '#92400e' : '#ffffff';

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      className="relative overflow-hidden group bg-white rounded-3xl p-6 shadow-md border border-gray-200 transition-all duration-300 cursor-pointer hover:shadow-xl hover:scale-[1.02]"
      style={{ borderColor: isActive ? bgColor : undefined }}
    >
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
          {subtitle && (
            <p className="text-xs font-medium flex items-center gap-1" style={{ color: subtitle.color || theme.colors.muted }}>
              {subtitle.icon} {subtitle.text}
            </p>
          )}
        </div>
        <div className="p-3 rounded-xl" style={{ backgroundColor: lightBg, color: bgColor }}>
          <Icon size={24} />
        </div>
      </div>
      <div
        className="absolute bottom-0 left-0 w-full h-1 scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"
        style={{ backgroundColor: bgColor }}
      />
      {showTooltip && tooltip && (
        <div className="absolute z-20 top-full left-1/2 -translate-x-1/2 mt-3 bg-white p-3 rounded-lg shadow-xl border border-gray-200 text-xs max-w-xs whitespace-pre-line">
          {tooltip}
        </div>
      )}
    </div>
  );
};

const FilterSelect = ({ label, value, onChange, options, icon: Icon = Filter }) => (
  <div className="relative min-w-[160px]">
    <Icon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value || null)}
      className="appearance-none bg-white border border-gray-200 rounded-xl px-4 py-2 pr-10 text-sm font-medium text-gray-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pl-10 w-full"
    >
      <option value="">{label}</option>
      {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
    </select>
    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
  </div>
);

const ErrorAlert = ({ message, onRetry }) => (
  <div className="bg-red-50 border border-red-200 rounded-2xl p-8 flex flex-col items-center gap-5 text-red-800 max-w-xl mx-auto text-center my-12">
    <AlertTriangle size={64} className="text-red-500" />
    <div>
      <h3 className="text-2xl font-bold mb-2">Erro ao carregar dados</h3>
      <p className="text-lg">{message}</p>
    </div>
    <button
      onClick={onRetry}
      className="px-8 py-4 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium shadow-sm"
    >
      Tentar novamente
    </button>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAPA DO BRASIL
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

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        if (clientWidth > 50 && clientHeight > 50) {
          setDimensions({ width: clientWidth, height: clientHeight });
        }
      }
    };

    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    updateDimensions();

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (dimensions.width > 100 && dimensions.height > 100 && features?.length > 0) {
      setMapReady(true);
    }
  }, [dimensions, features]);

  if (!mapReady || !features || features.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-5">
        <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-blue-500 border-b-transparent"></div>
        <p className="text-xl font-medium">Carregando mapa do Brasil...</p>
      </div>
    );
  }

  const projection = geoMercator().fitExtent([[40, 40], [dimensions.width - 40, dimensions.height - 40]], { type: 'FeatureCollection', features });
  const pathGenerator = geoPath().projection(projection);

  const colorScale = scaleLinear()
    .domain([0, maxValue || 1])
    .range([theme.neutrals[200], theme.colors.primaryDark]);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-gradient-to-br from-gray-50 to-white rounded-xl">
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} viewBox={`0 0 ${dimensions.width} ${dimensions.height}`} className="w-full h-full">
        <g>
          {features.map((feature, index) => {
            const sigla = String(feature.properties.SIGLA || feature.properties.sigla || feature.properties.UF || '').toUpperCase().trim();
            const ufData = data.find(u => u.uf === sigla);
            const count = ufData?.qtd ?? 0;
            const isSelected = selectedUf === sigla;
            const isHovered = hoveredState === sigla;

            const fillColor = isSelected
              ? theme.colors.primaryDark
              : isHovered
              ? theme.colors.primaryLight
              : count > 0
              ? colorScale(count)
              : theme.neutrals[100];

            return (
              <path
                key={`state-${sigla}-${index}`}
                d={pathGenerator(feature)}
                fill={fillColor}
                stroke={theme.neutrals[400]}
                strokeWidth={isSelected || isHovered ? 2.2 : 0.8}
                className="transition-all duration-200 ease-out cursor-pointer hover:brightness-110 active:brightness-90"
                onClick={() => onSelectUf(isSelected ? null : sigla)}
                onMouseEnter={(e) => {
                  onHoverUf(sigla);
                  const rect = svgRef.current?.getBoundingClientRect();
                  if (rect) setTooltip({ x: e.clientX - rect.left + 24, y: e.clientY - rect.top + 24, sigla, count });
                }}
                onMouseMove={(e) => {
                  const rect = svgRef.current?.getBoundingClientRect();
                  if (rect && tooltip) setTooltip(prev => ({ ...prev, x: e.clientX - rect.left + 24, y: e.clientY - rect.top + 24 }));
                }}
                onMouseLeave={() => { onHoverUf(null); setTooltip(null); }}
              />
            );
          })}
        </g>
      </svg>

      {tooltip && (
        <div
          className="absolute pointer-events-none bg-white/95 backdrop-blur-sm px-5 py-3 rounded-xl shadow-2xl border border-gray-200 text-sm z-50 min-w-[170px] font-medium"
          style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px`, transform: 'translate(-50%, -130%)' }}
        >
          <div className="font-bold text-gray-900 text-base">{tooltip.sigla}</div>
          <div className="text-gray-700 mt-1 flex items-center gap-2">
            <span className="font-semibold">{tooltip.count.toLocaleString('pt-BR')}</span>
            <span>processos</span>
          </div>
        </div>
      )}
    </div>
  );
};

const UfRanking = ({ ranking, selectedUf, onSelectUf, maxValue }) => (
  <div className="space-y-3 overflow-y-auto pr-5 h-full custom-scrollbar">
    {ranking.map(({ uf, qtd }) => {
      const isSelected = selectedUf === uf;
      const percentage = maxValue > 0 ? (qtd / maxValue) * 100 : 0;

      return (
        <div
          key={uf}
          onClick={() => onSelectUf(isSelected ? null : uf)}
          className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all duration-300
            ${isSelected ? 'bg-blue-50 border-2 border-blue-300 shadow-md' : 'hover:bg-gray-50 hover:shadow-sm border border-transparent'}`}
        >
          <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center font-bold text-lg text-gray-700 shadow-sm">
            {uf}
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-600">Processos</span>
              <span className="text-sm font-bold text-gray-900">{qtd.toLocaleString('pt-BR')}</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-700 ease-out"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        </div>
      );
    })}
  </div>
);

const InstrumentoPieChart = ({ data, selectedInstrumento, onSelectInstrumento, colors }) => {
  if (data.length === 0) return <div className="h-full flex items-center justify-center text-gray-500 font-medium">Sem dados para exibir</div>;

  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={340}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius="58%"
          outerRadius="88%"
          paddingAngle={4}
          dataKey="value"
          label={({ name, percent }) => percent > 0.045 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
          labelLine={false}
        >
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={colors[index % colors.length]}
              stroke={selectedInstrumento === entry.name ? theme.colors.primary : 'none'}
              strokeWidth={5}
              onClick={() => onSelectInstrumento(selectedInstrumento === entry.name ? null : entry.name)}
              className="cursor-pointer transition-all duration-200 hover:opacity-90 active:opacity-75"
            />
          ))}
        </Pie>
        <RechartsTooltip />
        <Legend verticalAlign="bottom" height={60} iconSize={14} wrapperStyle={{ fontSize: '0.875rem' }} />
      </PieChart>
    </ResponsiveContainer>
  );
};

const YearlyLineChart = ({ data }) => {
  if (data.length === 0) return <div className="h-full flex items-center justify-center text-gray-500 font-medium">Sem dados anuais disponíveis</div>;

  const formatNumber = (value) => value.toLocaleString('pt-BR');

  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={340}>
      <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 10 }}>
        <CartesianGrid strokeDasharray="4 4" stroke={theme.neutrals[200]} />
        <XAxis dataKey="ano" stroke={theme.neutrals[600]} />
        <YAxis stroke={theme.neutrals[600]} tickFormatter={formatNumber} />
        <RechartsTooltip formatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`} />
        <Legend verticalAlign="top" height={50} />
        <Line
          type="monotone"
          dataKey="valor"
          stroke={theme.colors.primary}
          strokeWidth={3}
          dot={{ r: 5, strokeWidth: 2 }}
          activeDot={{ r: 9, strokeWidth: 2 }}
        />
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
        <table className="w-full text-sm text-left text-gray-700 divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0 z-10">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className="px-6 py-4 font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:text-blue-700 select-none"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() && (header.column.getIsSorted() === 'desc' ? ' ▼' : ' ▲')}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100">
            {table.getRowModel().rows.length > 0 ? table.getRowModel().rows.map(row => (
              <tr key={row.id} className="hover:bg-blue-50/40 transition-colors">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-6 py-4 whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            )) : (
              <tr>
                <td colSpan={columns.length} className="text-center py-16 text-gray-500 italic text-lg">
                  Nenhum registro encontrado com os filtros aplicados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col sm:flex-row justify-between items-center p-6 border-t border-gray-200 bg-gray-50 gap-4 sm:gap-0">
        <button
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          className="px-6 py-2.5 bg-white border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-100 flex items-center gap-2 font-medium"
        >
          <ChevronLeft size={16} /> Anterior
        </button>
        <span className="text-sm font-medium text-gray-600">
          Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount() || 1}
        </span>
        <button
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          className="px-6 py-2.5 bg-white border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-100 flex items-center gap-2 font-medium"
        >
          Próxima <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// GERAÇÃO DE PDF CORRIGIDA (usando autoTable como função importada)
// ─────────────────────────────────────────────────────────────────────────────
const generatePDF = (filteredData, metrics) => {
  const doc = new jsPDF({ orientation: 'landscape' });

  autoTable(doc, {
    startY: 30,
    head: [['Processo', 'Entidade', 'UF', 'Valor (R$)', 'Instrumento', 'Ano', 'Situação']],
    body: filteredData.map(row => [
      row.processo,
      row.entidade,
      row.uf,
      row.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }),
      row.instrumento,
      row.ano,
      row.situacao
    ]),
    theme: 'grid',
    headStyles: { fillColor: [0, 102, 204] },
    didDrawPage: (data) => {
      doc.setFillColor(0, 102, 204);
      doc.rect(0, 0, doc.internal.pageSize.getWidth(), 20, 'F');
      doc.setTextColor(255);
      doc.setFontSize(12);
      doc.text("MESP - Relatório SNEA-ELIS", 10, 10);
      doc.setTextColor(0);
      doc.setFontSize(10);
      doc.text(`Total: ${metrics.totalValue}`, 10, 25);
    }
  });

  doc.save(`SNEA_ELIS_${new Date().toISOString().split('T')[0]}.pdf`);
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL DO DASHBOARD (adaptado para responsivo: grids com sm/md/lg, flex-wrap, etc.)
// ─────────────────────────────────────────────────────────────────────────────
export default function DashboardSneaElis() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [geoFeatures, setGeoFeatures] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedState, setSelectedState] = useState(null);
  const [selectedInstrumento, setSelectedInstrumento] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [hoveredState, setHoveredState] = useState(null);
  const [tableGlobalFilter, setTableGlobalFilter] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const geoRes = await fetch(GEO_JSON_URL);
      if (!geoRes.ok) throw new Error(`GeoJSON fetch failed: ${geoRes.status}`);
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

        let situacionalRaw = item.SITUACIONAL || item['SITUACIONAL '] || '';
        let situacao = String(situacionalRaw).trim().toUpperCase();
        if (!situacao || situacao === '—' || situacao === '') situacao = 'NÃO SE APLICA';
        if (situacao.includes('PENDENTE')) situacao = 'PENDENTE';
        if (situacao.includes('REJEIT')) situacao = 'REJEITADO';
        if (situacao.includes('CANCEL')) situacao = 'CANCELADO';
        if (situacao.includes('REALIZADO')) situacao = 'REALIZADO';

        let instrumentoRaw = item.INSTRUMENTO || item.instrumento || 'ND';
        let instrumento = String(instrumentoRaw).trim().toUpperCase();

        return {
          ...item,
          valor: parseFloat(String(item['VALOR REPASSE'] || 0).replace(/[^\d.-]/g, '')) || 0,
          uf: String(item.UF || item.uf || 'ND').toUpperCase().trim(),
          situacao,
          instrumento,
          ano,
          processo: String(item.PROCESSO || item.processo || 'ND').trim(),
          entidade: String(item.ENTIDADE || item.entidade || 'DESCONHECIDA').trim()
        };
      });

      setData(normalized);
    } catch (err) {
      setError(err.message || 'Falha ao carregar os dados');
      console.error('Erro no loadData:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredData = useMemo(() =>
    data.filter(row => {
      const searchMatch = !searchQuery || Object.values(row).some(v =>
        String(v).toLowerCase().includes(searchQuery.toLowerCase())
      );
      const stateMatch    = !selectedState    || row.uf === selectedState;
      const instrumentoMatch = !selectedInstrumento || row.instrumento === selectedInstrumento;
      const yearMatch     = !selectedYear     || row.ano === selectedYear;
      return searchMatch && stateMatch && instrumentoMatch && yearMatch;
    }),
  [data, searchQuery, selectedState, selectedInstrumento, selectedYear]);

  const metrics = useMemo(() => {
    const totalValue  = filteredData.reduce((sum, r) => sum + r.valor, 0);
    const totalCount  = filteredData.length;
    const completed   = filteredData.filter(r => COMPLETED_STATUSES.includes(r.situacao)).length;
    const efficiency  = totalCount > 0 ? (completed / totalCount * 100).toFixed(1) : '0.0';

    const stateAgg = filteredData.reduce((acc, r) => {
      acc[r.uf] = (acc[r.uf] || 0) + 1;
      return acc;
    }, {});

    const instrumentoAgg = filteredData.reduce((acc, r) => {
      acc[r.instrumento] = (acc[r.instrumento] || 0) + 1;
      return acc;
    }, {});

    const yearAgg = filteredData.reduce((acc, r) => {
      acc[r.ano] = (acc[r.ano] || 0) + r.valor;
      return acc;
    }, {});

    const stateRanking = Object.entries(stateAgg)
      .map(([uf, qtd]) => ({ uf, qtd }))
      .sort((a, b) => b.qtd - a.qtd);

    const instrumentoData = Object.entries(instrumentoAgg)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const yearlyData = Object.entries(yearAgg)
      .map(([ano, valor]) => ({ ano, valor }))
      .sort((a, b) => parseInt(a.ano || 9999) - parseInt(b.ano || 9999));

    let yearlyGrowth = 'N/A';
    let growthColor = 'text-gray-500';
    let growthIcon = <HelpCircle size={12} />;

    if (yearlyData.length >= 2) {
      const last = yearlyData[yearlyData.length - 1].valor;
      const prev = yearlyData[yearlyData.length - 2].valor;
      const growth = prev > 0 ? ((last - prev) / prev * 100).toFixed(1) : '∞';
      yearlyGrowth = `${growth}%`;
      growthColor = parseFloat(growth) > 0 ? 'text-emerald-600' : 'text-red-600';
      growthIcon = parseFloat(growth) > 0 ? <ArrowUpRight size={12} /> : <TrendingDown size={12} />;
    }

    const maxStateValue = Math.max(...Object.values(stateAgg), 1);

    const filterOptions = {
      years: [...new Set(data.map(r => r.ano).filter(Boolean))].sort((a,b) => b.localeCompare(a)),
      instrumentos: [...new Set(data.map(r => r.instrumento).filter(Boolean))].sort()
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
      instrumentoData,
      yearlyData,
      maxStateValue,
      filterOptions
    };
  }, [filteredData, data]);

  const tableColumns = useMemo(() => [
    { accessorKey: 'processo', header: 'Processo', cell: ({ getValue }) => <span className="font-mono text-sm">{getValue()}</span> },
    { accessorKey: 'entidade', header: 'Entidade', cell: ({ getValue }) => <span className="truncate max-w-xs">{getValue()}</span> },
    { accessorKey: 'uf', header: 'UF', cell: ({ getValue }) => (
      <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium">{getValue()}</span>
    )},
    { accessorKey: 'valor', header: 'Valor', cell: ({ getValue }) => getValue().toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
    {
      accessorKey: 'instrumento',
      header: 'Instrumento',
      cell: ({ getValue }) => {
        const v = getValue();
        return <span className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">{v}</span>;
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
          <p className="text-gray-500 mt-2">Buscando formalizações e atualizando métricas...</p>
        </div>
      </div>
    );
  }

  if (error) return <ErrorAlert message={error} onRetry={loadData} />;

  return (
    <div className="flex flex-col sm:flex-row h-screen bg-gray-50 overflow-hidden">
      {/* SIDEBAR */}
      <aside className="w-full sm:w-72 bg-gray-950 text-white flex flex-col">
        <div className="p-4 sm:p-6 border-b border-gray-800 flex items-center gap-4">
          <Layers className="text-blue-500" size={32} />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">SNEAELIS</h1>
            <p className="text-xs sm:text-sm text-gray-400">Intelligence PRO • 2026</p>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button className="w-full flex items-center gap-4 p-4 rounded-xl bg-blue-700 text-white font-medium">
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <button
            onClick={() => navigate('/tabela')}
            className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-gray-800 transition-colors"
          >
            <TableIcon size={20} /> Tabela Completa
          </button>
        </nav>
        <div className="p-4 sm:p-6 border-t border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white">PD</div>
            <div>
              <p className="font-medium">Pedro Dias</p>
              <p className="text-sm text-gray-400">Analista Sênior</p>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="relative flex-1 max-w-2xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por processo, entidade, UF ou instrumento..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <FilterSelect label="Ano" value={selectedYear} onChange={setSelectedYear} options={metrics.filterOptions.years} />
            <FilterSelect label="Instrumento" value={selectedInstrumento} onChange={setSelectedInstrumento} options={metrics.filterOptions.instrumentos} />
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedState(null);
                setSelectedInstrumento(null);
                setSelectedYear(null);
                setTableGlobalFilter('');
              }}
              className="p-3 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              title="Limpar todos os filtros"
            >
              <RefreshCw size={20} />
            </button>
            <button
              onClick={exportToExcel}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Download size={20} /> Exportar XLSX
            </button>
          </div>
        </header>

        {/* KPIs */}
        <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          <KpiCard icon={DollarSign} title="Valor Total" value={metrics.totalValue} color="success" tooltip="Soma de todos os valores de repasse filtrados" />
          <KpiCard icon={Box} title="Processos" value={metrics.totalCount} color="primary" tooltip="Quantidade total de processos" />
          <KpiCard icon={Target} title="Eficiência" value={metrics.efficiency} color="warning" tooltip="Percentual de processos concluídos / realizados" />
          <KpiCard
            icon={MapPin}
            title="Estados"
            value={metrics.stateRanking.length}
            color="info"
            isActive={!!selectedState}
            onClick={() => setSelectedState(null)}
            tooltip="Quantidade de UFs com pelo menos 1 processo"
          />
          <KpiCard
            icon={TrendingUp}
            title="Evolução"
            value={metrics.yearlyGrowth}
            color="purple"
            subtitle={{ text: 'vs ano anterior', color: metrics.growthColor, icon: metrics.growthIcon }}
            tooltip="Variação percentual do valor total em relação ao ano anterior"
          />
        </section>

        {/* MAPA + RANKING */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 h-[450px] sm:h-[650px] flex flex-col">
            <h3 className="text-xl font-bold mb-5 flex items-center gap-3">
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

          <div className="bg-white rounded-2xl shadow-lg p-6 h-[450px] sm:h-[650px] flex flex-col">
            <h3 className="text-xl font-bold mb-5 flex items-center gap-3">
              <BarChart3 className="text-indigo-600" size={24} /> Ranking por UF
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
          <div className="bg-white rounded-2xl shadow-lg p-6 h-[400px] sm:h-[520px] flex flex-col">
            <h3 className="text-xl font-bold mb-5 flex items-center gap-3">
              <PieIcon className="text-purple-600" size={24} /> Distribuição por Instrumento
            </h3>
            <InstrumentoPieChart
              data={metrics.instrumentoData}
              selectedInstrumento={selectedInstrumento}
              onSelectInstrumento={setSelectedInstrumento}
              colors={theme.chartPalette}
            />
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 h-[400px] sm:h-[520px] flex flex-col">
            <h3 className="text-xl font-bold mb-5 flex items-center gap-3">
              <LineIcon className="text-emerald-600" size={24} /> Evolução Anual (R$)
            </h3>
            <YearlyLineChart data={metrics.yearlyData} />
          </div>
        </section>

        {/* TABELA */}
        <section className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h3 className="text-xl font-bold flex items-center gap-3">
              <List className="text-orange-600" size={24} /> Registros Detalhados
            </h3>
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Filtrar tabela..."
                value={tableGlobalFilter}
                onChange={e => setTableGlobalFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="h-[400px] sm:h-[620px]">
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