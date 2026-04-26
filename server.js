import express from 'express';
import axios from 'axios';
import * as XLSX from 'xlsx';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Configurações de caminho para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Configurações da Microsoft (via Variáveis de Ambiente no Render)
const MS_CONFIG = {
  clientId: process.env.MS_CLIENT_ID || "f10758be-9dd0-4ccb-a281-a475142c8556",
  tenantId: process.env.MS_TENANT_ID || "49e66e23-2e11-4c98-9799-c02815282bd6",
  clientSecret: process.env.MS_CLIENT_SECRET, // Definido no painel Environment do Render
  userEmail: "leidiane.pires@esporte.gov.br",
  documentId: "10A078F5-E14F-4286-A207-8C24D03EB189"
};

// 1. Rota da API para buscar os dados do Excel
app.get('/api/dados', async (req, res) => {
  try {
    console.log("🔄 Solicitando novo token à Microsoft...");
    
    // Obter Token de Acesso
    const tokenRes = await axios.post(
      `https://login.microsoftonline.com/${MS_CONFIG.tenantId}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: MS_CONFIG.clientId,
        client_secret: MS_CONFIG.clientSecret,
        grant_type: 'client_credentials',
        scope: 'https://graph.microsoft.com/.default'
      })
    );

    const token = tokenRes.data.access_token;

    // Buscar metadados do arquivo para pegar a URL de download atualizada
    const fileRes = await axios.get(
      `https://graph.microsoft.com/v1.0/users/${MS_CONFIG.userEmail}/drive/items/${MS_CONFIG.documentId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const downloadUrl = fileRes.data["@microsoft.graph.downloadUrl"];

    // Baixar o arquivo Excel (ArrayBuffer para o XLSX ler corretamente)
    const excelRes = await axios.get(downloadUrl, { responseType: 'arraybuffer' });

    // Converter para JSON
    const workbook = XLSX.read(excelRes.data);
    const sheetName = "Controle Geral"; 
    const sheet = workbook.Sheets[sheetName];
    
    if (!sheet) {
      throw new Error(`Aba '${sheetName}' não encontrada no arquivo.`);
    }

    const jsonData = XLSX.utils.sheet_to_json(sheet);
    
    console.log(`✅ Dados obtidos com sucesso: ${jsonData.length} linhas.`);
    res.json(jsonData);

  } catch (error) {
    console.error("❌ Erro no Servidor:", error.message);
    res.status(500).json({ 
      error: "Erro ao sincronizar com SharePoint", 
      details: error.response?.data || error.message 
    });
  }
});

// 2. Servir Arquivos Estáticos do React (Pasta 'dist' gerada pelo Vite)
const buildPath = path.join(__dirname, 'dist');
app.use(express.static(buildPath));

// 3. Rota "Catch-all" para o React (SPA)
// Esta sintaxe '*' é compatível com Express 5 e garante que o F5 funcione no navegador
app.get('/*path', (req, res) => {
  // Se a rota não for da API, envia o index.html do front-end
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(buildPath, 'index.html'));
  }
});

// 4. Inicialização do Servidor
const PORT = process.env.PORT || 7890;
// Escutar em 0.0.0.0 é fundamental para o Render expor o serviço
app.listen(PORT, '0.0.0.0', () => {
  console.log(`-----------------------------------------`);
  console.log(`🚀 SNEAELIS-BI rodando na porta ${PORT}`);
  console.log(`📅 Modo: ${process.env.NODE_ENV || 'development'}`);
  console.log(`-----------------------------------------`);
});