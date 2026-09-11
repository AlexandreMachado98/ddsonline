'use client';

import React, { useState } from 'react';
import { 
  X, Download, Eye, FileText, CheckCircle2, 
  MapPin, Calendar, Users, FileCheck2, 
  Printer, ArrowLeft, Loader2, Sparkles, 
  Check, FileSpreadsheet, LayoutList, FileImage, 
  AlertCircle, ExternalLink, Image as ImageIcon,
  ShieldCheck, Award
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { generateDdsPdf, MeetingData, parseGroupPhotos } from '@/lib/pdfGenerator';

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

  // Cores institucionais do DDS ON (alinhadas aos prints oficiais)
  const brandDarkGreen = '#006341';
  const brandHeaderGreen = '#005034';
  const brandAccentGreen = '#2ecc71';
  const brandMintBg = '#eef7f2';

  // Formatação de data/hora
  const ddsDate = new Date(meeting.createdAt || Date.now());
  const endDate = meeting.endedAt ? new Date(meeting.endedAt) : null;
  let dateFormattedStr = ddsDate.toLocaleDateString('pt-BR') + ', ' + ddsDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (endDate) {
    dateFormattedStr = ddsDate.toLocaleDateString('pt-BR') + ', ' + ddsDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + ' até ' + endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  // Código de verificação
  const verificationCode = `DDS-${ddsDate.getFullYear()}${String(ddsDate.getMonth() + 1).padStart(2, '0')}${String(ddsDate.getDate()).padStart(2, '0')}-${String(ddsDate.getHours()).padStart(2, '0')}${String(ddsDate.getMinutes()).padStart(2, '0')}${String(ddsDate.getSeconds()).padStart(2, '0')}`;

  // Logo da empresa do localStorage se houver
  const companyLogo = typeof window !== 'undefined' ? localStorage.getItem('dds_company_logo') : null;

  // Lista de participantes e anexos
  const attendeesList = meeting.attendees || [];
  const attachmentsList = (meeting.attachments || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));

  // Verso condicional (Conteúdo Programático ou Treinamento ou Campanha)
  const rawContent = (meeting.programmaticContent || '').trim();
  const shouldRenderVerso = rawContent.length > 0 || meeting.classification === 'Treinamento' || meeting.classification === 'Campanha';

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
                Pré-Visualização da Ata de Conformidade
              </h2>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                {meeting.classification || 'DDS'}
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
              📍 {meeting.farm} • {dateFormattedStr} • <strong className="text-emerald-400">{attendeesList.length} presentes</strong>
            </p>
          </div>
        </div>

        {/* Ações da Topbar */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Alternar Modo de Visualização */}
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

      {/* Área de Visualização com Scroll */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 bg-slate-950/80 flex flex-col items-center gap-6">
        
        {/* Banner Informativo de Pré-visualização */}
        <div className="w-full max-w-[210mm] bg-emerald-950/60 border border-emerald-500/30 rounded-2xl p-3 sm:p-4 text-xs text-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2.5">
            <FileCheck2 size={20} className="text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold text-white text-xs sm:text-sm">Documento de Auditoria Conforme Referência Visual</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Layout oficial com cabeçalho institucional, grade de metadados, lista de presença com biometria facial, assinaturas e certificação de auditoria.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{totalEstimatedPages} {totalEstimatedPages === 1 ? 'página' : 'páginas'}</span>
            <span className="text-slate-500">•</span>
            <span>{attendeesList.length} presenças</span>
          </div>
        </div>

        {/* =================================================================== */}
        {/* PÁGINA 1: FRENTE - REGISTRO DE CONFORMIDADE, PRESENÇA E AUDITORIA   */}
        {/* =================================================================== */}
        <div 
          className={`w-full max-w-[210mm] bg-white text-slate-900 shadow-2xl rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-200 transition-all flex flex-col ${
            viewMode === 'A4_PAGES' ? 'min-h-[297mm]' : ''
          }`}
        >
          {/* Header Faixa Verde Escura Institucional */}
          <div style={{ backgroundColor: brandHeaderGreen }} className="relative px-6 py-5 text-white flex items-center justify-between border-b-2 border-emerald-400">
            <div className="flex items-center gap-3">
              <div className="h-10 w-auto flex items-center">
                <img src="/logo.png" alt="DDS ON" className="h-10 w-auto object-contain" />
              </div>
            </div>

            {/* Slogan Cursivo ou Logo da Empresa */}
            {companyLogo ? (
              <div className="bg-white p-1.5 rounded-xl shadow-sm max-w-[140px] max-h-[50px] flex items-center justify-center">
                <img src={companyLogo} alt="Logo da Empresa" className="max-h-9 max-w-full object-contain" />
              </div>
            ) : (
              <div className="text-right">
                <p className="font-serif italic text-emerald-200 text-xs sm:text-sm leading-tight">
                  Pessoas seguras<br/>
                  constroem grandes<br/>
                  <strong className="not-italic font-sans font-black text-emerald-100 text-sm sm:text-base">resultados</strong>
                </p>
              </div>
            )}
          </div>

          {/* Conteúdo da Página 1 */}
          <div className="p-6 sm:p-8 space-y-5 flex-1 flex flex-col">
            
            {/* Título Principal Editorial (Idêntico ao Print) */}
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight uppercase">
                REGISTRO DE CONFORMIDADE,<br />
                PRESENÇA E AUDITORIA
              </h1>
              <p className="text-xs text-slate-500 mt-1 font-normal">
                {meeting.classification === 'Treinamento'
                  ? 'Documento que comprova a realização do Treinamento Obrigatório (SST)'
                  : meeting.classification === 'Campanha'
                  ? 'Documento que comprova a realização da Campanha de Segurança e Saúde (SST)'
                  : 'Documento que comprova a realização do Diálogo Diário de Segurança (DDS)'}
              </p>
            </div>

            {/* Seção de Metadados: 2x2 Grid + Card Total Registrado */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              {/* Grid 2x2 Esquerdo */}
              <div style={{ backgroundColor: brandMintBg }} className="md:col-span-8 rounded-2xl p-4 border border-emerald-200/60 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Tema */}
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-lg bg-emerald-700 text-white shrink-0 mt-0.5">
                    <FileText size={14} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-slate-800 uppercase block">
                      {meeting.classification === 'Treinamento' ? 'Tema do Treinamento' : meeting.classification === 'Campanha' ? 'Tema da Campanha' : 'Tema do DDS'}
                    </span>
                    <p className="text-xs font-semibold text-slate-900 truncate mt-0.5" title={meeting.topic}>
                      {meeting.topic || 'Não informado'}
                    </p>
                  </div>
                </div>

                {/* 2. Modalidade */}
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-lg bg-emerald-700 text-white shrink-0 mt-0.5">
                    <Users size={14} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-slate-800 uppercase block">Modalidade</span>
                    <p className="text-xs font-semibold text-slate-900 mt-0.5">
                      {meeting.type === 'PRESENTIAL' ? 'Presencial (Canteiro/Galpão)' : 'Remoto / EAD'}
                    </p>
                  </div>
                </div>

                {/* 3. Local / Fazenda */}
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-lg bg-emerald-700 text-white shrink-0 mt-0.5">
                    <MapPin size={14} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-slate-800 uppercase block">Local / Fazenda</span>
                    <p className="text-xs font-semibold text-slate-900 truncate mt-0.5" title={meeting.farm}>
                      {meeting.farm || 'Não informado'}
                    </p>
                  </div>
                </div>

                {/* 4. Data e Horário */}
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-lg bg-emerald-700 text-white shrink-0 mt-0.5">
                    <Calendar size={14} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-slate-800 uppercase block">Data e Horário</span>
                    <p className="text-xs font-semibold text-slate-900 mt-0.5">
                      {dateFormattedStr}
                    </p>
                  </div>
                </div>
              </div>

              {/* Card Total Registrado na Direita */}
              <div style={{ backgroundColor: brandMintBg }} className="md:col-span-4 rounded-2xl p-4 border border-emerald-200/60 flex flex-col items-center justify-center text-center">
                <div className="text-emerald-800 mb-1">
                  <Users size={22} />
                </div>
                <span className="text-xs font-bold text-emerald-900 uppercase tracking-wide">
                  Total Registrado
                </span>
                <span style={{ color: brandDarkGreen }} className="text-3xl sm:text-4xl font-black my-0.5 leading-none">
                  {attendeesList.length}
                </span>
                <span className="text-[11px] text-slate-500 font-medium">colaborador(es)</span>
              </div>
            </div>

            {/* Objetivo do DDS (se informado) */}
            {meeting.objective && (
              <div style={{ backgroundColor: brandMintBg }} className="border-l-4 border-l-emerald-700 rounded-r-2xl p-3.5 border border-emerald-200/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 block mb-0.5">
                  Objetivo Específico:
                </span>
                <p className="text-xs text-slate-800 leading-relaxed font-normal">
                  {meeting.objective}
                </p>
              </div>
            )}

            {/* Tabela de Presença com Barra Verde Superior */}
            <div className="space-y-0 pt-1">
              <div style={{ backgroundColor: brandDarkGreen }} className="px-4 py-2.5 rounded-t-xl text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-sm">
                <Users size={16} />
                <span>LISTA DE PRESENÇA</span>
              </div>

              {attendeesList.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs border border-t-0 border-slate-200 rounded-b-xl bg-slate-50/50">
                  Nenhum participante registrado nesta reunião.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-b-xl border border-t-0 border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr style={{ backgroundColor: brandMintBg }} className="border-b border-emerald-200/70 text-slate-800 font-bold text-[10px] uppercase">
                        <th className="p-2.5 text-center w-8">#</th>
                        <th className="p-2.5">Nome Completo</th>
                        <th className="p-2.5">CPF</th>
                        <th className="p-2.5 text-center">Entrada</th>
                        <th className="p-2.5 text-center">Status / Saída</th>
                        <th className="p-2.5 text-center w-20">Biometria</th>
                        <th className="p-2.5 text-center w-32">Assinatura Digital</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px]">
                      {attendeesList.map((attendee, idx) => {
                        const isEarlyExit = Boolean(attendee.exitReason);

                        return (
                          <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-2.5 text-center font-mono font-bold text-slate-500">
                              {idx + 1}
                            </td>
                            <td className="p-2.5 font-bold text-slate-900">
                              {attendee.name.replace(/\(Saída:.*\)/, '').trim()}
                            </td>
                            <td className="p-2.5 text-slate-600 font-medium">
                              {attendee.cpf || '-'}
                            </td>
                            <td className="p-2.5 text-center font-mono text-slate-600">
                              {new Date(attendee.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="p-2.5 text-center">
                              {isEarlyExit ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-bold text-[9px] border border-rose-200">
                                  <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                                  SAÍDA ANTECIPADA
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[9px] border border-emerald-200">
                                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 flex items-center justify-center text-white text-[7px]">✓</span>
                                  PRESENTE ATÉ O FIM
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-center">
                              {attendee.selfie ? (
                                <img
                                  src={attendee.selfie}
                                  alt={attendee.name}
                                  onClick={() => setZoomImage(attendee.selfie || null)}
                                  className="w-10 h-10 rounded-xl object-cover mx-auto border border-slate-300 cursor-pointer hover:scale-105 transition-transform shadow-xs"
                                  title="Clique para ampliar"
                                />
                              ) : (
                                <span className="text-slate-300 text-[10px]">-</span>
                              )}
                            </td>
                            <td className="p-2.5 text-center">
                              {attendee.signature ? (
                                <div 
                                  onClick={() => setZoomImage(attendee.signature || null)}
                                  className="h-10 max-w-[120px] mx-auto flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity bg-slate-50/50 rounded-lg border border-slate-200 p-0.5"
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

            {/* Card de Conclusão / Certificação (Idêntico ao Print) */}
            <div style={{ backgroundColor: brandMintBg }} className="rounded-2xl p-4 border border-emerald-200/70 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Check size={20} strokeWidth={3} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-xs sm:text-sm">Registro concluído com sucesso!</h4>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Este documento atesta a presença dos colaboradores no DDS, conforme os dados registrados no sistema DDS ON.
                  </p>
                </div>
              </div>

              <div className="hidden sm:block h-10 w-[1px] bg-emerald-300/60 shrink-0"></div>

              <div className="text-right shrink-0">
                <p className="italic text-slate-700 text-xs font-serif">
                  "Segurança não é um custo,<br />é um investimento na vida."
                </p>
                <div className="w-20 h-0.5 bg-emerald-500 rounded-full ml-auto mt-1"></div>
              </div>
            </div>

            {/* Fotos da Equipe (Evidências de Campo em Grade) */}
            {(() => {
              const photos = parseGroupPhotos(meeting.groupPhoto);
              if (photos.length === 0) return null;
              return (
                <div className="pt-2 text-center space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
                    Fotos da Equipe (Registro Fotográfico de Campo • {photos.length} {photos.length === 1 ? 'Evidência' : 'Evidências'})
                  </span>
                  <div className={`grid gap-3 max-w-3xl mx-auto ${photos.length === 1 ? 'grid-cols-1 max-w-md' : 'grid-cols-1 sm:grid-cols-2'}`}>
                    {photos.map((photoUrl: string, pIdx: number) => (
                      <div 
                        key={pIdx}
                        onClick={() => setZoomImage(photoUrl)}
                        className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm cursor-pointer group relative bg-slate-950 aspect-video flex items-center justify-center"
                        title="Clique para ampliar foto"
                      >
                        <img src={photoUrl} alt={`Foto da Equipe #${pIdx + 1}`} className="w-full h-full object-contain group-hover:scale-102 transition-transform" />
                        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-white text-[9px] font-bold px-2 py-0.5 rounded-md">
                          Evidência #{pIdx + 1}
                        </div>
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold gap-1">
                          <Eye size={14} /> Ampliar
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Rodapé Oficial da Página 1 (Idêntico ao Print) */}
            <div className="pt-4 mt-auto border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-600 gap-2 font-sans">
              <div className="flex items-center gap-3">
                <div className="p-1 bg-white border border-slate-200 rounded-lg">
                  <QRCodeSVG 
                    value={`DDS-ON-VERIFY:${verificationCode}`}
                    size={42}
                  />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-xs">Documento oficial de auditoria</p>
                  <p className="text-[10px] text-slate-500">emitido digitalmente pelo DDS ON</p>
                  <p className="text-[10px] font-bold text-emerald-800">Desenvolvido e Auditado por AM TST</p>
                </div>
              </div>

              <div className="text-right text-[10px] text-slate-500 space-y-0.5">
                <p className="font-bold text-slate-800 text-xs">Página 1 de {totalEstimatedPages}</p>
                <p>{dateFormattedStr}</p>
                <p className="font-mono text-slate-400">Código de verificação: {verificationCode}</p>
              </div>
            </div>

            {/* Faixa Verde Inferior com Slogan */}
            <div style={{ backgroundColor: brandHeaderGreen }} className="-mx-6 sm:-mx-8 -mb-6 sm:-mb-8 py-2 text-center text-white text-[10px] font-bold tracking-wider">
              DDS ON &nbsp;|&nbsp; MAIS SEGURANÇA, MAIS PESSOAS, MAIS FUTURO
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
            <div style={{ backgroundColor: brandHeaderGreen }} className="px-6 py-5 text-white flex items-center justify-between border-b-2 border-emerald-400">
              <div className="flex items-center gap-3">
                <div className="h-9 w-auto flex items-center">
                  <img src="/logo.png" alt="DDS ON" className="h-9 w-auto object-contain" />
                </div>
                <div>
                  <span className="text-base sm:text-lg font-black tracking-tight">DDS ON</span>
                  <p className="text-[10px] text-emerald-200 uppercase font-medium">
                    {meeting.classification === 'Campanha' ? 'PROGRAMAÇÃO E DETALHAMENTO DA CAMPANHA' : 'PROGRAMAÇÃO E CONTEÚDO PROGRAMÁTICO DO TREINAMENTO'}
                  </p>
                </div>
              </div>
              {companyLogo && (
                <div className="bg-white p-1 rounded-xl max-w-[120px] max-h-[40px] flex items-center justify-center">
                  <img src={companyLogo} alt="Logo" className="max-h-7 max-w-full object-contain" />
                </div>
              )}
            </div>

            <div className="p-6 sm:p-8 space-y-4 flex-1 flex flex-col">
              <div className="border-b border-slate-200 pb-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 uppercase">
                  {meeting.classification === 'Campanha' ? 'PROGRAMAÇÃO & AÇÕES DA CAMPANHA' : 'CONTEÚDO PROGRAMÁTICO & METODOLOGIA'}
                </h2>
                <p className="text-xs text-slate-500">
                  {meeting.classification === 'Campanha' ? 'Detalhamento das ações de conscientização, dinâmicas e diretrizes de Segurança e Saúde (SST).' : 'Detalhamento pedagógico e normativo em conformidade com as Normas Regulamentadoras (NRs).'}
                </p>
              </div>

              {/* Cards Resumo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div style={{ backgroundColor: brandMintBg }} className="p-3 rounded-xl border border-emerald-200/60">
                  <span className="text-[9px] font-bold uppercase text-slate-600 block">{meeting.classification === 'Campanha' ? 'Tema / Campanha' : 'Tema / Treinamento'}</span>
                  <p className="text-xs font-bold text-slate-900 mt-0.5">{meeting.topic}</p>
                </div>
                <div style={{ backgroundColor: brandMintBg }} className="p-3 rounded-xl border border-emerald-200/60">
                  <span className="text-[9px] font-bold uppercase text-slate-600 block">Data e Horário</span>
                  <p className="text-xs font-bold text-slate-900 mt-0.5">{dateFormattedStr}</p>
                </div>
                <div style={{ backgroundColor: brandMintBg }} className="p-3 rounded-xl border border-emerald-200/60">
                  <span className="text-[9px] font-bold uppercase text-slate-600 block">Local / Unidade</span>
                  <p className="text-xs font-bold text-slate-900 mt-0.5">{meeting.farm}</p>
                </div>
                <div style={{ backgroundColor: brandMintBg }} className="p-3 rounded-xl border border-emerald-200/60">
                  <span className="text-[9px] font-bold uppercase text-slate-600 block">Instrutor / Responsável Técnico</span>
                  <p className="text-xs font-bold text-slate-900 mt-0.5">{meeting.instructorName || meeting.organizer?.name || 'Responsável Técnico'}</p>
                </div>
              </div>

              {/* 1. Objetivo */}
              {meeting.objective && (
                <div style={{ backgroundColor: brandMintBg }} className="p-4 rounded-2xl border border-emerald-200/60 space-y-1">
                  <h3 style={{ color: brandDarkGreen }} className="text-xs font-bold uppercase tracking-wider">
                    {meeting.classification === 'Campanha' ? '1. OBJETIVO DA CAMPANHA' : '1. OBJETIVO DO TREINAMENTO'}
                  </h3>
                  <p className="text-xs text-slate-800 leading-relaxed font-medium">
                    {meeting.objective}
                  </p>
                </div>
              )}

              {/* 2. Conteúdo Programático */}
              {rawContent && (
                <div style={{ backgroundColor: brandMintBg }} className="p-4 rounded-2xl border border-emerald-200/60 space-y-1">
                  <h3 style={{ color: brandDarkGreen }} className="text-xs font-bold uppercase tracking-wider">
                    {meeting.classification === 'Campanha' ? '2. PROGRAMAÇÃO E AÇÕES DA CAMPANHA' : '2. CONTEÚDO PROGRAMÁTICO & MÓDULOS MINISTRADOS'}
                  </h3>
                  <p className="text-xs text-slate-800 leading-relaxed font-medium whitespace-pre-line">
                    {rawContent}
                  </p>
                </div>
              )}

              {/* 3. Declaração do Responsável & Linha de Assinatura */}
              <div className="p-4 rounded-2xl border border-emerald-500/30 bg-white space-y-4">
                <div>
                  <h3 style={{ color: brandDarkGreen }} className="text-xs font-bold uppercase tracking-wider">
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
                    Responsável pela Aplicação
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
            {attachmentsList.length > 2 && (
              <div 
                className={`w-full max-w-[210mm] bg-white text-slate-900 shadow-2xl rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-200 transition-all flex flex-col ${
                  viewMode === 'A4_PAGES' ? 'min-h-[297mm]' : ''
                }`}
              >
                <div style={{ backgroundColor: brandHeaderGreen }} className="px-6 py-5 text-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img src="/logo.png" alt="DDS ON" className="h-9 w-auto object-contain" />
                    <div>
                      <span className="text-lg font-black tracking-tight">DDS ON</span>
                      <p className="text-[10px] text-emerald-200 font-medium">
                        DOSSIÊ DE EVIDÊNCIAS & MATERIAIS APRESENTADOS
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6 sm:p-8 space-y-4 flex-1 flex flex-col">
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-slate-900 uppercase">
                      ÍNDICE GERAL DE EVIDÊNCIAS E ANEXOS
                    </h2>
                    <p className="text-xs text-slate-500">
                      Comprovação documental dos arquivos, cartilhas, imagens e procedimentos exibidos durante o DDS.
                    </p>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr style={{ backgroundColor: brandMintBg }} className="border-b border-emerald-200/70 text-slate-800 font-bold text-[10px] uppercase">
                          <th className="p-2.5 text-center w-12">#</th>
                          <th className="p-2.5">Nome do Material</th>
                          <th className="p-2.5 text-center">Formato</th>
                          <th className="p-2.5 text-center">Tamanho</th>
                          <th className="p-2.5">Descrição Técnica</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[11px]">
                        {attachmentsList.map((att, aIdx) => {
                          const isPdf = att.mimeType === 'application/pdf' || att.fileName.toLowerCase().endsWith('.pdf');
                          const sizeStr = att.fileSize < 1024 * 1024 
                            ? `${(att.fileSize / 1024).toFixed(1)} KB` 
                            : `${(att.fileSize / (1024 * 1024)).toFixed(2)} MB`;

                          return (
                            <tr key={aIdx} className="hover:bg-slate-50/80">
                              <td className="p-2.5 text-center font-bold text-emerald-800 font-mono">
                                {String(aIdx + 1).padStart(2, '0')}
                              </td>
                              <td className="p-2.5 font-bold text-slate-900">
                                {att.displayName || att.fileName}
                              </td>
                              <td className="p-2.5 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold ${isPdf ? 'bg-rose-100 text-rose-800' : 'bg-sky-100 text-sky-800'}`}>
                                  {isPdf ? `PDF (${att.pageCount || 1} pág)` : 'IMAGEM'}
                                </span>
                              </td>
                              <td className="p-2.5 text-center font-mono text-slate-600">
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

            {/* Páginas Individuais de Anexos */}
            {attachmentsList.map((att, aIdx) => {
              const isPdf = att.mimeType === 'application/pdf' || att.fileName.toLowerCase().endsWith('.pdf');
              const anexoNumber = String(aIdx + 1).padStart(2, '0');

              return (
                <div 
                  key={aIdx}
                  className={`w-full max-w-[210mm] bg-white text-slate-900 shadow-2xl rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-200 transition-all flex flex-col ${
                    viewMode === 'A4_PAGES' ? 'min-h-[297mm]' : ''
                  }`}
                >
                  <div style={{ backgroundColor: brandHeaderGreen }} className="px-6 py-4 text-white flex items-center justify-between">
                    <div>
                      <span className="text-xs uppercase font-bold text-emerald-300">ANEXO {anexoNumber}</span>
                      <h3 className="text-sm sm:text-base font-black text-white truncate max-w-md">
                        {att.displayName || att.fileName}
                      </h3>
                    </div>
                  </div>

                  <div className="p-6 flex-1 flex flex-col">
                    {att.description && (
                      <div style={{ backgroundColor: brandMintBg }} className="p-3 rounded-xl border border-emerald-200/60 mb-4 text-xs">
                        <strong className="text-emerald-900">Observação: </strong>
                        <span className="text-slate-800">{att.description}</span>
                      </div>
                    )}

                    <div className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center p-4 overflow-hidden">
                      {isPdf ? (
                        <div className="text-center p-6 space-y-2">
                          <FileText size={48} className="mx-auto text-emerald-700" />
                          <p className="font-bold text-slate-900 text-sm">{att.fileName}</p>
                          <p className="text-xs text-slate-500">Documento PDF Oficial ({att.pageCount || 1} páginas)</p>
                          <p className="text-[11px] text-emerald-800 font-semibold">✓ Páginas mescladas em alta definição no PDF final</p>
                        </div>
                      ) : (
                        <img 
                          src={att.fileData} 
                          alt={att.fileName} 
                          className="max-h-[600px] max-w-full object-contain rounded-xl shadow-md cursor-pointer hover:scale-102 transition-transform"
                          onClick={() => setZoomImage(att.fileData)}
                          title="Clique para ampliar"
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Modal de Zoom de Imagens */}
      {zoomImage && (
        <div 
          onClick={() => setZoomImage(null)}
          className="fixed inset-0 z-[100000] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in"
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img src={zoomImage} alt="Zoom" className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/20" />
            <button 
              onClick={() => setZoomImage(null)}
              className="absolute top-3 right-3 p-2 bg-black/70 hover:bg-black text-white rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
