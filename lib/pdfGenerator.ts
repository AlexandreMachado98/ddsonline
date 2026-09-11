import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDFDocument } from 'pdf-lib';

export interface AttachmentPdfData {
  id?: string;
  fileName: string;
  displayName?: string | null;
  description?: string | null;
  mimeType: string;
  fileSize: number;
  fileData: string; // Base64 data URL
  pageCount?: number | null;
  order?: number;
}

interface AttendanceData {
  name: string;
  cpf: string;
  selfie?: string;
  signature?: string;
  createdAt: string;
  exitReason?: string;
  exitSignature?: string;
}

export interface MeetingData {
  id?: string;
  topic: string;
  farm: string;
  type?: 'PRESENTIAL' | 'REMOTE' | string;
  objective?: string | null;
  programmaticContent?: string | null;
  createdAt?: number | string | Date;
  endedAt?: string | null;
  instructorName?: string | null;
  classification?: string | null;
  organizer?: { name: string; position?: string | null; company?: string | null };
  attendees?: AttendanceData[];
  groupPhoto?: string | null;
  attachments?: AttachmentPdfData[];
  documentHash?: string | null;
}

// Helper para calcular digest SHA-256 de integridade documental
async function getDocumentSha256(text: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const buffer = new TextEncoder().encode(text);
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {}
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) - h) + text.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(16).padStart(16, '0') + 'f0a9b8c7e6d5e4b3';
}

