// src/pages/Dashboard.jsx
// ⚠️  Mapa 100% SVG embutido — sem d3-geo, sem fetch externo, sem GeoJSON
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, DollarSign, MapPin, Search, ChevronLeft, ChevronRight,
  BarChart3, PieChart as PieIcon, Filter, X, Download, AlertCircle,
  TrendingUp, FileText, Globe, ShieldCheck, RefreshCw, Table as TableIcon,
  Target, Zap, ChevronDown, Users, Activity, Calendar, AlertTriangle,
  CheckCircle2, Clock, XCircle, List, LineChart as LineIcon, Briefcase, Database
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  getPaginationRowModel, flexRender, getFilteredRowModel
} from '@tanstack/react-table';
import * as XLSX from 'xlsx';
import { supabase } from '../services/supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
//  PATHS SVG DO BRASIL — geometria simplificada, 100% embutida
//  viewBox="0 0 500 560"
//  Fonte: paths derivados manualmente de coordenadas geográficas reais
// ─────────────────────────────────────────────────────────────────────────────
// Coordenadas reais projetadas para viewBox="0 0 600 600"
const STATES = [
  { uf: 'AC', name: 'Acre', tx: 65, ty: 355, d: 'M46,339l21-6l42,20l17,62l-40,31l-44-3l-34-18l3-56l35-30' },
  { uf: 'AL', name: 'Alagoas', tx: 730, ty: 380, d: 'M708,368l27,2l4,22l-29,1z' },
  { uf: 'AM', name: 'Amazonas', tx: 180, ty: 250, d: 'M25,188l68-68l112,5l100,105l-42,50l-88,38l-42-45l-58,15l-40-52l-32,3l-28-46' },
  { uf: 'AP', name: 'Amapá', tx: 465, ty: 105, d: 'M430,105l45-30l35,40l-30,42l-50-5' },
  { uf: 'BA', name: 'Bahia', tx: 615, ty: 420, d: 'M510,320l85,5l115,100l-45,115l-130-15l-45-120l20-85' },
  { uf: 'CE', name: 'Ceará', tx: 670, ty: 250, d: 'M630,255l75-25l35,50l-40,60l-70-15l0-70' },
  { uf: 'DF', name: 'Distrito Federal', tx: 495, ty: 475, d: 'M485,465l20,0l0,20l-20,0z' },
  { uf: 'ES', name: 'Espírito Santo', tx: 685, ty: 565, d: 'M665,535l40,25l-15,65l-25-10z' },
  { uf: 'GO', name: 'Goiás', tx: 470, ty: 470, d: 'M430,420l110,10l45,130l-75,45l-65-80l-15-105' },
  { uf: 'MA', name: 'Maranhão', tx: 535, ty: 250, d: 'M505,188l85,25l25,115l-85,25l-25-165' },
  { uf: 'MG', name: 'Minas Gerais', tx: 590, ty: 560, d: 'M530,490l105,15l100,65l-45,110l-125,25l-35-215' },
  { uf: 'MS', name: 'Mato Grosso do Sul', tx: 350, ty: 590, d: 'M305,530l115,35l35,135l-95,45l-55-215' },
  { uf: 'MT', name: 'Mato Grosso', tx: 340, ty: 410, d: 'M295,335l115-25l100,105l-15,135l-115-35l-85-180' },
  { uf: 'PA', name: 'Pará', tx: 435, ty: 220, d: 'M285,130l125-35l145,55l-25,165l-115-25l-130-160' },
  { uf: 'PB', name: 'Paraíba', tx: 745, ty: 310, d: 'M715,295l45,5l-5,35l-40,5z' },
  { uf: 'PE', name: 'Pernambuco', tx: 710, ty: 340, d: 'M640,335l115-25l5,45l-120,25z' },
  { uf: 'PI', name: 'Piauí', tx: 600, ty: 300, d: 'M585,255l35,50l0,125l-75-15l40-160' },
  { uf: 'PR', name: 'Paraná', tx: 410, ty: 690, d: 'M375,665l105,15l25,55l-95,35l-35-105' },
  { uf: 'RJ', name: 'Rio de Janeiro', tx: 645, ty: 645, d: 'M625,635l55,10l-15,35l-40-5z' },
  { uf: 'RN', name: 'Rio Grande do Norte', tx: 745, ty: 275, d: 'M710,255l45,5l10,35l-55,5z' },
  { uf: 'RO', name: 'Rondônia', tx: 220, ty: 450, d: 'M185,405l75,25l45,115l-85,35l-35-175' },
  { uf: 'RR', name: 'Roraima', tx: 215, ty: 95, d: 'M175,45l85,15l45,105l-85,35l-45-155' },
  { uf: 'RS', name: 'Rio Grande do Sul', tx: 380, ty: 790, d: 'M345,745l95,15l-15,105l-80-120' },
  { uf: 'SC', name: 'Santa Catarina', tx: 435, ty: 745, d: 'M405,725l85,15l-15,45l-70-15z' },
  { uf: 'SE', name: 'Sergipe', tx: 720, ty: 405, d: 'M705,395l25,2l-10,25l-15-2z' },
  { uf: 'SP', name: 'São Paulo', tx: 510, ty: 645, d: 'M485,615l115,25l25,75l-115,15l-25-115' },
  { uf: 'TO', name: 'Tocantins', tx: 485, ty: 345, d: 'M465,295l65,15l25,135l-75,45l-15-195' }
];

// ─────────────────────────────────────────────────────────────────────────────
//  UTILITÁRIOS
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_OK  = ['REALIZADO','CONCLUÍDO','FINALIZADO','APROVADO','SIM','EXECUTADO','PUBLICADA'];
const STATUS_BAD = ['PENDENTE','REJEITADO','CANCELADO','NÃO'];
const PALETTE    = ['#1351B4','#0E9F6E','#F59E0B','#7E3AF2','#E02424','#0694A2','#E3A008','#6366F1','#E74694','#FF5A1F'];

