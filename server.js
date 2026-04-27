import express from 'express';
import axios from 'axios';
import * as XLSX from 'xlsx';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
let fetchPromise = null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Configurações
const MS_CONFIG = {
  clientId: process.env.MS_CLIENT_ID || "f10758be-9dd0-4ccb-a281-a475142c8556",
  tenantId: process.env.MS_TENANT_ID || "49e66e23-2e11-4c98-9799-c02815282bd6",
  clientSecret: process.env.MS_CLIENT_SECRET,
  userEmail: "leidiane.pires@esporte.gov.br",
  documentId: "10A078F5-E14F-4286-A207-8C24D03EB189"
};

// Variáveis de Cache em Memória
let cachedData = null;
let lastFetchTime = 0;
let cachedToken = null;
let tokenExpiry = 0;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos (em milissegundos)

/**
 * Obtém ou renova o token da Microsoft
 */
async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }

  console.log("🔑 Gerando novo token de acesso...");
  const res = await axios.post(
    `https://login.microsoftonline.com/${MS_CONFIG.tenantId}/oauth2/v2.0/token`,
    new URLSearchParams({
      client_id: MS_CONFIG.clientId,
      client_secret: MS_CONFIG.clientSecret,
      grant_type: 'client_credentials',
      scope: 'https://graph.microsoft.com/.default'
    })
  );

  cachedToken = res.data.access_token;
  // Expira o cache do token 5 minutos antes do tempo real para segurança
  tokenExpiry = now + (res.data.expires_in * 1000) - (5 * 60 * 1000);
  return cachedToken;
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    cached: !!cachedData,
    age: cachedData ? Math.round((Date.now() - lastFetchTime) / 1000) : null
  });
});

// Rota de API Otimizada
app.get("/api/dados", async (req, res) => {
  const now = Date.now();
  const forceRefresh = req.query.refresh === "1";

  // 1. Cache válido → responde imediatamente
  if (!forceRefresh && cachedData && now - lastFetchTime < CACHE_DURATION) {
    const ageSeconds = Math.round((now - lastFetchTime) / 1000);
    console.log(`⚡ Cache hit — ${cachedData.length} linhas (${ageSeconds}s atrás)`);
    res.setHeader("X-Cache", "HIT");
    res.setHeader("X-Cache-Age", String(ageSeconds));
    return res.json(cachedData);
  }

  // 2. Se já há um fetch em andamento, aguarda o mesmo (evita thundering herd)
  if (fetchPromise) {
    console.log("🔗 Aguardando fetch já em andamento...");
    try {
      const data = await fetchPromise;
      res.setHeader("X-Cache", "COALESCED");
      return res.json(data);
    } catch {
      // se o fetch em andamento falhou, cai no fallback abaixo
    }
  }

  async function fetchAndParseExcel() {
    const token = await getAccessToken();
    const fileRes = await axios.get(
      `https://graph.microsoft.com/v1.0/users/${MS_CONFIG.userEmail}/drive/items/${MS_CONFIG.documentId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    const downloadUrl = fileRes.data["@microsoft.graph.downloadUrl"];
    const excelRes = await axios.get(downloadUrl, {
      responseType: 'arraybuffer', 
      timeout: 30000 
    });
    
    const wb = XLSX.read(excelRes.data, { type: 'buffer' });
    const sheet = wb.Sheets["Controle Geral"]; // Verifique se o nome da aba está correto!
    
    if (!sheet) throw new Error('Aba "Controle Geral" não encontrada no Excel');
    
    return XLSX.utils.sheet_to_json(sheet);
  }

  // 3. Dispara novo fetch
  console.log("📡 Buscando dados no SharePoint/OneDrive...");
  fetchPromise = fetchAndParseExcel();

  try {
    const jsonData = await fetchPromise;

    cachedData = jsonData;
    lastFetchTime = Date.now();
    console.log(`✅ Cache renovado: ${jsonData.length} linhas.`);

    res.setHeader("X-Cache", "MISS");
    return res.json(jsonData);

  } catch (error) {
    console.error("❌ Erro ao buscar dados:", error.message);

    // Fallback: cache antigo é melhor que erro 500
    if (cachedData) {
      const staleAge = Math.round((Date.now() - lastFetchTime) / 1000 / 60);
      console.warn(`⚠️ Servindo cache stale (${staleAge} min atrás).`);
      res.setHeader("X-Cache", "STALE");
      res.setHeader("X-Cache-Stale-Age", String(staleAge));
      return res.json(cachedData);
    }

    return res.status(503).json({
      error: "Serviço temporariamente indisponível.",
      details: error.message,
      retry_after: 10,
    });

  } finally {
    // Libera a fila independentemente do resultado
    fetchPromise = null;
  }
});

// Servir Front-end
const buildPath = path.join(__dirname, 'dist');
app.use(express.static(buildPath));

app.get('/*path', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(buildPath, 'index.html'));
  }
});

const PORT = process.env.PORT || 7890;
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Servidor na porta ${PORT}`);

  // Pré-aquece o cache assim que o servidor sobe
  console.log('🔥 Pré-aquecendo cache...');
  try {
    const token = await getAccessToken();
    const fileRes = await axios.get(
      `https://graph.microsoft.com/v1.0/users/${MS_CONFIG.userEmail}/drive/items/${MS_CONFIG.documentId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const downloadUrl = fileRes.data["@microsoft.graph.downloadUrl"];
    const excelRes = await axios.get(downloadUrl, {
      responseType: 'arraybuffer', timeout: 30000
    });
    const wb = XLSX.read(excelRes.data, { type: 'buffer' });
    const sheet = wb.Sheets["Controle Geral"];
    if (!sheet) throw new Error('Aba não encontrada');
    cachedData = XLSX.utils.sheet_to_json(sheet);
    lastFetchTime = Date.now();
    console.log(`✅ Cache quente: ${cachedData.length} linhas prontas.`);
  } catch (e) {
    console.warn('⚠️ Pré-aquecimento falhou, dados carregados sob demanda.', e.message);
  }
});