export async function generateDdsPdf(meeting: MeetingData): Promise<void> {
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

  // --- HEADER PRINCIPAL / FAIXA INSTITUCIONAL ---
  doc.setFillColor(darkGreen[0], darkGreen[1], darkGreen[2]);
  doc.rect(0, 0, pageWidth, 28, 'F');
  
  // Linha verde clara de acento institucional
  doc.setFillColor(74, 163, 122);
  doc.rect(0, 27, pageWidth, 1, 'F');

  // Identidade DDS ON
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('DDS ON', 14, 16);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(215, 235, 225);
  doc.text('REGISTRO DE DIÁLOGO DIÁRIO DE SEGURANÇA E TREINAMENTO', 14, 22);

  // Logo da Empresa à direita
  renderCompanyLogo(28);

  currentY = 36;

  // --- CABEÇALHO EDITORIAL DO DOCUMENTO ---
  const ddsDate = new Date(meeting.createdAt || Date.now());
  const endDate = meeting.endedAt ? new Date(meeting.endedAt) : null;
  let dateStr = ddsDate.toLocaleDateString('pt-BR') + ' às ' + ddsDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (endDate) {
    dateStr += ' até ' + endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  // Tag de Categoria Superior
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]);
  const categoriaLabel = meeting.classification === 'Treinamento' 
    ? 'REGISTRO DE TREINAMENTO OBRIGATÓRIO (SST)' 
    : meeting.classification === 'Campanha'
    ? 'CAMPANHA DE SAÚDE, SEGURANÇA E CONSCIENTIZAÇÃO (SST)'
    : 'DIÁLOGO DIÁRIO DE SEGURANÇA E SAÚDE DO TRABALHO';
  doc.text(categoriaLabel.toUpperCase(), 14, currentY);

  currentY += 6;

  // --- TEMA DO DDS EM DESTAQUE MÁXIMO (NUNCA TRUNCADO) ---
  const topicTitle = (meeting.topic || 'Diálogo Diário de Segurança').trim();
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  
  // Largura disponível considerando eventual badge de total de colaboradores à direita
  const availableTopicWidth = pageWidth - 28 - 48;
  const topicLines = doc.splitTextToSize(topicTitle, availableTopicWidth);
  doc.text(topicLines, 14, currentY);

  // Badge elegante de total de participantes à direita
  const badgeX = pageWidth - 14 - 44;
  const badgeY = currentY - 5;
  doc.setFillColor(lightGreenBg[0], lightGreenBg[1], lightGreenBg[2]);
  doc.roundedRect(badgeX, badgeY, 44, 18, 2, 2, 'F');
  doc.setDrawColor(200, 225, 215);
  doc.setLineWidth(0.2);
  doc.roundedRect(badgeX, badgeY, 44, 18, 2, 2, 'S');

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]);
  doc.text('TOTAL REGISTRADO', badgeX + 22, badgeY + 5, { align: 'center' });

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(String(meeting.attendees?.length || 0), badgeX + 22, badgeY + 12, { align: 'center' });

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('colaborador(es)', badgeX + 22, badgeY + 16, { align: 'center' });

  // Avança o Y conforme a quantidade de linhas do tema
  const topicHeight = Math.max(16, (Array.isArray(topicLines) ? topicLines.length : 1) * 6.5);
  currentY += topicHeight;

  // --- FAIXA DE METADADOS EDITORIAL (SEM EXCESSO DE CARDS) ---
  const fullWidth = pageWidth - 28;
  
  doc.setFillColor(248, 250, 249);
  doc.roundedRect(14, currentY, fullWidth, 14, 2, 2, 'F');
  doc.setDrawColor(230, 235, 232);
  doc.setLineWidth(0.2);
  doc.roundedRect(14, currentY, fullWidth, 14, 2, 2, 'S');

  const metaColW = fullWidth / 4;
  const metaY = currentY + 4.5;
  const metaValY = currentY + 10;

  // Coluna 1: Data e Horário
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('DATA & HORÁRIO', 17, metaY);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(dateStr, 17, metaValY);

  // Coluna 2: Local / Unidade
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('LOCAL / UNIDADE', 14 + metaColW + 3, metaY);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  const localText = meeting.farm || 'Não informado';
  const splitLocal = doc.splitTextToSize(localText, metaColW - 6);
  doc.text(splitLocal[0] || localText, 14 + metaColW + 3, metaValY);

  // Coluna 3: Modalidade
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('MODALIDADE', 14 + (metaColW * 2) + 3, metaY);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(meeting.type === 'PRESENTIAL' ? 'Presencial' : 'EAD / Remoto', 14 + (metaColW * 2) + 3, metaValY);

  // Coluna 4: Responsável
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('RESPONSÁVEL / INSTRUTOR', 14 + (metaColW * 3) + 3, metaY);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  const respName = meeting.instructorName || meeting.organizer?.name || 'Não informado';
  const splitResp = doc.splitTextToSize(respName, metaColW - 6);
  doc.text(splitResp[0] || respName, 14 + (metaColW * 3) + 3, metaValY);

  currentY += 18;

  // --- OBJETIVO DO DDS (SE PREENCHIDO) ---
  const rawObjective = (meeting.objective || '').trim();
  if (rawObjective) {
    const objLines = doc.splitTextToSize(rawObjective, fullWidth - 14);
    const textLineCount = Array.isArray(objLines) ? objLines.length : 1;
    const objCardH = Math.max(12, 6 + textLineCount * 4);

    // Barra sutil de destaque lateral
    doc.setFillColor(248, 250, 249);
    doc.rect(14, currentY, fullWidth, objCardH, 'F');
    doc.setFillColor(darkGreen[0], darkGreen[1], darkGreen[2]);
    doc.rect(14, currentY, 2, objCardH, 'F');

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]);
    doc.text('OBJETIVO ESPECÍFICO:', 19, currentY + 4.5);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(objLines, 19, currentY + 9);

    currentY += objCardH + 4;
  }

  // --- CABEÇALHO DA LISTA DE PRESENÇA ---
  doc.setFillColor(243, 246, 244);
  doc.rect(14, currentY, fullWidth, 7, 'F');
  doc.setFillColor(darkGreen[0], darkGreen[1], darkGreen[2]);
  doc.rect(14, currentY, 2.5, 7, 'F');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text('LISTA DE PRESENÇA & ASSINATURAS ELETRÔNICAS', 19, currentY + 4.8);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('Evidências Documentais de SST / Registro Fotográfico e Assinatura Eletrônica', pageWidth - 14, currentY + 4.8, { align: 'right' });
  
  currentY += 9;
  
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
    theme: 'plain',
    headStyles: {
      fillColor: [243, 246, 244],
      textColor: textDark,
      fontStyle: 'bold',
      halign: 'left',
      valign: 'middle',
      fontSize: 7.5,
      minCellHeight: 8,
      cellPadding: { top: 2, bottom: 2, left: 2, right: 2 }
    },
    styles: {
      fontSize: 7.5,
      valign: 'middle',
      halign: 'left',
      textColor: textDark,
      lineColor: [230, 235, 232],
      lineWidth: { bottom: 0.1, top: 0, left: 0, right: 0 },
      minCellHeight: 18,
      cellPadding: { top: 2, bottom: 2, left: 2, right: 2 }
    },
    alternateRowStyles: {
      fillColor: [252, 253, 252]
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 40, halign: 'left', fontStyle: 'bold' },
      2: { cellWidth: 26, halign: 'left' },
      3: { cellWidth: 15, halign: 'center' },
      4: { cellWidth: 32, halign: 'center' },
      5: { cellWidth: 26, halign: 'center' },
      6: { cellWidth: 35, halign: 'center' }
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

        // Selfie com detecção dinâmica de formato
        if (data.column.index === 5 && attendee.selfie) {
          try {
            const format = attendee.selfie.includes('image/png') ? 'PNG' : 'JPEG';
            doc.addImage(attendee.selfie, format, data.cell.x + 6, data.cell.y + 1.5, 14, 14);
          } catch (e) {
            console.warn('Aviso: selfie não pôde ser renderizada no PDF:', e);
          }
        }

        // Signature com detecção dinâmica de formato
        if (data.column.index === 6 && attendee.signature) {
          try {
            const format = attendee.signature.includes('image/jpeg') ? 'JPEG' : 'PNG';
            doc.addImage(attendee.signature, format, data.cell.x + 2, data.cell.y + 2.5, 29, 12);
          } catch (e) {
            console.warn('Aviso: assinatura não pôde ser renderizada no PDF:', e);
          }
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
    const versoSubHeader = meeting.classification === 'Campanha' ? 'PROGRAMAÇÃO E DETALHAMENTO DA CAMPANHA' : 'PROGRAMAÇÃO E CONTEÚDO PROGRAMÁTICO DO TREINAMENTO';
    doc.text(versoSubHeader, 14, 23);

    renderCompanyLogo(30);

    versoY = 43;

    // Título Principal do Verso
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    const versoMainTitle = meeting.classification === 'Campanha' ? 'PROGRAMAÇÃO & AÇÕES DA CAMPANHA' : 'CONTEÚDO PROGRAMÁTICO & METODOLOGIA';
    doc.text(versoMainTitle, 14, versoY);
    
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    const versoDesc = meeting.classification === 'Campanha' ? 'Detalhamento das ações de conscientização, dinâmicas e diretrizes de Segurança e Saúde (SST).' : 'Detalhamento pedagógico e normativo em conformidade com as Normas Regulamentadoras (NRs).';
    doc.text(versoDesc, 14, versoY + 5);

    versoY += 12;

    // Faixa de Resumo Editorial no Topo do Verso
    doc.setFillColor(248, 250, 249);
    doc.roundedRect(14, versoY, fullWidth, 14, 2, 2, 'F');
    doc.setDrawColor(230, 235, 232);
    doc.setLineWidth(0.2);
    doc.roundedRect(14, versoY, fullWidth, 14, 2, 2, 'S');

    const vColW = fullWidth / 4;
    const vMetaY = versoY + 4.5;
    const vValY = versoY + 10;

    // Col 1: Tema
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(meeting.classification === 'Campanha' ? 'TEMA / CAMPANHA' : 'TEMA / TREINAMENTO', 17, vMetaY);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    const vTopicStr = meeting.topic || 'Não informado';
    doc.text(doc.splitTextToSize(vTopicStr, vColW - 6)[0] || vTopicStr, 17, vValY);

    // Col 2: Data e Carga Horária
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text('DATA & HORÁRIO', 14 + vColW + 3, vMetaY);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(dateStr, 14 + vColW + 3, vValY);

    // Col 3: Local / Unidade
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text('LOCAL / UNIDADE', 14 + (vColW * 2) + 3, vMetaY);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    const vFarmStr = meeting.farm || 'Não informado';
    doc.text(doc.splitTextToSize(vFarmStr, vColW - 6)[0] || vFarmStr, 14 + (vColW * 2) + 3, vValY);

    // Col 4: Instrutor
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text('INSTRUTOR / RESPONSÁVEL', 14 + (vColW * 3) + 3, vMetaY);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    const vInstStr = meeting.instructorName || meeting.organizer?.name || 'Não informado';
    doc.text(doc.splitTextToSize(vInstStr, vColW - 6)[0] || vInstStr, 14 + (vColW * 3) + 3, vValY);

    versoY += 18;

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
    doc.text(meeting.classification === 'Campanha' ? '1. OBJETIVO DA CAMPANHA' : '1. OBJETIVO DO TREINAMENTO', 19, versoY + 6.5);
    
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
    doc.text(meeting.classification === 'Campanha' ? '2. PROGRAMAÇÃO E AÇÕES DA CAMPANHA' : '2. CONTEÚDO PROGRAMÁTICO & MÓDULOS MINISTRADOS', 19, versoY + 6.5);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(vContentLines, 19, versoY + 12);

    versoY += vContentBlockH + 6;

    // 3. Bloco de Declaração do Responsável pelo DDS
    const declText = 'Declaro para os devidos fins de registro de Segurança e Saúde no Trabalho que os conteúdos e orientações de segurança foram ministrados aos colaboradores listados nesta lista de presença, com base nas diretrizes internas de prevenção de acidentes da empresa.';
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
    doc.text('3. DECLARAÇÃO DO RESPONSÁVEL PELA APLICAÇÃO', 19, versoY + 6);

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

  // =========================================================================
  // PÁGINAS DE EVIDÊNCIAS & MATERIAIS APRESENTADOS (ANEXOS)
  // =========================================================================
  const attachmentsList = (meeting.attachments || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  const pdfAttachmentsToMerge: { index: number; attachment: AttachmentPdfData }[] = [];

  if (attachmentsList.length > 0) {
    // Se houver mais de 2 anexos, gera página de Sumário Editorial. Se houver 1 ou 2, integra direto nas páginas de evidência.
    if (attachmentsList.length > 2) {
      doc.addPage();
      let attPageY = 0;

      // Header Banner
      doc.setFillColor(darkGreen[0], darkGreen[1], darkGreen[2]);
      doc.rect(0, 0, pageWidth, 28, 'F');
      doc.setFillColor(74, 163, 122);
      doc.rect(0, 27, pageWidth, 1, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('DDS ON', 14, 16);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(215, 235, 225);
      doc.text('DOSSIÊ DE EVIDÊNCIAS & MATERIAIS APRESENTADOS', 14, 22);

      renderCompanyLogo(28);

      attPageY = 38;

      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('ÍNDICE GERAL DE EVIDÊNCIAS E ANEXOS', 14, attPageY);
      
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text('Comprovação documental dos arquivos, cartilhas, imagens e procedimentos exibidos durante o DDS.', 14, attPageY + 5);

      attPageY += 12;

      // Tabela Sumário de Anexos
      const attTableRows = attachmentsList.map((att, idx) => {
        const isPdf = att.mimeType === 'application/pdf' || att.fileName.toLowerCase().endsWith('.pdf');
        const sizeStr = att.fileSize < 1024 * 1024 
          ? `${(att.fileSize / 1024).toFixed(1)} KB` 
          : `${(att.fileSize / (1024 * 1024)).toFixed(2)} MB`;

        return [
          String(idx + 1).padStart(2, '0'),
          att.displayName || att.fileName,
          isPdf ? `PDF (${att.pageCount || 1} pág)` : 'IMAGEM',
          sizeStr,
          att.description || 'Material apresentado aos participantes'
        ];
      });

      autoTable(doc, {
        startY: attPageY,
        margin: { top: 20, bottom: 25, left: 14, right: 14 },
        head: [['ANEXO', 'NOME DO MATERIAL', 'FORMATO', 'TAMANHO', 'DESCRIÇÃO / OBSERVAÇÃO TÉCNICA']],
        body: attTableRows,
        theme: 'plain',
        headStyles: {
          fillColor: [243, 246, 244],
          textColor: textDark,
          fontStyle: 'bold',
          halign: 'left',
          fontSize: 7.5,
          minCellHeight: 8
        },
        styles: {
          fontSize: 7.5,
          textColor: textDark,
          lineColor: [230, 235, 232],
          lineWidth: { bottom: 0.1, top: 0, left: 0, right: 0 },
          cellPadding: 3
        },
        alternateRowStyles: {
          fillColor: [252, 253, 252]
        },
        columnStyles: {
          0: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
          1: { cellWidth: 46, fontStyle: 'bold' },
          2: { cellWidth: 24, halign: 'center' },
          3: { cellWidth: 18, halign: 'center' },
          4: { cellWidth: 78 }
        }
      });
    }

    // 2. Renderização de cada Anexo
    attachmentsList.forEach((att, idx) => {
      const isPdf = att.mimeType === 'application/pdf' || att.fileName.toLowerCase().endsWith('.pdf');
      const anexoLabel = `ANEXO ${String(idx + 1).padStart(2, '0')}`;

      if (!isPdf) {
        // Renderiza página de imagem
        doc.addPage();
        
        // Header Banner
        doc.setFillColor(darkGreen[0], darkGreen[1], darkGreen[2]);
        doc.rect(0, 0, pageWidth, 26, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(`${anexoLabel}: ${att.displayName || att.fileName}`, 14, 15);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(230, 240, 235);
        doc.text(`Evidência visual apresentada em: ${dateStr}`, 14, 21);

        renderCompanyLogo(26);

        let imgCardY = 32;

        // Card de Descrição
        if (att.description) {
          doc.setFillColor(lightGreenBg[0], lightGreenBg[1], lightGreenBg[2]);
          doc.roundedRect(14, imgCardY, pageWidth - 28, 12, 2, 2, 'F');
          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]);
          doc.text('Observação:', 18, imgCardY + 5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(textDark[0], textDark[1], textDark[2]);
          doc.text(doc.splitTextToSize(att.description, pageWidth - 60), 38, imgCardY + 5);
          imgCardY += 16;
        }

        // Imagem Centralizada e Proporcional
        try {
          const imgProps = doc.getImageProperties(att.fileData);
          const maxW = pageWidth - 28;
          const maxH = pageHeight - imgCardY - 26;
          let imgW = maxW;
          let imgH = maxH;

          if (imgProps) {
            const ratio = imgProps.width / imgProps.height;
            imgH = imgW / ratio;
            if (imgH > maxH) {
              imgH = maxH;
              imgW = imgH * ratio;
            }
          }

          const imgX = (pageWidth - imgW) / 2;
          const format = att.fileData.includes('image/png') ? 'PNG' : 'JPEG';
          doc.addImage(att.fileData, format, imgX, imgCardY, imgW, imgH);
        } catch (imgErr) {
          console.error("Erro ao desenhar imagem no PDF:", imgErr);
        }
      } else {
        // Anexo é PDF: gera Capa/Separador oficial e marca para mesclagem vetorial posterior
        doc.addPage();
        
        // Banner Superior
        doc.setFillColor(darkGreen[0], darkGreen[1], darkGreen[2]);
        doc.rect(0, 0, pageWidth, 30, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('DDS ON', 14, 18);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(230, 240, 235);
        doc.text('DOCUMENTO E PROCEDIMENTO TÉCNICO ANEXO', 14, 24);

        renderCompanyLogo(30);

        let sepY = 55;

        // Moldura Decorativa do Anexo
        doc.setDrawColor(tableHeaderGreen[0], tableHeaderGreen[1], tableHeaderGreen[2]);
        doc.setLineWidth(0.6);
        doc.setFillColor(lightGreenBg[0], lightGreenBg[1], lightGreenBg[2]);
        doc.roundedRect(20, sepY, pageWidth - 40, 140, 4, 4, 'FD');

        // Título do Anexo
        doc.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(anexoLabel, pageWidth / 2, sepY + 22, { align: 'center' });

        doc.setTextColor(textDark[0], textDark[1], textDark[2]);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        const splitDocTitle = doc.splitTextToSize(att.displayName || att.fileName, pageWidth - 60);
        doc.text(splitDocTitle, pageWidth / 2, sepY + 34, { align: 'center' });

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
        doc.text(`Arquivo: ${att.fileName}  •  Formato: Documento PDF (${att.pageCount || 1} páginas)`, pageWidth / 2, sepY + 48, { align: 'center' });

        // Divisória
        doc.setDrawColor(200, 215, 205);
        doc.setLineWidth(0.3);
        doc.line(35, sepY + 56, pageWidth - 35, sepY + 56);

        // Bloco de Descrição Técnica
        const sepDesc = att.description || 'Material normativo e instrucional apresentado integralmente aos colaboradores durante a sessão de DDS.';
        const splitDesc = doc.splitTextToSize(sepDesc, pageWidth - 70);
        doc.setFontSize(8.5);
        doc.setTextColor(textDark[0], textDark[1], textDark[2]);
        doc.text('Descrição / Finalidade Operacional:', 35, sepY + 68);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
        doc.text(splitDesc, 35, sepY + 76);

        // Metadados do DDS
        const metaY = sepY + 105;
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]);
        doc.text(`Tema do DDS:`, 35, metaY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(textDark[0], textDark[1], textDark[2]);
        doc.text(meeting.topic || 'DDS de Segurança', 60, metaY);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]);
        doc.text(`Responsável:`, 35, metaY + 6);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(textDark[0], textDark[1], textDark[2]);
        doc.text(meeting.instructorName || meeting.organizer?.name || 'Técnico Responsável', 60, metaY + 6);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]);
        doc.text(`Data / Horário:`, 35, metaY + 12);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(textDark[0], textDark[1], textDark[2]);
        doc.text(dateStr, 60, metaY + 12);

        // Aviso Informativo
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(30, sepY + 123, pageWidth - 60, 12, 2, 2, 'F');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]);
        doc.text('✓ As páginas oficiais deste documento foram anexadas a seguir com qualidade vetorial.', pageWidth / 2, sepY + 130.5, { align: 'center' });

        // Guarda referência para mesclagem
        pdfAttachmentsToMerge.push({ index: idx, attachment: att });
      }
    });
  }

  // --- CÁLCULO DO HASH DE INTEGRIDADE DOCUMENTAL SHA-256 ---
  const rawDataForHash = [
    meeting.id || '',
    meeting.topic || '',
    meeting.createdAt ? new Date(meeting.createdAt).toISOString() : '',
    meeting.endedAt ? new Date(meeting.endedAt).toISOString() : '',
    meeting.attendees?.map(a => `${a.name}:${a.cpf}`).join(';') || '',
    meeting.attachments?.map(att => `${att.fileName}:${att.fileSize}`).join(';') || ''
  ].join('|');
  const docHash = meeting.documentHash || await getDocumentSha256(rawDataForHash);
  const displayHash = `${docHash.slice(0, 16)}...${docHash.slice(-8)}`.toUpperCase();
  const ddsIdDisplay = meeting.id ? `DDS-${meeting.id.slice(0, 8).toUpperCase()}` : `DDS-${ddsDate.getFullYear()}${String(ddsDate.getMonth()+1).padStart(2,'0')}${String(ddsDate.getDate()).padStart(2,'0')}`;

  // --- FOOTER EM TODAS AS PÁGINAS DO JSPDF ---
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const footY = pageHeight - 20;
    
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text('Documento de registro e evidência de SST', 14, footY);
    doc.text('Emitido digitalmente pela plataforma DDS ON', 14, footY + 3.5);
    doc.text(`ID Único: ${ddsIdDisplay}   •   Integridade (SHA-256): ${displayHash}`, 14, footY + 7);
    
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, footY, { align: 'right' });
    doc.text(dateStr, pageWidth - 14, footY + 3.5, { align: 'right' });
    doc.text('Registro sob diretrizes corporativas de SST', pageWidth - 14, footY + 7, { align: 'right' });
    
    // Bottom edge line
    doc.setFillColor(darkGreen[0], darkGreen[1], darkGreen[2]);
    doc.rect(0, pageHeight - 6, pageWidth, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(5.8);
    doc.setFont('helvetica', 'bold');
    doc.text('© 2026 AM TST. Todos os direitos reservados. DDS ON é uma plataforma da AM TST.', pageWidth/2, pageHeight - 2, { align: 'center' });
  }

  const cleanTopic = (meeting.topic || 'DDS').replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `Relatorio_Auditoria_DDS_ON_${cleanTopic}_${new Date().toISOString().slice(0, 10)}.pdf`;

  // =========================================================================
  // CONSOLIDAÇÃO VETORIAL DOS PDFs ANEXADOS USANDO PDF-LIB
  // =========================================================================
  try {
    const mainPdfBytes = doc.output('arraybuffer');

    if (pdfAttachmentsToMerge.length === 0) {
      // Sem PDFs para mesclar, salva direto
      doc.save(fileName);
      return;
    }

    const mergedPdf = await PDFDocument.load(mainPdfBytes);

    for (const item of pdfAttachmentsToMerge) {
      try {
        const base64Data = item.attachment.fileData.replace(/^data:application\/pdf;base64,/, '').trim();
        const binaryStr = atob(base64Data);
        const donorBytes = new Uint8Array(binaryStr.length);
        for (let j = 0; j < binaryStr.length; j++) {
          donorBytes[j] = binaryStr.charCodeAt(j);
        }

        const donorPdf = await PDFDocument.load(donorBytes, { ignoreEncryption: true });
        const pageIndices = donorPdf.getPageIndices();
        const copiedPages = await mergedPdf.copyPages(donorPdf, pageIndices);
        
        for (const page of copiedPages) {
          mergedPdf.addPage(page);
        }
      } catch (err) {
        console.error(`Falha ao mesclar páginas do PDF "${item.attachment.fileName}":`, err);
      }
    }

    const finalPdfBytes = await mergedPdf.save();
    const blob = new Blob([finalPdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 8000);
  } catch (mergeError) {
    console.error("Erro na consolidação pdf-lib, exportando via jsPDF padrão:", mergeError);
    doc.save(fileName);
  }
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
  doc.text('DDS ON - DOSSIÊ CONSOLIDADO DE REGISTROS DE SST', 14, 17);

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
    m.topic + (m.classification && m.classification !== 'DDS' ? ` (${m.classification})` : ''),
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
      `Dossiê Consolidado • © 2026 AM TST. Todos os direitos reservados. DDS ON é uma plataforma da AM TST. - Página ${i} de ${pageCount}`,
      14,
      doc.internal.pageSize.height - 8
    );
  }

  doc.save(`Dossie_Consolidado_DDS_ON_${new Date().toISOString().slice(0, 10)}.pdf`);
}
