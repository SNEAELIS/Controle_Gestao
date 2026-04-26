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

// Configurações protegidas por Variáveis de Ambiente
const MS_CONFIG = {
  clientId: process.env.MS_CLIENT_ID || "f10758be-9dd0-4ccb-a281-a475142c8556",
  tenantId: process.env.MS_TENANT_ID || "49e66e23-2e11-4c98-9799-c02815282bd6",
  clientSecret: process.env.MS_CLIENT_SECRET, // NÃO COLOQUE O VALOR AQUI, coloque no painel do Render
  userEmail: "leidiane.pires@esporte.gov.br",
  documentId: "10A078F5-E14F-4286-A207-8C24D03EB189"
};

// Rota para buscar dados da Microsoft
app.get('/api/dados', async (req, res) => {
  try {
    console.log("🔄 Iniciando busca de dados no SharePoint...");
    
    // 1. Obtém o Token de Acesso
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

    // 2. Localiza o arquivo e obtém URL de download
    const fileRes = await axios.get(
      `https://graph.microsoft.com/v1.0/users/${MS_CONFIG.userEmail}/drive/items/${MS_CONFIG.documentId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const downloadUrl = fileRes.data["@microsoft.graph.downloadUrl"];

    // 3. Baixa o conteúdo do Excel
    const excelRes = await axios.get(downloadUrl, { responseType: 'arraybuffer' });

    // 4. Converte o Excel para JSON
    const workbook = XLSX.read(excelRes.data);
    const sheetName = "Controle Geral"; 
    const sheet = workbook.Sheets[sheetName];
    
    if (!sheet) {
      return res.status(404).json({ error: `Aba '${sheetName}' não encontrada no Excel.` });
    }

    const jsonData = XLSX.utils.sheet_to_json(sheet);
    console.log(`✅ Sucesso! ${jsonData.length} linhas processadas.`);
    res.json(jsonData);

  } catch (error) {
    console.error("❌ Erro na Ponte Microsoft:", error.response?.data || error.message);
    res.status(500).json({ 
      error: "Falha ao buscar dados da Microsoft",
      details: error.response?.data?.error_description || error.message 
    });
  }
});

// --- SERVIR FRONT-END EM PRODUÇÃO ---
// Esta parte faz o Node entregar os arquivos do React gerados pelo 'npm run build'
const buildPath = path.join(__dirname, 'dist');
app.use(express.static(buildPath));

// Qualquer rota que não seja /api será enviada para o React (SPA)
// Captura qualquer rota (.*) para servir o React
app.get('(.*)', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(buildPath, 'index.html'));
    }
  });

// Porta dinâmica para o Render ou 7890 para local
const PORT = process.env.PORT || 7890;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📡 API de dados disponível em /api/dados`);
});