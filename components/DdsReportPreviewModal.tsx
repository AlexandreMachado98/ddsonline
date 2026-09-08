'use client';

import React, { useState } from 'react';
import { 
  X, Download, Eye, FileText, CheckCircle2, 
  MapPin, Calendar, Users, ShieldCheck, 
  Printer, ArrowLeft, Loader2, Sparkles, 
  Check, FileSpreadsheet, LayoutList, FileImage, 
  AlertCircle, ExternalLink, Image as ImageIcon
} from 'lucide-react';
import { generateDdsPdf, MeetingData } from '@/lib/pdfGenerator';

interface DdsReportPreviewModalProps {
  meeting: MeetingData;
  onClose: () => void;
  onDownloadPdf?: () => Promise<void> | void;
}

export default function DdsReportPreviewModal({
  meeting,
  onClose,
  onDownloadPdf
}: DdsReportPreviewModalProps) {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'A4_PAGES' | 'FLUID'>('A4_PAGES');

  // Cores institucionais do DDS ON
  const darkGreen = '#006341';
  const tableHeaderGreen = '#198754';
  const lightGreenBg = '#ebf5f0';

  // Formatação de data/hora
  const ddsDate = new Date(meeting.createdAt || Date.now());
  const endDate = meeting.endedAt ? new Date(meeting.endedAt) : null;
  let dateStr = ddsDate.toLocaleDateString('pt-BR') + ' às ' + ddsDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (endDate) {
    dateStr += ' até ' + endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  // Código de verificação
  const verificationCode = `DDS-${ddsDate.getFullYear()}${String(ddsDate.getMonth() + 1).padStart(2, '0')}${String(ddsDate.getDate()).padStart(2, '0')}-${String(ddsDate.getHours()).padStart(2, '0')}${String(ddsDate.getMinutes()).padStart(2, '0')}`;

  // Logo da empresa do localStorage se houver
  const companyLogo = typeof window !== 'undefined' ? localStorage.getItem('dds_company_logo') : null;

  // Lista de participantes e anexos
  const attendeesList = meeting.attendees || [];
  const attachmentsList = (meeting.attachments || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));

  // Verso condicional (Conteúdo Programático ou Treinamento)
  const rawContent = (meeting.programmaticContent || '').trim();
  const shouldRenderVerso = rawContent.length > 0 || meeting.classification === 'Treinamento';

  // Cálculo total de páginas estimadas
  let totalEstimatedPages = 1;
  if (shouldRenderVerso) totalEstimatedPages += 1;
  if (attachmentsList.length > 0) {
    totalEstimatedPages += 1 + attachmentsList.length;
  }

  const handleGeneratePdf = async () => {
    setIsGeneratingPdf(true);
    try {
      if (onDownloadPdf) {
        await onDownloadPdf();
      } else {
        await generateDdsPdf(meeting);
      }
    } catch (err) {
      console.error('Erro ao gerar PDF da prévia:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-black/90 backdrop-blur-md flex flex-col overflow-hidden animate-in fade-in duration-200">
      {/* Topbar Fixa da Pré-Visualização */}
      <header className="h-16 bg-slate-950 border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-3 shrink-0 shadow-xl z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900 transition-colors flex items-center gap-1.5 text-xs font-bold shrink-0 cursor-pointer"
            title="Voltar ao Histórico"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Voltar</span>
          </button>

          <div className="h-6 w-[1px] bg-slate-800 hidden sm:block"></div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-black text-white truncate">
                Pré-Visualização da Lista de Presença
              </h2>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                {meeting.topic}
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
              📍 {meeting.farm} • {dateStr} • <strong className="text-emerald-400">{attendeesList.length} presentes</strong>
            </p>
          </div>
        </div>

        {/* Ações da Topbar */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Alternar Modo de Visualização (Desktop / Tablet) */}
          <div className="hidden md:flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('A4_PAGES')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'A4_PAGES'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutList size={13} />
              <span>Folhas A4</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('FLUID')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'FLUID'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Eye size={13} />
              <span>Visão Fluida</span>
            </button>
          </div>

          {/* Botão Principal: Gerar PDF */}
          <button
            type="button"
            onClick={handleGeneratePdf}
            disabled={isGeneratingPdf}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-950/60 active:scale-95 transition-all cursor-pointer min-h-[40px] disabled:opacity-50"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Gerando PDF...</span>
              </>
            ) : (
              <>
                <Download size={16} />
                <span>Gerar Ata em PDF</span>
              </>
            )}
          </button>

          {/* Fechar */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900 transition-colors cursor-pointer"
            title="Fechar Visualização"
          >
            <X size={20} />
          </button>
        </div>
      </header>

      {/* Área de Visualização com Scroll Vertical Suave */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 bg-slate-950/80 flex flex-col items-center gap-6">
        
        {/* Banner Informativo de Pré-visualização */}
        <div className="w-full max-w-[210mm] bg-emerald-950/60 border border-emerald-500/30 rounded-2xl p-3 sm:p-4 text-xs text-slate-200 flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={20} className="text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold text-white text-xs sm:text-sm">Documento de Auditoria Pronto para Conferência</p>
              <p className="text-xs text-slate-400 mt-1">
                Esta é a visualização da ata gerada pelo DDS ON. Confira os participantes, assinaturas e materiais antes de emitir o PDF definitivo.
              </p>
            </div>
            
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors shrink-0"
              title="Fechar Prévia"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Visualizando <strong>{totalEstimatedPages} {totalEstimatedPages === 1 ? 'página' : 'páginas'}</strong></span>
              <span className="text-slate-500">•</span>
              <span>{attendeesList.length} presenças registradas</span>
              {attachmentsList.length > 0 && (
                <>
                  <span className="text-slate-500">•</span>
                  <span>{attachmentsList.length} anexo(s)</span>
                </>
              )}
            </div>

            <button
              onClick={handleGeneratePdf}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-950/40 transition-all cursor-pointer text-xs"
            >
              <Download size={14} />
              <span>Baixar Ata em PDF</span>
            </button>
          </div>
        </div>

        {/* =================================================================== */}
        {/* PÁGINA 1: FRENTE - REGISTRO DE PRESENÇA                             */}
        {/* =================================================================== */}
        <div 
          className={`w-full max-w-[210mm] bg-white text-slate-900 shadow-2xl rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-200 transition-all flex flex-col ${
            viewMode === 'A4_PAGES' ? 'min-h-[297mm]' : ''
          }`}
        >
          {/* Header Faixa Verde */}
          <div style={{ backgroundColor: darkGreen }} className="p-4 sm:p-6 text-white flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black tracking-tight">DDS ON</span>
                <span className="text-[10px] uppercase font-bold tracking-widest bg-emerald-500/30 px-2 py-0.5 rounded-md border border-emerald-400/30">
                  {meeting.classification || 'DDS'}
                </span>
              </div>
              <p className="text-[11px] text-emerald-100/90 font-light mt-0.5">
                Plataforma de registro de presença e evidências de SST
              </p>
            </div>

            {/* Logo da Empresa */}
            {companyLogo ? (
              <div className="bg-white p-1.5 rounded-xl shadow-sm max-w-[140px] max-h-[50px] flex items-center justify-center">
                <img src={companyLogo} alt="Logo da Empresa" className="max-h-9 max-w-full object-contain" />
              </div>
            ) : (
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-white">REGISTRO DE DDS</p>
                <p className="text-[10px] text-emerald-200">Segurança do Trabalho</p>
              </div>
            )}
          </div>

          {/* Conteúdo da Página 1 */}
          <div className="p-4 sm:p-6 space-y-4 flex-1 flex flex-col">
            {/* Cabeçalho Editorial do Documento */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <div className="flex-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 block mb-1">
                  {meeting.classification === 'Treinamento'
                    ? 'Registro de Treinamento Obrigatório (SST)'
                    : 'Diálogo Diário de Segurança e Saúde do Trabalho'}
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
                  {meeting.topic || 'Diálogo Diário de Segurança'}
                </h1>
              </div>

              {/* Badge de Total Registrado */}
              <div style={{ backgroundColor: lightGreenBg }} className="shrink-0 px-4 py-2.5 rounded-xl border border-emerald-900/10 text-center min-w-[100px]">
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-800 block">
                  Total Registrado
                </span>
                <span style={{ color: darkGreen }} className="text-2xl sm:text-3xl font-black block leading-none my-1">
                  {attendeesList.length}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">colaborador(es)</span>
              </div>
            </div>

            {/* Faixa de Metadados Editorial */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">Data & Horário</span>
                <p className="font-bold text-slate-900 mt-0.5 text-[11px] sm:text-xs">{dateStr}</p>
              </div>
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">Local / Unidade</span>
                <p className="font-bold text-slate-900 mt-0.5 text-[11px] sm:text-xs">{meeting.farm || 'Não informado'}</p>
              </div>
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">Modalidade</span>
                <p className="font-bold text-slate-900 mt-0.5 text-[11px] sm:text-xs">
                  {meeting.type === 'PRESENTIAL' ? '👥 Presencial' : '💻 EAD / Remoto'}
                </p>
              </div>
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">Responsável / Instrutor</span>
                <p className="font-bold text-slate-900 mt-0.5 text-[11px] sm:text-xs">
                  {meeting.instructorName || meeting.organizer?.name || 'Não informado'}
                </p>
              </div>
            </div>

            {/* Objetivo do DDS (se informado) */}
            {meeting.objective && (
              <div className="bg-slate-50/80 border-l-4 border-l-emerald-700 border border-slate-200/60 rounded-r-xl p-3">
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-800 block mb-0.5">
                  Objetivo Específico:
                </span>
                <p className="text-xs text-slate-800 leading-relaxed font-normal">
                  {meeting.objective}
                </p>
              </div>
            )}

            {/* Tabela de Presença */}
            <div className="space-y-1.5 pt-1">
              <div className="bg-slate-100/90 border-l-4 border-l-emerald-800 px-3.5 py-2 rounded-r-lg text-slate-900 font-bold text-xs uppercase tracking-wider flex items-center justify-between">
                <span>Lista de Presença & Assinaturas Eletrônicas</span>
                <span className="text-[10px] font-medium text-slate-500 lowercase">Diretrizes de SST</span>
              </div>

              {attendeesList.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                  Nenhum participante registrado nesta reunião.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr style={{ backgroundColor: lightGreenBg }} className="border-b border-slate-200 text-slate-800 font-bold text-[10px] uppercase">
                        <th className="p-2 text-center w-8">#</th>
                        <th className="p-2">Nome Completo</th>
                        <th className="p-2">Função</th>
                        <th className="p-2 text-center">Entrada</th>
                        <th className="p-2 text-center">Status / Saída</th>
                        <th className="p-2 text-center w-16">Foto Facial</th>
                        <th className="p-2 text-center w-28">Assinatura</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px]">
                      {attendeesList.map((attendee, idx) => {
                        const isEarlyExit = Boolean(attendee.exitReason);

                        return (
                          <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-2 text-center font-mono font-bold text-slate-500">
                              {idx + 1}
                            </td>
                            <td className="p-2 font-bold text-slate-900">
                              {attendee.name.replace(/\(Saída:.*\)/, '').trim()}
                            </td>
                            <td className="p-2 text-slate-600 font-medium">
                              {attendee.cpf || '-'}
                            </td>
                            <td className="p-2 text-center font-mono text-slate-600">
                              {new Date(attendee.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="p-2 text-center">
                              {isEarlyExit ? (
                                <span className="inline-block px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-bold text-[9px] border border-rose-200" title={attendee.exitReason || 'Saída Registrada'}>
                                  Saída Antecipada
                                </span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[9px] border border-emerald-200">
                                  Presente até o fim
                                </span>
                              )}
                            </td>
                            <td className="p-2 text-center">
                              {attendee.selfie ? (
                                <img
                                  src={attendee.selfie}
                                  alt={attendee.name}
                                  onClick={() => setZoomImage(attendee.selfie || null)}
                                  className="w-8 h-8 rounded-full object-cover mx-auto border border-slate-300 cursor-pointer hover:scale-110 transition-transform shadow-xs"
                                  title="Clique para ampliar"
                                />
                              ) : (
                                <span className="text-slate-300 text-[10px]">-</span>
                              )}
                            </td>
                            <td className="p-2 text-center">
                              {attendee.signature ? (
                                <div 
                                  onClick={() => setZoomImage(attendee.signature || null)}
                                  className="h-8 max-w-[100px] mx-auto flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity bg-slate-50 rounded border border-slate-200 p-0.5"
                                  title="Clique para ampliar assinatura"
                                >
                                  <img src={attendee.signature} alt="Assinatura" className="max-h-full max-w-full object-contain" />
                                </div>
                              ) : (
                                <span className="text-slate-300 text-[10px]">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Foto da Equipe (Evidência em Grupo) */}
            {meeting.groupPhoto && meeting.groupPhoto.length > 50 && (
              <div className="pt-2 text-center space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
                  Foto da Equipe (Registro Fotográfico de Campo)
                </span>
                <div 
                  onClick={() => setZoomImage(meeting.groupPhoto || null)}
                  className="max-w-md mx-auto rounded-2xl overflow-hidden border border-slate-200 shadow-sm cursor-pointer group relative"
                  title="Clique para ampliar foto"
                >
                  <img src={meeting.groupPhoto} alt="Foto da Equipe" className="w-full h-auto max-h-56 object-cover group-hover:scale-102 transition-transform" />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold gap-1">
                    <Eye size={14} /> Ampliar Foto
                  </div>
                </div>
              </div>
            )}

            {/* Rodapé da Página 1 */}
            <div className="pt-4 mt-auto border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-500 gap-1 font-sans">
              <div>
                <p>Documento de registro e evidência de SST emitido pelo <strong>DDS ON</strong></p>
                <p className="text-[9px] text-slate-400">© 2026 AM TST • DDS ON é uma plataforma da AM TST • Código: {verificationCode}</p>
              </div>
              <div className="text-right">
                <p className="font-bold">Página 1 de {totalEstimatedPages}</p>
                <p>{dateStr}</p>
              </div>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* PÁGINA 2: VERSO - CONTEÚDO PROGRAMÁTICO & NRs                       */}
        {/* =================================================================== */}
        {shouldRenderVerso && (
          <div 
            className={`w-full max-w-[210mm] bg-white text-slate-900 shadow-2xl rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-200 transition-all flex flex-col ${
              viewMode === 'A4_PAGES' ? 'min-h-[297mm]' : ''
            }`}
          >
            {/* Header Banner do Verso */}
            <div style={{ backgroundColor: darkGreen }} className="p-4 sm:p-5 text-white flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl sm:text-2xl font-black tracking-tight">DDS ON</span>
                  <span className="text-[9px] bg-white/20 text-white font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Plano Pedagógico
                  </span>
                </div>
                <p className="text-[10px] text-emerald-100 font-medium mt-0.5">
                  PROGRAMAÇÃO E CONTEÚDO PROGRAMÁTICO DO TREINAMENTO
                </p>
              </div>
              {companyLogo && (
                <div className="bg-white p-1 rounded-xl max-w-[120px] max-h-[40px] flex items-center justify-center">
                  <img src={companyLogo} alt="Logo" className="max-h-7 max-w-full object-contain" />
                </div>
              )}
            </div>

            <div className="p-4 sm:p-6 space-y-4 flex-1 flex flex-col">
              <div className="border-b border-slate-200 pb-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 uppercase">
                  CONTEÚDO PROGRAMÁTICO & METODOLOGIA
                </h2>
                <p className="text-xs text-slate-500">
                  Detalhamento pedagógico e normativo em conformidade com as Normas Regulamentadoras (NRs).
                </p>
              </div>

              {/* Cards Resumo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div style={{ backgroundColor: lightGreenBg }} className="p-3 rounded-xl border border-emerald-900/10">
                  <span className="text-[9px] font-bold uppercase text-slate-600 block">Tema / Treinamento</span>
                  <p className="text-xs font-bold text-slate-900 mt-0.5">{meeting.topic}</p>
                </div>
                <div style={{ backgroundColor: lightGreenBg }} className="p-3 rounded-xl border border-emerald-900/10">
                  <span className="text-[9px] font-bold uppercase text-slate-600 block">Data e Carga Horária</span>
                  <p className="text-xs font-bold text-slate-900 mt-0.5">{dateStr}</p>
                </div>
                <div style={{ backgroundColor: lightGreenBg }} className="p-3 rounded-xl border border-emerald-900/10">
                  <span className="text-[9px] font-bold uppercase text-slate-600 block">Local / Unidade</span>
                  <p className="text-xs font-bold text-slate-900 mt-0.5">{meeting.farm}</p>
                </div>
                <div style={{ backgroundColor: lightGreenBg }} className="p-3 rounded-xl border border-emerald-900/10">
                  <span className="text-[9px] font-bold uppercase text-slate-600 block">Instrutor / Responsável Técnico</span>
                  <p className="text-xs font-bold text-slate-900 mt-0.5">{meeting.instructorName || meeting.organizer?.name || 'Responsável Técnico'}</p>
                </div>
              </div>

              {/* 1. Objetivo */}
              <div style={{ backgroundColor: lightGreenBg }} className="p-4 rounded-2xl border border-emerald-900/10 space-y-1">
                <h3 style={{ color: darkGreen }} className="text-xs font-bold uppercase tracking-wider">
                  1. OBJETIVO DO TREINAMENTO
                </h3>
                <p className="text-xs text-slate-800 leading-relaxed font-medium">
                  {meeting.objective || 'Orientação, instrução normativa e conscientização operacional conforme as diretrizes de Segurança e Saúde no Trabalho.'}
                </p>
              </div>

              {/* 2. Conteúdo Programático */}
              <div style={{ backgroundColor: lightGreenBg }} className="p-4 rounded-2xl border border-emerald-900/10 space-y-1">
                <h3 style={{ color: darkGreen }} className="text-xs font-bold uppercase tracking-wider">
                  2. CONTEÚDO PROGRAMÁTICO & MÓDULOS MINISTRADOS
                </h3>
                <p className="text-xs text-slate-800 leading-relaxed font-medium whitespace-pre-line">
                  {rawContent || '1. Módulo Geral: Conceitos e Diretrizes de Segurança do Trabalho e NRs aplicáveis.\n2. Módulo Específico: Procedimentos Operacionais Padrão (POP), Análise Preliminar de Risco (APR) e uso correto de EPIs.\n3. Módulo Prático: Condutas Preventivas, Primeiros Socorros e Prática Operacional.'}
                </p>
              </div>

              {/* 3. Declaração do Responsável & Linha de Assinatura */}
              <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-50/50 space-y-4">
                <div>
                  <h3 style={{ color: darkGreen }} className="text-xs font-bold uppercase tracking-wider">
                    3. DECLARAÇÃO DO RESPONSÁVEL PELA APLICAÇÃO
                  </h3>
                  <p className="text-[11px] text-slate-600 italic mt-1 leading-relaxed">
                    Declaro para os devidos fins de registro de Segurança e Saúde no Trabalho que os conteúdos e orientações de segurança foram ministrados aos colaboradores listados nesta lista de presença, com base nas diretrizes internas de prevenção de acidentes da empresa.
                  </p>
                </div>

                <div className="pt-6 text-center space-y-1">
                  <div className="w-64 mx-auto border-t border-slate-400"></div>
                  <p className="text-xs font-bold text-slate-900">
                    {meeting.instructorName || meeting.organizer?.name || 'Responsável Técnico / Instrutor'}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Responsável pela Aplicação do DDS
                  </p>
                </div>
              </div>

              {/* Rodapé Página 2 */}
              <div className="pt-4 mt-auto border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-500 gap-1 font-sans">
                <div>
                  <p>Documento de registro e evidência de SST emitido pelo <strong>DDS ON</strong></p>
                  <p className="text-[9px] text-slate-400">© 2026 AM TST • DDS ON é uma plataforma da AM TST</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">Página 2 de {totalEstimatedPages}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* PÁGINA 3+: EVIDÊNCIAS & MATERIAIS APRESENTADOS (ANEXOS)             */}
        {/* =================================================================== */}
        {attachmentsList.length > 0 && (
          <>
            {/* Índice Geral de Evidências (exibido apenas quando houver mais de 2 anexos para evitar desperdício de página) */}
            {attachmentsList.length > 2 && (
              <div 
                className={`w-full max-w-[210mm] bg-white text-slate-900 shadow-2xl rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-200 transition-all flex flex-col ${
                  viewMode === 'A4_PAGES' ? 'min-h-[297mm]' : ''
                }`}
              >
                <div style={{ backgroundColor: darkGreen }} className="p-4 sm:p-5 text-white flex items-center justify-between gap-4">
                  <div>
                    <span className="text-xl sm:text-2xl font-black tracking-tight">DDS ON</span>
                    <p className="text-[10px] text-emerald-100 font-medium mt-0.5">
                      DOSSIÊ DE EVIDÊNCIAS & MATERIAIS APRESENTADOS
                    </p>
                  </div>
                  <span className="text-xs bg-white/20 px-3 py-1 rounded-full font-bold">
                    {attachmentsList.length} anexos
                  </span>
                </div>

                <div className="p-4 sm:p-6 space-y-4 flex-1 flex flex-col">
                  <div className="border-b border-slate-200 pb-2">
                    <h2 className="text-base sm:text-lg font-black text-slate-900 uppercase">
                      ÍNDICE GERAL DE EVIDÊNCIAS E ANEXOS
                    </h2>
                    <p className="text-xs text-slate-500">
                      Comprovação documental dos arquivos, cartilhas, imagens e procedimentos exibidos durante o DDS.
                    </p>
                  </div>

                  {/* Tabela Índice de Anexos */}
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-800 font-bold text-[10px] uppercase">
                          <th className="p-2.5 text-center w-16">Anexo</th>
                          <th className="p-2.5">Nome do Material</th>
                          <th className="p-2.5 text-center">Formato</th>
                          <th className="p-2.5 text-center">Tamanho</th>
                          <th className="p-2.5">Descrição / Observação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[11px]">
                        {attachmentsList.map((att, idx) => {
                          const isPdf = att.mimeType === 'application/pdf' || att.fileName.toLowerCase().endsWith('.pdf');
                          const sizeStr = att.fileSize < 1024 * 1024 
                            ? `${(att.fileSize / 1024).toFixed(1)} KB` 
                            : `${(att.fileSize / (1024 * 1024)).toFixed(2)} MB`;

                          return (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="p-2.5 text-center font-bold text-emerald-800 font-mono">
                                {String(idx + 1).padStart(2, '0')}
                              </td>
                              <td className="p-2.5 font-bold text-slate-900">
                                {att.displayName || att.fileName}
                              </td>
                              <td className="p-2.5 text-center font-medium">
                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isPdf ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900'
                                }`}>
                                  {isPdf ? `PDF (${att.pageCount || 1} pág)` : 'IMAGEM'}
                                </span>
                              </td>
                              <td className="p-2.5 text-center text-slate-500 font-mono text-[10px]">
                                {sizeStr}
                              </td>
                              <td className="p-2.5 text-slate-600">
                                {att.description || 'Material apresentado aos participantes'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Renderização Visual de cada Anexo */}

            {/* Renderização Visual de cada Anexo */}
            {attachmentsList.map((att, idx) => {
              const isPdf = att.mimeType === 'application/pdf' || att.fileName.toLowerCase().endsWith('.pdf');
              const anexoNumber = String(idx + 1).padStart(2, '0');
              const pageNum = (shouldRenderVerso ? 3 : 2) + 1 + idx;

              return (
                <div 
                  key={idx}
                  className={`w-full max-w-[210mm] bg-white text-slate-900 shadow-2xl rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-200 transition-all flex flex-col ${
                    viewMode === 'A4_PAGES' ? 'min-h-[297mm]' : ''
                  }`}
                >
                  <div style={{ backgroundColor: darkGreen }} className="p-3.5 sm:p-4 text-white flex items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
                        ANEXO {anexoNumber}
                      </span>
                      <h3 className="text-sm sm:text-base font-bold text-white truncate">
                        {att.displayName || att.fileName}
                      </h3>
                    </div>
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-bold uppercase">
                      {isPdf ? 'Documento PDF' : 'Imagem / Foto'}
                    </span>
                  </div>

                  <div className="p-4 sm:p-6 space-y-4 flex-1 flex flex-col">
                    {/* Card de Legenda */}
                    {att.description && (
                      <div style={{ backgroundColor: lightGreenBg }} className="p-3 rounded-xl border border-emerald-900/10 text-xs">
                        <strong className="text-emerald-900">Observação Técnica: </strong>
                        <span className="text-slate-800 italic">{att.description}</span>
                      </div>
                    )}

                    {/* Conteúdo: Imagem ou Separador de PDF */}
                    {!isPdf ? (
                      <div className="flex-1 flex items-center justify-center p-2">
                        <img
                          src={att.fileData}
                          alt={att.fileName}
                          onClick={() => setZoomImage(att.fileData)}
                          className="max-h-[180mm] max-w-full object-contain rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:scale-101 transition-transform"
                          title="Clique para ampliar"
                        />
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-3">
                        <div className="p-4 bg-rose-100 text-rose-700 rounded-3xl">
                          <FileText size={48} />
                        </div>
                        <h4 className="text-base font-bold text-slate-900">{att.fileName}</h4>
                        <p className="text-xs text-slate-600 max-w-md">
                          Documento PDF original de <strong>{att.pageCount || 1} página(s)</strong> vinculado a esta sessão de DDS.
                        </p>
                        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                          <CheckCircle2 size={16} />
                          <span>As páginas deste documento são mescladas no relatório final em qualidade vetorial integral.</span>
                        </div>
                        <a
                          href={att.fileData}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                        >
                          <ExternalLink size={14} />
                          <span>Abrir PDF em nova aba</span>
                        </a>
                      </div>
                    )}

                    {/* Rodapé do Anexo */}
                    <div className="pt-4 mt-auto border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
                      <p>Anexo oficial integrante do Dossiê DDS ON</p>
                      <p className="font-bold">Página {pageNum} de {totalEstimatedPages}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Modal de Zoom de Imagem */}
      {zoomImage && (
        <div 
          onClick={() => setZoomImage(null)}
          className="fixed inset-0 z-[100000] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in duration-150"
        >
          <div className="relative max-w-5xl max-h-[90dvh] flex flex-col items-center">
            <img src={zoomImage} alt="Zoom" className="max-w-full max-h-[85dvh] object-contain rounded-2xl shadow-2xl border border-slate-800" />
            <button
              type="button"
              onClick={() => setZoomImage(null)}
              className="mt-3 px-4 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-full hover:bg-slate-700"
            >
              Clique em qualquer lugar para fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
