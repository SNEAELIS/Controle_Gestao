// src/pages/Dashboard.jsx
// ============================================================
//  SNEAELIS · Dashboard Analítico
//  Padrão Digital de Governo — GOV.BR Design System v3
//  Tokens, fontes (Rawline/Raleway), classes br-*, faixa
//  tricolor e estrutura de header/menu oficiais.
// ============================================================
import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  getPaginationRowModel, flexRender, getFilteredRowModel,
} from '@tanstack/react-table';
import * as XLSX from 'xlsx';
import { supabase } from '../services/supabaseClient';

// ─────────────────────────────────────────────────────────────
//  CONSTANTES
// ─────────────────────────────────────────────────────────────
const STATUS_OK  = ['REALIZADO','CONCLUÍDO','FINALIZADO','APROVADO','SIM','EXECUTADO','PUBLICADA'];
const STATUS_BAD = ['PENDENTE','REJEITADO','CANCELADO','NÃO'];
const PALETTE    = ['#1351B4','#168821','#FFCD07','#E60000','#0E9F6E','#7E3AF2','#0694A2','#F59E0B','#6366F1','#E74694'];

function lerpColor(a, b, t) {
  const p = (hex, i) => parseInt(hex.slice(i, i + 2), 16);
  const r  = Math.round(p(a,1) + (p(b,1) - p(a,1)) * t);
  const g  = Math.round(p(a,3) + (p(b,3) - p(a,3)) * t);
  const bl = Math.round(p(a,5) + (p(b,5) - p(a,5)) * t);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${bl.toString(16).padStart(2,'0')}`;
}

// ─────────────────────────────────────────────────────────────
//  CSS — variáveis e overrides no topo do GOV.BR DS
// ─────────────────────────────────────────────────────────────
const CSS = `
/* ── Importa GOV.BR DS via CDN oficial ── */
@import url('https://cdngovbr-ds.estaleiro.serpro.gov.br/design-system/fonts/rawline/css/rawline.css');
@import url('https://fonts.googleapis.com/css?family=Raleway:300,400,500,600,700,800,900&display=swap');

/* Font Awesome 5 */
@import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css');

/* ── Tokens GOV.BR adaptados para React (sem as classes br-* que precisam do JS nativo) ── */
:root {
  /* Cores primárias GOV.BR */
  --color-primary:         #1351B4;
  --color-primary-darken:  #0C326F;
  --color-primary-lighten: #C5D4EB;
  --color-primary-pale:    #DBE8FB;

  /* Cores de destaque */
  --color-green:  #168821;
  --color-yellow: #FFCD07;
  --color-blue:   #1351B4;

  /* Feedback */
  --color-success:          #168821;
  --color-success-bg:       #E3F5E1;
  --color-warning:          #B47800;
  --color-warning-bg:       #FFF5D0;
  --color-danger:           #E52207;
  --color-danger-bg:        #FDE8E8;
  --color-info:             #155BCB;
  --color-info-bg:          #D9E8FB;

  /* Neutros */
  --color-secondary-07:  #071D41;
  --color-secondary-08:  #0C326F;
  --color-secondary-06:  #1351B4;
  --color-secondary-03:  #C5D4EB;
  --color-secondary-01:  #F8F8F8;

  /* Superfícies */
  --bg-01: #FFFFFF;
  --bg-02: #F8F8F8;
  --bg-03: #EDEDED;

  /* Texto */
  --text-01: #1B1B1B;
  --text-02: #333333;
  --text-03: #555555;
  --text-04: #888888;

  /* Borda */
  --border-color: #CCCCCC;
  --border-width: 1px;
  --border-radius: 4px;

  /* Tipografia */
  --font-family-base:    'Rawline', 'Raleway', sans-serif;
  --font-size-base:      14px;
  --font-weight-regular: 400;
  --font-weight-medium:  500;
  --font-weight-semi:    600;
  --font-weight-bold:    700;

  /* Sombra */
  --shadow-sm: 0 1px 3px rgba(0,0,0,.10), 0 1px 2px rgba(0,0,0,.06);
  --shadow-md: 0 4px 6px rgba(0,0,0,.07), 0 2px 4px rgba(0,0,0,.06);
  --shadow-lg: 0 10px 15px rgba(0,0,0,.07), 0 4px 6px rgba(0,0,0,.05);

  /* Espaçamento (escala 4px) */
  --spacing-1: 4px;
  --spacing-2: 8px;
  --spacing-3: 12px;
  --spacing-4: 16px;
  --spacing-5: 20px;
  --spacing-6: 24px;
  --spacing-8: 32px;
}

*,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0 }

html, body, #root {
  font-family: var(--font-family-base);
  font-size: var(--font-size-base);
  background: var(--bg-02);
  height: 100vh;
  overflow: hidden;
  color: var(--text-01);
}

/* ──────────────────────────────────────────────
   FAIXA TRICOLOR OFICIAL GOV.BR
   (verde #168821 | amarelo #FFCD07 | azul #1351B4)
────────────────────────────────────────────── */
.govbr-stripe {
  height: 8px;
  background: linear-gradient(
    to right,
    #168821 0%, #168821 33.33%,
    #FFCD07 33.33%, #FFCD07 66.66%,
    #1351B4 66.66%, #1351B4 100%
  );
  flex-shrink: 0;
  width: 100%;
}

/* ──────────────────────────────────────────────
   LAYOUT SHELL
────────────────────────────────────────────── */
.ds-shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

/* ──────────────────────────────────────────────
   SIDEBAR (padrão menu lateral GOV.BR DS)
────────────────────────────────────────────── */
.ds-sidebar {
  width: 256px;
  flex-shrink: 0;
  background: var(--color-secondary-07);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  box-shadow: 2px 0 8px rgba(0,0,0,.18);
}

/* Borda direita tricolor decorativa */
.ds-sidebar::after {
  content: '';
  position: absolute;
  top: 0; right: 0;
  width: 4px;
  height: 100%;
  background: linear-gradient(180deg, #168821, #FFCD07 50%, #1351B4);
}

.ds-sidebar-header {
  padding: var(--spacing-4) var(--spacing-4) var(--spacing-3);
  border-bottom: 1px solid rgba(255,255,255,.10);
}

.ds-sidebar-logo {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  margin-bottom: var(--spacing-3);
}

/* Logo GOV.BR via img */
.ds-govbr-logo {
  height: 28px;
  filter: brightness(0) invert(1);
  flex-shrink: 0;
}

.ds-sidebar-divider {
  width: 1px;
  height: 28px;
  background: rgba(255,255,255,.25);
  flex-shrink: 0;
}

.ds-sidebar-system {
  color: #FFFFFF;
  font-size: 15px;
  font-weight: var(--font-weight-bold);
  letter-spacing: -.01em;
  line-height: 1.2;
}

.ds-sidebar-system em {
  color: var(--color-yellow);
  font-style: normal;
}

.ds-sidebar-ministry {
  font-size: 10px;
  font-weight: var(--font-weight-semi);
  letter-spacing: .12em;
  text-transform: uppercase;
  color: rgba(255,255,255,.45);
  margin-top: var(--spacing-1);
}

/* Nav */
.ds-sidebar-nav {
  flex: 1;
  padding: var(--spacing-3) var(--spacing-2);
  overflow-y: auto;
}

.ds-nav-section {
  font-size: 10px;
  font-weight: var(--font-weight-bold);
  letter-spacing: .14em;
  text-transform: uppercase;
  color: rgba(255,255,255,.28);
  padding: 0 var(--spacing-3);
  margin: var(--spacing-3) 0 var(--spacing-2);
}

.ds-nav-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: 10px var(--spacing-3);
  border-radius: var(--border-radius);
  border: none;
  cursor: pointer;
  font-size: 13px;
  font-weight: var(--font-weight-semi);
  font-family: var(--font-family-base);
  text-align: left;
  color: rgba(255,255,255,.55);
  background: transparent;
  margin-bottom: 2px;
  transition: all .15s ease;
  text-decoration: none;
}

.ds-nav-item:hover {
  background: rgba(255,255,255,.08);
  color: #fff;
}

.ds-nav-item.active {
  background: var(--color-primary);
  color: #fff;
  box-shadow: 0 2px 8px rgba(19,81,180,.4);
}

.ds-nav-item.active i {
  color: var(--color-yellow);
}

/* Rodapé sidebar */
.ds-sidebar-footer {
  padding: var(--spacing-3) var(--spacing-4);
  border-top: 1px solid rgba(255,255,255,.08);
  flex-shrink: 0;
}

.ds-user-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

.ds-user-avatar {
  width: 36px; height: 36px;
  border-radius: 50%;
  background: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--font-weight-bold);
  font-size: 12px;
  color: #fff;
  border: 2px solid rgba(255,255,255,.2);
  flex-shrink: 0;
}

.ds-user-name { font-size: 12px; font-weight: var(--font-weight-bold); color: #fff; }
.ds-user-role { font-size: 10px; color: rgba(255,255,255,.38); }

/* ──────────────────────────────────────────────
   MAIN AREA
────────────────────────────────────────────── */
.ds-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

/* ── Header GOV.BR DS (adaptado) ── */
.ds-header {
  background: var(--bg-01);
  border-bottom: 1px solid var(--border-color);
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--spacing-5);
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
  gap: var(--spacing-3);
}

.ds-header-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

.ds-breadcrumb {
  font-size: 12px;
  color: var(--text-03);
  display: flex;
  align-items: center;
  gap: 6px;
}

.ds-breadcrumb b { color: var(--text-01); font-weight: var(--font-weight-semi); }

.ds-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: var(--font-weight-bold);
  letter-spacing: .06em;
  text-transform: uppercase;
  background: var(--color-primary-pale);
  color: var(--color-primary);
  border: 1px solid var(--color-primary-lighten);
  padding: 3px 10px;
  border-radius: 100px;
}

.ds-header-right {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

/* Busca no header */
.ds-search {
  position: relative;
  display: flex;
  align-items: center;
}

.ds-search i {
  position: absolute;
  left: 10px;
  color: var(--text-04);
  font-size: 12px;
  pointer-events: none;
}

.ds-search input {
  padding: 7px 12px 7px 30px;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  font-size: 12px;
  color: var(--text-01);
  width: 210px;
  font-family: var(--font-family-base);
  outline: none;
  background: var(--bg-02);
  transition: border-color .15s;
}

.ds-search input:focus { border-color: var(--color-primary); }
.ds-search input::placeholder { color: var(--text-04); }

/* Botões padrão GOV.BR DS */
.br-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: var(--border-radius);
  border: 1px solid transparent;
  cursor: pointer;
  font-size: 12px;
  font-weight: var(--font-weight-semi);
  font-family: var(--font-family-base);
  transition: all .15s;
  text-decoration: none;
  line-height: 1;
}

.br-button.secondary {
  background: transparent;
  border-color: var(--border-color);
  color: var(--text-02);
}

.br-button.secondary:hover { background: var(--bg-02); }

.br-button.primary {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}

.br-button.primary:hover { background: var(--color-primary-darken); }

/* Separador */
.ds-divider-v {
  width: 1px;
  height: 20px;
  background: var(--border-color);
}

/* ──────────────────────────────────────────────
   PÁGINA / CONTEÚDO
────────────────────────────────────────────── */
.ds-page {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-4) var(--spacing-5) var(--spacing-8);
}

/* ── Barra de filtros ── */
.ds-filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  background: var(--bg-01);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  padding: 8px 14px;
  margin-bottom: var(--spacing-4);
  box-shadow: var(--shadow-sm);
}

.ds-filter-label {
  font-size: 10px;
  font-weight: var(--font-weight-bold);
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--text-04);
  display: flex;
  align-items: center;
  gap: 4px;
  margin-right: var(--spacing-1);
}

.ds-filter-select-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.ds-filter-select-wrapper i.icon-left {
  position: absolute;
  left: 8px;
  color: var(--text-04);
  font-size: 11px;
  pointer-events: none;
  z-index: 1;
}

.ds-filter-select-wrapper i.icon-right {
  position: absolute;
  right: 6px;
  color: var(--text-04);
  font-size: 10px;
  pointer-events: none;
}

.ds-filter-select-wrapper select {
  padding: 5px 22px 5px 26px;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  font-size: 11px;
  color: var(--text-02);
  font-family: var(--font-family-base);
  background: var(--bg-02);
  outline: none;
  cursor: pointer;
  appearance: none;
  transition: border-color .15s;
}

