import express from 'express';
import axios from 'axios';
import * as XLSX from 'xlsx';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

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

// Rota de API Otimizada
app.get('/api/dados', async (req, res) => {
  const now = Date.now();

  // 1. Verifica Cache
  if (cachedData && (now - lastFetchTime < CACHE_DURATION)) {
    console.log("⚡ Dados servidos via Cache (Instantâneo)");
    return res.json(cachedData);
  }

  try {
    console.log("📡 Buscando novos dados no SharePoint/OneDrive...");
    const token = await getAccessToken();

    // 2. Busca metadados (URL de download)
    const fileRes = await axios.get(
      `https://graph.microsoft.com/v1.0/users/${MS_CONFIG.userEmail}/drive/items/${MS_CONFIG.documentId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const downloadUrl = fileRes.data["@microsoft.graph.downloadUrl"];

    // 3. Download do binário
    const excelRes = await axios.get(downloadUrl, { 
      responseType: 'arraybuffer',
      timeout: 15000 // 15 segundos de timeout
    });

    // 4. Processamento XLSX
    const workbook = XLSX.read(excelRes.data, { type: 'buffer' });
    const sheetName = "Controle Geral"; 
    const sheet = workbook.Sheets[sheetName];
    
    if (!sheet) throw new Error(`Aba '${sheetName}' não encontrada.`);

    const jsonData = XLSX.utils.sheet_to_json(sheet);
    
    // 5. Atualiza Cache Global
    cachedData = jsonData;
    lastFetchTime = now;

    console.log(`✅ Cache atualizado: ${jsonData.length} linhas.`);
    res.json(jsonData);

  } catch (error) {
    console.error("❌ Erro:", error.message);
    
    // Se falhar mas tivermos cache antigo, envia o antigo em vez de erro
    if (cachedData) {
      console.log("⚠️ Falha na renovação. Enviando cache antigo.");
      return res.json(cachedData);
    }

    res.status(500).json({ error: "Erro na sincronização", details: error.message });
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
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor Otimizado na porta ${PORT}`);
});