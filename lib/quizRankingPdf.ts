// lib/quizRankingPdf.ts
// Gerador Oficial do Relatório de Ranking e Desempenho dos Questionários do DDS Online em PDF

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { QuizRankingSummary } from './quizRanking';

export interface GenerateRankingPdfParams {
  ddsTopic?: string;
  ddsFarm?: string;
  quizTitle: string;
  passingScore: number;
  organizerName?: string;
  companyName?: string;
  summary: QuizRankingSummary;
  generatedAt?: Date;
}

export async function generateQuizRankingPdf(params: GenerateRankingPdfParams): Promise<jsPDF> {
  const {
    ddsTopic,
    ddsFarm,
    quizTitle,
    passingScore,
    organizerName = 'Técnico de Segurança do Trabalho',
    companyName = 'DDS Online',
    summary,
    generatedAt = new Date()
  } = params;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let currentY = margin;

  // Paleta de Cores DDS Online
  const primaryDark: [number, number, number] = [15, 23, 42];     // slate-900
  const emeraldAccent: [number, number, number] = [16, 185, 129]; // emerald-500
  const emeraldDark: [number, number, number] = [5, 150, 105];   // emerald-600
  const goldColor: [number, number, number] = [217, 119, 6];     // amber-600
  const silverColor: [number, number, number] = [100, 116, 139]; // slate-500
  const bronzeColor: [number, number, number] = [180, 83, 9];    // amber-700
  const textDark: [number, number, number] = [30, 41, 59];       // slate-800
  const textMuted: [number, number, number] = [100, 116, 139];   // slate-500

  // 1. Cabeçalho Corporativo
  doc.setFillColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 28, 3, 3, 'F');

  // Barra de Destaque Esmeralda
  doc.setFillColor(emeraldAccent[0], emeraldAccent[1], emeraldAccent[2]);
  doc.rect(margin, currentY, 3.5, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('DDS ONLINE • RELATÓRIO OFICIAL DE RANKING E DESEMPENHO', margin + 8, currentY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(`Avaliação de Segurança: ${quizTitle}`, margin + 8, currentY + 17);
  doc.text(`Empresa: ${companyName} • Unidade/Frente: ${ddsFarm || 'Geral'}`, margin + 8, currentY + 23);

  currentY += 34;

  // 2. Metadados do Questionário e DDS
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 24, 2, 2, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);

  doc.text('VÍNCULO DO DDS:', margin + 4, currentY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(ddsTopic ? `${ddsTopic} (${ddsFarm || 'Geral'})` : 'Avaliação Autônoma Independente', margin + 35, currentY + 6);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.text('INSTRUTOR / GESTOR:', margin + 4, currentY + 12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(organizerName, margin + 35, currentY + 12);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.text('DATA DE GERAÇÃO:', margin + 4, currentY + 18);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(generatedAt.toLocaleString('pt-BR'), margin + 35, currentY + 18);

  // Lado direito dos metadados
  const rightX = margin + 115;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.text('CRITÉRIO DE APROVAÇÃO:', rightX, currentY + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nota Mínima ≥ ${passingScore}%`, rightX + 42, currentY + 6);

  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL AVALIADOS:', rightX, currentY + 12);
  doc.setFont('helvetica', 'normal');
  doc.text(`${summary.totalParticipants} participantes`, rightX + 42, currentY + 12);

  doc.setFont('helvetica', 'bold');
  doc.text('APROVEITAMENTO MÉDIO:', rightX, currentY + 18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(summary.averageScore >= passingScore ? emeraldDark[0] : 185, summary.averageScore >= passingScore ? emeraldDark[1] : 28, summary.averageScore >= passingScore ? emeraldDark[2] : 28);
  doc.text(`${summary.averageScore}%`, rightX + 42, currentY + 18);

  currentY += 30;

  // 3. Quadro de Resumo de Indicadores (KPIs)
  const kpiWidth = (pageWidth - margin * 2 - 9) / 4;
  const kpis = [
    { title: 'PARTICIPANTES', value: String(summary.totalParticipants), color: primaryDark },
    { title: 'RESPOSTAS TOTAIS', value: String(summary.totalAttempts), color: primaryDark },
    { title: 'MÉDIA DA EQUIPE', value: `${summary.averageScore}%`, color: emeraldDark },
    { title: 'TAXA DE APROVAÇÃO', value: `${summary.approvalRate}%`, color: summary.approvalRate >= 70 ? emeraldDark : [185, 28, 28] }
  ];

  kpis.forEach((kpi, idx) => {
    const kpiX = margin + idx * (kpiWidth + 3);
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(kpiX, currentY, kpiWidth, 16, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(kpi.title, kpiX + kpiWidth / 2, currentY + 5, { align: 'center' });

    doc.setFontSize(11);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.value, kpiX + kpiWidth / 2, currentY + 12, { align: 'center' });
  });

  currentY += 22;

  // 4. Destaque Visual do Pódio (Top 3)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.text('🏆 PÓDIO DOS MELHORES COLOCADOS', margin, currentY);

  currentY += 4;

  const podiumBoxWidth = (pageWidth - margin * 2 - 6) / 3;
  const podiumOrder = [
    { label: '🥇 1º LUGAR (OURO)', items: summary.podium.first, color: goldColor, bgColor: [254, 243, 199] },
    { label: '🥈 2º LUGAR (PRATA)', items: summary.podium.second, color: silverColor, bgColor: [241, 245, 249] },
    { label: '🥉 3º LUGAR (BRONZE)', items: summary.podium.third, color: bronzeColor, bgColor: [255, 237, 213] }
  ];

  podiumOrder.forEach((pod, idx) => {
    const podX = margin + idx * (podiumBoxWidth + 3);
    doc.setFillColor(pod.bgColor[0], pod.bgColor[1], pod.bgColor[2]);
    doc.setDrawColor(pod.color[0], pod.color[1], pod.color[2]);
    doc.roundedRect(podX, currentY, podiumBoxWidth, 23, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(pod.color[0], pod.color[1], pod.color[2]);
    doc.text(pod.label, podX + podiumBoxWidth / 2, currentY + 5.5, { align: 'center' });

    if (pod.items.length > 0) {
      const topName = pod.items.map(it => it.participantName).join(' / ');
      const truncatedName = topName.length > 25 ? topName.slice(0, 23) + '...' : topName;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text(truncatedName, podX + podiumBoxWidth / 2, currentY + 11.5, { align: 'center' });

      const timeStr = pod.items[0].timeSpentFormatted && pod.items[0].timeSpentFormatted !== '—' ? ` • ${pod.items[0].timeSpentFormatted}` : '';
      const scoreText = `${pod.items[0].score}% (${pod.items[0].correctCount}/${pod.items[0].totalQuestions} acertos${timeStr})`;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(emeraldDark[0], emeraldDark[1], emeraldDark[2]);
      doc.text(scoreText, podX + podiumBoxWidth / 2, currentY + 17, { align: 'center' });
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text('Sem classificação', podX + podiumBoxWidth / 2, currentY + 13, { align: 'center' });
    }
  });

  currentY += 29;

  // 5. Tabela do Ranking Completo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.text('📋 CLASSIFICAÇÃO COMPLETA DA EQUIPE', margin, currentY);

  currentY += 3;

  const tableRows = summary.ranking.map(item => {
    const formattedDate = item.submittedAt
      ? new Date(item.submittedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : '-';

    const posLabel = item.position === 1 ? '🥇 1º' :
                     item.position === 2 ? '🥈 2º' :
                     item.position === 3 ? '🥉 3º' :
                     `${item.position}º`;

    const tieSuffix = item.isTie ? ' (Empate)' : '';

    return [
      `${posLabel}${tieSuffix}`,
      item.participantName,
      item.participantRole || 'Colaborador',
      `${item.correctCount}/${item.totalQuestions}`,
      item.timeSpentFormatted || '—',
      `${item.score}%`,
      item.passed ? 'APROVADO' : 'INSUFICIENTE',
      formattedDate
    ];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { top: 15, bottom: 20, left: margin, right: margin },
    head: [['POSIÇÃO', 'COLABORADOR', 'FUNÇÃO', 'ACERTOS', 'TEMPO', 'NOTA (%)', 'SITUAÇÃO', 'DATA']],
    body: tableRows.length > 0 ? tableRows : [['-', 'Nenhum participante concluiu a avaliação ainda', '-', '-', '-', '-', '-', '-']],
    theme: 'plain',
    headStyles: {
      fillColor: primaryDark,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
      valign: 'middle',
      fontSize: 7.5,
      minCellHeight: 7
    },
    styles: {
      fontSize: 7,
      valign: 'middle',
      halign: 'left',
      textColor: textDark,
      lineColor: [226, 232, 240],
      lineWidth: { bottom: 0.1, top: 0, left: 0, right: 0 },
      minCellHeight: 6.5
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 42, halign: 'left', fontStyle: 'bold' },
      2: { cellWidth: 30, halign: 'left' },
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
      6: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
      7: { cellWidth: 18, halign: 'center' }
    },
    didParseCell: (data) => {
      // Destaque de cor para a coluna SITUAÇÃO (índice 6)
      if (data.section === 'body' && data.column.index === 6) {
        if (data.cell.raw === 'APROVADO') {
          data.cell.styles.textColor = emeraldDark;
        } else if (data.cell.raw === 'INSUFICIENTE') {
          data.cell.styles.textColor = [185, 28, 28];
        }
      }
      // Destaque para top 3
      if (data.section === 'body' && data.column.index === 0) {
        if (String(data.cell.raw).includes('1º')) {
          data.cell.styles.textColor = goldColor;
        } else if (String(data.cell.raw).includes('2º')) {
          data.cell.styles.textColor = silverColor;
        } else if (String(data.cell.raw).includes('3º')) {
          data.cell.styles.textColor = bronzeColor;
        }
      }
    }
  });

  // 6. Rodapé em todas as páginas
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(6.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    doc.text(
      `DDS Online • Sistema de Gestão de Diálogo Diário de Segurança e Avaliações de Treinamento • Emitido em ${generatedAt.toLocaleString('pt-BR')}`,
      margin,
      pageHeight - 8
    );

    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  return doc;
}
