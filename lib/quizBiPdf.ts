// lib/quizBiPdf.ts
// Gerador Oficial de Relatórios Consolidado de Business Intelligence (BI) e Histórico de Questionários

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface GenerateBiReportParams {
  periodLabel: string;
  organizerName?: string;
  companyName?: string;
  indicators: {
    totalQuizzesCreated: number;
    totalQuizzesPublished: number;
    totalQuizzesClosed: number;
    totalQuizzesInProgress: number;
    totalAttempts: number;
    uniqueParticipantsCount: number;
    overallAverageScore: number;
    approvalRate: number;
    criticalPerformancesCount: number;
    participationRate: number;
  };
  quizzes: Array<{
    title: string;
    status: string;
    meetingTopic?: string | null;
    meetingFarm?: string | null;
    createdAt: string;
    totalAttempts: number;
    totalParticipants: number;
    averageScore: number;
    approvalRate: number;
  }>;
  fragilities?: Array<{
    questionText: string;
    errorRate: number;
    correctOptionText: string;
    mostCommonWrongText?: string;
    actionPlan: string;
  }>;
  generatedAt?: Date;
}

export async function generateBiConsolidatedPdf(params: GenerateBiReportParams): Promise<jsPDF> {
  const {
    periodLabel,
    organizerName = 'Gestor de Segurança do Trabalho',
    companyName = 'DDS Online',
    indicators,
    quizzes,
    fragilities = [],
    generatedAt = new Date()
  } = params;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let currentY = margin;

  // Paleta de Cores DDS Online
  const primaryDark: [number, number, number] = [15, 23, 42];     // slate-900
  const emeraldAccent: [number, number, number] = [16, 185, 129]; // emerald-500
  const textDark: [number, number, number] = [30, 41, 59];       // slate-800
  const textMuted: [number, number, number] = [100, 116, 139];   // slate-500

  // 1. Cabeçalho Corporativo
  doc.setFillColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 28, 3, 3, 'F');

  doc.setFillColor(emeraldAccent[0], emeraldAccent[1], emeraldAccent[2]);
  doc.rect(margin, currentY, 3.5, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.text('DDS ONLINE • RELATÓRIO EXECUTIVO DE BI & APRENDIZAGEM', margin + 8, currentY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`Período de Análise: ${periodLabel} • Empresa: ${companyName}`, margin + 8, currentY + 17);
  doc.text(`Responsável: ${organizerName} • Emissão: ${generatedAt.toLocaleString('pt-BR')}`, margin + 8, currentY + 23);

  currentY += 34;

  // 2. Painel de Indicadores Gerais (Cards KPI)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.text('1. INDICADORES CONSOLIDADOS DO PERÍODO', margin, currentY);

  currentY += 4;

  const kpis = [
    { title: 'Aproveitamento Médio', value: `${indicators.overallAverageScore}%` },
    { title: 'Taxa de Aprovação', value: `${indicators.approvalRate}%` },
    { title: 'Respostas Recebidas', value: `${indicators.totalAttempts}` },
    { title: 'Participantes Únicos', value: `${indicators.uniqueParticipantsCount}` },
    { title: 'Questionários Ativos', value: `${indicators.totalQuizzesInProgress}` },
    { title: 'Questionários Concluídos', value: `${indicators.totalQuizzesClosed}` },
    { title: 'Desempenhos Críticos', value: `${indicators.criticalPerformancesCount}` },
    { title: 'Taxa de Participação', value: `${indicators.participationRate}%` }
  ];

  const colWidth = (pageWidth - margin * 2) / 4;
  const cardHeight = 16;

  kpis.forEach((kpi, index) => {
    const row = Math.floor(index / 4);
    const col = index % 4;
    const x = margin + col * colWidth;
    const y = currentY + row * (cardHeight + 3);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, colWidth - 2.5, cardHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(kpi.title.toUpperCase(), x + 3, y + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
    doc.text(kpi.value, x + 3, y + 12);
  });

  currentY += 2 * (cardHeight + 3) + 6;

  // 3. Tabela de Questionários do Período
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.text('2. AVALIAÇÕES E QUESTIONÁRIOS NO ESCOPO', margin, currentY);

  currentY += 3;

  const tableBody = quizzes.map((q, idx) => [
    `${idx + 1}`,
    q.title,
    q.meetingTopic ? `${q.meetingTopic} (${q.meetingFarm || 'Geral'})` : 'Autônomo',
    q.status === 'PUBLISHED' ? 'Em Andamento' : q.status === 'CLOSED' ? 'Concluído' : 'Rascunho',
    `${q.totalParticipants}`,
    `${q.totalAttempts}`,
    `${q.averageScore}%`,
    `${q.approvalRate}%`
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Avaliação', 'DDS Vinculado', 'Status', 'Particip.', 'Submiss.', 'Média', 'Aprov.']],
    body: tableBody.length > 0 ? tableBody : [['-', 'Nenhum questionário encontrado no filtro selecionado', '-', '-', '-', '-', '-', '-']],
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [30, 41, 59]
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { cellWidth: 55 },
      2: { cellWidth: 45 },
      3: { halign: 'center', cellWidth: 22 },
      4: { halign: 'center', cellWidth: 14 },
      5: { halign: 'center', cellWidth: 14 },
      6: { halign: 'center', cellWidth: 14, fontStyle: 'bold' },
      7: { halign: 'center', cellWidth: 14, fontStyle: 'bold' }
    },
    margin: { left: margin, right: margin }
  });

  const finalY = (doc as any).lastAutoTable?.finalY || currentY + 40;
  currentY = finalY + 8;

  // 4. Fragilidades Operacionais e Planos de Ação Preventiva
  if (fragilities.length > 0) {
    if (currentY > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      currentY = margin;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
    doc.text('3. DIAGNÓSTICO DE FRAGILIDADES & PLANOS DE AÇÃO RECOMENDADOS', margin, currentY);

    currentY += 4;

    const topFragilities = fragilities.slice(0, 5);
    const fragRows = topFragilities.map(f => [
      f.questionText,
      `${f.errorRate}%`,
      f.correctOptionText,
      f.mostCommonWrongText || 'Não mapeado',
      f.actionPlan.replace(/🚨|⚠️|✅|•/g, '').trim()
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Pauta / Pergunta', 'Erro', 'Conduta Correta', 'Desvio Frequente', 'Ação Preventiva para o DDS']],
      body: fragRows,
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 2,
        textColor: [30, 41, 59]
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { halign: 'center', cellWidth: 12, fontStyle: 'bold' },
        2: { cellWidth: 35 },
        3: { cellWidth: 30 },
        4: { cellWidth: 60 }
      },
      margin: { left: margin, right: margin }
    });
  }

  // Rodapé em todas as páginas
  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(
      `DDS Online • Sistema de Gestão de Diálogos Diários de Segurança e Treinamentos • Página ${i} de ${pageCount}`,
      margin,
      doc.internal.pageSize.getHeight() - 7
    );
  }

  return doc;
}