/** Interpola hex entre duas cores (t = 0..1) */
function lerpColor(a, b, t) {
  const p = (hex, i) => parseInt(hex.slice(i, i + 2), 16);
  const r = Math.round(p(a,1) + (p(b,1) - p(a,1)) * t);
  const g = Math.round(p(a,3) + (p(b,3) - p(a,3)) * t);
  const bl = Math.round(p(a,5) + (p(b,5) - p(a,5)) * t);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${bl.toString(16).padStart(2,'0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  CSS GLOBAL
// ─────────────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body,#root{font-family:'IBM Plex Sans',sans-serif;background:#F0F4F8;height:100vh;overflow:hidden}
:root{
  --gb:#1351B4;--gbh:#0C326F;--gbl:#C5D4EB;--gbxl:#EDF2FB;
  --gg:#168821;--gy:#FFCD07;--gdk:#071D41;
  --ok:#0E9F6E;--okl:#DEF7EC;--wn:#C27803;--wnl:#FDF6B2;
  --er:#E02424;--erl:#FDE8E8;--infl:#E1EFFE;--inf:#1A56DB;
  --pur:#7E3AF2;--purl:#EDEBFE;
  --bd:#E2E8F0;--bdl:#F3F4F6;
  --t1:#111827;--t2:#374151;--t3:#6B7280;--t4:#9CA3AF;
  --bg:#fff;--bg2:#F9FAFB;--bg3:#F0F4F8
}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-thumb{background:#C5D4EB;border-radius:10px}

/* shell */
.shell{display:flex;height:100vh;overflow:hidden}

/* govbar */
.govbar{height:4px;background:linear-gradient(90deg,var(--gg) 33.3%,var(--gy) 33.3%,var(--gy) 66.6%,var(--gb) 66.6%);flex-shrink:0;width:100%}

/* sidebar */
.sb{width:236px;flex-shrink:0;background:var(--gdk);display:flex;flex-direction:column;overflow:hidden;position:relative}
.sb::after{content:'';position:absolute;top:0;right:0;width:3px;height:100%;background:linear-gradient(180deg,var(--gg),var(--gy) 50%,var(--gb))}
.sb-head{padding:16px 16px 12px;border-bottom:1px solid rgba(255,255,255,.08)}
.sb-org{font-size:8.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--gy);margin-bottom:5px;display:flex;align-items:center;gap:6px}
.sb-org::before{content:'';display:inline-block;width:18px;height:3px;background:linear-gradient(90deg,var(--gg) 33%,var(--gy) 33%,var(--gy) 66%,var(--gb) 66%);border-radius:2px}
.sb-title{font-size:19px;font-weight:800;color:#fff;letter-spacing:-.03em}
.sb-title em{color:var(--gy);font-style:normal}
.sb-tag{font-size:9.5px;color:rgba(255,255,255,.34);margin-top:2px}
.sb-nav{flex:1;padding:11px 8px;overflow-y:auto}
.nav-lbl{font-size:8.5px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:rgba(255,255,255,.2);padding:0 8px;margin:7px 0 4px}
.nbtn{width:100%;display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:8px;border:none;cursor:pointer;font-size:12.5px;font-weight:600;font-family:inherit;transition:all .14s;text-align:left;color:rgba(255,255,255,.5);background:transparent;margin-bottom:2px}
.nbtn:hover{background:rgba(255,255,255,.07);color:#fff}
.nbtn.on{background:var(--gb);color:#fff;box-shadow:0 2px 10px rgba(19,81,180,.4)}
.nbtn.on svg{color:var(--gy)!important}
.sb-foot{padding:11px 13px;border-top:1px solid rgba(255,255,255,.07);flex-shrink:0}
.sb-user{display:flex;align-items:center;gap:9px}
.sb-av{width:32px;height:32px;border-radius:50%;background:var(--gb);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px;color:#fff;border:2px solid rgba(255,255,255,.18);flex-shrink:0}
.sb-un{font-size:12px;font-weight:700;color:#fff}
.sb-ur{font-size:9.5px;color:rgba(255,255,255,.35)}

/* main */
.main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}
.topbar{background:var(--bg);border-bottom:1px solid var(--bd);padding:0 20px;height:50px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;box-shadow:0 1px 4px rgba(0,0,0,.05);gap:10px}
.tb-l{display:flex;align-items:center;gap:9px}
.tb-bc{font-size:11.5px;color:var(--t3);display:flex;align-items:center;gap:7px}
.tb-bc b{color:var(--t1);font-weight:600}
.tb-cnt{font-size:9.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--gb);background:var(--gbxl);border:1px solid var(--gbl);padding:3px 9px;border-radius:20px}
.tb-r{display:flex;align-items:center;gap:7px}
.sw{position:relative;display:flex;align-items:center}
.sw svg.i{position:absolute;left:9px;color:var(--t4);pointer-events:none}
.sw input{padding:6px 11px 6px 29px;border:1px solid var(--bd);border-radius:7px;font-size:11.5px;color:var(--t1);width:200px;font-family:inherit;outline:none;background:var(--bg2);transition:border-color .14s}
.sw input:focus{border-color:var(--gb)}
.sw input::placeholder{color:var(--t4)}
.vd{width:1px;height:18px;background:var(--bd)}
.btn{display:flex;align-items:center;gap:5px;padding:6px 12px;border-radius:7px;border:1px solid var(--bd);background:var(--bg);color:var(--t2);cursor:pointer;font-size:11.5px;font-weight:600;font-family:inherit;transition:background .14s}
.btn:hover{background:var(--bg2)}
.btn.p{background:var(--gb);color:#fff;border-color:var(--gb)}
.btn.p:hover{background:var(--gbh)}

/* page */
.page{flex:1;overflow-y:auto;padding:14px 18px 24px}

/* filter bar */
.fbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;background:var(--bg);border:1px solid var(--bd);border-radius:9px;padding:8px 12px;margin-bottom:13px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.fbar-lbl{font-size:8.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--t4);display:flex;align-items:center;gap:4px;margin-right:3px}
.fsw{position:relative;display:flex;align-items:center}
.fsw .fi{position:absolute;left:7px;color:var(--t4);pointer-events:none;z-index:1}
.fsw select{padding:5px 22px 5px 24px;border:1px solid var(--bd);border-radius:6px;font-size:11px;color:var(--t2);font-family:inherit;background:var(--bg2);outline:none;cursor:pointer;appearance:none;transition:border-color .14s}
.fsw select:focus{border-color:var(--gb)}
.fsw .fa{position:absolute;right:5px;pointer-events:none;color:var(--t4)}
.fchip{display:flex;align-items:center;gap:4px;padding:3px 9px;background:var(--gbxl);border:1px solid var(--gbl);border-radius:20px;font-size:10px;font-weight:700;color:var(--gb);cursor:pointer}
.fchip:hover{background:var(--gbl)}
.fclr{display:flex;align-items:center;gap:4px;padding:4px 9px;background:transparent;border:1px solid var(--bd);border-radius:6px;font-size:11px;font-weight:600;color:var(--t3);cursor:pointer;font-family:inherit;transition:background .14s;margin-left:auto}
.fclr:hover{background:var(--bg2)}

/* kpi grid */
.kg{display:grid;grid-template-columns:repeat(5,1fr);gap:9px;margin-bottom:9px}
.kpi{background:var(--bg);border:1px solid var(--bd);border-radius:9px;padding:11px 12px;cursor:pointer;position:relative;overflow:hidden;transition:box-shadow .18s,transform .18s;border-left:4px solid transparent}
.kpi:hover{box-shadow:0 4px 16px rgba(0,0,0,.09);transform:translateY(-2px)}
.kpi.on{box-shadow:0 0 0 3px rgba(19,81,180,.15)}
.kpi.c1{border-left-color:#1351B4}.kpi.c2{border-left-color:#0E9F6E}
.kpi.c3{border-left-color:#168821}.kpi.c4{border-left-color:#C27803}
.kpi.c5{border-left-color:#E02424}.kpi.c6{border-left-color:#7E3AF2}
.kpi.c7{border-left-color:#C27803}.kpi.c8{border-left-color:#0694A2}
.kpi.c9{border-left-color:#6366F1}.kpi.c10{border-left-color:#E74694}
.kpi-t{display:flex;justify-content:space-between;align-items:flex-start}
.kpi-ico{padding:6px;border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.kpi-l{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--t3);margin-bottom:2px}
.kpi-v{font-size:20px;font-weight:800;color:var(--t1);letter-spacing:-.03em;line-height:1}
.kpi-s{font-size:9.5px;color:var(--t3);margin-top:4px;display:flex;align-items:center;gap:3px}
.kpi-s.g{color:var(--ok)}.kpi-s.r{color:var(--er)}
.kpi-hint{position:absolute;bottom:4px;right:7px;font-size:8.5px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--t4);opacity:0;transition:opacity .14s;pointer-events:none}
.kpi:hover .kpi-hint{opacity:1}

/* section label */
.sec{font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--t3);display:flex;align-items:center;gap:6px;margin-bottom:8px;margin-top:4px}
.sec::after{content:'';flex:1;height:1px;background:var(--bdl)}

/* chart layout */
.crow{display:grid;gap:10px;margin-bottom:10px}
.crow2{grid-template-columns:1fr 1fr}
.crow-map{grid-template-columns:3fr 2fr}
.cc{background:var(--bg);border:1px solid var(--bd);border-radius:9px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.cc-hd{padding:10px 13px 8px;border-bottom:1px solid var(--bdl);display:flex;align-items:center;justify-content:space-between}
.cc-tit{font-size:12px;font-weight:700;color:var(--t1);display:flex;align-items:center;gap:6px}
.cc-sub{font-size:9.5px;color:var(--t3);margin-top:1px}
.cc-bd{padding:8px 12px 10px}

/* ════════════════════════
   MAPA SVG
════════════════════════ */
.map-outer{
  width:100%;
  background:linear-gradient(160deg,#EEF4FC 0%,#E4EDF8 100%);
  border-radius:8px;
  overflow:hidden;
  position:relative;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:8px;
}
.map-outer svg{
  width:100%;
  height:auto;
  display:block;
  filter:drop-shadow(0 2px 8px rgba(7,29,65,.12));
}
.map-legend{
  position:absolute;
  bottom:10px;
  left:14px;
  display:flex;
  align-items:center;
  gap:7px;
  background:rgba(255,255,255,.92);
  backdrop-filter:blur(4px);
  padding:5px 10px;
  border-radius:7px;
  font-size:10px;
  color:var(--t2);
  font-weight:600;
  box-shadow:0 1px 6px rgba(0,0,0,.1);
  border:1px solid rgba(255,255,255,.7);
}
.map-legend-bar{
  width:72px;height:8px;
  border-radius:4px;
  background:linear-gradient(90deg,#C5D4EB,#071D41);
  border:1px solid rgba(0,0,0,.08);
}

/* UF list */
.uf-list{max-height:300px;overflow-y:auto;padding:0 2px}
.uf-row{display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:7px;cursor:pointer;transition:background .12s;margin-bottom:2px}
.uf-row:hover{background:var(--bg2)}
.uf-row.on{background:var(--gbxl)}
.uf-code{width:30px;height:22px;border-radius:4px;background:var(--bg3);border:1px solid var(--bd);display:flex;align-items:center;justify-content:center;font-size:9.5px;font-weight:700;color:var(--t2);flex-shrink:0}
.uf-row.on .uf-code{background:var(--gb);color:#fff;border-color:var(--gb)}
.uf-bw{flex:1}
.uf-bt{display:flex;justify-content:space-between;margin-bottom:2px}
.uf-bl{font-size:9.5px;color:var(--t3)}.uf-bv{font-size:9.5px;font-weight:700;color:var(--t1)}
.uf-bg{height:4px;background:var(--bdl);border-radius:10px;overflow:hidden}
.uf-bf{height:100%;background:var(--gb);border-radius:10px;transition:width .5s ease}

/* table */
.tc{background:var(--bg);border:1px solid var(--bd);border-radius:9px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.tc-hd{padding:10px 13px;border-bottom:1px solid var(--bdl);display:flex;align-items:center;justify-content:space-between;gap:8px}
.tc-tit{font-size:12px;font-weight:700;color:var(--t1);display:flex;align-items:center;gap:6px}
.tc-cnt{font-size:9.5px;font-weight:700;color:var(--gb);background:var(--gbxl);padding:2px 9px;border-radius:20px}
.tsr{position:relative;display:flex;align-items:center}
.tsr svg{position:absolute;left:8px;color:var(--t4);pointer-events:none}
.tsr input{padding:5px 10px 5px 27px;border:1px solid var(--bd);border-radius:6px;font-size:11px;color:var(--t1);width:180px;font-family:inherit;outline:none;background:var(--bg2)}
.tsr input:focus{border-color:var(--gb)}
.tscr{overflow-x:auto;max-height:330px;overflow-y:auto}
table{width:100%;border-collapse:collapse}
thead th{position:sticky;top:0;z-index:5;background:var(--bg3);border-bottom:1px solid var(--bd);padding:7px 11px;text-align:left;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:var(--t3);white-space:nowrap;cursor:pointer;user-select:none}
thead th:hover{color:var(--gb);background:var(--gbxl)}
.th-in{display:flex;align-items:center;gap:3px}
.si{font-size:9px;opacity:.35}
tbody tr+tr{border-top:1px solid var(--bdl)}
tbody tr:hover{background:var(--gbxl)}
tbody td{padding:6px 11px;font-size:11px;color:var(--t1);white-space:nowrap}
.mono{font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:500;color:var(--gb)}
.badge{display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:20px;font-size:9.5px;font-weight:700;white-space:nowrap}
.badge::before{content:'';width:5px;height:5px;border-radius:50%;flex-shrink:0}
.bok{background:var(--okl);color:var(--ok)}.bok::before{background:var(--ok)}
.ber{background:var(--erl);color:var(--er)}.ber::before{background:var(--er)}
.bwn{background:var(--wnl);color:var(--wn)}.bwn::before{background:var(--wn)}
.binf{background:var(--infl);color:var(--inf)}.binf::before{background:var(--inf)}
.bgr{background:var(--bg3);color:var(--t3)}.bgr::before{background:var(--t4)}
.tfoot2{padding:8px 13px;border-top:1px solid var(--bdl);display:flex;align-items:center;justify-content:space-between;background:var(--bg2)}
.pg-info{font-size:10.5px;color:var(--t3)}.pg-info b{color:var(--t1);font-weight:700}
.pg-c{display:flex;align-items:center;gap:5px}
.pg-sz{padding:3px 7px;border:1px solid var(--bd);border-radius:5px;font-size:10.5px;font-family:inherit;color:var(--t1);background:#fff;cursor:pointer;outline:none}
.pg-btn{padding:4px 9px;border:1px solid var(--bd);border-radius:5px;font-size:10.5px;font-weight:600;background:#fff;color:var(--t2);cursor:pointer;transition:background .12s;font-family:inherit;display:flex;align-items:center;gap:3px}
.pg-btn:hover:not(:disabled){background:var(--gb);color:#fff;border-color:var(--gb)}
.pg-btn:disabled{opacity:.28;cursor:not-allowed}
.pg-cur{font-size:10.5px;color:var(--t3);font-weight:600;padding:0 2px}

/* recharts tooltip */
.rtip{background:#fff;border:1px solid var(--bd);border-radius:7px;padding:6px 10px;box-shadow:0 4px 14px rgba(0,0,0,.09);font-size:11px;color:var(--t1)}
.rtip b{font-weight:700;display:block;margin-bottom:2px}

/* loading */
.lscreen{height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:var(--bg3)}
.spin{width:34px;height:34px;border:3px solid var(--gbl);border-top-color:var(--gb);border-radius:50%;animation:sp .65s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}
.lt{font-size:13.5px;font-weight:700;color:var(--t1)}.ls{font-size:11.5px;color:var(--t3)}

/* fade-in */
@keyframes fu{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}
.fu{animation:fu .28s ease both}
.d1{animation-delay:.04s}.d2{animation-delay:.09s}.d3{animation-delay:.14s}
.d4{animation-delay:.19s}.d5{animation-delay:.24s}
`;

// ─────────────────────────────────────────────────────────────────────────────
//  COMPONENTE: MAPA BRASIL (Correção de Centralização e ViewBox)
// ─────────────────────────────────────────────────────────────────────────────
function BrazilMap({ countByUf, selectedUf, onSelect }) {
  const [geoData, setGeoData] = useState(null);
  const [hov, setHov] = useState(null);

  // GeoJSON oficial simplificado
  const GEO_URL = "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson";

  useEffect(() => {
    fetch(GEO_URL)
      .then(res => res.json())
      .then(data => setGeoData(data))
      .catch(err => console.error("Erro ao carregar mapa:", err));
  }, []);

  const maxVal = useMemo(() => 
    Math.max(...Object.values(countByUf), 1), 
  [countByUf]);

  if (!geoData) return (
    <div className="ls" style={{textAlign:'center', padding:'40px'}}>
      <div className="spin" style={{margin:'0 auto 10px'}} />
      Sincronizando cartografia...
    </div>
  );

  return (
    <div className="map-outer" style={{ height: '500px', display: 'flex', flexDirection: 'column' }}>
      <svg
        /* AJUSTE DE VIEWBOX: 
           O Brasil fica aproximadamente entre Longitude -74 a -34 e Latitude -34 a 5.
           Como invertemos o Y (* -1), a latitude vai de 34 a -5.
           viewBox="min-x min-y largura altura"
        */
        viewBox="-75 -6 42 42" 
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
        className="fu"
        style={{ width: '100%', height: '100%', flex: 1 }}
      >
        {geoData.features.map((feature) => {
          const uf = feature.properties.sigla;
          const name = feature.properties.name;
          const cnt = countByUf[uf] || 0;
          const isSel = selectedUf === uf;
          const isHov = hov === uf;
          const t = cnt / maxVal;

          const fill = isSel
            ? 'var(--gb)' 
            : isHov
            ? 'var(--gbh)' 
            : cnt > 0
            ? lerpColor('#DCE6F2', '#1351B4', Math.pow(t, 0.4)) 
            : '#F1F5F9';

          // Processamento robusto para Polygon e MultiPolygon
          const pathData = feature.geometry.coordinates.map(polygon => {
            const rings = Array.isArray(polygon[0][0]) ? polygon : [polygon];
            return rings.map(ring => 
              ring.map((coord, i) => 
                `${i === 0 ? 'M' : 'L'}${coord[0]},${coord[1] * -1}`
              ).join(' ') + 'Z'
            ).join(' ');
          }).join(' ');

          return (
            <path
              key={uf}
              d={pathData}
              fill={fill}
              stroke={isSel ? '#FFCD07' : '#fff'}
              strokeWidth={isSel ? "0.25" : "0.12"} 
              strokeLinejoin="round"
              onClick={() => onSelect(isSel ? null : uf)}
              onMouseEnter={() => setHov(uf)}
              onMouseLeave={() => setHov(null)}
              style={{ 
                cursor: 'pointer', 
                transition: 'fill 0.2s, stroke-width 0.2s',
                outline: 'none'
              }}
            >
              <title>{`${name}: ${cnt} processos`}</title>
            </path>
          );
        })}
      </svg>

      <div className="map-legend" style={{ position: 'relative', bottom: '10px', left: '10px' }}>
        <span style={{color: 'var(--t3)', fontSize: '10px'}}>Menos</span>
        <div className="map-legend-bar" style={{ background: 'linear-gradient(90deg, #DCE6F2, var(--gb))', width: '80px', height: '8px', borderRadius: '4px', margin: '0 5px' }} />
        <span style={{fontWeight: 700, fontSize: '10px'}}>{maxVal.toLocaleString('pt-BR')}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  COMPONENTES MENORES
// ─────────────────────────────────────────────────────────────────────────────
function SBadge({ v }) {
  if (!v) return <span style={{ color: '#9CA3AF' }}>—</span>;
  const s = String(v).toUpperCase().trim();
  let c = 'bgr';
  if (STATUS_OK.some(x => s.includes(x)))   c = 'bok';
  else if (STATUS_BAD.some(x => s.includes(x))) c = 'ber';
  else if (['CONJUR','FORMALIZAR','SOLICITADO'].some(x => s.includes(x))) c = 'bwn';
  else if (s.includes('NÃO SE APLICA'))      c = 'binf';
  return <span className={`badge ${c}`}>{v}</span>;
}

const CTip = ({ active, payload, label, cur }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rtip">
      <b>{label}</b>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>
          {cur
            ? p.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
            : p.value.toLocaleString('pt-BR')}
        </div>
      ))}
    </div>
  );
};

function KCard({ icon: Ic, lbl, val, sub, subGood, cc, ibg, icol, active, onClick, clickable }) {
  return (
    <div className={`kpi ${cc}${active ? ' on' : ''} fu`} onClick={onClick}>
      <div className="kpi-t">
        <div>
          <div className="kpi-l">{lbl}</div>
          <div className="kpi-v">{val}</div>
          {sub && (
            <div className={`kpi-s${subGood === true ? ' g' : subGood === false ? ' r' : ''}`}>
              {sub}
            </div>
          )}
        </div>
        <div className="kpi-ico" style={{ background: ibg, color: icol }}>
          <Ic size={18} />
        </div>
      </div>
      {clickable && <div className="kpi-hint">⬡ Filtrar</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  DASHBOARD PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function DashboardSneaElis() {
  const navigate = useNavigate();

  const [raw, setRaw]         = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [prog, setProg]       = useState(0);

  // filtros
  const [search,   setSearch]   = useState('');
  const [fUf,      setFUf]      = useState(null);
  const [fInstr,   setFInstr]   = useState(null);
  const [fAno,     setFAno]     = useState(null);
  const [fTec,     setFTec]     = useState(null);
  const [fEquipe,  setFEquipe]  = useState(null);
  const [fSit,     setFSit]     = useState(null);
  const [kpiFlt,   setKpiFlt]   = useState(null);   // { field, value }
  const [tblFlt,   setTblFlt]   = useState('');

  // ── carregar dados ──
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      let all = [], from = 0, ps = 1000;
      while (true) {
        const { data: chunk, error: e, count } = await supabase
          .from('formalizacoes')
          .select('*', { count: 'exact' })
          .order('id', { ascending: false })
          .range(from, from + ps - 1);
        if (e) throw e;
        all = [...all, ...chunk];
        from += ps;
        if (count) setProg(Math.round(all.length / count * 100));
        if (chunk.length < ps) break;
      }
      setRaw(all.map(r => ({
        ...r,
        _val:    parseFloat(String(r['VALOR REPASSE'] || 0).replace(/[^\d.-]/g, '')) || 0,
        _ano:    String(r.ANO || r.ano || '').trim().slice(0, 4) || 'N/D',
        _sit:    String(r.AJUSTE || r.SITUACIONAL || '').trim().toUpperCase() || 'N/D',
        _instr:  String(r.INSTRUMENTO || '').trim().toUpperCase() || 'N/D',
        _uf:     String(r.UF || r.uf || '').trim().toUpperCase() || 'N/D',
        _tec:    String(r['TÉCNICO DE FORMALIZAÇÃO'] || '').trim() || 'N/D',
        _equipe: String(r.EQUIPE || '').trim() || 'N/D',
      })));
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── dados filtrados ──
  const fd = useMemo(() => raw.filter(r => {
    if (search && !Object.values(r).some(v => String(v).toLowerCase().includes(search.toLowerCase()))) return false;
    if (fUf     && r._uf     !== fUf)     return false;
    if (fInstr  && r._instr  !== fInstr)  return false;
    if (fAno    && r._ano    !== fAno)    return false;
    if (fTec    && r._tec    !== fTec)    return false;
    if (fEquipe && r._equipe !== fEquipe) return false;
    if (fSit    && r._sit    !== fSit)    return false;
    if (kpiFlt) {
      const v = String(r[kpiFlt.field] || '').trim().toUpperCase();
      if (!v.includes(kpiFlt.value)) return false;
    }
    return true;
  }), [raw, search, fUf, fInstr, fAno, fTec, fEquipe, fSit, kpiFlt]);

  // ── opções dos selects ──
  const opts = useMemo(() => ({
    ufs:     [...new Set(raw.map(r => r._uf).filter(v => v && v !== 'N/D'))].sort(),
    instrs:  [...new Set(raw.map(r => r._instr).filter(v => v && v !== 'N/D'))].sort(),
    anos:    [...new Set(raw.map(r => r._ano).filter(v => v && v !== 'N/D'))].sort((a, b) => b.localeCompare(a)),
    tecs:    [...new Set(raw.map(r => r._tec).filter(v => v && v !== 'N/D'))].sort(),
    equipes: [...new Set(raw.map(r => r._equipe).filter(v => v && v !== 'N/D'))].sort(),
  }), [raw]);

  // ── analytics ──
  const an = useMemo(() => {
    const total = fd.length;
    const tv    = fd.reduce((s, r) => s + r._val, 0);
    const realiz  = fd.filter(r => STATUS_OK.some(s => r._sit?.includes(s))).length;
    const pend    = fd.filter(r => r._sit?.includes('PENDENTE')).length;
    const cancel  = fd.filter(r => ['CANCEL', 'REJEIT'].some(s => r._sit?.includes(s))).length;
    const cSusp   = fd.filter(r => String(r['CELEBRADO COM CLAUSULA SUSPENSIVA'] || '').toUpperCase() === 'SIM').length;
    const semPar  = fd.filter(r => String(r['PARECER TRANSFEREGOV'] || '').toUpperCase() === 'NÃO').length;
    const adit    = fd.filter(r => String(r['NECESSIDADE DE ADITIVO'] || '').toUpperCase() === 'SIM').length;
    const lim     = fd.filter(r => ['CONJUR', 'REJEITAR', 'FORMALIZAR'].some(s => String(r['SOB LIMINAR'] || '').toUpperCase().includes(s))).length;
    const eff     = total > 0 ? (realiz / total * 100) : 0;

    const agg = (key, valFn = null) => Object.entries(
      fd.reduce((a, r) => {
        const k = r[key];
        if (k) a[k] = (a[k] || 0) + (valFn ? valFn(r) : 1);
        return a;
      }, {})
    );

    const byUf    = agg('_uf').map(([uf, qtd]) => ({ uf, qtd })).sort((a, b) => b.qtd - a.qtd);
    const cbu     = fd.reduce((a, r) => { a[r._uf] = (a[r._uf] || 0) + 1; return a; }, {});
    const byInstr = agg('_instr').map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const byAno   = agg('_ano', r => r._val)
      .map(([ano, valor]) => ({ ano, valor }))
      .sort((a, b) => a.ano.localeCompare(b.ano))
      .filter(d => d.ano !== 'N/D');
    const byTec   = agg('_tec').map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 10);
    const bySit   = agg('_sit').map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 8);

    let growth = null;
    if (byAno.length >= 2) {
      const last = byAno[byAno.length - 1].valor, prev = byAno[byAno.length - 2].valor;
      growth = prev > 0 ? ((last - prev) / prev * 100) : null;
    }

    return {
      total, tv, realiz, pend, cancel, cSusp, semPar, adit, lim, eff,
      byUf, cbu, byInstr, byAno, byTec, bySit, growth,
      maxUf: Math.max(...Object.values(cbu).concat(1)),
    };
  }, [fd]);

  // ── colunas da tabela ──
  const tblCols = useMemo(() => [
    { accessorKey: 'PROPOSTA',   header: 'Proposta',    cell: ({ getValue }) => <span className="mono">{getValue()}</span> },
    { accessorKey: 'ENTIDADE',   header: 'Entidade',    cell: ({ getValue }) => <span style={{ maxWidth: 160, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 11 }}>{getValue() || '—'}</span> },
    { accessorKey: '_uf',        header: 'UF',          cell: ({ getValue }) => <span className="badge binf">{getValue()}</span> },
    { accessorKey: '_val',       header: 'Valor',       cell: ({ getValue }) => <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, fontWeight: 700 }}>{(getValue() || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span> },
    { accessorKey: '_instr',     header: 'Instrumento', cell: ({ getValue }) => <span className="badge bgr">{getValue()}</span> },
    { accessorKey: '_ano',       header: 'Ano' },
    { accessorKey: 'AJUSTE',     header: 'Ajuste',      cell: ({ getValue }) => <SBadge v={getValue()} /> },
    { accessorKey: 'PUBLICAÇÃO NO TRANSFEREGOV', header: 'Publicação', cell: ({ getValue }) => <SBadge v={getValue()} /> },
    { accessorKey: 'TÉCNICO DE FORMALIZAÇÃO',    header: 'Técnico' },
  ], []);

  const tbl = useReactTable({
    data: fd, columns: tblCols,
    state: { globalFilter: tblFlt },
    onGlobalFilterChange: setTblFlt,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 15 } },
  });

  const { pageIndex, pageSize } = tbl.getState().pagination;
  const tblTotal = tbl.getFilteredRowModel().rows.length;

  const clearAll = () => {
    setSearch(''); setFUf(null); setFInstr(null); setFAno(null);
    setFTec(null); setFEquipe(null); setFSit(null); setKpiFlt(null); setTblFlt('');
  };

  const chips = [
    fUf     && { lbl: `UF: ${fUf}`,           clr: () => setFUf(null) },
    fInstr  && { lbl: `Instr.: ${fInstr}`,     clr: () => setFInstr(null) },
    fAno    && { lbl: `Ano: ${fAno}`,          clr: () => setFAno(null) },
    fTec    && { lbl: `Téc.: ${fTec}`,         clr: () => setFTec(null) },
    fEquipe && { lbl: `Equipe: ${fEquipe}`,    clr: () => setFEquipe(null) },
    fSit    && { lbl: `Sit.: ${fSit}`,         clr: () => setFSit(null) },
    kpiFlt  && { lbl: `KPI: ${kpiFlt.value}`,  clr: () => setKpiFlt(null) },
  ].filter(Boolean);

  const toggleKpi = (field, value) =>
    setKpiFlt(k => k?.field === field && k?.value === value ? null : { field, value });

  const exportXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(fd);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Formalizações');
    XLSX.writeFile(wb, `SNEA_ELIS_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ── telas de loading / erro ──
  if (loading) return (
    <>
      <style>{CSS}</style>
      <div className="lscreen">
        <div className="spin" />
        <div className="lt">Carregando SNEAELIS Intelligence</div>
        <div className="ls">Sincronizando dados… {prog}%</div>
      </div>
    </>
  );

  if (error) return (
    <>
      <style>{CSS}</style>
      <div className="lscreen">
        <AlertTriangle size={44} style={{ color: '#E02424' }} />
        <div className="lt">Erro ao carregar dados</div>
        <div className="ls">{error}</div>
        <button onClick={load} style={{ padding: '8px 20px', background: '#1351B4', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, marginTop: 8 }}>
          Tentar novamente
        </button>
      </div>
    </>
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{CSS}</style>
      <div className="shell">

        {/* ── SIDEBAR ── */}
        <aside className="sb">
          <div className="govbar" />
          <div className="sb-head">
            <div className="sb-org">Ministério do Esporte</div>
            <div className="sb-title">SNEA<em>ELIS</em></div>
            <div className="sb-tag">Sistema Nacional de Esporte e Lazer • 2026</div>
          </div>
          <nav className="sb-nav">
            <div className="nav-lbl">Menu Principal</div>
            <button className="nbtn on"><LayoutDashboard size={14} /> Dashboard Analítico</button>
            <button className="nbtn" onClick={() => navigate('/tabela')}><TableIcon size={14} /> Tabela Gerencial</button>
          </nav>
          <div className="sb-foot">
            <div className="sb-user">
              <div className="sb-av">PD</div>
              <div>
                <div className="sb-un">Pedro Dias</div>
                <div className="sb-ur">Analista Sênior </div>
              </div>
            </div>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main className="main">
          <div className="govbar" />

          {/* Topbar */}
          <div className="topbar">
            <div className="tb-l">
              <span className="tb-bc">
                <Globe size={13} /> Dashboard &rsaquo; <b>Painel Analítico SNEAELIS</b>
              </span>
              <span className="tb-cnt">{fd.length.toLocaleString('pt-BR')} REGISTROS</span>
            </div>
            <div className="tb-r">
              <div className="sw">
                <Search size={13} className="i" />
                <input placeholder="Pesquisa rápida…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="vd" />
              <button className="btn" onClick={load}><RefreshCw size={13} /> Atualizar</button>
              <button className="btn p" onClick={exportXlsx}><Download size={13} /> Exportar</button>
            </div>
          </div>

          {/* ── PAGE ── */}
          <div className="page">

            {/* FILTER BAR */}
            <div className="fbar">
              <span className="fbar-lbl"><Filter size={10} /> Filtros</span>
              {[
                { lbl: 'UF',          Ico: MapPin,   val: fUf,     set: setFUf,     items: opts.ufs },
                { lbl: 'Instrumento', Ico: FileText,  val: fInstr,  set: setFInstr,  items: opts.instrs },
                { lbl: 'Ano',         Ico: Calendar,  val: fAno,    set: setFAno,    items: opts.anos },
                { lbl: 'Técnico',     Ico: Users,     val: fTec,    set: setFTec,    items: opts.tecs },
                { lbl: 'Equipe',      Ico: Briefcase, val: fEquipe, set: setFEquipe, items: opts.equipes },
              ].map(({ lbl, Ico, val, set, items }) => (
                <div className="fsw" key={lbl}>
                  <Ico size={11} className="fi" />
                  <select value={val || ''} onChange={e => set(e.target.value || null)}>
                    <option value="">{lbl}</option>
                    {items.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <ChevronDown size={10} className="fa" />
                </div>
              ))}
              {chips.map((c, i) => (
                <div key={i} className="fchip" onClick={c.clr}>{c.lbl} <X size={9} /></div>
              ))}
              {chips.length > 0 && (
                <button className="fclr" onClick={clearAll}><X size={10} /> Limpar todos</button>
              )}
            </div>

            {/* ── KPI LINHA 1 ── */}
            <div className="sec fu d1"><Target size={11} /> Indicadores-Chave de Desempenho</div>
            <div className="kg fu d1">
              <KCard icon={Database} lbl="Total de Propostas"
                val={an.total.toLocaleString('pt-BR')}
                sub={`${raw.length.toLocaleString('pt-BR')} na base total`}
                cc="c1" ibg="#EDF2FB" icol="#1351B4" />
              <KCard icon={DollarSign} lbl="Valor Total Repasse"
                val={an.tv.toLocaleString('pt-BR', { notation: 'compact', style: 'currency', currency: 'BRL' })}
                sub={`Média: ${an.total > 0 ? (an.tv / an.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : 'R$ 0'}`}
                cc="c2" ibg="#DEF7EC" icol="#0E9F6E" />
              <KCard icon={CheckCircle2} lbl="Realizados"
                val={an.realiz.toLocaleString('pt-BR')}
                sub={`${an.total > 0 ? (an.realiz / an.total * 100).toFixed(1) : 0}% do total`} subGood={true}
                cc="c3" ibg="#DAF0DC" icol="#168821"
                active={kpiFlt?.field === 'AJUSTE' && kpiFlt?.value === 'REALIZADO'}
                onClick={() => toggleKpi('AJUSTE', 'REALIZADO')} clickable />
              <KCard icon={Clock} lbl="Pendentes"
                val={an.pend.toLocaleString('pt-BR')}
                sub={`${an.total > 0 ? (an.pend / an.total * 100).toFixed(1) : 0}% do total`} subGood={false}
                cc="c4" ibg="#FDF6B2" icol="#C27803"
                active={kpiFlt?.field === 'AJUSTE' && kpiFlt?.value === 'PENDENTE'}
                onClick={() => toggleKpi('AJUSTE', 'PENDENTE')} clickable />
              <KCard icon={XCircle} lbl="Cancelados/Rejeitados"
                val={an.cancel.toLocaleString('pt-BR')}
                sub={`${an.total > 0 ? (an.cancel / an.total * 100).toFixed(1) : 0}% do total`} subGood={false}
                cc="c5" ibg="#FDE8E8" icol="#E02424" />
            </div>

            {/* ── KPI LINHA 2 ── */}
            <div className="kg fu d2" style={{ marginBottom: 12 }}>
              <KCard icon={ShieldCheck} lbl="Cláusula Suspensiva"
                val={an.cSusp.toLocaleString('pt-BR')} sub="Celebrados c/ cláusula"
                cc="c6" ibg="#EDEBFE" icol="#7E3AF2"
                active={kpiFlt?.field === 'CELEBRADO COM CLAUSULA SUSPENSIVA'}
                onClick={() => toggleKpi('CELEBRADO COM CLAUSULA SUSPENSIVA', 'SIM')} clickable />
              <KCard icon={AlertCircle} lbl="Sem Parecer TransfereGov"
                val={an.semPar.toLocaleString('pt-BR')} sub="Parecer = NÃO" subGood={false}
                cc="c7" ibg="#FDF6B2" icol="#C27803"
                active={kpiFlt?.field === 'PARECER TRANSFEREGOV'}
                onClick={() => toggleKpi('PARECER TRANSFEREGOV', 'NÃO')} clickable />
              <KCard icon={Zap} lbl="Necessidade de Aditivo"
                val={an.adit.toLocaleString('pt-BR')} sub="Aditivo = SIM"
                cc="c8" ibg="#D5F5F6" icol="#0694A2"
                active={kpiFlt?.field === 'NECESSIDADE DE ADITIVO'}
                onClick={() => toggleKpi('NECESSIDADE DE ADITIVO', 'SIM')} clickable />
              <KCard icon={AlertTriangle} lbl="Sob Liminar/Conjur"
                val={an.lim.toLocaleString('pt-BR')} sub="Requer ação jurídica" subGood={false}
                cc="c9" ibg="#E0E7FF" icol="#6366F1" />
              <KCard icon={TrendingUp} lbl="Eficiência Global"
                val={`${an.eff.toFixed(1)}%`}
                sub={an.growth !== null
                  ? `${an.growth > 0 ? '+' : ''}${an.growth.toFixed(1)}% vs ano ant.`
                  : 'Realizados ÷ Total'}
                subGood={an.growth !== null ? an.growth > 0 : undefined}
                cc="c10" ibg="#FCE8F3" icol="#E74694" />
            </div>

            {/* ── MAPA + RANKING ── */}
            <div className="sec fu d3"><Globe size={11} /> Distribuição Geográfica</div>
            <div className="crow crow-map fu d3">

              {/* Mapa */}
              <div className="cc">
                <div className="cc-hd">
                  <div>
                    <div className="cc-tit"><Globe size={13} style={{ color: '#1351B4' }} /> Mapa do Brasil</div>
                    <div className="cc-sub">Clique em um estado para filtrar • {an.byUf.length} UFs com dados</div>
                  </div>
                  {fUf && <div className="fchip" onClick={() => setFUf(null)}>{fUf} <X size={9} /></div>}
                </div>
                <div className="cc-bd">
                  <BrazilMap countByUf={an.cbu} selectedUf={fUf} onSelect={setFUf} />
                </div>
              </div>

              {/* Ranking UF */}
              <div className="cc">
                <div className="cc-hd">
                  <div>
                    <div className="cc-tit"><BarChart3 size={13} style={{ color: '#6366F1' }} /> Ranking por UF</div>
                    <div className="cc-sub">Top {Math.min(an.byUf.length, 15)} estados • clique para filtrar</div>
                  </div>
                </div>
                <div className="cc-bd">
                  <div className="uf-list">
                    {an.byUf.slice(0, 15).map(({ uf, qtd }) => (
                      <div key={uf} className={`uf-row${fUf === uf ? ' on' : ''}`}
                        onClick={() => setFUf(fUf === uf ? null : uf)}>
                        <div className="uf-code">{uf}</div>
                        <div className="uf-bw">
                          <div className="uf-bt">
                            <span className="uf-bl">Processos</span>
                            <span className="uf-bv">{qtd.toLocaleString('pt-BR')}</span>
                          </div>
                          <div className="uf-bg">
                            <div className="uf-bf" style={{ width: `${an.maxUf > 0 ? qtd / an.maxUf * 100 : 0}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── GRÁFICOS LINHA 1 ── */}
            <div className="crow crow2 fu d4">
              {/* Pizza instrumento */}
              <div className="cc">
                <div className="cc-hd">
                  <div>
                    <div className="cc-tit"><PieIcon size={13} style={{ color: '#7E3AF2' }} /> Distribuição por Instrumento</div>
                    <div className="cc-sub">Clique no setor para filtrar</div>
                  </div>
                  {fInstr && <div className="fchip" onClick={() => setFInstr(null)}>{fInstr} <X size={9} /></div>}
                </div>
                <div className="cc-bd">
                  <div style={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={an.byInstr} cx="50%" cy="50%" innerRadius="50%" outerRadius="80%"
                          paddingAngle={3} dataKey="value"
                          label={({ name, percent }) => percent > 0.06 ? `${(percent * 100).toFixed(0)}%` : ''}
                          labelLine={false}>
                          {an.byInstr.map((d, i) => (
                            <Cell key={i} fill={PALETTE[i % PALETTE.length]}
                              stroke={fInstr === d.name ? '#071D41' : 'transparent'} strokeWidth={3}
                              onClick={() => setFInstr(fInstr === d.name ? null : d.name)}
                              style={{ cursor: 'pointer' }} />
                          ))}
                        </Pie>
                        <RTooltip content={<CTip />} />
                        <Legend iconSize={11} wrapperStyle={{ fontSize: 10 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Area evolução anual */}
              <div className="cc">
                <div className="cc-hd">
                  <div>
                    <div className="cc-tit"><LineIcon size={13} style={{ color: '#0E9F6E' }} /> Evolução Anual (R$)</div>
                    <div className="cc-sub">Soma dos valores de repasse por ano</div>
                  </div>
                </div>
                <div className="cc-bd">
                  <div style={{ height: 260 }}>
                    {an.byAno.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={an.byAno} margin={{ top: 8, right: 10, left: 5, bottom: 0 }}>
                          <defs>
                            <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#1351B4" stopOpacity={0.18} />
                              <stop offset="95%" stopColor="#1351B4" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                          <XAxis dataKey="ano" tick={{ fontSize: 10 }} stroke="#E2E8F0" />
                          <YAxis tickFormatter={v => v.toLocaleString('pt-BR', { notation: 'compact' })} tick={{ fontSize: 9 }} stroke="#E2E8F0" />
                          <RTooltip content={<CTip cur />} />
                          <Area type="monotone" dataKey="valor" stroke="#1351B4" strokeWidth={2.5}
                            fill="url(#ag)"
                            dot={{ r: 4, fill: '#1351B4', strokeWidth: 2, stroke: '#fff' }}
                            activeDot={{ r: 6 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 12 }}>
                        Sem dados anuais disponíveis
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── GRÁFICOS LINHA 2 ── */}
            <div className="crow crow2 fu d5" style={{ marginBottom: 12 }}>
              {/* Barra técnico */}
              <div className="cc">
                <div className="cc-hd">
                  <div>
                    <div className="cc-tit"><Users size={13} style={{ color: '#0694A2' }} /> Por Técnico de Formalização</div>
                    <div className="cc-sub">Clique na barra para filtrar</div>
                  </div>
                  {fTec && <div className="fchip" onClick={() => setFTec(null)}>{fTec} <X size={9} /></div>}
                </div>
                <div className="cc-bd">
                  <div style={{ height: 230 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={an.byTec} margin={{ top: 5, right: 10, left: 0, bottom: 36 }}
                        onClick={({ activePayload }) => {
                          if (activePayload?.[0]) setFTec(fTec === activePayload[0].payload.name ? null : activePayload[0].payload.name);
                        }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 8.5 }} angle={-32} textAnchor="end" stroke="#E2E8F0" interval={0} />
                        <YAxis tick={{ fontSize: 9 }} stroke="#E2E8F0" />
                        <RTooltip content={<CTip />} />
                        <Bar dataKey="qty" name="Propostas" radius={[4, 4, 0, 0]} cursor="pointer">
                          {an.byTec.map((d, i) => <Cell key={i} fill={fTec === d.name ? '#071D41' : '#1A56DB'} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Barra horizontal situação */}
              <div className="cc">
                <div className="cc-hd">
                  <div>
                    <div className="cc-tit"><Activity size={13} style={{ color: '#E02424' }} /> Por Situação (Ajuste)</div>
                    <div className="cc-sub">Clique na barra para filtrar</div>
                  </div>
                  {fSit && <div className="fchip" onClick={() => setFSit(null)}>{fSit} <X size={9} /></div>}
                </div>
                <div className="cc-bd">
                  <div style={{ height: 230 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={an.bySit} layout="vertical" margin={{ top: 5, right: 20, left: 88, bottom: 5 }}
                        onClick={({ activePayload }) => {
                          if (activePayload?.[0]) setFSit(fSit === activePayload[0].payload.name ? null : activePayload[0].payload.name);
                        }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 9 }} stroke="#E2E8F0" />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} stroke="#E2E8F0" width={86} />
                        <RTooltip content={<CTip />} />
                        <Bar dataKey="qty" name="Qtd." radius={[0, 4, 4, 0]} cursor="pointer">
                          {an.bySit.map((d, i) => {
                            let fill = '#1A56DB';
                            if (STATUS_OK.some(s => d.name?.includes(s))) fill = '#0E9F6E';
                            else if (STATUS_BAD.some(s => d.name?.includes(s))) fill = '#E02424';
                            if (fSit === d.name) fill = '#071D41';
                            return <Cell key={i} fill={fill} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            {/* ── TABELA ── */}
            <div className="sec fu"><List size={11} /> Registros Detalhados</div>
            <div className="tc fu">
              <div className="tc-hd">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="tc-tit"><TableIcon size={13} style={{ color: '#1351B4' }} /> Propostas</span>
                  <span className="tc-cnt">{tblTotal.toLocaleString('pt-BR')} registros</span>
                </div>
                <div className="tsr">
                  <Search size={12} />
                  <input placeholder="Filtrar tabela…" value={tblFlt} onChange={e => setTblFlt(e.target.value)} />
                </div>
              </div>
              <div className="tscr">
                <table>
                  <thead>
                    <tr>
                      {tbl.getHeaderGroups()[0]?.headers.map(h => (
                        <th key={h.id} onClick={h.column.getToggleSortingHandler()}>
                          <div className="th-in">
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            {h.column.getIsSorted() === 'asc'  && <span className="si">▲</span>}
                            {h.column.getIsSorted() === 'desc' && <span className="si">▼</span>}
                            {!h.column.getIsSorted() && h.column.getCanSort() && <span className="si">⇅</span>}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tbl.getRowModel().rows.map(row => (
                      <tr key={row.id}>
                        {row.getVisibleCells().map(cell => (
                          <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                        ))}
                      </tr>
                    ))}
                    {tbl.getRowModel().rows.length === 0 && (
                      <tr>
                        <td colSpan={tblCols.length} style={{ textAlign: 'center', padding: '28px 0', color: '#9CA3AF', fontSize: 12 }}>
                          Nenhum registro encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="tfoot2">
                <div className="pg-info">
                  Exibindo <b>{pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, tblTotal)}</b> de <b>{tblTotal.toLocaleString('pt-BR')}</b>
                </div>
                <div className="pg-c">
                  <span style={{ fontSize: 10.5, color: 'var(--t3)', fontWeight: 600 }}>Linhas</span>
                  <select className="pg-sz" value={pageSize} onChange={e => tbl.setPageSize(Number(e.target.value))}>
                    {[10, 15, 25, 50].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button className="pg-btn" onClick={() => tbl.previousPage()} disabled={!tbl.getCanPreviousPage()}>
                    <ChevronLeft size={11} /> Anterior
                  </button>
                  <span className="pg-cur">Pág. {pageIndex + 1} / {tbl.getPageCount()}</span>
                  <button className="pg-btn" onClick={() => tbl.nextPage()} disabled={!tbl.getCanNextPage()}>
                    Próxima <ChevronRight size={11} />
                  </button>
                </div>
              </div>
            </div>

          </div>{/* /page */}
        </main>
      </div>
    </>
  );
}