.ds-filter-select-wrapper select:focus { border-color: var(--color-primary); }

/* Chips de filtro ativos */
.ds-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  background: var(--color-primary-pale);
  border: 1px solid var(--color-primary-lighten);
  border-radius: 100px;
  font-size: 10px;
  font-weight: var(--font-weight-bold);
  color: var(--color-primary);
  cursor: pointer;
  transition: background .14s;
}

.ds-chip:hover { background: var(--color-primary-lighten); }

.ds-chip-clear {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  font-size: 11px;
  font-weight: var(--font-weight-semi);
  color: var(--text-03);
  cursor: pointer;
  font-family: var(--font-family-base);
  margin-left: auto;
  transition: background .14s;
}

.ds-chip-clear:hover { background: var(--bg-02); }

/* ── Seção heading ── */
.ds-section-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  font-weight: var(--font-weight-bold);
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--text-03);
  margin: var(--spacing-4) 0 var(--spacing-3);
}

.ds-section-heading::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border-color);
}

/* ──────────────────────────────────────────────
   KPI CARDS  (br-card padrão GOV.BR)
────────────────────────────────────────────── */
.ds-kpi-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--spacing-3);
  margin-bottom: var(--spacing-3);
}

.br-card {
  background: var(--bg-01);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  position: relative;
  cursor: pointer;
  transition: box-shadow .18s, transform .18s;
  border-top: 4px solid var(--accent, var(--color-primary));
}

.br-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.br-card.active { box-shadow: 0 0 0 3px rgba(19,81,180,.2); }

.br-card .card-content { padding: var(--spacing-3) var(--spacing-4); }

.kpi-label {
  font-size: 10px;
  font-weight: var(--font-weight-bold);
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--text-03);
  margin-bottom: 4px;
}

.kpi-value {
  font-size: 22px;
  font-weight: var(--font-weight-bold);
  color: var(--text-01);
  letter-spacing: -.02em;
  line-height: 1;
  font-family: 'Rawline', sans-serif;
}

.kpi-sub {
  font-size: 10px;
  color: var(--text-04);
  margin-top: 5px;
  display: flex;
  align-items: center;
  gap: 3px;
}

.kpi-sub.success { color: var(--color-success); }
.kpi-sub.danger  { color: var(--color-danger); }

.kpi-icon {
  position: absolute;
  top: var(--spacing-3);
  right: var(--spacing-3);
  width: 36px; height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
}

.kpi-clickhint {
  position: absolute;
  bottom: 4px;
  right: 8px;
  font-size: 8.5px;
  font-weight: var(--font-weight-bold);
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--text-04);
  opacity: 0;
  transition: opacity .15s;
}

.br-card:hover .kpi-clickhint { opacity: 1; }

/* ──────────────────────────────────────────────
   CHARTS / CONTAINERS
────────────────────────────────────────────── */
.ds-row {
  display: grid;
  gap: var(--spacing-3);
  margin-bottom: var(--spacing-3);
}

.ds-row-2  { grid-template-columns: 1fr 1fr; }
.ds-row-map{ grid-template-columns: 3fr 2fr; }
.ds-row-tec{ grid-template-columns: 3fr 2fr; }

.ds-card {
  background: var(--bg-01);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.ds-card-header {
  padding: 10px 14px 9px;
  border-bottom: 1px solid var(--bg-03);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-2);
}

.ds-card-title {
  font-size: 13px;
  font-weight: var(--font-weight-bold);
  color: var(--text-01);
  display: flex;
  align-items: center;
  gap: 6px;
}

.ds-card-subtitle {
  font-size: 10px;
  color: var(--text-04);
  margin-top: 2px;
}

.ds-card-body { padding: var(--spacing-3) var(--spacing-4) var(--spacing-4); }

/* ── Mapa ── */
.ds-map-outer {
  width: 100%;
  background: linear-gradient(160deg, #EEF4FC, #E4EDF8);
  border-radius: var(--border-radius);
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--spacing-2);
}

.ds-map-legend {
  display: flex;
  align-items: center;
  gap: 7px;
  background: rgba(255,255,255,.92);
  backdrop-filter: blur(4px);
  padding: 5px 10px;
  border-radius: 100px;
  font-size: 10px;
  color: var(--text-02);
  font-weight: var(--font-weight-semi);
  box-shadow: var(--shadow-sm);
  border: 1px solid rgba(255,255,255,.7);
  margin-top: var(--spacing-2);
}

.ds-map-legend-bar {
  width: 72px; height: 8px;
  border-radius: 4px;
  background: linear-gradient(90deg,#C5D4EB,#071D41);
  border: 1px solid rgba(0,0,0,.08);
}

/* ── Ranking UF ── */
.ds-uf-list { max-height: 300px; overflow-y: auto; }

.ds-uf-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: 6px var(--spacing-2);
  border-radius: var(--border-radius);
  cursor: pointer;
  transition: background .12s;
  margin-bottom: 2px;
}

.ds-uf-row:hover { background: var(--bg-02); }
.ds-uf-row.active { background: var(--color-primary-pale); }

.ds-uf-badge {
  width: 32px; height: 22px;
  border-radius: var(--border-radius);
  background: var(--bg-03);
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9.5px;
  font-weight: var(--font-weight-bold);
  color: var(--text-02);
  flex-shrink: 0;
}

.ds-uf-row.active .ds-uf-badge {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}

.ds-uf-bar-wrap { flex: 1; }
.ds-uf-bar-top  { display: flex; justify-content: space-between; margin-bottom: 3px; }
.ds-uf-bar-lbl  { font-size: 10px; color: var(--text-04); }
.ds-uf-bar-val  { font-size: 10px; font-weight: var(--font-weight-bold); color: var(--text-01); }
.ds-uf-bar-bg   { height: 5px; background: var(--bg-03); border-radius: 10px; overflow: hidden; }
.ds-uf-bar-fill { height: 100%; background: var(--color-primary); border-radius: 10px; transition: width .5s ease; }

/* ──────────────────────────────────────────────
   TABELA  (padrão GOV.BR DS)
────────────────────────────────────────────── */
.ds-table-card {
  background: var(--bg-01);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.ds-table-header {
  padding: 10px 14px;
  border-bottom: 1px solid var(--bg-03);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-2);
}

.ds-table-title {
  font-size: 13px;
  font-weight: var(--font-weight-bold);
  color: var(--text-01);
  display: flex;
  align-items: center;
  gap: 6px;
}

.ds-table-count {
  font-size: 10px;
  font-weight: var(--font-weight-bold);
  color: var(--color-primary);
  background: var(--color-primary-pale);
  padding: 2px 10px;
  border-radius: 100px;
  border: 1px solid var(--color-primary-lighten);
}

.ds-table-search {
  position: relative;
  display: flex;
  align-items: center;
}

.ds-table-search i {
  position: absolute;
  left: 8px;
  color: var(--text-04);
  font-size: 11px;
  pointer-events: none;
}

.ds-table-search input {
  padding: 5px 10px 5px 27px;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  font-size: 11px;
  color: var(--text-01);
  width: 190px;
  font-family: var(--font-family-base);
  outline: none;
  background: var(--bg-02);
}

.ds-table-search input:focus { border-color: var(--color-primary); }

.ds-table-scroll { overflow-x: auto; max-height: 340px; overflow-y: auto; }

/* Tabela GOV.BR DS style */
.br-table {
  width: 100%;
  border-collapse: collapse;
}

.br-table thead th {
  position: sticky;
  top: 0;
  z-index: 5;
  background: var(--bg-02);
  border-bottom: 2px solid var(--border-color);
  padding: 8px 12px;
  text-align: left;
  font-size: 10px;
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: .09em;
  color: var(--text-03);
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
}

.br-table thead th:hover {
  color: var(--color-primary);
  background: var(--color-primary-pale);
}

.th-inner { display: flex; align-items: center; gap: 3px; }
.sort-icon { font-size: 9px; opacity: .4; }

.br-table tbody tr + tr { border-top: 1px solid var(--bg-03); }
.br-table tbody tr:hover { background: var(--color-primary-pale); }

.br-table tbody td {
  padding: 7px 12px;
  font-size: 12px;
  color: var(--text-01);
  white-space: nowrap;
}

/* Texto monospace (ex.: Proposta) */
.ds-mono {
  font-family: 'Courier New', monospace;
  font-size: 11.5px;
  font-weight: var(--font-weight-bold);
  color: var(--color-primary);
}

/* ── Badges GOV.BR DS ── */
.br-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 100px;
  font-size: 10px;
  font-weight: var(--font-weight-bold);
  white-space: nowrap;
}

.br-tag::before {
  content: '';
  width: 5px; height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
}

.br-tag.success { background: var(--color-success-bg); color: var(--color-success); }
.br-tag.success::before { background: var(--color-success); }
.br-tag.danger  { background: var(--color-danger-bg);  color: var(--color-danger);  }
.br-tag.danger::before  { background: var(--color-danger); }
.br-tag.warning { background: var(--color-warning-bg); color: var(--color-warning); }
.br-tag.warning::before { background: var(--color-warning); }
.br-tag.info    { background: var(--color-info-bg);    color: var(--color-info);    }
.br-tag.info::before    { background: var(--color-info); }
.br-tag.neutral { background: var(--bg-03); color: var(--text-03); }
.br-tag.neutral::before { background: var(--text-04); }

/* ── Paginação ── */
.ds-table-footer {
  padding: 8px 14px;
  border-top: 1px solid var(--bg-03);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-02);
}

.ds-pg-info { font-size: 11px; color: var(--text-03); }
.ds-pg-info b { color: var(--text-01); font-weight: var(--font-weight-bold); }

.ds-pg-controls { display: flex; align-items: center; gap: 6px; }

.ds-pg-size {
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  font-size: 11px;
  font-family: var(--font-family-base);
  color: var(--text-01);
  background: #fff;
  cursor: pointer;
  outline: none;
}

.ds-pg-btn {
  padding: 4px 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  font-size: 11px;
  font-weight: var(--font-weight-semi);
  background: #fff;
  color: var(--text-02);
  cursor: pointer;
  font-family: var(--font-family-base);
  display: flex;
  align-items: center;
  gap: 3px;
  transition: all .12s;
}

.ds-pg-btn:hover:not(:disabled) {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}

.ds-pg-btn:disabled { opacity: .28; cursor: not-allowed; }

.ds-pg-current { font-size: 11px; color: var(--text-03); font-weight: var(--font-weight-semi); padding: 0 2px; }

/* ──────────────────────────────────────────────
   TOOLTIP CHARTS
────────────────────────────────────────────── */
.ds-tooltip {
  background: #fff;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  padding: 7px 12px;
  box-shadow: var(--shadow-md);
  font-size: 12px;
  color: var(--text-01);
  font-family: var(--font-family-base);
}

.ds-tooltip strong {
  font-weight: var(--font-weight-bold);
  display: block;
  margin-bottom: 3px;
}

/* ── Legenda técnico ── */
.ds-tec-legend { display: flex; align-items: center; gap: 14px; margin-top: 4px; flex-wrap: wrap; }

.ds-tec-legend-item { display: flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: var(--font-weight-semi); color: var(--text-02); }

.ds-tec-legend-dot { width: 11px; height: 11px; border-radius: 3px; flex-shrink: 0; }

/* ──────────────────────────────────────────────
   LOADING / ERRO
────────────────────────────────────────────── */
.ds-loading-screen {
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  background: var(--bg-02);
}

