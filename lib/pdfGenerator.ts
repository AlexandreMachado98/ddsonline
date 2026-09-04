import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AttendanceData {
  name: string;
  cpf: string;
  selfie?: string;
  signature?: string;
  createdAt: string;
  exitReason?: string;
  exitSignature?: string;
}

interface MeetingData {
  id?: string;
  topic: string;
  farm: string;
  type?: 'PRESENTIAL' | 'REMOTE';
  objective?: string | null;
  programmaticContent?: string | null;
  createdAt?: number | string;
  endedAt?: string | null;
  instructorName?: string | null;
  classification?: string | null;
  organizer?: { name: string };
  attendees?: AttendanceData[];
  groupPhoto?: string | null;
}

export function generateDdsPdf(meeting: MeetingData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // Colors
  const darkGreen: [number, number, number] = [0, 99, 65];
  const tableHeaderGreen: [number, number, number] = [25, 135, 84];
  const lightGreenBg: [number, number, number] = [235, 245, 240];
  const textDark: [number, number, number] = [30, 41, 59];
  const textMuted: [number, number, number] = [100, 116, 139];

  let currentY = 0;

  // Helper to render company logo
  const renderCompanyLogo = (bannerHeight = 30) => {
    if (typeof window !== 'undefined') {
      try {
        const companyLogo = localStorage.getItem('dds_company_logo');
        if (companyLogo) {
          const props = doc.getImageProperties(companyLogo);
          const maxW = 50;
          const maxH = 22;
          const ratio = Math.min(maxW / props.width, maxH / props.height);
          const finalW = props.width * ratio;
          const finalH = props.height * ratio;
          
          const xPos = pageWidth - 14 - finalW;
          const yPos = (bannerHeight - finalH) / 2;
          
          doc.setFillColor(255, 255, 255);
          doc.roundedRect(xPos - 3, yPos - 3, finalW + 6, finalH + 6, 2, 2, 'F');
          doc.addImage(companyLogo, 'PNG', xPos, yPos, finalW, finalH);
        }
      } catch (e) {}
    }
  };

  // =========================================================================
  // PÁGINA 1: FRENTE - REGISTRO DE PRESENÇA OFICIAL
  // =========================================================================

  // --- HEADER BANNER ---
  doc.setFillColor(darkGreen[0], darkGreen[1], darkGreen[2]);
  doc.rect(0, 0, pageWidth, 30, 'F');
  
  // Logo "DDS ON"
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('DDS ON', 14, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(230, 240, 235);
  doc.text('Plataforma de registro de presença online', 14, 24);

  // Logo da Empresa
  renderCompanyLogo(30);
  
  currentY = 43;

  // --- MAIN TITLE ---
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('REGISTRO DE PRESENÇA', 14, currentY);
  
  currentY += 10;

  // --- CARDS ---
  const cardH = 14;
  const col1 = 14;
  const col2 = 82;
  const col3 = 150;
  const cardW = 65;
  const col3W = 46;

  const drawCard = (x: number, y: number, w: number, h: number, title: string, value: string) => {
    doc.setFillColor(lightGreenBg[0], lightGreenBg[1], lightGreenBg[2]);
    doc.roundedRect(x, y, w, h, 2, 2, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(title, x + 4, y + 5.5);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const splitVal = doc.splitTextToSize(value, w - 8);
    doc.text(splitVal, x + 4, y + 10);
  };

  // Row 1
  drawCard(col1, currentY, cardW, cardH, meeting.classification === 'Treinamento' ? 'Tema do Treinamento' : 'Tema do DDS', meeting.topic || 'Não informado');
  drawCard(col2, currentY, cardW, cardH, 'Modalidade', meeting.type === 'PRESENTIAL' ? 'Presencial' : 'EAD');
  
  // Right large card (Total)
  doc.setFillColor(lightGreenBg[0], lightGreenBg[1], lightGreenBg[2]);
  doc.roundedRect(col3, currentY, col3W, cardH * 2 + 3, 3, 3, 'F');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text('Total Registrado', col3 + (col3W/2), currentY + 7.5, { align: 'center' });
  doc.setFontSize(20);
  doc.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]);
  doc.text(String(meeting.attendees?.length || 0), col3 + (col3W/2), currentY + 19, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text('colaborador(es)', col3 + (col3W/2), currentY + 27, { align: 'center' });

  currentY += cardH + 3;

  // Row 2
  const ddsDate = new Date(meeting.createdAt || Date.now());
  const endDate = meeting.endedAt ? new Date(meeting.endedAt) : null;
  let dateStr = ddsDate.toLocaleDateString('pt-BR') + ' às ' + ddsDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (endDate) {
    dateStr += ' até ' + endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  drawCard(col1, currentY, cardW, cardH, 'Local', meeting.farm || 'Não informado');
  drawCard(col2, currentY, cardW, cardH, 'Data e Horário', dateStr);

  currentY += cardH + 3;

  // Row 3 (Responsável)
  const fullWidth = pageWidth - 28;
  drawCard(col1, currentY, fullWidth, cardH, 'Responsável pelo Treinamento / DDS', meeting.instructorName || meeting.organizer?.name || 'Não informado');

  currentY += cardH + 3;

  // Row 4 (Objetivo)
  const rawObjective = (meeting.objective || '').trim();
  const objText = rawObjective || 'Não informado';
  const objLines = doc.splitTextToSize(objText, fullWidth - 10);
  const textLineCount = Array.isArray(objLines) ? objLines.length : 1;
  const objCardH = Math.max(13, 6 + textLineCount * 4);

  doc.setFillColor(lightGreenBg[0], lightGreenBg[1], lightGreenBg[2]);
  doc.roundedRect(col1, currentY, fullWidth, objCardH, 2, 2, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text('Objetivo', col1 + 4, currentY + 5);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(objLines, col1 + 4, currentY + 9.5);

  currentY += objCardH + 4;

  // --- TABLE DE PRESENÇA ---
  
  // Green header above table
  doc.setFillColor(tableHeaderGreen[0], tableHeaderGreen[1], tableHeaderGreen[2]);
  doc.roundedRect(14, currentY, pageWidth - 28, 10, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('LISTA DE PRESENÇA', 22, currentY + 6.8);
  
  currentY += 10;
  
  const attendeesList = meeting.attendees || [];
  const tableRows = attendeesList.map((a, idx) => {
    return [
      String(idx + 1),
      a.name.replace(/\(Saída:.*\)/, '').trim(),
      a.cpf || '-',
      new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      '', // Status pill drawn manually
      '', // Selfie
      ''  // Signature
    ];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { top: 20, bottom: 25, left: 14, right: 14 },
    head: [['#', 'NOME COMPLETO', 'FUNÇÃO', 'ENTRADA', 'STATUS / SAÍDA', 'BIOMETRIA', 'ASSINATURA DIGITAL']],
    body: tableRows.length > 0 ? tableRows : [['-', 'Nenhum participante', '-', '-', '-', '-', '-']],
    theme: 'grid',
    headStyles: {
      fillColor: lightGreenBg,
      textColor: textDark,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      fontSize: 8,
      minCellHeight: 9
    },
    styles: {
      fontSize: 8,
      valign: 'middle',
      halign: 'center',
      textColor: textDark,
      lineColor: [229, 231, 235],
      lineWidth: 0.1,
      minCellHeight: 17
    },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 38, halign: 'left' },
      2: { cellWidth: 26 },
      3: { cellWidth: 16 },
      4: { cellWidth: 35 },
      5: { cellWidth: 26 },
      6: { cellWidth: 33 }
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && attendeesList.length > 0) {
        const attendee = attendeesList[data.row.index];
        if (!attendee) return;

        // Draw Status Pill
        if (data.column.index === 4) {
          const isEarlyExit = !!attendee.exitReason;
          const bg = isEarlyExit ? [248, 215, 218] : [209, 231, 221];
          const fg = isEarlyExit ? [132, 32, 41] : [15, 81, 50];
          
          doc.setFillColor(bg[0], bg[1], bg[2]);
          const pillW = 28;
          const pillH = 9.5;
          const px = data.cell.x + (data.cell.width - pillW) / 2;
          const py = data.cell.y + (data.cell.height - pillH) / 2;
          
          doc.roundedRect(px, py, pillW, pillH, 2, 2, 'F');
          
          doc.setFillColor(tableHeaderGreen[0], tableHeaderGreen[1], tableHeaderGreen[2]);
          doc.circle(px + 5.5, py + 4.7, 2.2, 'F');
          
          doc.setTextColor(fg[0], fg[1], fg[2]);
          doc.setFontSize(6);
          doc.setFont('helvetica', 'bold');
          
          if (isEarlyExit) {
            doc.text('SAÍDA', px + 16, py + 4.2, { align: 'center' });
            doc.text('ANTECIPADA', px + 16, py + 7.2, { align: 'center' });
          } else {
            doc.text('PRESENTE', px + 16.5, py + 4.2, { align: 'center' });
            doc.text('ATÉ O FIM', px + 16.5, py + 7.2, { align: 'center' });
          }
        }

        // Selfie
        if (data.column.index === 5 && attendee.selfie) {
          try {
            doc.addImage(attendee.selfie, 'JPEG', data.cell.x + 6, data.cell.y + 1.5, 14, 14);
          } catch (e) {}
        }

        // Signature
        if (data.column.index === 6 && attendee.signature) {
          try {
            doc.addImage(attendee.signature, 'PNG', data.cell.x + 2, data.cell.y + 2.5, 29, 12);
          } catch (e) {}
        }
      }
    }
  });

  let finalY = (doc as any).lastAutoTable.finalY + 12;

  // --- GROUP PHOTO (EVIDÊNCIA) ---
  if (meeting.groupPhoto && meeting.groupPhoto.length > 50) {
    if (finalY + 55 > pageHeight - 30) {
      doc.addPage();
      finalY = 20;
    }
    try {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text('FOTO DA EQUIPE (EVIDÊNCIA)', pageWidth / 2, finalY, { align: 'center' });
      
      const imgProps = doc.getImageProperties(meeting.groupPhoto);
      const maxW = 80;
      const maxH = 45;
      let imgWidth = maxW;
      let imgHeight = maxH;
      if (imgProps) {
        const ratio = imgProps.width / imgProps.height;
        imgHeight = imgWidth / ratio;
        if (imgHeight > maxH) {
          imgHeight = maxH;
          imgWidth = imgHeight * ratio;
        }
      }
      
      const imgX = (pageWidth - imgWidth) / 2;
      const format = meeting.groupPhoto.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(meeting.groupPhoto, format, imgX, finalY + 4, imgWidth, imgHeight);
      finalY += imgHeight + 8;
    } catch(e){}
  }

  // =========================================================================
  // PÁGINA 2: VERSO DEDICADO (CONTEÚDO PROGRAMÁTICO & PLANO DE TREINAMENTO)
  // Gerado quando houver conteúdo programático ou a classificação for 'Treinamento'
  // =========================================================================
  const rawContent = (meeting.programmaticContent || '').trim();
  const shouldRenderVerso = rawContent.length > 0 || meeting.classification === 'Treinamento';

  if (shouldRenderVerso) {
    doc.addPage();
    let versoY = 0;

    // Header Banner do Verso
    doc.setFillColor(darkGreen[0], darkGreen[1], darkGreen[2]);
    doc.rect(0, 0, pageWidth, 30, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('DDS ON', 14, 17);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(230, 240, 235);
    doc.text('PROGRAMAÇÃO E CONTEÚDO PROGRAMÁTICO DO TREINAMENTO', 14, 23);

    renderCompanyLogo(30);

    versoY = 43;

    // Título Principal do Verso
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text('CONTEÚDO PROGRAMÁTICO & METODOLOGIA', 14, versoY);
    
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text('Detalhamento pedagógico e normativo em conformidade com as Normas Regulamentadoras (NRs).', 14, versoY + 5);

    versoY += 12;

    // Cards Informativos Resumidos no Topo do Verso
    const vCardH = 13;
    const vCol1 = 14;
    const vCol2 = 104;
    const vWidthHalf = 92;

    // Linha 1 de Resumo
    drawCard(vCol1, versoY, vWidthHalf, vCardH, 'Tema / Treinamento', meeting.topic || 'Não informado');
    drawCard(vCol2, versoY, vWidthHalf, vCardH, 'Data e Carga Horária', dateStr);

    versoY += vCardH + 3;

    // Linha 2 de Resumo
    drawCard(vCol1, versoY, vWidthHalf, vCardH, 'Local / Unidade', meeting.farm || 'Não informado');
    drawCard(vCol2, versoY, vWidthHalf, vCardH, 'Instrutor / Responsável Técnico', meeting.instructorName || meeting.organizer?.name || 'Não informado');

    versoY += vCardH + 5;

    // 1. Bloco de Objetivo Geral
    const vObjText = rawObjective || 'Orientação, instrução normativa e conscientização operacional conforme as diretrizes de Segurança e Saúde no Trabalho.';
    const vObjLines = doc.splitTextToSize(vObjText, fullWidth - 12);
    const vObjLineCount = Array.isArray(vObjLines) ? vObjLines.length : 1;
    const vObjBlockH = Math.max(18, 9 + vObjLineCount * 4.5);

    doc.setFillColor(lightGreenBg[0], lightGreenBg[1], lightGreenBg[2]);
    doc.roundedRect(14, versoY, fullWidth, vObjBlockH, 2, 2, 'F');
    
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]);
    doc.text('1. OBJETIVO DO TREINAMENTO', 19, versoY + 6.5);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(vObjLines, 19, versoY + 12);

    versoY += vObjBlockH + 5;

    // 2. Bloco de Conteúdo Programático Ministrado
    const vContentText = rawContent || '1. Módulo Geral: Conceitos e Diretrizes de Segurança do Trabalho e NRs aplicáveis.\n2. Módulo Específico: Procedimentos Operacionais Padrão (POP), Análise Preliminar de Risco (APR) e uso correto de EPIs.\n3. Módulo Prático: Condutas Preventivas, Primeiros Socorros e Prática Operacional.';
    const vContentLines = doc.splitTextToSize(vContentText, fullWidth - 12);
    const vContentLineCount = Array.isArray(vContentLines) ? vContentLines.length : 1;
    const vContentBlockH = Math.max(40, 10 + vContentLineCount * 4.5);

    doc.setFillColor(lightGreenBg[0], lightGreenBg[1], lightGreenBg[2]);
    doc.roundedRect(14, versoY, fullWidth, vContentBlockH, 2, 2, 'F');

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]);
    doc.text('2. CONTEÚDO PROGRAMÁTICO & MÓDULOS MINISTRADOS', 19, versoY + 6.5);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(vContentLines, 19, versoY + 12);

    versoY += vContentBlockH + 6;

    // 3. Bloco de Declaração de Conformidade & Assinatura do Instrutor
    const declText = 'Declaro para os devidos fins de comprovação legal e auditoria trabalhista que os conteúdos programáticos e orientações acima descritos foram integralmente ministrados aos colaboradores listados no Registro de Presença anexo, com observância estrita das Normas Regulamentadoras (NRs).';
    const declLines = doc.splitTextToSize(declText, fullWidth - 12);
    const declLineCount = Array.isArray(declLines) ? declLines.length : 1;
    const declBlockH = 32 + declLineCount * 3.5;

    // Verifica se cabe na página antes do rodapé; se não, adiciona página
    if (versoY + declBlockH > pageHeight - 25) {
      doc.addPage();
      versoY = 20;
    }

    doc.setDrawColor(tableHeaderGreen[0], tableHeaderGreen[1], tableHeaderGreen[2]);
    doc.setLineWidth(0.3);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(14, versoY, fullWidth, declBlockH, 2, 2, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]);
    doc.text('3. DECLARAÇÃO DE CONFORMIDADE E VALIDAÇÃO TÉCNICA', 19, versoY + 6);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(declLines, 19, versoY + 11);

    // Linha de Assinatura do Instrutor
    const signY = versoY + declBlockH - 12;
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.3);
    doc.line(pageWidth / 2 - 50, signY, pageWidth / 2 + 50, signY);

    const instructorNameDisplay = meeting.instructorName || meeting.organizer?.name || 'Responsável Técnico / Instrutor';
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(instructorNameDisplay, pageWidth / 2, signY + 4, { align: 'center' });
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text('Instrutor / Responsável pelo Treinamento', pageWidth / 2, signY + 7.5, { align: 'center' });
  }

  // --- FOOTER EM TODAS AS PÁGINAS ---
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const footY = pageHeight - 20;
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text('Documento oficial de auditoria', 14, footY);
    doc.text('emitido digitalmente pelo DDS ON', 14, footY + 4);
    
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, footY, { align: 'right' });
    doc.text(dateStr, pageWidth - 14, footY + 4, { align: 'right' });
    doc.text(`Código de verificação: DDS-${ddsDate.getFullYear()}${String(ddsDate.getMonth()+1).padStart(2,'0')}${String(ddsDate.getDate()).padStart(2,'0')}-${String(ddsDate.getHours()).padStart(2,'0')}${String(ddsDate.getMinutes()).padStart(2,'0')}`, pageWidth - 14, footY + 10, { align: 'right' });
    
    // Bottom edge line
    doc.setFillColor(darkGreen[0], darkGreen[1], darkGreen[2]);
    doc.rect(0, pageHeight - 6, pageWidth, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text('DDS ON   |   DESENVOLVIDO E CRIADO PELA AM TST', pageWidth/2, pageHeight - 2, { align: 'center' });
  }

  const cleanTopic = (meeting.topic || 'DDS').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Relatorio_Auditoria_DDS_ON_${cleanTopic}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// 2. RELATÓRIO CONSOLIDADO DO PERÍODO
