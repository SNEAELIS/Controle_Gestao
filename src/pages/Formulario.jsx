// src/pages/Formulario.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, Save, X, FileText, DollarSign, CalendarDays, 
  Building2, MapPin, User, Info, CheckCircle2, AlertCircle, 
  ClipboardCheck, Edit3, Loader2
} from 'lucide-react';

import { supabase } from '../services/supabaseClient';

const Formulario = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const [dados, setDados] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Carrega dados reais do Supabase
  useEffect(() => {
    if (!id) {
      navigate('/');
      return;
    }

    const fetchProposta = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('formalizacoes')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        if (!data) {
          setMessage({ type: 'error', text: 'Proposta não encontrada.' });
          return;
        }

        setDados(data);
        setFormValues(data);
      } catch (err) {
        console.error('Erro ao carregar proposta:', err);
        setMessage({ type: 'error', text: 'Erro ao carregar os dados da proposta.' });
      } finally {
        setLoading(false);
      }
    };

    fetchProposta();
  }, [id, navigate]);

  // Formatação limpa (sem .0)
  const formatarValor = (val) => {
    if (val == null || isNaN(val)) return "—";
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(val);
  };

  const formatarData = (ts) => {
    if (!ts) return "—";
    const date = new Date(ts);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormValues(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const { error } = await supabase
        .from('formalizacoes')
        .update(formValues)
        .eq('id', id);

      if (error) throw error;

      setDados({ ...formValues });
      setEditMode(false);
      setMessage({ type: 'success', text: 'Proposta atualizada com sucesso!' });
    } catch (err) {
      console.error('Erro ao salvar:', err);
      setMessage({ type: 'error', text: 'Erro ao salvar as alterações. Tente novamente.' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormValues(dados);
    setEditMode(false);
    setMessage({ type: '', text: '' });
  };

  // Grupos de campos organizados
  const grupos = [
    {
      titulo: "Informações Básicas",
      icon: <FileText className="text-blue-600" size={24} />,
      campos: [
        { label: "Processo", chave: "PROCESSO", tipo: "text" },
        { label: "Instrumento", chave: "INSTRUMENTO", tipo: "text" },
        { label: "Entidade Proponente", chave: "ENTIDADE", tipo: "text" },
        { label: "UF", chave: "UF", tipo: "text" },
        { label: "Nome Parlamentar", chave: "NOME PARLAMENTAR", tipo: "text" },
      ]
    },
    {
      titulo: "Valores Financeiros",
      icon: <DollarSign className="text-emerald-600" size={24} />,
      campos: [
        { label: "Valor Repasse", chave: "VALOR REPASSE", tipo: "number", format: formatarValor },
        { label: "Ação Orçamentária", chave: "AÇÃO ORÇAMENTÁRIA", tipo: "text" },
        { label: "RP", chave: "RP", tipo: "text" },
        { label: "GND", chave: "GND", tipo: "text" },
      ]
    },
    {
      titulo: "Datas e Prazos",
      icon: <CalendarDays className="text-violet-600" size={24} />,
      campos: [
        { label: "Ano", chave: "ANO", tipo: "text" },
        { label: "Data Publicação DOU", chave: "DATA DA PUBLICAÇÃO DOU", tipo: "text", format: formatarData },
        { label: "Término da Vigência", chave: "TÉRMINO DA VIGÊNCIA", tipo: "text", format: formatarData },
        { label: "Data Limite Saneamento", chave: "DATA LIMITE PARA SANEAMENTO", tipo: "text", format: formatarData },
      ]
    },
    {
      titulo: "Status e Responsáveis",
      icon: <CheckCircle2 className="text-green-600" size={24} />,
      campos: [
        { label: "Situação", chave: "SITUACIONAL", tipo: "text" },
        { label: "Técnico de Formalização", chave: "TÉCNICO DE FORMALIZAÇÃO", tipo: "text" },
        { label: "Setor", chave: "SETOR", tipo: "text" },
      ]
    },
    {
      titulo: "Objeto e Detalhes",
      icon: <Info className="text-amber-600" size={24} />,
      campos: [
        { label: "Objeto", chave: "OBJETO ", tipo: "textarea", fullWidth: true },
        { label: "Classificação do Objeto", chave: "CLASSIFICAÇÃO DO OBJETO", tipo: "text" },
      ]
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Carregando proposta...</p>
        </div>
      </div>
    );
  }

  if (!dados) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center max-w-md p-8 bg-white rounded-2xl shadow-lg">
          <AlertCircle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Proposta não encontrada</h2>
          <p className="text-slate-600 mb-6">O registro solicitado não existe ou não pôde ser carregado.</p>
          <button 
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Cabeçalho fixo */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-slate-600 hover:text-blue-700 font-medium transition"
          >
            <ArrowLeft size={20} />
            Voltar ao Dashboard
          </button>

          <div className="flex items-center gap-4">
            {!editMode ? (
              <button
                onClick={() => setEditMode(true)}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition shadow-sm"
              >
                <Edit3 size={18} />
                Editar Proposta
              </button>
            ) : (
              <>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-medium rounded-lg transition disabled:opacity-50"
                >
                  <X size={18} />
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition shadow-sm disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  {saving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Feedback */}
      {message.text && (
        <div className={`max-w-7xl mx-auto mt-6 px-4 sm:px-6 lg:px-8 ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'} border rounded-xl p-4 flex items-center gap-3`}>
          {message.type === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
          <p className="font-medium">{message.text}</p>
        </div>
      )}

      {/* Conteúdo principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Cabeçalho da proposta */}
        <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-6 mb-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-start gap-5">
              <div className="bg-blue-100 p-4 rounded-xl shrink-0">
                <ClipboardCheck className="text-blue-700" size={36} />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
                  {dados.ENTIDADE || 'Proposta sem nome'}
                </h1>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-slate-600">
                  <span className="flex items-center gap-2">
                    <FileText size={16} />
                    Processo: <strong>{dados.PROCESSO || '—'}</strong>
                  </span>
                  <span className="flex items-center gap-2">
                    <MapPin size={16} />
                    UF: <strong>{dados.UF || '—'}</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-3">
              <div className="text-right">
                <p className="text-sm text-slate-500">Valor Total Repassado</p>
                <p className="text-3xl font-bold text-emerald-700">
                  {formatarValor(dados["VALOR REPASSE"])}
                </p>
              </div>
                <span className={`px-5 py-2 rounded-full text-sm font-semibold border ${
                  (dados?.["SITUACIONAL "] || dados?.SITUACIONAL || '').toUpperCase().includes('CONCLU') ||
                  (dados?.["SITUACIONAL "] || dados?.SITUACIONAL || '').toUpperCase().includes('ASSINADO')
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                    : (dados?.["SITUACIONAL "] || dados?.SITUACIONAL || '').toUpperCase().includes('PUBLICADA')
                    ? 'bg-blue-100 text-blue-700 border-blue-200'
                    : (dados?.["SITUACIONAL "] || dados?.SITUACIONAL || '').toUpperCase().includes('CANCELADA') ||
                      (dados?.["SITUACIONAL "] || dados?.SITUACIONAL || '').toUpperCase().includes('PENDENTE')
                    ? 'bg-amber-100 text-amber-700 border-amber-200'
                    : 'bg-gray-100 text-gray-700 border-gray-200'
                }`}>
                  {dados?.["SITUACIONAL "] || dados?.SITUACIONAL || 'Pendente'}
                </span>
            </div>
          </div>
        </div>

        {/* Seções de campos */}
        {grupos.map((grupo, idx) => (
          <div key={idx} className="mb-12">
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-slate-100 p-3.5 rounded-xl">
                {grupo.icon}
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-slate-800">{grupo.titulo}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {grupo.campos.map((campo) => {
                const valorOriginal = dados?.[campo.chave];
                const valorEditado = formValues?.[campo.chave];
                const valorExibido = editMode ? valorEditado : valorOriginal;

                const displayValue = campo.format 
                  ? campo.format(valorExibido)
                  : (valorExibido ?? "—");

                return (
                  <div 
                    key={campo.chave} 
                    className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                  >
                    <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
                      <label className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
                        {campo.label}
                      </label>
                    </div>
                    
                    <div className="p-5">
                      {editMode ? (
                        campo.tipo === 'textarea' ? (
                          <textarea
                            name={campo.chave}
                            value={valorEditado || ''}
                            onChange={handleChange}
                            rows={campo.fullWidth ? 5 : 3}
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y min-h-[100px]"
                          />
                        ) : (
                          <input
                            type={campo.tipo}
                            name={campo.chave}
                            value={valorEditado ?? ''}
                            onChange={handleChange}
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          />
                        )
                      ) : (
                        <p className={`text-lg font-medium break-words ${displayValue === '—' ? 'text-slate-400 italic' : 'text-slate-900'}`}>
                          {displayValue}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Formulario;