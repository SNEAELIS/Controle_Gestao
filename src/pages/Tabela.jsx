import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table';
import {
  Download, Save, CheckCircle2, AlertCircle, Loader2,
  ChevronLeft, ChevronRight, Search, Plus, Trash2,
  AlertTriangle, RefreshCw, Filter, X, Bot, FileSpreadsheet,
  Hash, Upload,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../services/supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURAÇÕES
// INSTRUMENTO → somente leitura (preenchido pelo robô)
// NECESSIDADE DE ADITIVO PARA SUSPENSIVA → editável (SIM/NÃO/NÃO SE APLICA)
// ─────────────────────────────────────────────────────────────────────────────
const SELECT_OPTIONS = {
  'CELEBRADO COM CLAUSULA SUSPENSIVA':      ['SIM', 'NÃO', 'NÃO SE APLICA'],
  'NECESSIDADE DE ADITIVO PARA SUSPENSIVA': ['SIM', 'NÃO', 'NÃO SE APLICA'],
  'PAD - CRONO':                            ['SIM', 'NÃO', 'PORTARIA 64/2025'],
  'PARECER TRANSFEREGOV':                   ['SIM', 'NÃO', 'NÃO SE APLICA'],
  'AJUSTE':                                 ['PENDENTE', 'REALIZADO', 'NÃO SE APLICA'],
  'CANCELAR EMPENHO':                       ['SIM', 'NÃO', 'SOLICITADO', 'NÃO SE APLICA'],
  'REJEITAR NO TRANSFEREGOV':               ['CONJUR', 'REJEITAR', 'FORMALIZAR', 'REALIZADO', 'NÃO SE APLICA'],
  'SOB LIMINAR':                            ['CONJUR', 'REJEITAR', 'FORMALIZAR', 'NÃO SE APLICA'],
  'NECESSIDADE DE ADITIVO':                 ['SIM', 'NÃO', 'PENDENTE', 'NÃO SE APLICA'],
  'INSTRUÇÃO PROCESSUAL':                   ['SIM', 'NÃO', 'PENDENTE'],
  'EQUIPE':                                 ['EQUIPE 6', 'EQUIPE 7'],
  'TÉCNICO DE FORMALIZAÇÃO':                ['THALITA', 'SAMARA', 'GLENDA', 'HELLEN', 'ALINE', 'SUELHY', 'JAQUELINE', 'CLARISSA', 'JÚLIO'],
};

// Colunas preenchidas automaticamente pelo robô (somente leitura)
const ROBO_COLS = ['INSTRUMENTO', 'PUBLICAÇÃO NO TRANSFEREGOV', 'PROPONENTE', 'NÚMERO DO PROCESSO', 'DATA INÍCIO DE VIGÊNCIA'];

// ─────────────────────────────────────────────────────────────────────────────
// ESTILOS
// ─────────────────────────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { font-family: 'DM Sans', sans-serif; background: #ECEEF2; height: 100vh; overflow: hidden; }

  :root {
    --blue:       #1D4ED8; --blue-h: #1E40AF; --blue-lt: #EFF6FF; --blue-md: #BFDBFE;
    --green:      #059669; --green-lt: #ECFDF5;
    --amber:      #D97706; --amber-lt: #FFFBEB;
    --red:        #DC2626; --red-lt:   #FEF2F2;
    --sky:        #0369A1; --sky-lt:   #F0F9FF; --sky-bd:  #BAE6FD;
    --slate:      #64748B;
    --border:     #E2E8F0; --border2: #CBD5E1;
    --text:       #0F172A; --text2: #475569; --text3: #94A3B8;
    --bg:         #FFFFFF; --bg2: #F8FAFC;
  }

  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 8px; }

  /* shell */
  .shell { display: flex; height: 100vh; overflow: hidden; }

  /* ─── SIDEBAR ─── */
  .sidebar { width: 252px; flex-shrink:0; background:var(--bg); border-right:1px solid var(--border); display:flex; flex-direction:column; overflow:hidden; }

  .sb-head { padding:16px 16px 13px; border-bottom:1px solid var(--border); }
  .sb-brand { display:flex; align-items:center; gap:10px; }
  .sb-icon { width:34px;height:34px;border-radius:9px;background:var(--blue);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;flex-shrink:0; }
  .sb-name { font-size:14px;font-weight:800;color:var(--text);letter-spacing:-.02em; }
  .sb-name em { color:var(--blue);font-style:normal; }
  .sb-sub  { font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);margin-top:2px; }

  .sb-body { flex:1;overflow-y:auto;padding:13px 13px 0; }
  .sb-sec  { font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--text3);display:flex;align-items:center;gap:5px;margin-bottom:10px; }

  .fld { margin-bottom:9px; }
  .fld-l { display:block;font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text2);margin-bottom:4px;padding-left:2px; }
  .fld-i, .fld-s { width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:7px;font-size:12px;color:var(--text);font-family:'DM Sans',sans-serif;background:var(--bg2);outline:none;transition:border-color .14s,box-shadow .14s;appearance:none; }
  .fld-i:focus,.fld-s:focus { border-color:var(--blue);box-shadow:0 0 0 3px rgba(29,78,216,.1);background:#fff; }
  .sel-w { position:relative; }
  .sel-w::after { content:'';position:absolute;right:10px;top:50%;transform:translateY(-50%);width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:5px solid var(--text3);pointer-events:none; }

  .sb-foot { padding:11px 13px 13px;border-top:1px solid var(--border);flex-shrink:0; }
  .btn-clear { width:100%;padding:9px;background:transparent;color:var(--text2);border:1px solid var(--border);border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background .14s; }
  .btn-clear:hover { background:var(--bg2); }

  /* ─── MAIN ─── */
  .main { flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0; }

  /* KPI */
  .kpi-row { display:flex;gap:13px;padding:16px 18px 0;flex-shrink:0; }
  .kpi { flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:13px 16px;border-top:3px solid transparent;transition:box-shadow .14s,transform .14s;cursor:default; }
  .kpi:hover { box-shadow:0 4px 18px rgba(0,0,0,.07);transform:translateY(-1px); }
  .kpi.bl { border-top-color:var(--blue); }
  .kpi.gr { border-top-color:var(--green); }
  .kpi.am { border-top-color:var(--amber); }
  .kpi.re { border-top-color:var(--red); }
  .kpi-v { font-size:24px;font-weight:800;color:var(--text);line-height:1;letter-spacing:-.03em; }
  .kpi-l { font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text3);margin-top:4px; }

  /* Table card */
  .tcard { flex:1;margin:13px 18px 18px;background:var(--bg);border:1px solid var(--border);border-radius:12px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.04); }

  /* Toolbar */
  .tbar { padding:11px 15px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:9px;flex-shrink:0; }
  .tbar-l { display:flex;align-items:center;gap:9px; }
  .tbar-title { font-size:14px;font-weight:800;color:var(--text);letter-spacing:-.02em; }
  .tbar-cnt { font-size:11px;font-weight:600;color:var(--blue);background:var(--blue-lt);border-radius:20px;padding:2px 9px; }
  .tbar-r { display:flex;align-items:center;gap:7px; }

  .sw { position:relative;display:flex;align-items:center; }
  .sw svg { position:absolute;left:9px;color:var(--text3);pointer-events:none; }
  .sw-i { padding:7px 26px 7px 30px;border:1px solid var(--border);border-radius:8px;font-size:12px;color:var(--text);width:230px;font-family:'DM Sans',sans-serif;outline:none;transition:border-color .14s,box-shadow .14s; }
  .sw-i:focus { border-color:var(--blue);box-shadow:0 0 0 3px rgba(29,78,216,.08); }
  .sw-i::placeholder { color:var(--text3); }
  .sw-x { position:absolute;right:7px;background:none;border:none;cursor:pointer;color:var(--text3);display:flex;align-items:center;padding:2px;border-radius:4px; }
  .sw-x:hover { color:var(--text); }

  .lbl-flt { font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text3); }
  .vdiv { width:1px;height:20px;background:var(--border);margin:0 1px; }

  .ibtn { padding:7px;border-radius:8px;border:1px solid var(--border);background:var(--bg);cursor:pointer;color:var(--text2);display:flex;align-items:center;justify-content:center;transition:background .14s,color .14s; }
  .ibtn:hover { background:var(--bg2);color:var(--text); }
  .ibtn.g { border-color:#A7F3D0;background:var(--green-lt);color:var(--green); }
  .ibtn.g:hover { background:#D1FAE5; }

  .btn-save { display:flex;align-items:center;gap:5px;padding:7px 12px;background:var(--amber);color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background .14s; }
  .btn-save:hover { background:#B45309; }
  .btn-save:disabled { opacity:.55;cursor:not-allowed; }

  .btn-pri { display:flex;align-items:center;gap:5px;padding:7px 13px;background:var(--blue);color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background .14s; }
  .btn-pri:hover { background:var(--blue-h); }

  .btn-del-sel { display:flex;align-items:center;gap:5px;padding:7px 12px;background:var(--red-lt);color:var(--red);border:1px solid #FECACA;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background .14s; }
  .btn-del-sel:hover { background:#FEE2E2; }

  /* Table */
  .tscroll { flex:1;overflow:auto; }
  table { width:100%;border-collapse:collapse; }
  thead th { position:sticky;top:0;z-index:10;background:#F8FAFC;padding:9px 12px;text-align:left;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:var(--text2);border-bottom:1px solid var(--border);white-space:nowrap;user-select:none; }
  thead th.s { cursor:pointer; }
  thead th.s:hover { background:#EFF6FF;color:var(--blue); }
  thead th.robo { color:var(--sky);background:var(--sky-lt); }
  thead th.robo:hover { background:#E0F2FE; }
  .th-in { display:flex;align-items:center;gap:4px; }
  .si { font-size:9px;opacity:.35; }

  tbody tr { transition:background .08s; }
  tbody tr:hover { background:#F8FAFC; }
  tbody tr + tr { border-top:1px solid #F1F5F9; }
  tbody tr.sel { background:#EFF6FF !important; }
  tbody td { padding:8px 12px;font-size:11.5px;color:var(--text);vertical-align:middle; }

  .td-p { font-weight:700;color:var(--blue);font-family:'DM Mono',monospace;font-size:11px;white-space:nowrap; }
  .td-v { font-weight:700;color:var(--text);font-size:11px;white-space:nowrap;font-family:'DM Mono',monospace; }
  .td-robo { color:var(--sky);font-size:11px;background:var(--sky-lt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px;display:block; }

  .badge { display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;white-space:nowrap;letter-spacing:.02em; }
  .badge::before { content:'';width:5px;height:5px;border-radius:50%;flex-shrink:0; }
  .bg-g  { background:var(--green-lt);color:var(--green); }  .bg-g::before  { background:var(--green); }
  .bg-r  { background:var(--red-lt);color:var(--red); }      .bg-r::before  { background:var(--red); }
  .bg-a  { background:var(--amber-lt);color:var(--amber); }  .bg-a::before  { background:var(--amber); }
  .bg-bl { background:var(--blue-lt);color:var(--blue); }    .bg-bl::before { background:var(--blue); }
  .bg-sl { background:#F1F5F9;color:var(--slate); }          .bg-sl::before { background:var(--slate); }

  .csel { padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:11px;font-family:'DM Sans',sans-serif;color:var(--text);outline:none;background:#fff;cursor:pointer;transition:border-color .12s;min-width:120px;appearance:none; }
  .csel:focus { border-color:var(--blue);box-shadow:0 0 0 2px rgba(29,78,216,.08); }
  .csel.ed { border-color:var(--amber);box-shadow:0 0 0 2px rgba(217,119,6,.12);background:var(--amber-lt); }

  .del-row { opacity:0;padding:5px;background:none;border:none;color:var(--text3);cursor:pointer;border-radius:6px;display:flex;align-items:center;transition:opacity .12s,background .12s,color .12s; }
  tbody tr:hover .del-row { opacity:1; }
  .del-row:hover { background:var(--red-lt);color:var(--red); }

  .cb { width:14px;height:14px;cursor:pointer;accent-color:var(--blue); }

  .robo-tag { display:inline-flex;align-items:center;gap:2px;font-size:8px;font-weight:700;text-transform:uppercase;background:var(--sky-lt);color:var(--sky);border:1px solid var(--sky-bd);border-radius:4px;padding:1px 5px;margin-left:4px; }

  /* Footer */
  .tfoot { padding:10px 15px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;background:#FAFBFC; }
  .pg-info { font-size:11px;color:var(--text2); }
  .pg-info b { color:var(--text);font-weight:700; }
  .pg-ctrl { display:flex;align-items:center;gap:6px; }
  .pg-lbl { font-size:11px;color:var(--text2);font-weight:600; }
  .pg-size { padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:11px;font-family:'DM Sans',sans-serif;color:var(--text);background:#fff;cursor:pointer;outline:none; }
  .pg-btn { padding:5px 11px;border:1px solid var(--border);border-radius:6px;font-size:11px;font-weight:600;background:#fff;color:var(--text2);cursor:pointer;transition:background .12s,color .12s,border-color .12s;font-family:'DM Sans',sans-serif;display:flex;align-items:center;gap:3px; }
  .pg-btn:hover:not(:disabled) { background:var(--blue);color:#fff;border-color:var(--blue); }
  .pg-btn:disabled { opacity:.3;cursor:not-allowed; }
  .pg-cur { font-size:11px;color:var(--text2);font-weight:600;padding:0 2px; }

  /* ─── MODALS ─── */
  .overlay { position:fixed;inset:0;z-index:300;background:rgba(15,23,42,.5);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;padding:20px; }
  .modal { background:#fff;border-radius:14px;padding:28px;width:100%;box-shadow:0 24px 64px rgba(0,0,0,.18);animation:popIn .2s ease; }
  @keyframes popIn { from{opacity:0;transform:scale(.95) translateY(8px)} }
  .modal-sm { max-width:420px; }
  .modal-lg { max-width:600px; }

  .m-ico { width:52px;height:52px;border-radius:13px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px; }
  .m-ico.red   { background:var(--red-lt);color:var(--red); }
  .m-ico.blue  { background:var(--blue-lt);color:var(--blue); }
  .modal h2 { font-size:17px;font-weight:800;text-align:center;color:var(--text);margin-bottom:6px;letter-spacing:-.02em; }
  .m-desc { font-size:13px;color:var(--text2);text-align:center;line-height:1.6;margin-bottom:20px; }
  .m-desc b { color:var(--text);font-weight:700; }

  .m-acts { display:flex;gap:8px; }
  .m-acts button { flex:1;padding:10px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background .12s; }
  .act-cancel { background:#F1F5F9;border:1px solid var(--border);color:var(--text2); }
  .act-cancel:hover { background:#E2E8F0; }
  .act-del { background:var(--red);border:none;color:#fff; }
  .act-del:hover { background:#B91C1C; }
  .act-ok { background:var(--blue);border:none;color:#fff; }
  .act-ok:hover { background:var(--blue-h); }
  .act-ok:disabled { opacity:.4;cursor:not-allowed; }

  /* Modal form */
  .mfld { margin-bottom:13px; }
  .mfld-l { display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text2);margin-bottom:5px; }
  .mfld-i { width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;color:var(--text);font-family:'DM Sans',sans-serif;background:var(--bg2);outline:none;transition:border-color .14s,box-shadow .14s; }
  .mfld-i:focus { border-color:var(--blue);box-shadow:0 0 0 3px rgba(29,78,216,.1);background:#fff; }
  .mfld-i::placeholder { color:var(--text3); }

  /* Notices */
  .notice { border-radius:8px;padding:10px 12px;display:flex;align-items:flex-start;gap:8px;font-size:12px;line-height:1.5;margin-bottom:14px; }
  .notice svg { flex-shrink:0;margin-top:1px; }
  .notice.sky   { background:var(--sky-lt);border:1px solid var(--sky-bd);color:var(--sky); }
  .notice.green { background:var(--green-lt);border:1px solid #A7F3D0;color:#065F46; }

  /* Tabs */
  .tabs { display:flex;background:#F1F5F9;border-radius:9px;padding:3px;margin-bottom:16px; }
  .tab { flex:1;padding:8px;border:none;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background .14s,color .14s;background:transparent;color:var(--text2);display:flex;align-items:center;justify-content:center;gap:6px; }
  .tab.on { background:#fff;color:var(--text);box-shadow:0 1px 4px rgba(0,0,0,.1); }

  /* Dropzone */
  .dz { border:2px dashed var(--border2);border-radius:10px;padding:22px;text-align:center;cursor:pointer;transition:border-color .14s,background .14s;margin-bottom:12px;background:var(--bg2); }
  .dz:hover,.dz.over { border-color:var(--blue);background:var(--blue-lt); }
  .dz-ic { color:var(--text3);margin:0 auto 8px;display:block; }
  .dz-t { font-size:13px;font-weight:600;color:var(--text2); }
  .dz-s { font-size:11px;color:var(--text3);margin-top:2px; }

  /* Preview */
  .prev-wrap { max-height:170px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;margin-bottom:12px; }
  .prev-t { width:100%;border-collapse:collapse;font-size:11px; }
  .prev-t th { background:#F8FAFC;padding:6px 10px;text-align:left;font-weight:700;color:var(--text2);border-bottom:1px solid var(--border);font-size:10px;text-transform:uppercase; }
  .prev-t td { padding:5px 10px;color:var(--text);border-bottom:1px solid #F1F5F9; }

  /* Toast */
  .toast { position:fixed;top:15px;left:50%;transform:translateX(-50%);z-index:999;padding:10px 18px;border-radius:10px;display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;letter-spacing:.02em;box-shadow:0 8px 28px rgba(0,0,0,.14);animation:slideD .25s ease;white-space:nowrap; }
  .toast.success { background:#0F172A;color:#fff; }
  .toast.error   { background:var(--red);color:#fff; }
  @keyframes slideD { from{opacity:0;transform:translateX(-50%) translateY(-10px)} }

  /* Loading */
  .load-scr { height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:11px;background:#ECEEF2; }
  .spin { width:30px;height:30px;border:3px solid #E2E8F0;border-top-color:var(--blue);border-radius:50%;animation:rot .65s linear infinite; }
  @keyframes rot { to{transform:rotate(360deg)} }
  .load-t { font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:var(--text3); }
`;

// ─── Badge ───
function Badge({ value }) {
  if (!value) return <span style={{ color: '#94A3B8', fontSize: 11 }}>—</span>;
  const v = String(value).toUpperCase();
  let c = 'bg-sl';
  if (['SIM','REALIZADO','PUBLICADO'].includes(v)) c = 'bg-g';
  else if (['NÃO','PENDENTE'].includes(v)) c = 'bg-r';
  else if (v === 'NÃO SE APLICA') c = 'bg-a';
  else if (['SOLICITADO','FORMALIZAR','CONJUR'].includes(v)) c = 'bg-bl';
  return <span className={`badge ${c}`}>{value}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function TabelaGerencialMaster() {
  const navigate = useNavigate();

  const [data, setData]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [progress, setProgress]     = useState(0);
  const [message, setMessage]       = useState(null);
  const [editedCells, setEditedCells] = useState({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [selectedRows, setSelectedRows] = useState(new Set());

  const [delModal, setDelModal]   = useState({ open: false, single: null });
  const [newModal, setNewModal]   = useState(false);
  const [newTab, setNewTab]       = useState('manual');
  const [newProposta, setNewProposta] = useState('');
  const [excelFile, setExcelFile] = useState(null);
  const [excelError, setExcelError] = useState('');
  const [dragover, setDragover]   = useState(false);
  const fileRef = useRef(null);

  const [filters, setFilters] = useState({
    proposta: '', modalidade: 'Todas', situacao: 'Todas',
    empenhado: 'Todos', publicacao: 'Todas',
    processo: '', proponente: '', tecnico: 'Todos',
  });

  // ── fetch ──
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      let all = [], from = 0, ps = 1000;
      while (true) {
        const { data: chunk, error, count } = await supabase
          .from('formalizacoes').select('*', { count: 'exact' })
          .order('id', { ascending: false }).range(from, from + ps - 1);
        if (error) throw error;
        all = [...all, ...chunk];
        from += ps;
        if (count) setProgress(Math.round((all.length / count) * 100));
        if (chunk.length < ps) break;
      }
      setData(all);
    } catch { notify('error', 'Falha na conexão com o Supabase.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  const notify = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  // ── filtros ──
  const filteredData = useMemo(() => data.filter(row => {
    const f = filters;
    if (f.proposta    && !String(row['PROPOSTA'] || '').toLowerCase().includes(f.proposta.toLowerCase())) return false;
    if (f.modalidade  !== 'Todas' && row['INSTRUMENTO'] !== f.modalidade) return false;
    if (f.situacao    !== 'Todas' && row['AJUSTE'] !== f.situacao) return false;
    if (f.empenhado   !== 'Todos') {
      const e = String(row['CANCELAR EMPENHO'] || '').toLowerCase();
      if (f.empenhado === 'Sim' && e !== 'sim') return false;
      if (f.empenhado === 'Não' && e !== 'não') return false;
    }
    if (f.publicacao  !== 'Todas' && row['PUBLICAÇÃO NO TRANSFEREGOV'] !== f.publicacao) return false;
    if (f.processo    && !String(row['NÚMERO DO PROCESSO'] || '').toLowerCase().includes(f.processo.toLowerCase())) return false;
    if (f.proponente  && !String(row['PROPONENTE'] || '').toLowerCase().includes(f.proponente.toLowerCase())) return false;
    if (f.tecnico     !== 'Todos' && row['TÉCNICO DE FORMALIZAÇÃO'] !== f.tecnico) return false;
    if (globalFilter) {
      const gf = globalFilter.toLowerCase();
      return Object.values(row).some(v => String(v || '').toLowerCase().includes(gf));
    }
    return true;
  }), [data, filters, globalFilter]);

  // ── KPI ──
  const stats = useMemo(() => ({
    total:        data.length,
    termoFomento: data.filter(d => d['INSTRUMENTO'] === 'TERMO DE FOMENTO').length,
    convenio:     data.filter(d => d['INSTRUMENTO'] === 'CONVÊNIO').length,
    valorTotal:   data.reduce((s, r) => s + (parseFloat(r['VALOR REPASSE']) || 0), 0),
  }), [data]);

  // ── colunas ──
  const columns = useMemo(() => {
    const hidden = ['id','created_at','vazia_1','vazia_2','SITUACIONAL','Coluna1'];
    const fixed  = ['PROPOSTA','VALOR REPASSE'];
    const dyn    = data.length > 0
      ? Object.keys(data[0]).filter(k => !hidden.includes(k) && !fixed.includes(k))
      : [];

    return [
      {
        id: 'sel', header: () => (
          <input type="checkbox" className="cb"
            checked={selectedRows.size === filteredData.length && filteredData.length > 0}
            onChange={e => {
              if (e.target.checked) setSelectedRows(new Set(filteredData.map(r => r.id)));
              else setSelectedRows(new Set());
            }} />
        ), size: 36,
        cell: ({ row }) => (
          <input type="checkbox" className="cb"
            checked={selectedRows.has(row.original.id)}
            onChange={e => {
              const s = new Set(selectedRows);
              e.target.checked ? s.add(row.original.id) : s.delete(row.original.id);
              setSelectedRows(s);
            }} />
        ),
      },
      {
        id: 'del', header: '', size: 36,
        cell: ({ row }) => (
          <button className="del-row" title="Excluir"
            onClick={() => setDelModal({ open: true, single: row.original })}>
            <Trash2 size={13} />
          </button>
        ),
      },
      {
        accessorKey: 'PROPOSTA', header: 'Nº PROPOSTA', size: 130,
        cell: ({ getValue }) => <span className="td-p">{getValue()}</span>,
      },
      {
        accessorKey: 'VALOR REPASSE', header: 'VALOR REPASSE', size: 140,
        cell: ({ getValue }) => {
          const v = parseFloat(getValue()) || 0;
          return <span className="td-v">{v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>;
        },
      },
      ...dyn.map(key => {
        const isRobo = ROBO_COLS.includes(key);
        return {
          accessorKey: key,
          header: () => (
            <div className="th-in">
              {key}
              {isRobo && <span className="robo-tag"><Bot size={8} />robô</span>}
            </div>
          ),
          size: 190,
          cell: ({ getValue, row }) => {
            const val = getValue();
            const cellId = `${row.original.id}::${key}`;
            const cur = editedCells[cellId] ?? val;

            if (isRobo) return <span className="td-robo" title={cur || ''}>{cur || '—'}</span>;

            if (SELECT_OPTIONS[key]) return (
              <select value={cur ?? ''} className={`csel${editedCells[cellId] ? ' ed' : ''}`}
                onChange={e => setEditedCells(p => ({ ...p, [cellId]: e.target.value }))}>
                <option value="">—</option>
                {SELECT_OPTIONS[key].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            );

            return <Badge value={cur} />;
          },
        };
      }),
    ];
  }, [data, editedCells, selectedRows, filteredData]);

  const table = useReactTable({
    data: filteredData, columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  const totalFiltered = filteredData.length;
  const pageCount = table.getPageCount();

  // ── salvar ──
  const handleSave = async () => {
    setSaving(true);
    try {
      const upd = {};
      for (const [cellId, value] of Object.entries(editedCells)) {
        const [id, key] = cellId.split('::');
        if (!upd[id]) upd[id] = { id: parseInt(id) };
        upd[id][key] = value;
      }
      for (const u of Object.values(upd)) {
        const { id, ...fields } = u;
        await supabase.from('formalizacoes').update(fields).eq('id', id);
      }
      setEditedCells({});
      notify('success', `${Object.keys(upd).length} registro(s) salvo(s).`);
      fetchAllData();
    } catch { notify('error', 'Erro ao salvar.'); }
    finally { setSaving(false); }
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Formalizações');
    XLSX.writeFile(wb, 'Relatorio_MESP.xlsx');
  };

  // ── excluir único ──
  const handleDeleteSingle = async () => {
    const row = delModal.single;
    await supabase.from('formalizacoes').delete().eq('id', row.id);
    setDelModal({ open: false, single: null });
    setSelectedRows(s => { const n = new Set(s); n.delete(row.id); return n; });
    notify('success', 'Registro excluído.');
    fetchAllData();
  };

  // ── excluir selecionados ──
  const handleDeleteSelected = async () => {
    const ids = Array.from(selectedRows);
    await supabase.from('formalizacoes').delete().in('id', ids);
    setDelModal({ open: false, single: null });
    setSelectedRows(new Set());
    notify('success', `${ids.length} registro(s) excluído(s).`);
    fetchAllData();
  };

  // ── novo manual ──
  const handleNewManual = async () => {
    const p = newProposta.trim();
    if (!p) return;
    const { error } = await supabase.from('formalizacoes').insert([{ PROPOSTA: p }]);
    if (error) { notify('error', 'Erro ao inserir.'); return; }
    notify('success', `Proposta ${p} criada. O robô preencherá os demais dados.`);
    setNewModal(false); setNewProposta(''); fetchAllData();
  };

  // ── processar excel ──
  const processExcel = file => {
    setExcelError(''); setExcelFile(null);
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb   = XLSX.read(e.target.result, { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        const col  = Object.keys(rows[0] || {}).find(k => k.toLowerCase().includes('proposta'));
        if (!col) { setExcelError('Nenhuma coluna com "PROPOSTA" encontrada. Verifique o arquivo.'); return; }
        setExcelFile({ name: file.name, col, rows: rows.filter(r => r[col]) });
      } catch { setExcelError('Erro ao ler o arquivo. Use .xlsx ou .xls válido.'); }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleNewExcel = async () => {
    if (!excelFile) return;
    const inserts = excelFile.rows.map(r => ({ PROPOSTA: String(r[excelFile.col]).trim() }));
    const { error } = await supabase.from('formalizacoes').insert(inserts);
    if (error) { notify('error', 'Erro ao importar.'); return; }
    notify('success', `${inserts.length} proposta(s) importada(s). O robô preencherá os dados.`);
    setNewModal(false); setExcelFile(null); fetchAllData();
  };

  // ── loading ──
  if (loading && !data.length) return (
    <><style>{STYLES}</style>
      <div className="load-scr">
        <div className="spin" />
        <p className="load-t">Carregando… {progress}%</p>
      </div>
    </>
  );

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <><style>{STYLES}</style>

    <div className="shell">

      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sb-head">
          <div className="sb-brand">
            <div className="sb-icon">M</div>
            <div>
              <div className="sb-name">GERENCIAL <em>MESP</em></div>
              <div className="sb-sub">Painel de Controle</div>
            </div>
          </div>
        </div>

        <div className="sb-body">
          <div className="sb-sec"><Filter size={10} /> Filtros</div>

          {[
            { lbl: 'Nº Proposta', key: 'proposta', type: 'input', placeholder: 'Ex.: 024721/2025' },
            { lbl: 'Nº do Processo', key: 'processo', type: 'input', placeholder: 'Digite o processo' },
            { lbl: 'Proponente', key: 'proponente', type: 'input', placeholder: 'Digite o proponente' },
          ].map(({ lbl, key, placeholder }) => (
            <div className="fld" key={key}>
              <label className="fld-l">{lbl}</label>
              <input type="text" className="fld-i" placeholder={placeholder}
                value={filters[key]}
                onChange={e => setFilters(p => ({ ...p, [key]: e.target.value }))} />
            </div>
          ))}

          <div className="fld">
            <label className="fld-l">Modalidade</label>
            <div className="sel-w">
              <select className="fld-s" value={filters.modalidade}
                onChange={e => setFilters(p => ({ ...p, modalidade: e.target.value }))}>
                <option>Todas</option>
                <option value="CONVÊNIO">Convênio</option>
                <option value="TERMO DE FOMENTO">Termo de Fomento</option>
                <option value="TERMO DE EXECUÇÃO DESCENTRALIZADA">Termo de Exec. Descentralizada</option>
              </select>
            </div>
          </div>

          <div className="fld">
            <label className="fld-l">Situação de Contratação</label>
            <div className="sel-w">
              <select className="fld-s" value={filters.situacao}
                onChange={e => setFilters(p => ({ ...p, situacao: e.target.value }))}>
                <option>Todas</option>
                <option value="PENDENTE">Pendente</option>
                <option value="REALIZADO">Realizado</option>
                <option value="NÃO SE APLICA">Não Se Aplica</option>
              </select>
            </div>
          </div>

          <div className="fld">
            <label className="fld-l">Empenhado</label>
            <div className="sel-w">
              <select className="fld-s" value={filters.empenhado}
                onChange={e => setFilters(p => ({ ...p, empenhado: e.target.value }))}>
                <option>Todos</option>
                <option value="Sim">Sim</option>
                <option value="Não">Não</option>
              </select>
            </div>
          </div>

          <div className="fld">
            <label className="fld-l">Publicação</label>
            <div className="sel-w">
              <select className="fld-s" value={filters.publicacao}
                onChange={e => setFilters(p => ({ ...p, publicacao: e.target.value }))}>
                <option>Todas</option>
                <option value="SIM">Sim</option>
                <option value="NÃO">Não</option>
              </select>
            </div>
          </div>

          <div className="fld">
            <label className="fld-l">Técnico</label>
            <div className="sel-w">
              <select className="fld-s" value={filters.tecnico}
                onChange={e => setFilters(p => ({ ...p, tecnico: e.target.value }))}>
                <option>Todos</option>
                {SELECT_OPTIONS['TÉCNICO DE FORMALIZAÇÃO'].map(t =>
                  <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="sb-foot">
          <button className="btn-clear" onClick={() => {
            setFilters({ proposta:'',modalidade:'Todas',situacao:'Todas',empenhado:'Todos',publicacao:'Todas',processo:'',proponente:'',tecnico:'Todos' });
            setGlobalFilter('');
          }}>Limpar Filtros</button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="main">

        {/* KPI */}
        <div className="kpi-row">
          <div className="kpi bl">
            <div className="kpi-v">{stats.total.toLocaleString('pt-BR')}</div>
            <div className="kpi-l">Total de Propostas</div>
          </div>
          <div className="kpi gr">
            <div className="kpi-v">{stats.termoFomento}</div>
            <div className="kpi-l">Termo de Fomento</div>
          </div>
          <div className="kpi am">
            <div className="kpi-v">{stats.convenio}</div>
            <div className="kpi-l">Convênio</div>
          </div>
          <div className="kpi re">
            <div className="kpi-v">
              {stats.valorTotal.toLocaleString('pt-BR', { notation: 'compact', style: 'currency', currency: 'BRL' })}
            </div>
            <div className="kpi-l">Valor em Repasse</div>
          </div>
        </div>

        {/* TABLE */}
        <div className="tcard">

          {/* Toolbar */}
          <div className="tbar">
            <div className="tbar-l">
              <span className="tbar-title">Propostas</span>
              <span className="tbar-cnt">{totalFiltered.toLocaleString('pt-BR')} registros</span>
            </div>
            <div className="tbar-r">
              <span className="lbl-flt">FILTRO POR PALAVRAS</span>
              <div className="sw">
                <Search size={13} />
                <input className="sw-i" placeholder="Buscar em qualquer coluna..."
                  value={globalFilter}
                  onChange={e => setGlobalFilter(e.target.value)} />
                {globalFilter && (
                  <button className="sw-x" onClick={() => setGlobalFilter('')}><X size={11} /></button>
                )}
              </div>
              <div className="vdiv" />
              <button className="ibtn" onClick={fetchAllData} title="Atualizar"><RefreshCw size={14} /></button>
              <button className="ibtn g" onClick={exportToExcel} title="Exportar Excel"><Download size={14} /></button>

              {selectedRows.size > 0 && (
                <button className="btn-del-sel"
                  onClick={() => setDelModal({ open: true, single: null })}>
                  <Trash2 size={13} /> Excluir ({selectedRows.size})
                </button>
              )}

              {Object.keys(editedCells).length > 0 && (
                <button className="btn-save" onClick={handleSave} disabled={saving}>
                  {saving
                    ? <Loader2 size={13} style={{ animation: 'rot .65s linear infinite' }} />
                    : <Save size={13} />}
                  Salvar ({Object.keys(editedCells).length})
                </button>
              )}

              <div className="vdiv" />
              <button className="btn-pri"
                onClick={() => { setNewModal(true); setNewTab('manual'); setNewProposta(''); setExcelFile(null); setExcelError(''); }}>
                <Plus size={13} /> Novo Registro
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="tscroll">
            <table>
              <thead>
                <tr>
                  {table.getHeaderGroups()[0]?.headers.map(header => {
                    const key = header.column.columnDef.accessorKey;
                    const isRobo = ROBO_COLS.includes(key);
                    return (
                      <th key={header.id}
                        className={`${header.column.getCanSort() ? 's' : ''}${isRobo ? ' robo' : ''}`}
                        style={{ width: header.column.columnDef.size }}
                        onClick={header.column.getToggleSortingHandler()}>
                        <div className="th-in">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === 'asc'  && <span className="si">▲</span>}
                          {header.column.getIsSorted() === 'desc' && <span className="si">▼</span>}
                          {!header.column.getIsSorted() && header.column.getCanSort() && <span className="si">⇅</span>}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id} className={selectedRows.has(row.original.id) ? 'sel' : ''}>
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
                {table.getRowModel().rows.length === 0 && (
                  <tr><td colSpan={columns.length}
                    style={{ textAlign: 'center', padding: '48px 0', color: '#94A3B8', fontSize: 13 }}>
                    Nenhum registro encontrado para os filtros aplicados.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="tfoot">
            <div className="pg-info">
              Exibindo{' '}
              <b>{pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, totalFiltered)}</b>
              {' '}de <b>{totalFiltered.toLocaleString('pt-BR')}</b> filtrado(s).
              Total geral: <b>{stats.total.toLocaleString('pt-BR')}</b>.
            </div>
            <div className="pg-ctrl">
              <span className="pg-lbl">Linhas por página</span>
              <select className="pg-size" value={pageSize}
                onChange={e => table.setPageSize(Number(e.target.value))}>
                {[10,25,50,100].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button className="pg-btn" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                <ChevronLeft size={12} /> Anterior
              </button>
              <span className="pg-cur">Página {pageIndex + 1} de {pageCount}</span>
              <button className="pg-btn" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                Próxima <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>

    {/* ── MODAL EXCLUIR ÚNICO ── */}
    {delModal.open && delModal.single && (
      <div className="overlay">
        <div className="modal modal-sm">
          <div className="m-ico red"><AlertTriangle size={24} /></div>
          <h2>Excluir Registro?</h2>
          <p className="m-desc">
            Você está prestes a remover a proposta{' '}
            <b>{delModal.single?.PROPOSTA}</b> permanentemente. Esta ação é irreversível.
          </p>
          <div className="m-acts">
            <button className="act-cancel" onClick={() => setDelModal({ open: false, single: null })}>Cancelar</button>
            <button className="act-del" onClick={handleDeleteSingle}>Sim, Excluir</button>
          </div>
        </div>
      </div>
    )}

    {/* ── MODAL EXCLUIR SELECIONADOS ── */}
    {delModal.open && !delModal.single && (
      <div className="overlay">
        <div className="modal modal-sm">
          <div className="m-ico red"><AlertTriangle size={24} /></div>
          <h2>Excluir {selectedRows.size} Registro(s)?</h2>
          <p className="m-desc">
            Os <b>{selectedRows.size} registros selecionados</b> serão removidos
            permanentemente. Esta ação é irreversível.
          </p>
          <div className="m-acts">
            <button className="act-cancel" onClick={() => setDelModal({ open: false, single: null })}>Cancelar</button>
            <button className="act-del" onClick={handleDeleteSelected}>Sim, Excluir Todos</button>
          </div>
        </div>
      </div>
    )}

    {/* ── MODAL NOVO REGISTRO ── */}
    {newModal && (
      <div className="overlay">
        <div className="modal modal-lg">
          <div className="m-ico blue"><Plus size={24} /></div>
          <h2>Novo Registro</h2>
          <p className="m-desc" style={{ marginBottom: 14 }}>
            Adicione propostas manualmente ou via Excel. O robô preencherá os demais dados automaticamente.
          </p>

          <div className="tabs">
            <button className={`tab${newTab === 'manual' ? ' on' : ''}`} onClick={() => setNewTab('manual')}>
              <Hash size={13} /> Inserir Manualmente
            </button>
            <button className={`tab${newTab === 'excel' ? ' on' : ''}`} onClick={() => setNewTab('excel')}>
              <FileSpreadsheet size={13} /> Importar Excel
            </button>
          </div>

          {/* MANUAL */}
          {newTab === 'manual' && <>
            <div className="notice sky">
              <Bot size={15} />
              <span>
                Informe apenas o <b>número da proposta</b> (ex.: <b>024721/2025</b>).
                O robô preencherá automaticamente: Instrumento, Publicação, Proponente, Processo e demais dados do TransfereGov.
              </span>
            </div>
            <div className="mfld">
              <label className="mfld-l">Número da Proposta</label>
              <input className="mfld-i" placeholder="Ex.: 024721/2025"
                value={newProposta}
                onChange={e => setNewProposta(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleNewManual()} />
            </div>
            <div className="m-acts">
              <button className="act-cancel" onClick={() => setNewModal(false)}>Cancelar</button>
              <button className="act-ok" disabled={!newProposta.trim()} onClick={handleNewManual}>
                Criar Registro
              </button>
            </div>
          </>}

          {/* EXCEL */}
          {newTab === 'excel' && <>
            <div className="notice green">
              <FileSpreadsheet size={15} />
              <span>
                Faça upload de um <b>.xlsx</b> ou <b>.xls</b>. Certifique-se de que existe
                uma coluna cujo nome contenha a palavra <b>"PROPOSTA"</b> — ela será
                usada para importar os registros. O robô preencherá os demais campos.
              </span>
            </div>

            <div
              className={`dz${dragover ? ' over' : ''}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragover(true); }}
              onDragLeave={() => setDragover(false)}
              onDrop={e => { e.preventDefault(); setDragover(false); const f = e.dataTransfer.files[0]; if (f) processExcel(f); }}>
              <Upload size={26} className="dz-ic" />
              <div className="dz-t">{excelFile ? excelFile.name : 'Clique ou arraste o arquivo aqui'}</div>
              <div className="dz-s">.xlsx, .xls</div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
                onChange={e => { if (e.target.files[0]) processExcel(e.target.files[0]); }} />
            </div>

            {excelError && (
              <div style={{ fontSize:12,color:'var(--red)',marginBottom:12,padding:'8px 12px',background:'var(--red-lt)',borderRadius:7 }}>
                ⚠ {excelError}
              </div>
            )}

            {excelFile && !excelError && <>
              <div style={{ fontSize:12,color:'var(--text2)',marginBottom:8,fontWeight:600 }}>
                Coluna detectada: <span style={{ color:'var(--blue)' }}>{excelFile.col}</span>
                {' '}— <b style={{ color:'var(--text)' }}>{excelFile.rows.length}</b> proposta(s) encontrada(s)
              </div>
              <div className="prev-wrap">
                <table className="prev-t">
                  <thead><tr><th>#</th><th>PROPOSTA</th></tr></thead>
                  <tbody>
                    {excelFile.rows.slice(0, 8).map((r, i) => (
                      <tr key={i}><td>{i + 1}</td><td>{String(r[excelFile.col])}</td></tr>
                    ))}
                    {excelFile.rows.length > 8 && (
                      <tr><td colSpan={2} style={{ textAlign:'center',color:'var(--text3)',fontStyle:'italic' }}>
                        + {excelFile.rows.length - 8} mais…
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>}

            <div className="m-acts">
              <button className="act-cancel" onClick={() => setNewModal(false)}>Cancelar</button>
              <button className="act-ok" disabled={!excelFile || !!excelError} onClick={handleNewExcel}>
                Importar {excelFile ? `(${excelFile.rows.length})` : ''} Propostas
              </button>
            </div>
          </>}
        </div>
      </div>
    )}

    {/* TOAST */}
    {message && (
      <div className={`toast ${message.type}`}>
        {message.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
        {message.text}
      </div>
    )}
    </>
  );
}