interface ConsolidatedReportData {
  companyName: string;
  organizerName: string;
  startDate?: string;
  endDate?: string;
  meetings: any[];
}

export function generateConsolidatedDdsPdf(report: ConsolidatedReportData) {
  const doc = new jsPDF();

  // Topo do Relatório Consolidado
  doc.setFillColor(5, 150, 105); // Verde Esmeralda
  doc.rect(0, 0, 210, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('DDS ON - DOSSIÊ CONSOLIDADO DE AUDITORIA E NRs', 14, 17);

  // Metadados do Dossiê
  doc.setTextColor(31, 41, 55);
  doc.setFontSize(9.5);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Empresa / Unidade:', 14, 35);
  doc.setFont('helvetica', 'normal');
  doc.text(report.companyName || 'Não informada', 50, 35);

  doc.setFont('helvetica', 'bold');
  doc.text('Técnico / Responsável:', 14, 42);
  doc.setFont('helvetica', 'normal');
  doc.text(report.organizerName || 'Não informado', 56, 42);

  let periodText = 'Todo o Histórico';
  if (report.startDate && report.endDate) {
    periodText = `De ${new Date(report.startDate).toLocaleDateString('pt-BR')} até ${new Date(report.endDate).toLocaleDateString('pt-BR')}`;
  } else if (report.startDate) {
    periodText = `A partir de ${new Date(report.startDate).toLocaleDateString('pt-BR')}`;
  } else if (report.endDate) {
    periodText = `Até ${new Date(report.endDate).toLocaleDateString('pt-BR')}`;
  }

  doc.setFont('helvetica', 'bold');
  doc.text('Período Selecionado:', 14, 49);
  doc.setFont('helvetica', 'normal');
  doc.text(periodText, 52, 49);

  doc.setFont('helvetica', 'bold');
  doc.text('Total de Reuniões:', 14, 56);
  doc.setFont('helvetica', 'normal');
  doc.text(`${report.meetings.length} DDS realizados`, 50, 56);

  doc.setDrawColor(229, 231, 235);
  doc.line(14, 60, 196, 60);

  const tableData = report.meetings.map(m => [
    new Date(m.createdAt || Date.now()).toLocaleDateString('pt-BR'),
    new Date(m.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    m.topic + (m.classification === 'Treinamento' ? ' (Treinamento)' : ''),
    m.farm,
    m.type === 'PRESENTIAL' ? '👥 Presencial' : '🎙️ Remoto',
    `${m.attendees?.length || 0} pessoas`,
    'CONCLUÍDO'
  ]);

  autoTable(doc, {
    startY: 64,
    head: [['Data', 'Hora', 'Tema / Classificação', 'Local / Fazenda', 'Modalidade', 'Presentes', 'Status']],
    body: tableData.length > 0 ? tableData : [['Nenhum DDS encontrado', '-', '-', '-', '-', '-', '-']],
    theme: 'striped',
    headStyles: {
      fillColor: [5, 150, 105],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 8.5
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5
    },
    columnStyles: {
      0: { cellWidth: 20, halign: 'center' },
      1: { cellWidth: 15, halign: 'center' },
      2: { cellWidth: 62 },
      3: { cellWidth: 35 },
      4: { cellWidth: 22, halign: 'center' },
      5: { cellWidth: 18, halign: 'center' },
      6: { cellWidth: 18, halign: 'center' }
    }
  });

  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(156, 163, 175);
    doc.text(
      `Dossiê consolidado emitido pelo DDS ON • Desenvolvido e Auditado por AM TST - Página ${i} de ${pageCount}`,
      14,
      doc.internal.pageSize.height - 8
    );
  }

  doc.save(`Dossie_Consolidado_DDS_ON_${new Date().toISOString().slice(0, 10)}.pdf`);
}