.ds-spinner {
  width: 36px; height: 36px;
  border: 3px solid var(--color-primary-lighten);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin .7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.ds-loading-title { font-size: 14px; font-weight: var(--font-weight-bold); color: var(--text-01); }
.ds-loading-sub   { font-size: 12px; color: var(--text-03); }

/* ── Scrollbar ── */
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-thumb { background: var(--color-primary-lighten); border-radius: 10px; }

/* ── Animações ── */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.anim-1 { animation: fadeUp .25s ease both; }
.anim-2 { animation: fadeUp .25s .07s ease both; }
.anim-3 { animation: fadeUp .25s .14s ease both; }
.anim-4 { animation: fadeUp .25s .21s ease both; }
.anim-5 { animation: fadeUp .25s .28s ease both; }

/* ── Modal PDF overlay ── */
.ds-pdf-overlay {
  position: fixed;
  inset: 0;
  background: rgba(7,29,65,.55);
  backdrop-filter: blur(3px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ds-pdf-modal {
  background: var(--bg-01);
  border-radius: var(--border-radius);
  padding: 32px 40px;
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  min-width: 320px;
  border-top: 4px solid var(--color-primary);
}

.ds-pdf-modal .ds-spinner { width: 40px; height: 40px; }
.ds-pdf-modal-title { font-size: 15px; font-weight: var(--font-weight-bold); color: var(--text-01); }
.ds-pdf-modal-sub   { font-size: 12px; color: var(--text-03); text-align: center; }

/* ── Botão PDF verde destaque ── */
.br-button.pdf {
  background: #168821;
  color: #fff;
  border-color: #168821;
}
.br-button.pdf:hover { background: #0d5c16; }

/* ── Área capturável para PDF ── */
#pdf-capture-area { background: var(--bg-02); }
`;

// ─────────────────────────────────────────────────────────────
//  MAPA DO BRASIL
// ─────────────────────────────────────────────────────────────
function BrazilMap({ countByUf, selectedUf, onSelect }) {
  const [geoData, setGeoData] = useState(null);
  const [hov, setHov]         = useState(null);
  const GEO_URL = 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson';

  useEffect(() => {
    fetch(GEO_URL).then(r => r.json()).then(setGeoData).catch(console.error);
  }, []);

  const maxVal = useMemo(() => Math.max(...Object.values(countByUf), 1), [countByUf]);

  if (!geoData) return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <div className="ds-spinner" style={{ margin: '0 auto 10px' }} />
      <div className="ds-loading-sub">Carregando cartografia…</div>
    </div>
  );

  return (
    <div className="ds-map-outer" style={{ height: 490 }}>
      <svg
        viewBox="-75 -6 42 42"
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', flex: 1 }}
      >
        {geoData.features.map(feature => {
          const uf   = feature.properties.sigla;
          const name = feature.properties.name;
          const cnt  = countByUf[uf] || 0;
          const t    = cnt / maxVal;
          const fill = selectedUf === uf ? '#1351B4'
            : hov === uf ? '#0C326F'
            : cnt > 0 ? lerpColor('#DCE6F2', '#1351B4', Math.pow(t, 0.4)) : '#F1F5F9';

          const pathData = feature.geometry.coordinates.map(polygon => {
            const rings = Array.isArray(polygon[0][0]) ? polygon : [polygon];
            return rings.map(ring =>
              ring.map((c, i) => `${i === 0 ? 'M' : 'L'}${c[0]},${c[1] * -1}`).join(' ') + 'Z'
            ).join(' ');
          }).join(' ');

          return (
            <path key={uf} d={pathData} fill={fill}
              stroke={selectedUf === uf ? '#FFCD07' : '#fff'}
              strokeWidth={selectedUf === uf ? '0.25' : '0.12'}
              strokeLinejoin="round"
              onClick={() => onSelect(selectedUf === uf ? null : uf)}
              onMouseEnter={() => setHov(uf)}
              onMouseLeave={() => setHov(null)}
              style={{ cursor: 'pointer', transition: 'fill .2s' }}>
              <title>{`${name}: ${cnt} processos`}</title>
            </path>
          );
        })}
      </svg>
      <div className="ds-map-legend">
        <span style={{ color: 'var(--text-04)' }}>Menos</span>
        <div className="ds-map-legend-bar" />
        <span style={{ fontWeight: 700 }}>{maxVal.toLocaleString('pt-BR')}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  BADGE DE STATUS
// ─────────────────────────────────────────────────────────────
function StatusBadge({ v }) {
  if (!v) return <span style={{ color: 'var(--text-04)' }}>—</span>;
  const s = String(v).toUpperCase().trim();
  let cls = 'neutral';
  if (STATUS_OK.some(x => s.includes(x)))  cls = 'success';
  else if (STATUS_BAD.some(x => s.includes(x))) cls = 'danger';
  else if (['CONJUR','FORMALIZAR','SOLICITADO'].some(x => s.includes(x))) cls = 'warning';
  else if (s.includes('NÃO SE APLICA')) cls = 'info';
  return <span className={`br-tag ${cls}`}>{v}</span>;
}

// ─────────────────────────────────────────────────────────────
//  TOOLTIP CUSTOMIZADO
// ─────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label, currency }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="ds-tooltip">
      <strong>{label}</strong>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>
          {currency
            ? p.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
            : p.value.toLocaleString('pt-BR')}
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
//  KPI CARD
// ─────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, subVariant, accent, iconBg, iconColor, active, onClick, clickable }) {
  return (
    <div
      className={`br-card anim-1${active ? ' active' : ''}`}
      style={{ '--accent': accent }}
      onClick={onClick}
    >
      <div className="card-content">
        <div className="kpi-icon" style={{ background: iconBg, color: iconColor }}>
          <i className={icon} />
        </div>
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">{value}</div>
        {sub && (
          <div className={`kpi-sub${subVariant ? ' ' + subVariant : ''}`}>
            {subVariant === 'success' && <i className="fas fa-arrow-up" style={{ fontSize: 9 }} />}
            {subVariant === 'danger'  && <i className="fas fa-arrow-down" style={{ fontSize: 9 }} />}
            {sub}
          </div>
        )}
      </div>
      {clickable && <div className="kpi-clickhint"><i className="fas fa-filter" /> Filtrar</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  DASHBOARD PRINCIPAL
// ─────────────────────────────────────────────────────────────
export default function DashboardSneaElis() {
  const navigate = useNavigate();

  const [raw, setRaw]         = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [prog, setProg]       = useState(0);

  const [search,   setSearch]   = useState('');
  const [fUf,      setFUf]      = useState(null);
  const [fInstr,   setFInstr]   = useState(null);
  const [fAno,     setFAno]     = useState(null);
  const [fTec,     setFTec]     = useState(null);
  const [fEquipe,  setFEquipe]  = useState(null);
  const [fSit,     setFSit]     = useState(null);
  const [kpiFlt,   setKpiFlt]   = useState(null);
  const [tblFlt,   setTblFlt]   = useState('');

  // ── Carregar dados ──────────────────────────────────────────
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
        _cgap:   String(r['TRAMITADO PARA CGAP'] || '').trim().toUpperCase(),
      })));
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Dados filtrados ─────────────────────────────────────────
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

  // ── Opções selects ──────────────────────────────────────────
  const opts = useMemo(() => ({
    ufs:     [...new Set(raw.map(r => r._uf).filter(v => v && v !== 'N/D'))].sort(),
    instrs:  [...new Set(raw.map(r => r._instr).filter(v => v && v !== 'N/D'))].sort(),
    anos:    [...new Set(raw.map(r => r._ano).filter(v => v && v !== 'N/D'))].sort((a, b) => b.localeCompare(a)),
    tecs:    [...new Set(raw.map(r => r._tec).filter(v => v && v !== 'N/D'))].sort(),
    equipes: [...new Set(raw.map(r => r._equipe).filter(v => v && v !== 'N/D'))].sort(),
  }), [raw]);

  // ── Analytics ──────────────────────────────────────────────
  const an = useMemo(() => {
    const total  = fd.length;
    const tv     = fd.reduce((s, r) => s + r._val, 0);
    const realiz = fd.filter(r => STATUS_OK.some(s => r._sit?.includes(s))).length;
    const pend   = fd.filter(r => r._sit?.includes('PENDENTE')).length;
    const cancel = fd.filter(r => ['CANCEL', 'REJEIT'].some(s => r._sit?.includes(s))).length;
    const cSusp  = fd.filter(r => String(r['CELEBRADO COM CLAUSULA SUSPENSIVA'] || '').toUpperCase() === 'SIM').length;
    const semPar = fd.filter(r => String(r['PARECER TRANSFEREGOV'] || '').toUpperCase() === 'NÃO').length;
    const adit   = fd.filter(r => String(r['NECESSIDADE DE ADITIVO'] || '').toUpperCase() === 'SIM').length;
    const lim    = fd.filter(r => ['CONJUR','REJEITAR','FORMALIZAR'].some(s => String(r['SOB LIMINAR'] || '').toUpperCase().includes(s))).length;
    const eff    = total > 0 ? (realiz / total * 100) : 0;

    const agg = (key, valFn = null) =>
      Object.entries(fd.reduce((a, r) => {
        const k = r[key];
        if (k) a[k] = (a[k] || 0) + (valFn ? valFn(r) : 1);
        return a;
      }, {}));

    const byUf    = agg('_uf').map(([uf, qtd]) => ({ uf, qtd })).sort((a, b) => b.qtd - a.qtd);
    const cbu     = fd.reduce((a, r) => { a[r._uf] = (a[r._uf] || 0) + 1; return a; }, {});
    const byInstr = agg('_instr').map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const byAno   = agg('_ano', r => r._val)
      .map(([ano, valor]) => ({ ano, valor }))
      .sort((a, b) => a.ano.localeCompare(b.ano))
      .filter(d => d.ano !== 'N/D');
    const bySit   = agg('_sit').map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 8);

    const byTec = (() => {
      const map = {};
      fd.forEach(r => {
        const tec = r._tec;
        if (!tec || tec === 'N/D') return;
        if (!map[tec]) map[tec] = { name: tec, ativo: 0, cgap: 0 };
        if (r._cgap === 'CGAP') map[tec].cgap += 1;
        else map[tec].ativo += 1;
      });
      return Object.values(map)
        .map(d => ({ ...d, total: d.ativo + d.cgap }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
    })();

    let growth = null;
    if (byAno.length >= 2) {
      const last = byAno[byAno.length - 1].valor, prev = byAno[byAno.length - 2].valor;
      growth = prev > 0 ? ((last - prev) / prev * 100) : null;
    }

    return { total, tv, realiz, pend, cancel, cSusp, semPar, adit, lim, eff,
      byUf, cbu, byInstr, byAno, byTec, bySit, growth,
      maxUf: Math.max(...Object.values(cbu).concat(1)) };
  }, [fd]);

  // ── Colunas da tabela ───────────────────────────────────────
  const tblCols = useMemo(() => [
    { accessorKey: 'PROPOSTA',   header: 'Proposta',    cell: ({ getValue }) => <span className="ds-mono">{getValue()}</span> },
    { accessorKey: 'ENTIDADE',   header: 'Entidade',    cell: ({ getValue }) => <span style={{ maxWidth: 160, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 11 }}>{getValue() || '—'}</span> },
    { accessorKey: '_uf',        header: 'UF',          cell: ({ getValue }) => <span className="br-tag info">{getValue()}</span> },
    { accessorKey: '_val',       header: 'Valor',       cell: ({ getValue }) => <span className="ds-mono">{(getValue() || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span> },
    { accessorKey: '_instr',     header: 'Instrumento', cell: ({ getValue }) => <span className="br-tag neutral">{getValue()}</span> },
    { accessorKey: '_ano',       header: 'Ano' },
    { accessorKey: 'AJUSTE',     header: 'Ajuste',      cell: ({ getValue }) => <StatusBadge v={getValue()} /> },
    { accessorKey: '_cgap',      header: 'CGAP',
      cell: ({ getValue }) => {
        const v = getValue();
        if (v === 'CGAP') return <span className="br-tag danger">CGAP</span>;
        if (!v) return <span style={{ color: 'var(--text-04)' }}>—</span>;
        return <span className="br-tag neutral">{v}</span>;
      }
    },
    { accessorKey: 'PUBLICAÇÃO NO TRANSFEREGOV', header: 'Publicação', cell: ({ getValue }) => <StatusBadge v={getValue()} /> },
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

  const pageRef = useRef(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // ─────────────────────────────────────────────────────────────
  //  EXPORT XLSX PROFISSIONAL — múltiplas abas, formatação GOV.BR
  // ─────────────────────────────────────────────────────────────
  const exportXlsx = () => {
    const wb   = XLSX.utils.book_new();
    const hoje = new Date().toLocaleString('pt-BR');
    const dataStr = new Date().toISOString().slice(0, 10);

    // ── Cores GOV.BR (hex sem #) ──────────────────────────────
    const C = {
      blue:   '1351B4', dark:   '071D41', green:  '168821',
      yellow: 'FFCD07', red:    'E52207', white:  'FFFFFF',
      lgray:  'F8F8F8', gray:   'EDEDED', dgray:  'CCCCCC',
      okBg:   'E3F5E1', wnBg:   'FFF5D0', erBg:   'FDE8E8',
      infoBg: 'D9E8FB',
    };

    const hdr = (v, bg = C.dark, fg = C.white, bold = true, sz = 9) =>
      ({ v, s: { font: { name:'Arial', bold, sz, color:{rgb:fg} },
                 fill: { fgColor:{rgb:bg}, patternType:'solid' },
                 alignment: { horizontal:'center', vertical:'center', wrapText:true },
                 border: fullBorder(C.dark) } });

    const cell = (v, bg = null, fg = '222222', bold = false,
                  sz = 9, halign = 'left', numFmt = null) => {
      const s = {
        font: { name:'Arial', bold, sz, color:{rgb:fg} },
        alignment: { horizontal:halign, vertical:'center' },
        border: fullBorder(C.dgray),
      };
      if (bg) s.fill = { fgColor:{rgb:bg}, patternType:'solid' };
      const obj = { v, s };
      if (numFmt) obj.z = numFmt;
      return obj;
    };

    function fullBorder(color = C.dgray) {
      const s = { style:'thin', color:{rgb:color} };
      return { top:s, bottom:s, left:s, right:s };
    }

    function statusColor(st) {
      if (['REALIZADO','CONCLUÍDO','FINALIZADO','APROVADO','EXECUTADO'].some(x => st?.includes(x)))
        return [C.okBg, C.green, true];
      if (['PENDENTE'].some(x => st?.includes(x)))
        return [C.wnBg, 'B47800', true];
      if (['CANCELADO','REJEITADO'].some(x => st?.includes(x)))
        return [C.erBg, C.red, true];
      return [C.lgray, '333333', false];
    }

    // Agregações reutilizadas
    const byUf = Object.entries(
      fd.reduce((a, r) => { a[r._uf] = (a[r._uf] || {qtd:0,val:0}); a[r._uf].qtd++; a[r._uf].val += r._val; return a; }, {})
    ).sort((a,b) => b[1].qtd - a[1].qtd);

    const byInstr = Object.entries(
      fd.reduce((a, r) => { a[r._instr] = (a[r._instr] || {qtd:0,val:0}); a[r._instr].qtd++; a[r._instr].val += r._val; return a; }, {})
    ).sort((a,b) => b[1].qtd - a[1].qtd);

    const byTec = Object.entries(
      fd.reduce((a, r) => {
        if (!r._tec || r._tec === 'N/D') return a;
        a[r._tec] = a[r._tec] || {ativo:0,cgap:0};
        r._cgap === 'CGAP' ? a[r._tec].cgap++ : a[r._tec].ativo++;
        return a;
      }, {})
    ).map(([k,v]) => [k, {...v, total: v.ativo+v.cgap}]).sort((a,b) => b[1].total - a[1].total);

    const byAno = Object.entries(
      fd.reduce((a, r) => { if (r._ano !== 'N/D') { a[r._ano] = (a[r._ano]||0) + r._val; } return a; }, {})
    ).sort((a,b) => a[0].localeCompare(b[0]));

    const bySit = Object.entries(
      fd.reduce((a, r) => { a[r._sit] = (a[r._sit]||{qtd:0,val:0}); a[r._sit].qtd++; a[r._sit].val += r._val; return a; }, {})
    ).sort((a,b) => b[1].qtd - a[1].qtd);

    const total   = fd.length;
    const totalV  = fd.reduce((s,r) => s+r._val, 0);
    const realiz  = fd.filter(r => STATUS_OK.some(s => r._sit?.includes(s))).length;
    const pend    = fd.filter(r => r._sit?.includes('PENDENTE')).length;
    const cancel  = fd.filter(r => ['CANCEL','REJEIT'].some(s => r._sit?.includes(s))).length;
    const efic    = total > 0 ? (realiz/total*100) : 0;

    // ══════════════════════════════════════════════════════════
    //  ABA 1 · CAPA
    // ══════════════════════════════════════════════════════════
    const capaRows = [];

    // Linhas em branco de topo (simula faixa tricolor via cor de fundo)
    const tricolorRow = (cols) => Array.from({length:cols}, (_,i) => {
      const bg = i < Math.floor(cols/3) ? C.green
        : i < Math.floor(2*cols/3) ? C.yellow : C.blue;
      return { v:'', s:{ fill:{fgColor:{rgb:bg},patternType:'solid'} } };
    });
    capaRows.push(tricolorRow(6));
    capaRows.push(tricolorRow(6));

    capaRows.push([{ v:'', s:{} }]); // espaço

    // Título
    capaRows.push([
      { v:'SNEAELIS · Painel Analítico', s:{
          font:{ name:'Arial', bold:true, sz:20, color:{rgb:C.blue} },
          alignment:{horizontal:'left',vertical:'center'},
      }},
    ]);
    capaRows.push([
      { v:'Ministério do Esporte — Sistema Nacional de Esporte e Lazer', s:{
          font:{ name:'Arial', sz:11, color:{rgb:'555555'}, italic:true },
          alignment:{horizontal:'left',vertical:'center'},
      }},
    ]);

    capaRows.push([{ v:'', s:{} }]);

    // Linha separadora azul
    capaRows.push(Array.from({length:5}, () => ({
      v:'', s:{ fill:{fgColor:{rgb:C.blue},patternType:'solid'} }
    })));

    capaRows.push([{ v:'', s:{} }]);

    // Metadados
    const metaData = [
      ['📅 Data de Geração',     hoje],
      ['📊 Total de Registros',  total],
      ['💰 Valor Total Repasse', totalV],
      ['✅ Taxa de Eficiência',   efic/100],
      ['🏛️ Órgão',              'Ministério do Esporte'],
      ['📂 Versão',              '2026.1'],
    ];
    const metaFmts = [null, '#,##0', 'R$ #,##0.00', '0.0%', null, null];

    for (let i=0; i<metaData.length; i++) {
      const [lbl, val] = metaData[i];
      const rowObj = [
        { v: lbl, s:{ font:{name:'Arial',bold:true,sz:10,color:{rgb:'555555'}},
                      fill:{fgColor:{rgb:C.lgray},patternType:'solid'},
                      alignment:{horizontal:'left',vertical:'center'},
                      border:{bottom:{style:'thin',color:{rgb:C.dgray}}} } },
        { v: val, z: metaFmts[i] || null,
          s:{ font:{name:'Arial',bold:true,sz:10,color:{rgb:C.dark}},
              alignment:{horizontal:'left',vertical:'center'},
              border:{bottom:{style:'thin',color:{rgb:C.dgray}}} } },
      ];
      if (metaFmts[i]) rowObj[1].z = metaFmts[i];
      capaRows.push(rowObj);
    }

    capaRows.push([{ v:'', s:{} }]);

    // Índice de abas
    capaRows.push([{
      v: 'ÍNDICE DE ABAS',
      s:{ font:{name:'Arial',bold:true,sz:10,color:{rgb:C.white}},
          fill:{fgColor:{rgb:C.blue},patternType:'solid'},
          alignment:{horizontal:'center',vertical:'center'} }
    }]);

    const abas = [
      ['📊 Resumo Executivo',  'KPIs e indicadores consolidados'],
      ['📋 Dados Completos',   'Tabela com todos os registros filtrados'],
      ['🗺️ Por UF',           'Distribuição geográfica por estado'],
      ['📑 Por Instrumento',   'Análise por tipo de instrumento'],
      ['👤 Por Técnico',       'Carga de trabalho por técnico'],
      ['📈 Evolução Anual',    'Série histórica de valores de repasse'],
    ];

    for (const [aba, desc] of abas) {
      capaRows.push([
        { v: aba,  s:{ font:{name:'Arial',bold:true,sz:10,color:{rgb:C.blue}},
                       fill:{fgColor:{rgb:C.infoBg},patternType:'solid'},
                       alignment:{horizontal:'left',vertical:'center'},
                       border:fullBorder() } },
        { v: desc, s:{ font:{name:'Arial',sz:10,color:{rgb:'333333'}},
                       alignment:{horizontal:'left',vertical:'center'},
                       border:fullBorder() } },
      ]);
    }

    const wsCapa = XLSX.utils.aoa_to_sheet(capaRows);
    wsCapa['!cols'] = [{wch:3},{wch:32},{wch:32},{wch:18},{wch:18},{wch:3}];
    wsCapa['!merges'] = [
      {s:{r:3,c:0},e:{r:3,c:4}},
      {s:{r:4,c:0},e:{r:4,c:4}},
    ];
    XLSX.utils.book_append_sheet(wb, wsCapa, '📋 Capa');

    // ══════════════════════════════════════════════════════════
    //  ABA 2 · RESUMO EXECUTIVO
    // ══════════════════════════════════════════════════════════
    const resRows = [];
    resRows.push(tricolorRow(8));
    resRows.push(tricolorRow(8));
    resRows.push([{ v:'', s:{} }]);
    resRows.push([{
      v:'RESUMO EXECUTIVO · SNEAELIS',
      s:{ font:{name:'Arial',bold:true,sz:16,color:{rgb:C.blue}},
          alignment:{horizontal:'left',vertical:'center'} }
    }]);
    resRows.push(Array.from({length:6},()=>({ v:'',s:{fill:{fgColor:{rgb:C.blue},patternType:'solid'}} })));
    resRows.push([{ v:'', s:{} }]);

    // KPIs em tabela simples
    const kpis = [
      ['TOTAL DE PROPOSTAS',    total,       '#,##0',       C.blue,  C.infoBg],
      ['VALOR TOTAL REPASSE',   totalV,      'R$ #,##0.00', C.green, C.okBg],
      ['REALIZADOS',            realiz,      '#,##0',       C.green, C.okBg],
      ['PENDENTES',             pend,        '#,##0',       'B47800',C.wnBg],
      ['CANCELADOS/REJEITADOS', cancel,      '#,##0',       C.red,   C.erBg],
      ['EFICIÊNCIA GLOBAL',     efic/100,    '0.0%',        C.blue,  C.infoBg],
    ];

    resRows.push([
      hdr('INDICADOR', C.dark, C.white, true, 10),
      hdr('VALOR',     C.dark, C.white, true, 10),
      hdr('DETALHE',   C.dark, C.white, true, 10),
    ]);

    const kpiDetails = [
      `Base total: ${raw.length.toLocaleString('pt-BR')} registros`,
      `Média: ${total>0 ? (totalV/total).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}) : 'R$ 0'}`,
      `${total>0?(realiz/total*100).toFixed(1):0}% do total filtrado`,
      `${total>0?(pend/total*100).toFixed(1):0}% do total filtrado`,
      `${total>0?(cancel/total*100).toFixed(1):0}% do total filtrado`,
      'Realizados ÷ Total de propostas',
    ];

    for (let i=0; i<kpis.length; i++) {
      const [lbl, val, fmt, cor, bg] = kpis[i];
      resRows.push([
        { v:lbl, s:{ font:{name:'Arial',bold:true,sz:10,color:{rgb:cor}},
                     fill:{fgColor:{rgb:bg},patternType:'solid'},
                     alignment:{horizontal:'left',vertical:'center'},
                     border:fullBorder() } },
        { v:val, z:fmt, s:{ font:{name:'Arial',bold:true,sz:12,color:{rgb:cor}},
                     fill:{fgColor:{rgb:bg},patternType:'solid'},
                     alignment:{horizontal:'center',vertical:'center'},
                     border:fullBorder(cor) } },
        { v:kpiDetails[i], s:{ font:{name:'Arial',sz:9,color:{rgb:'555555'},italic:true},
                     fill:{fgColor:{rgb:bg},patternType:'solid'},
                     alignment:{horizontal:'left',vertical:'center'},
                     border:fullBorder() } },
      ]);
    }

    resRows.push([{ v:'', s:{} }]);

    // Por situação
    resRows.push([
      hdr('SITUAÇÃO', C.dark, C.white, true, 9),
      hdr('QTDE',     C.dark, C.white, true, 9),
      hdr('VALOR (R$)',C.dark,C.white, true, 9),
      hdr('% QTDE',   C.dark, C.white, true, 9),
      hdr('% VALOR',  C.dark, C.white, true, 9),
    ]);

    for (const [sit, d] of bySit) {
      const [bg, cor] = statusColor(sit);
      resRows.push([
        { v:sit,            s:{ font:{name:'Arial',bold:true,sz:9,color:{rgb:cor}},
                                fill:{fgColor:{rgb:bg},patternType:'solid'},
                                alignment:{horizontal:'left',vertical:'center'},
                                border:fullBorder() } },
        { v:d.qtd, z:'#,##0', s:{ font:{name:'Arial',sz:9,color:{rgb:'222222'}},
                                fill:{fgColor:{rgb:bg},patternType:'solid'},
                                alignment:{horizontal:'center',vertical:'center'},
                                border:fullBorder() } },
        { v:d.val, z:'R$ #,##0.00', s:{ font:{name:'Arial',sz:9},
                                fill:{fgColor:{rgb:bg},patternType:'solid'},
                                alignment:{horizontal:'center',vertical:'center'},
                                border:fullBorder() } },
        { v: total>0?d.qtd/total:0, z:'0.0%', s:{ font:{name:'Arial',sz:9},
                                fill:{fgColor:{rgb:bg},patternType:'solid'},
                                alignment:{horizontal:'center',vertical:'center'},
                                border:fullBorder() } },
        { v: totalV>0?d.val/totalV:0, z:'0.0%', s:{ font:{name:'Arial',sz:9},
                                fill:{fgColor:{rgb:bg},patternType:'solid'},
                                alignment:{horizontal:'center',vertical:'center'},
                                border:fullBorder() } },
      ]);
    }

    // Linha total
    resRows.push([
      { v:'TOTAL', s:{ font:{name:'Arial',bold:true,sz:9,color:{rgb:C.white}},
                       fill:{fgColor:{rgb:C.blue},patternType:'solid'},
                       alignment:{horizontal:'left',vertical:'center'},
                       border:fullBorder(C.blue) } },
      { v:total, z:'#,##0', s:{ font:{name:'Arial',bold:true,sz:9,color:{rgb:C.white}},
                       fill:{fgColor:{rgb:C.blue},patternType:'solid'},
                       alignment:{horizontal:'center',vertical:'center'},
                       border:fullBorder(C.blue) } },
      { v:totalV, z:'R$ #,##0.00', s:{ font:{name:'Arial',bold:true,sz:9,color:{rgb:C.white}},
                       fill:{fgColor:{rgb:C.blue},patternType:'solid'},
                       alignment:{horizontal:'center',vertical:'center'},
                       border:fullBorder(C.blue) } },
      { v:1, z:'0.0%', s:{ font:{name:'Arial',bold:true,sz:9,color:{rgb:C.white}},
                       fill:{fgColor:{rgb:C.blue},patternType:'solid'},
                       alignment:{horizontal:'center',vertical:'center'},
                       border:fullBorder(C.blue) } },
      { v:1, z:'0.0%', s:{ font:{name:'Arial',bold:true,sz:9,color:{rgb:C.white}},
                       fill:{fgColor:{rgb:C.blue},patternType:'solid'},
                       alignment:{horizontal:'center',vertical:'center'},
                       border:fullBorder(C.blue) } },
    ]);

    const wsRes = XLSX.utils.aoa_to_sheet(resRows);
    wsRes['!cols'] = [{wch:28},{wch:20},{wch:30},{wch:12},{wch:12}];
    XLSX.utils.book_append_sheet(wb, wsRes, '📊 Resumo Executivo');

    // ══════════════════════════════════════════════════════════
    //  ABA 3 · DADOS COMPLETOS
    // ══════════════════════════════════════════════════════════
    const dataRows = [];
    dataRows.push(tricolorRow(10));
    dataRows.push(tricolorRow(10));

    const colsData = [
      {k:'PROPOSTA',  label:'PROPOSTA',    wch:14, fmt:null,         align:'left'},
      {k:'ENTIDADE',  label:'ENTIDADE',    wch:30, fmt:null,         align:'left'},
      {k:'_uf',       label:'UF',          wch:6,  fmt:null,         align:'center'},
      {k:'_instr',    label:'INSTRUMENTO', wch:26, fmt:null,         align:'left'},
      {k:'_ano',      label:'ANO',         wch:8,  fmt:'0',          align:'center'},
      {k:'TÉCNICO DE FORMALIZAÇÃO', label:'TÉCNICO', wch:20, fmt:null, align:'left'},
      {k:'EQUIPE',    label:'EQUIPE',      wch:14, fmt:null,         align:'center'},
      {k:'AJUSTE',    label:'SITUAÇÃO',    wch:16, fmt:null,         align:'center'},
      {k:'_val',      label:'VALOR (R$)',  wch:18, fmt:'R$ #,##0.00',align:'right'},
      {k:'_cgap',     label:'CGAP',        wch:10, fmt:null,         align:'center'},
    ];

    dataRows.push(colsData.map(c => hdr(c.label, C.dark, C.white, true, 9)));

    for (let ri=0; ri<fd.length; ri++) {
      const r   = fd[ri];
      const bg  = ri % 2 === 0 ? 'FFFFFF' : 'F5F7FB';
      const row = colsData.map(c => {
        const v = r[c.k] ?? '';
        let useBg = bg;
        let useFg = '222222';
        let bold  = false;

        if (c.k === 'AJUSTE') {
          const [sb, sf, sbold] = statusColor(String(v).toUpperCase());
          useBg = sb; useFg = sf; bold = sbold;
        } else if (c.k === '_cgap' && v === 'CGAP') {
          useBg = C.erBg; useFg = C.red; bold = true;
        } else if (c.k === '_uf') {
          useBg = C.infoBg; useFg = C.blue; bold = true;
        }

        const obj = { v, s:{
          font:{name:'Arial',bold,sz:9,color:{rgb:useFg}},
          fill:{fgColor:{rgb:useBg},patternType:'solid'},
          alignment:{horizontal:c.align,vertical:'center'},
          border:fullBorder(C.dgray),
        }};
        if (c.fmt && typeof v === 'number') obj.z = c.fmt;
        return obj;
      });
      dataRows.push(row);
    }

    const wsData = XLSX.utils.aoa_to_sheet(dataRows);
    wsData['!cols'] = colsData.map(c => ({wch:c.wch}));
    wsData['!autofilter'] = { ref: `A3:J${fd.length+3}` };
    wsData['!freeze'] = { xSplit:0, ySplit:3 };
    XLSX.utils.book_append_sheet(wb, wsData, '📋 Dados Completos');

    // ══════════════════════════════════════════════════════════
    //  ABA 4 · POR UF
    // ══════════════════════════════════════════════════════════
    const ufRows = [];
    ufRows.push(tricolorRow(5));
    ufRows.push(tricolorRow(5));
    ufRows.push([{ v:'DISTRIBUIÇÃO POR UNIDADE FEDERATIVA',
      s:{ font:{name:'Arial',bold:true,sz:14,color:{rgb:C.blue}},
          alignment:{horizontal:'left',vertical:'center'} } }]);
    ufRows.push(Array.from({length:5},()=>({v:'',s:{fill:{fgColor:{rgb:C.blue},patternType:'solid'}}})));
    ufRows.push([{v:'',s:{}}]);

    ufRows.push([
      hdr('UF',            C.dark,C.white,true,9),
      hdr('QTD. PROCESSOS',C.dark,C.white,true,9),
      hdr('VALOR TOTAL',   C.dark,C.white,true,9),
      hdr('% QTDE',        C.dark,C.white,true,9),
      hdr('% VALOR',       C.dark,C.white,true,9),
    ]);

    const maxQtd = Math.max(...byUf.map(([,d])=>d.qtd),1);
    for (let ri=0; ri<byUf.length; ri++) {
      const [uf, d] = byUf[ri];
      const bg = ri%2===0 ? C.lgray : 'FFFFFF';
      // Intensidade de azul proporcional
      const intens = Math.round(200 - (d.qtd/maxQtd)*140);
      const heatHex = C.blue;
      ufRows.push([
        { v:uf, s:{ font:{name:'Arial',bold:true,sz:9,color:{rgb:'FFFFFF'}},
                    fill:{fgColor:{rgb:heatHex},patternType:'solid'},
                    alignment:{horizontal:'center',vertical:'center'},
                    border:fullBorder() } },
        { v:d.qtd, z:'#,##0', s:{ font:{name:'Arial',sz:9},
                    fill:{fgColor:{rgb:bg},patternType:'solid'},
                    alignment:{horizontal:'center',vertical:'center'},
                    border:fullBorder() } },
        { v:d.val, z:'R$ #,##0.00', s:{ font:{name:'Arial',sz:9},
                    fill:{fgColor:{rgb:bg},patternType:'solid'},
                    alignment:{horizontal:'center',vertical:'center'},
                    border:fullBorder() } },
        { v:total>0?d.qtd/total:0, z:'0.0%', s:{ font:{name:'Arial',sz:9},
                    fill:{fgColor:{rgb:bg},patternType:'solid'},
                    alignment:{horizontal:'center',vertical:'center'},
                    border:fullBorder() } },
        { v:totalV>0?d.val/totalV:0, z:'0.0%', s:{ font:{name:'Arial',sz:9},
                    fill:{fgColor:{rgb:bg},patternType:'solid'},
                    alignment:{horizontal:'center',vertical:'center'},
                    border:fullBorder() } },
      ]);
    }

    const wsUf = XLSX.utils.aoa_to_sheet(ufRows);
    wsUf['!cols'] = [{wch:8},{wch:18},{wch:20},{wch:10},{wch:10}];
    XLSX.utils.book_append_sheet(wb, wsUf, '🗺️ Por UF');

    // ══════════════════════════════════════════════════════════
    //  ABA 5 · POR INSTRUMENTO
    // ══════════════════════════════════════════════════════════
    const instrRows = [];
    instrRows.push(tricolorRow(5));
    instrRows.push(tricolorRow(5));
    instrRows.push([{ v:'ANÁLISE POR INSTRUMENTO',
      s:{ font:{name:'Arial',bold:true,sz:14,color:{rgb:C.blue}},
          alignment:{horizontal:'left',vertical:'center'} } }]);
    instrRows.push(Array.from({length:5},()=>({v:'',s:{fill:{fgColor:{rgb:C.blue},patternType:'solid'}}})));
    instrRows.push([{v:'',s:{}}]);

    instrRows.push([
      hdr('INSTRUMENTO', C.dark,C.white,true,9),
      hdr('QTD.',        C.dark,C.white,true,9),
      hdr('VALOR TOTAL', C.dark,C.white,true,9),
      hdr('% QTDE',      C.dark,C.white,true,9),
      hdr('% VALOR',     C.dark,C.white,true,9),
    ]);

    const instrPalette = [C.blue, C.green, 'B47800', '7E3AF2', C.red];
    for (let ri=0; ri<byInstr.length; ri++) {
      const [instr, d] = byInstr[ri];
      const bg  = ri%2===0 ? C.lgray : 'FFFFFF';
      const cor = instrPalette[ri % instrPalette.length];
      instrRows.push([
        { v:instr, s:{ font:{name:'Arial',bold:true,sz:9,color:{rgb:C.white}},
                       fill:{fgColor:{rgb:cor},patternType:'solid'},
                       alignment:{horizontal:'left',vertical:'center'},
                       border:fullBorder() } },
        { v:d.qtd, z:'#,##0', s:{ font:{name:'Arial',sz:9},
                       fill:{fgColor:{rgb:bg},patternType:'solid'},
                       alignment:{horizontal:'center',vertical:'center'},
                       border:fullBorder() } },
        { v:d.val, z:'R$ #,##0.00', s:{ font:{name:'Arial',sz:9},
                       fill:{fgColor:{rgb:bg},patternType:'solid'},
                       alignment:{horizontal:'center',vertical:'center'},
                       border:fullBorder() } },
        { v:total>0?d.qtd/total:0, z:'0.0%', s:{ font:{name:'Arial',sz:9},
                       fill:{fgColor:{rgb:bg},patternType:'solid'},
                       alignment:{horizontal:'center',vertical:'center'},
                       border:fullBorder() } },
        { v:totalV>0?d.val/totalV:0, z:'0.0%', s:{ font:{name:'Arial',sz:9},
                       fill:{fgColor:{rgb:bg},patternType:'solid'},
                       alignment:{horizontal:'center',vertical:'center'},
                       border:fullBorder() } },
      ]);
    }

    const wsInstr = XLSX.utils.aoa_to_sheet(instrRows);
    wsInstr['!cols'] = [{wch:28},{wch:10},{wch:20},{wch:10},{wch:10}];
    XLSX.utils.book_append_sheet(wb, wsInstr, '📑 Por Instrumento');

    // ══════════════════════════════════════════════════════════
    //  ABA 6 · POR TÉCNICO
    // ══════════════════════════════════════════════════════════
    const tecRows = [];
    tecRows.push(tricolorRow(6));
    tecRows.push(tricolorRow(6));
    tecRows.push([{ v:'CARGA DE TRABALHO POR TÉCNICO',
      s:{ font:{name:'Arial',bold:true,sz:14,color:{rgb:C.blue}},
          alignment:{horizontal:'left',vertical:'center'} } }]);
    tecRows.push(Array.from({length:6},()=>({v:'',s:{fill:{fgColor:{rgb:C.blue},patternType:'solid'}}})));
    tecRows.push([{v:'',s:{}}]);

    tecRows.push([
      hdr('TÉCNICO',       C.dark,C.white,true,9),
      hdr('EM CARGA',      C.dark,C.white,true,9),
      hdr('TRAMIT. CGAP',  C.dark,C.white,true,9),
      hdr('TOTAL',         C.dark,C.white,true,9),
      hdr('% EM CARGA',    C.dark,C.white,true,9),
      hdr('% CGAP',        C.dark,C.white,true,9),
    ]);

    for (let ri=0; ri<byTec.length; ri++) {
      const [tec, d] = byTec[ri];
      const bg = ri%2===0 ? C.lgray : 'FFFFFF';
      const tot = d.total;
      tecRows.push([
        { v:tec, s:{ font:{name:'Arial',bold:true,sz:9,color:{rgb:C.blue}},
                     fill:{fgColor:{rgb:bg},patternType:'solid'},
                     alignment:{horizontal:'left',vertical:'center'},
                     border:fullBorder() } },
        { v:d.ativo, z:'#,##0', s:{ font:{name:'Arial',sz:9,color:{rgb:C.blue}},
                     fill:{fgColor:{rgb:C.infoBg},patternType:'solid'},
                     alignment:{horizontal:'center',vertical:'center'},
                     border:fullBorder() } },
        { v:d.cgap, z:'#,##0', s:{ font:{name:'Arial',sz:9,color:{rgb:C.red}},
                     fill:{fgColor:{rgb:C.erBg},patternType:'solid'},
                     alignment:{horizontal:'center',vertical:'center'},
                     border:fullBorder() } },
        { v:tot, z:'#,##0', s:{ font:{name:'Arial',bold:true,sz:9,color:{rgb:C.dark}},
                     fill:{fgColor:{rgb:bg},patternType:'solid'},
                     alignment:{horizontal:'center',vertical:'center'},
                     border:fullBorder() } },
        { v:tot>0?d.ativo/tot:0, z:'0.0%', s:{ font:{name:'Arial',sz:9},
                     fill:{fgColor:{rgb:bg},patternType:'solid'},
                     alignment:{horizontal:'center',vertical:'center'},
                     border:fullBorder() } },
        { v:tot>0?d.cgap/tot:0, z:'0.0%', s:{ font:{name:'Arial',sz:9},
                     fill:{fgColor:{rgb:bg},patternType:'solid'},
                     alignment:{horizontal:'center',vertical:'center'},
                     border:fullBorder() } },
      ]);
    }

    const wsTec = XLSX.utils.aoa_to_sheet(tecRows);
    wsTec['!cols'] = [{wch:24},{wch:12},{wch:14},{wch:10},{wch:12},{wch:10}];
    XLSX.utils.book_append_sheet(wb, wsTec, '👤 Por Técnico');

    // ══════════════════════════════════════════════════════════
    //  ABA 7 · EVOLUÇÃO ANUAL
    // ══════════════════════════════════════════════════════════
    const anoRows = [];
    anoRows.push(tricolorRow(4));
    anoRows.push(tricolorRow(4));
    anoRows.push([{ v:'EVOLUÇÃO ANUAL DE REPASSES',
      s:{ font:{name:'Arial',bold:true,sz:14,color:{rgb:C.blue}},
          alignment:{horizontal:'left',vertical:'center'} } }]);
    anoRows.push(Array.from({length:4},()=>({v:'',s:{fill:{fgColor:{rgb:C.blue},patternType:'solid'}}})));
    anoRows.push([{v:'',s:{}}]);

    anoRows.push([
      hdr('ANO',          C.dark,C.white,true,9),
      hdr('VALOR TOTAL',  C.dark,C.white,true,9),
      hdr('VARIAÇÃO',     C.dark,C.white,true,9),
      hdr('% VARIAÇÃO',   C.dark,C.white,true,9),
    ]);

    let prevVal = null;
    for (let ri=0; ri<byAno.length; ri++) {
      const [ano, val] = byAno[ri];
      const variacao = prevVal !== null ? val - prevVal : null;
      const pctVar   = prevVal && prevVal !== 0 ? variacao/prevVal : null;
      const bg   = ri%2===0 ? C.lgray : 'FFFFFF';
      const bgV  = variacao === null ? bg : variacao >= 0 ? C.okBg : C.erBg;
      const fgV  = variacao === null ? '333333' : variacao >= 0 ? C.green : C.red;

      anoRows.push([
        { v:ano, z:'0', s:{ font:{name:'Arial',bold:true,sz:9,color:{rgb:C.dark}},
                  fill:{fgColor:{rgb:bg},patternType:'solid'},
                  alignment:{horizontal:'center',vertical:'center'},
                  border:fullBorder() } },
        { v:val, z:'R$ #,##0.00', s:{ font:{name:'Arial',sz:9},
                  fill:{fgColor:{rgb:bg},patternType:'solid'},
                  alignment:{horizontal:'center',vertical:'center'},
                  border:fullBorder() } },
        variacao !== null
          ? { v:variacao, z:'R$ #,##0.00;(R$ #,##0.00);—',
              s:{ font:{name:'Arial',bold:true,sz:9,color:{rgb:fgV}},
                  fill:{fgColor:{rgb:bgV},patternType:'solid'},
                  alignment:{horizontal:'center',vertical:'center'},
                  border:fullBorder() } }
          : { v:'Primeiro ano', s:{ font:{name:'Arial',sz:9,color:{rgb:'888888'},italic:true},
                  fill:{fgColor:{rgb:bg},patternType:'solid'},
                  alignment:{horizontal:'center',vertical:'center'},
                  border:fullBorder() } },
        pctVar !== null
          ? { v:pctVar, z:'0.0%;(0.0%);—',
              s:{ font:{name:'Arial',bold:true,sz:9,color:{rgb:fgV}},
                  fill:{fgColor:{rgb:bgV},patternType:'solid'},
                  alignment:{horizontal:'center',vertical:'center'},
                  border:fullBorder() } }
          : { v:'—', s:{ font:{name:'Arial',sz:9,color:{rgb:'888888'}},
                  fill:{fgColor:{rgb:bg},patternType:'solid'},
                  alignment:{horizontal:'center',vertical:'center'},
                  border:fullBorder() } },
      ]);
      prevVal = val;
    }

    const wsAno = XLSX.utils.aoa_to_sheet(anoRows);
    wsAno['!cols'] = [{wch:10},{wch:22},{wch:22},{wch:14}];
    XLSX.utils.book_append_sheet(wb, wsAno, '📈 Evolução Anual');

    // ── Propriedades e salvar ─────────────────────────────────
    wb.Props = {
      Title:    'SNEAELIS · Painel Analítico',
      Subject:  'Ministério do Esporte',
      Author:   'SNEAELIS Intelligence',
      Keywords: 'GOV.BR Esporte Formalizações SNEAELIS',
      CreatedDate: new Date(),
    };

    XLSX.writeFile(wb, `SNEAELIS_Painel_${dataStr}.xlsx`,
      { bookType:'xlsx', type:'binary', cellStyles:true });
  };

  const exportPdf = async () => {
    setPdfLoading(true);
    try {
      // Carrega jsPDF e html2canvas dinamicamente para não precisar instalar
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);

      const el = pageRef.current;
      if (!el) return;

      // Captura toda a área de conteúdo
      const canvas = await html2canvas(el, {
        scale: 1.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#F8F8F8',
        logging: false,
        scrollY: 0,
        windowHeight: el.scrollHeight,
        height: el.scrollHeight,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      // Faixa tricolor GOV.BR no topo de cada página
      const stripeH = 3;
      const stripeW = pageW / 3;
      pdf.setFillColor(22, 136, 33);   // verde
      pdf.rect(0, 0, stripeW, stripeH, 'F');
      pdf.setFillColor(255, 205, 7);   // amarelo
      pdf.rect(stripeW, 0, stripeW, stripeH, 'F');
      pdf.setFillColor(19, 81, 180);   // azul
      pdf.rect(stripeW * 2, 0, stripeW, stripeH, 'F');

      // Cabeçalho
      pdf.setFontSize(14);
      pdf.setTextColor(19, 81, 180);
      pdf.setFont(undefined, 'bold');
      pdf.text('SNEAELIS · Painel Analítico', 10, stripeH + 8);

      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.setFont(undefined, 'normal');
      pdf.text(`Ministério do Esporte · Gerado em ${new Date().toLocaleString('pt-BR')}`, 10, stripeH + 14);

      pdf.setFontSize(8);
      pdf.text(`Registros filtrados: ${fd.length.toLocaleString('pt-BR')}`, pageW - 10, stripeH + 8, { align: 'right' });

      // Linha separadora
      pdf.setDrawColor(197, 212, 235);
      pdf.setLineWidth(0.3);
      pdf.line(10, stripeH + 17, pageW - 10, stripeH + 17);

      // Conteúdo capturado
      const headerOffset = stripeH + 20;
      const contentH     = pageH - headerOffset - 8;
      const imgW         = pageW - 20;
      const totalImgH    = (canvas.height * imgW) / canvas.width;

      let remainingH = totalImgH;
      let srcY       = 0;
      let isFirst    = true;

      while (remainingH > 0) {
        const sliceH = Math.min(contentH, remainingH);
        const srcSliceH = (sliceH / totalImgH) * canvas.height;

        // Cria canvas da fatia
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width  = canvas.width;
        sliceCanvas.height = srcSliceH;
        const ctx = sliceCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, srcY, canvas.width, srcSliceH, 0, 0, canvas.width, srcSliceH);

        if (!isFirst) {
          pdf.addPage();
          // Faixa tricolor nas páginas seguintes
          pdf.setFillColor(22, 136, 33);
          pdf.rect(0, 0, stripeW, stripeH, 'F');
          pdf.setFillColor(255, 205, 7);
          pdf.rect(stripeW, 0, stripeW, stripeH, 'F');
          pdf.setFillColor(19, 81, 180);
          pdf.rect(stripeW * 2, 0, stripeW, stripeH, 'F');
        }

        pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', 10, isFirst ? headerOffset : stripeH + 4, imgW, sliceH);

        srcY       += srcSliceH;
        remainingH -= sliceH;
        isFirst     = false;
      }

      // Rodapé em todas as páginas
      const totalPages = pdf.internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        pdf.setFontSize(7);
        pdf.setTextColor(150, 150, 150);
        pdf.text(
          `Página ${p} de ${totalPages} · SNEAELIS · Ministério do Esporte`,
          pageW / 2, pageH - 3,
          { align: 'center' }
        );
      }

      pdf.save(`SNEAELIS_Painel_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      alert('Erro ao gerar PDF. Verifique se jspdf e html2canvas estão instalados:\nnpm i jspdf html2canvas');
    } finally {
      setPdfLoading(false);
    }
  };

  // ── Loading ─────────────────────────────────────────────────
  if (loading) return (
    <>
      <style>{CSS}</style>
      <div className="govbr-stripe" />
      <div className="ds-loading-screen">
        <div className="ds-spinner" />
        <div className="ds-loading-title">Carregando SNEAELIS Intelligence</div>
        <div className="ds-loading-sub">Sincronizando dados… {prog}%</div>
      </div>
    </>
  );

  if (error) return (
    <>
      <style>{CSS}</style>
      <div className="govbr-stripe" />
      <div className="ds-loading-screen">
        <i className="fas fa-exclamation-triangle" style={{ fontSize: 40, color: 'var(--color-danger)' }} />
        <div className="ds-loading-title">Erro ao carregar dados</div>
        <div className="ds-loading-sub">{error}</div>
        <button onClick={load} className="br-button primary" style={{ marginTop: 8 }}>
          <i className="fas fa-redo" /> Tentar novamente
        </button>
      </div>
    </>
  );

  // ── RENDER ──────────────────────────────────────────────────
  return (
    <>
      <style>{CSS}</style>

      <div className="ds-shell">

        {/* ══════════════════════════════
            SIDEBAR
        ══════════════════════════════ */}
        <aside className="ds-sidebar">
          <div className="govbr-stripe" />

          <div className="ds-sidebar-header">
            <div className="ds-sidebar-logo">
              {/* Logo GOV.BR oficial */}
              <img
                className="ds-govbr-logo"
                src="https://www.gov.br/ds/assets/img/govbr-logo.png"
                alt="GOV.BR"
              />
              <div className="ds-sidebar-divider" />
              <div>
                <div className="ds-sidebar-system">SNEA<em>ELIS</em></div>
              </div>
            </div>
            <div className="ds-sidebar-ministry">Ministério do Esporte · 2026</div>
          </div>

          <nav className="ds-sidebar-nav">
            <div className="ds-nav-section">Menu Principal</div>

            <button className="ds-nav-item active">
              <i className="fas fa-th-large" />
              Dashboard Analítico
            </button>

            <button className="ds-nav-item" onClick={() => navigate('/tabela')}>
              <i className="fas fa-table" />
              Tabela Gerencial
            </button>


          </nav>

          <div className="ds-sidebar-footer">
            <div className="ds-user-card">
              <div className="ds-user-avatar">PD</div>
              <div>
                <div className="ds-user-name">Pedro Dias</div>
                <div className="ds-user-role">Analista Sênior</div>
              </div>
            </div>
          </div>
        </aside>

        {/* ══════════════════════════════
            MAIN
        ══════════════════════════════ */}
        <main className="ds-main">
          <div className="govbr-stripe" />

          {/* ── Header ── */}
          <header className="ds-header">
            <div className="ds-header-left">
              <nav className="ds-breadcrumb">
                <i className="fas fa-globe" style={{ fontSize: 12 }} />
                Dashboard
                <i className="fas fa-chevron-right" style={{ fontSize: 9 }} />
                <b>Painel Analítico SNEAELIS</b>
              </nav>
              <span className="ds-tag">
                <i className="fas fa-database" style={{ fontSize: 9 }} />
                {fd.length.toLocaleString('pt-BR')} Registros
              </span>
            </div>

            <div className="ds-header-right">
              <div className="ds-search">
                <i className="fas fa-search" />
                <input
                  placeholder="Pesquisa rápida…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div className="ds-divider-v" />
              <button className="br-button secondary" onClick={load}>
                <i className="fas fa-sync-alt" /> Atualizar
              </button>
              <button className="br-button primary" onClick={exportXlsx}>
                <i className="fas fa-download" /> Exportar XLSX
              </button>
              <button className="br-button pdf" onClick={exportPdf} disabled={pdfLoading}>
                <i className="fas fa-file-pdf" /> Exportar PDF
              </button>
            </div>
          </header>

          {/* Modal de loading PDF */}
          {pdfLoading && (
            <div className="ds-pdf-overlay">
              <div className="ds-pdf-modal">
                <div className="ds-spinner" />
                <div className="ds-pdf-modal-title">Gerando PDF…</div>
                <div className="ds-pdf-modal-sub">
                  Capturando o painel completo.<br />Aguarde alguns instantes.
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════
              PÁGINA
          ══════════════════════════════ */}
          <div className="ds-page" ref={pageRef} id="pdf-capture-area">

            {/* ── Filtros ── */}
            <div className="ds-filter-bar anim-1">
              <span className="ds-filter-label">
                <i className="fas fa-filter" style={{ fontSize: 9 }} /> Filtros
              </span>

              {[
                { lbl: 'UF',          icon: 'fas fa-map-marker-alt', val: fUf,     set: setFUf,     items: opts.ufs },
                { lbl: 'Instrumento', icon: 'fas fa-file-contract',  val: fInstr,  set: setFInstr,  items: opts.instrs },
                { lbl: 'Ano',         icon: 'fas fa-calendar-alt',   val: fAno,    set: setFAno,    items: opts.anos },
                { lbl: 'Técnico',     icon: 'fas fa-user',           val: fTec,    set: setFTec,    items: opts.tecs },
                { lbl: 'Equipe',      icon: 'fas fa-users',          val: fEquipe, set: setFEquipe, items: opts.equipes },
              ].map(({ lbl, icon, val, set, items }) => (
                <div className="ds-filter-select-wrapper" key={lbl}>
                  <i className={`${icon} icon-left`} />
                  <select value={val || ''} onChange={e => set(e.target.value || null)}>
                    <option value="">{lbl}</option>
                    {items.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <i className="fas fa-chevron-down icon-right" />
                </div>
              ))}

              {chips.map((c, i) => (
                <div key={i} className="ds-chip" onClick={c.clr}>
                  {c.lbl} <i className="fas fa-times" style={{ fontSize: 9 }} />
                </div>
              ))}

              {chips.length > 0 && (
                <button className="ds-chip-clear" onClick={clearAll}>
                  <i className="fas fa-times" style={{ fontSize: 10 }} /> Limpar todos
                </button>
              )}
            </div>

            {/* ════════════════════════
                KPI LINHA 1
            ════════════════════════ */}
            <div className="ds-section-heading anim-1">
              <i className="fas fa-bullseye" /> Indicadores-Chave de Desempenho
            </div>

            <div className="ds-kpi-grid anim-2">
              <KpiCard icon="fas fa-database" label="Total de Propostas"
                value={an.total.toLocaleString('pt-BR')}
                sub={`${raw.length.toLocaleString('pt-BR')} na base total`}
                accent="#1351B4" iconBg="#DBE8FB" iconColor="#1351B4" />

              <KpiCard icon="fas fa-dollar-sign" label="Valor Total Repasse"
                value={an.tv.toLocaleString('pt-BR', { notation: 'compact', style: 'currency', currency: 'BRL' })}
                sub={`Média: ${an.total > 0 ? (an.tv / an.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : 'R$ 0'}`}
                accent="#168821" iconBg="#E3F5E1" iconColor="#168821" />

              <KpiCard icon="fas fa-check-circle" label="Realizados"
                value={an.realiz.toLocaleString('pt-BR')}
                sub={`${an.total > 0 ? (an.realiz / an.total * 100).toFixed(1) : 0}% do total`}
                subVariant="success"
                accent="#168821" iconBg="#E3F5E1" iconColor="#168821"
                active={kpiFlt?.field === 'AJUSTE' && kpiFlt?.value === 'REALIZADO'}
                onClick={() => toggleKpi('AJUSTE', 'REALIZADO')} clickable />

              <KpiCard icon="fas fa-clock" label="Pendentes"
                value={an.pend.toLocaleString('pt-BR')}
                sub={`${an.total > 0 ? (an.pend / an.total * 100).toFixed(1) : 0}% do total`}
                subVariant="danger"
                accent="#B47800" iconBg="#FFF5D0" iconColor="#B47800"
                active={kpiFlt?.field === 'AJUSTE' && kpiFlt?.value === 'PENDENTE'}
                onClick={() => toggleKpi('AJUSTE', 'PENDENTE')} clickable />

              <KpiCard icon="fas fa-times-circle" label="Cancelados/Rejeitados"
                value={an.cancel.toLocaleString('pt-BR')}
                sub={`${an.total > 0 ? (an.cancel / an.total * 100).toFixed(1) : 0}% do total`}
                subVariant="danger"
                accent="#E52207" iconBg="#FDE8E8" iconColor="#E52207" />
            </div>

            {/* ════════════════════════
                KPI LINHA 2
            ════════════════════════ */}
            <div className="ds-kpi-grid anim-3" style={{ marginBottom: 16 }}>
              <KpiCard icon="fas fa-shield-alt" label="Cláusula Suspensiva"
                value={an.cSusp.toLocaleString('pt-BR')} sub="Celebrados c/ cláusula"
                accent="#7E3AF2" iconBg="#EDEBFE" iconColor="#7E3AF2"
                active={kpiFlt?.field === 'CELEBRADO COM CLAUSULA SUSPENSIVA'}
                onClick={() => toggleKpi('CELEBRADO COM CLAUSULA SUSPENSIVA', 'SIM')} clickable />

              <KpiCard icon="fas fa-exclamation-circle" label="Sem Parecer TransfGov"
                value={an.semPar.toLocaleString('pt-BR')} sub="Parecer = NÃO" subVariant="danger"
                accent="#B47800" iconBg="#FFF5D0" iconColor="#B47800"
                active={kpiFlt?.field === 'PARECER TRANSFEREGOV'}
                onClick={() => toggleKpi('PARECER TRANSFEREGOV', 'NÃO')} clickable />

              <KpiCard icon="fas fa-bolt" label="Necessidade de Aditivo"
                value={an.adit.toLocaleString('pt-BR')} sub="Aditivo = SIM"
                accent="#0694A2" iconBg="#D5F5F6" iconColor="#0694A2"
                active={kpiFlt?.field === 'NECESSIDADE DE ADITIVO'}
                onClick={() => toggleKpi('NECESSIDADE DE ADITIVO', 'SIM')} clickable />

              <KpiCard icon="fas fa-balance-scale" label="Sob Liminar/Conjur"
                value={an.lim.toLocaleString('pt-BR')} sub="Requer ação jurídica" subVariant="danger"
                accent="#6366F1" iconBg="#E0E7FF" iconColor="#6366F1" />

              <KpiCard icon="fas fa-chart-line" label="Eficiência Global"
                value={`${an.eff.toFixed(1)}%`}
                sub={an.growth !== null
                  ? `${an.growth > 0 ? '+' : ''}${an.growth.toFixed(1)}% vs ano ant.`
                  : 'Realizados ÷ Total'}
                subVariant={an.growth !== null ? (an.growth > 0 ? 'success' : 'danger') : undefined}
                accent="#E52207" iconBg="#FDE8E8" iconColor="#E52207" />
            </div>

            {/* ════════════════════════
                MAPA + RANKING
            ════════════════════════ */}
            <div className="ds-section-heading anim-3">
              <i className="fas fa-globe-americas" /> Distribuição Geográfica
            </div>

            <div className="ds-row ds-row-map anim-4">
              {/* Mapa */}
              <div className="ds-card">
                <div className="ds-card-header">
                  <div>
                    <div className="ds-card-title">
                      <i className="fas fa-globe" style={{ color: 'var(--color-primary)' }} />
                      Mapa do Brasil
                    </div>
                    <div className="ds-card-subtitle">
                      Clique em um estado para filtrar · {an.byUf.length} UFs com dados
                    </div>
                  </div>
                  {fUf && (
                    <div className="ds-chip" onClick={() => setFUf(null)}>
                      {fUf} <i className="fas fa-times" style={{ fontSize: 9 }} />
                    </div>
                  )}
                </div>
                <div className="ds-card-body">
                  <BrazilMap countByUf={an.cbu} selectedUf={fUf} onSelect={setFUf} />
                </div>
              </div>

              {/* Ranking UF */}
              <div className="ds-card">
                <div className="ds-card-header">
                  <div>
                    <div className="ds-card-title">
                      <i className="fas fa-bar-chart" style={{ color: '#6366F1' }} />
                      Ranking por UF
                    </div>
                    <div className="ds-card-subtitle">
                      Top {Math.min(an.byUf.length, 15)} estados · clique para filtrar
                    </div>
                  </div>
                </div>
                <div className="ds-card-body">
                  <div className="ds-uf-list">
                    {an.byUf.slice(0, 15).map(({ uf, qtd }) => (
                      <div key={uf}
                        className={`ds-uf-row${fUf === uf ? ' active' : ''}`}
                        onClick={() => setFUf(fUf === uf ? null : uf)}>
                        <div className="ds-uf-badge">{uf}</div>
                        <div className="ds-uf-bar-wrap">
                          <div className="ds-uf-bar-top">
                            <span className="ds-uf-bar-lbl">Processos</span>
                            <span className="ds-uf-bar-val">{qtd.toLocaleString('pt-BR')}</span>
                          </div>
                          <div className="ds-uf-bar-bg">
                            <div className="ds-uf-bar-fill"
                              style={{ width: `${an.maxUf > 0 ? qtd / an.maxUf * 100 : 0}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ════════════════════════
                GRÁFICOS LINHA 1
            ════════════════════════ */}
            <div className="ds-row ds-row-2 anim-4">

              {/* Pizza — Instrumento */}
              <div className="ds-card">
                <div className="ds-card-header">
                  <div>
                    <div className="ds-card-title">
                      <i className="fas fa-chart-pie" style={{ color: '#7E3AF2' }} />
                      Distribuição por Instrumento
                    </div>
                    <div className="ds-card-subtitle">Clique no setor para filtrar</div>
                  </div>
                  {fInstr && (
                    <div className="ds-chip" onClick={() => setFInstr(null)}>
                      {fInstr} <i className="fas fa-times" style={{ fontSize: 9 }} />
                    </div>
                  )}
                </div>
                <div className="ds-card-body">
                  <div style={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={an.byInstr} cx="50%" cy="50%"
                          innerRadius="50%" outerRadius="80%"
                          paddingAngle={3} dataKey="value"
                          label={({ name, percent }) => percent > 0.06 ? `${(percent * 100).toFixed(0)}%` : ''}
                          labelLine={false}>
                          {an.byInstr.map((d, i) => (
                            <Cell key={i}
                              fill={PALETTE[i % PALETTE.length]}
                              stroke={fInstr === d.name ? '#071D41' : 'transparent'}
                              strokeWidth={3}
                              onClick={() => setFInstr(fInstr === d.name ? null : d.name)}
                              style={{ cursor: 'pointer' }} />
                          ))}
                        </Pie>
                        <RTooltip content={<ChartTooltip />} />
                        <Legend iconSize={11} wrapperStyle={{ fontSize: 10 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Área — Evolução anual */}
              <div className="ds-card">
                <div className="ds-card-header">
                  <div>
                    <div className="ds-card-title">
                      <i className="fas fa-chart-line" style={{ color: '#168821' }} />
                      Evolução Anual (R$)
                    </div>
                    <div className="ds-card-subtitle">Soma dos valores de repasse por ano</div>
                  </div>
                </div>
                <div className="ds-card-body">
                  <div style={{ height: 260 }}>
                    {an.byAno.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={an.byAno} margin={{ top: 8, right: 10, left: 5, bottom: 0 }}>
                          <defs>
                            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="#1351B4" stopOpacity={0.18} />
                              <stop offset="95%" stopColor="#1351B4" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                          <XAxis dataKey="ano" tick={{ fontSize: 10, fontFamily: 'var(--font-family-base)' }} stroke="#E0E0E0" />
                          <YAxis tickFormatter={v => v.toLocaleString('pt-BR', { notation: 'compact' })} tick={{ fontSize: 9 }} stroke="#E0E0E0" />
                          <RTooltip content={<ChartTooltip currency />} />
                          <Area type="monotone" dataKey="valor"
                            stroke="#1351B4" strokeWidth={2.5}
                            fill="url(#areaGrad)"
                            dot={{ r: 4, fill: '#1351B4', strokeWidth: 2, stroke: '#fff' }}
                            activeDot={{ r: 6 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-04)', fontSize: 12 }}>
                        Sem dados anuais disponíveis
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ════════════════════════
                GRÁFICOS LINHA 2
            ════════════════════════ */}
            <div className="ds-row ds-row-tec anim-5" style={{ marginBottom: 16 }}>

              {/* ── Técnico de Formalização (barras paralelas) ── */}
              <div className="ds-card">
                <div className="ds-card-header">
                  <div>
                    <div className="ds-card-title">
                      <i className="fas fa-users" style={{ color: '#0694A2' }} />
                      Processos por Técnico de Formalização
                    </div>
                    <div className="ds-tec-legend">
                      <span className="ds-tec-legend-item">
                        <span className="ds-tec-legend-dot" style={{ background: '#1A56DB' }} />
                        Em carga do técnico
                      </span>
                      <span className="ds-tec-legend-item">
                        <span className="ds-tec-legend-dot" style={{ background: '#E52207' }} />
                        Tramitado para CGAP
                      </span>
                      <span style={{ fontSize: 9.5, color: 'var(--text-04)', marginLeft: 4 }}>· clique para filtrar</span>
                    </div>
                  </div>
                  {fTec && (
                    <div className="ds-chip" onClick={() => setFTec(null)}>
                      {fTec} <i className="fas fa-times" style={{ fontSize: 9 }} />
                    </div>
                  )}
                </div>
                <div className="ds-card-body">
                  <div style={{ height: 360 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={an.byTec}
                        margin={{ top: 28, right: 10, left: 0, bottom: 20 }}
                        barCategoryGap="18%" barGap={3}
                        onClick={({ activePayload }) => {
                          if (activePayload?.[0]) {
                            const name = activePayload[0].payload.name;
                            setFTec(fTec === name ? null : name);
                          }
                        }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
                        <XAxis dataKey="name" axisLine={{ stroke: '#E0E0E0' }} tickLine={false}
                          tick={({ x, y, payload }) => {
                            const firstName = payload.value.split(' ')[0];
                            const isSel = fTec === payload.value;
                            return (
                              <text x={x} y={y + 14} textAnchor="middle"
                                fill={isSel ? '#1351B4' : '#374151'}
                                fontSize={11} fontWeight={isSel ? 800 : 600}
                                fontFamily="Rawline, Raleway, sans-serif"
                                style={{ cursor: 'pointer' }}
                                onClick={() => setFTec(fTec === payload.value ? null : payload.value)}>
                                {firstName}
                              </text>
                            );
                          }} />
                        <YAxis hide />
                        <RTooltip
                          cursor={{ fill: 'rgba(19,81,180,0.05)' }}
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0]?.payload;
                            return (
                              <div className="ds-tooltip" style={{ minWidth: 180 }}>
                                <strong style={{ fontSize: 12, marginBottom: 6 }}>{d.name}</strong>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                                      <span style={{ width: 8, height: 8, borderRadius: 2, background: '#1A56DB', display: 'inline-block' }} />
                                      Em carga
                                    </span>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: '#1A56DB' }}>{d.ativo}</span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                                      <span style={{ width: 8, height: 8, borderRadius: 2, background: '#E52207', display: 'inline-block' }} />
                                      CGAP
                                    </span>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: '#E52207' }}>{d.cgap}</span>
                                  </div>
                                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: 11, fontWeight: 600 }}>Total</span>
                                    <span style={{ fontSize: 13, fontWeight: 800 }}>{d.total}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          }} />
                        {/* Barra Azul — Em carga */}
                        <Bar dataKey="ativo" name="Em carga" radius={[4, 4, 0, 0]} cursor="pointer"
                          label={{ position: 'top', fontSize: 11, fontWeight: 700, fill: '#1A56DB', formatter: v => v > 0 ? v : '' }}>
                          {an.byTec.map((d, i) => (
                            <Cell key={i}
                              fill={fTec === d.name ? '#0C326F' : '#1A56DB'}
                              opacity={fTec && fTec !== d.name ? 0.28 : 1} />
                          ))}
                        </Bar>
                        {/* Barra Vermelha — CGAP */}
                        <Bar dataKey="cgap" name="CGAP" radius={[4, 4, 0, 0]} cursor="pointer"
                          label={{ position: 'top', fontSize: 11, fontWeight: 700, fill: '#E52207', formatter: v => v > 0 ? v : '' }}>
                          {an.byTec.map((d, i) => (
                            <Cell key={i}
                              fill={fTec === d.name ? '#9B1C1C' : '#E52207'}
                              opacity={fTec && fTec !== d.name ? 0.28 : 1} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* ── Por Situação (Ajuste) ── */}
              <div className="ds-card">
                <div className="ds-card-header">
                  <div>
                    <div className="ds-card-title">
                      <i className="fas fa-activity" style={{ color: '#E52207' }} />
                      Por Situação (Ajuste)
                    </div>
                    <div className="ds-card-subtitle">Clique na barra para filtrar</div>
                  </div>
                  {fSit && (
                    <div className="ds-chip" onClick={() => setFSit(null)}>
                      {fSit} <i className="fas fa-times" style={{ fontSize: 9 }} />
                    </div>
                  )}
                </div>
                <div className="ds-card-body">
                  <div style={{ height: 320 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={an.bySit} layout="vertical"
                        margin={{ top: 5, right: 44, left: 88, bottom: 5 }}
                        onClick={({ activePayload }) => {
                          if (activePayload?.[0]) setFSit(fSit === activePayload[0].payload.name ? null : activePayload[0].payload.name);
                        }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 9 }} stroke="#E0E0E0" />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} stroke="#E0E0E0" width={86} />
                        <RTooltip content={<ChartTooltip />} />
                        <Bar dataKey="qty" name="Qtd." radius={[0, 4, 4, 0]} cursor="pointer"
                          label={{ position: 'right', fontSize: 10, fontWeight: 700, fill: 'var(--text-02)', formatter: v => v.toLocaleString('pt-BR') }}>
                          {an.bySit.map((d, i) => {
                            let fill = '#1A56DB';
                            if (STATUS_OK.some(s => d.name?.includes(s)))  fill = '#168821';
                            if (STATUS_BAD.some(s => d.name?.includes(s))) fill = '#E52207';
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

            {/* ════════════════════════
                TABELA
            ════════════════════════ */}
            <div className="ds-section-heading anim-5">
              <i className="fas fa-list" /> Registros Detalhados
            </div>

            <div className="ds-table-card anim-5">
              <div className="ds-table-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="ds-table-title">
                    <i className="fas fa-table" style={{ color: 'var(--color-primary)' }} />
                    Propostas
                  </span>
                  <span className="ds-table-count">{tblTotal.toLocaleString('pt-BR')} registros</span>
                </div>
                <div className="ds-table-search">
                  <i className="fas fa-search" />
                  <input placeholder="Filtrar tabela…" value={tblFlt} onChange={e => setTblFlt(e.target.value)} />
                </div>
              </div>

              <div className="ds-table-scroll">
                <table className="br-table">
                  <thead>
                    <tr>
                      {tbl.getHeaderGroups()[0]?.headers.map(h => (
                        <th key={h.id} onClick={h.column.getToggleSortingHandler()}>
                          <div className="th-inner">
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            {h.column.getIsSorted() === 'asc'  && <span className="sort-icon">▲</span>}
                            {h.column.getIsSorted() === 'desc' && <span className="sort-icon">▼</span>}
                            {!h.column.getIsSorted() && h.column.getCanSort() && <span className="sort-icon">⇅</span>}
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
                        <td colSpan={tblCols.length}
                          style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-04)', fontSize: 12 }}>
                          <i className="fas fa-inbox" style={{ fontSize: 24, display: 'block', marginBottom: 8 }} />
                          Nenhum registro encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="ds-table-footer">
                <div className="ds-pg-info">
                  Exibindo <b>{pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, tblTotal)}</b> de <b>{tblTotal.toLocaleString('pt-BR')}</b>
                </div>
                <div className="ds-pg-controls">
                  <span style={{ fontSize: 11, color: 'var(--text-03)', fontWeight: 600 }}>Linhas</span>
                  <select className="ds-pg-size" value={pageSize} onChange={e => tbl.setPageSize(Number(e.target.value))}>
                    {[10, 15, 25, 50].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button className="ds-pg-btn" onClick={() => tbl.previousPage()} disabled={!tbl.getCanPreviousPage()}>
                    <i className="fas fa-chevron-left" style={{ fontSize: 10 }} /> Anterior
                  </button>
                  <span className="ds-pg-current">Pág. {pageIndex + 1} / {tbl.getPageCount()}</span>
                  <button className="ds-pg-btn" onClick={() => tbl.nextPage()} disabled={!tbl.getCanNextPage()}>
                    Próxima <i className="fas fa-chevron-right" style={{ fontSize: 10 }} />
                  </button>
                </div>
              </div>
            </div>

          </div>{/* /ds-page */}
        </main>
      </div>
    </>
  );
}