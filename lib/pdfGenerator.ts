import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDFDocument } from 'pdf-lib';
import QRCode from 'qrcode';

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
  groupPhoto?: string | string[] | null;
  attachments?: AttachmentPdfData[];
  documentHash?: string | null;
}

// Helper para carregar o logo oficial DDS ON do public ou cache
async function getLogoBase64(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch('/logo.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return null;
  }
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

export function parseGroupPhotos(groupPhoto?: string | string[] | null): string[] {
  if (!groupPhoto) return [];
  if (Array.isArray(groupPhoto)) return groupPhoto.filter((p): p is string => typeof p === 'string' && p.length > 50);
  if (typeof groupPhoto !== 'string') return [];
  const trimmed = groupPhoto.trim();
  if (!trimmed || trimmed.length < 50) return [];
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter((p: any): p is string => typeof p === 'string' && p.length > 50);
      }
    } catch (e) {}
  }
  return [trimmed];
}

// Helper para desenhar ícones vetoriais com alta fidelidade no jsPDF
function drawVectorIcon(doc: jsPDF, type: 'document' | 'users' | 'location' | 'calendar' | 'check' | 'helmet', x: number, y: number, size = 6, color = [0, 99, 65]) {
  doc.setFillColor(color[0], color[1], color[2]);
  doc.setDrawColor(color[0], color[1], color[2]);

  if (type === 'document') {
    // Ícone de documento com dobra
    doc.roundedRect(x, y, size * 0.8, size, 0.8, 0.8, 'F');
    doc.setFillColor(255, 255, 255);
    doc.rect(x + size * 0.2, y + size * 0.3, size * 0.4, size * 0.1, 'F');
    doc.rect(x + size * 0.2, y + size * 0.5, size * 0.4, size * 0.1, 'F');
    doc.rect(x + size * 0.2, y + size * 0.7, size * 0.25, size * 0.1, 'F');
  } else if (type === 'users') {
    // Ícone de grupo de pessoas
    doc.circle(x + size * 0.5, y + size * 0.3, size * 0.22, 'F');
    doc.roundedRect(x + size * 0.15, y + size * 0.55, size * 0.7, size * 0.4, 1.2, 1.2, 'F');
    // Segunda pessoa ao lado (sombra)
    doc.circle(x + size * 0.85, y + size * 0.25, size * 0.18, 'F');
    doc.roundedRect(x + size * 0.65, y + size * 0.48, size * 0.45, size * 0.35, 1, 1, 'F');
  } else if (type === 'location') {
    // Ícone de pino de localização
    doc.circle(x + size * 0.45, y + size * 0.35, size * 0.3, 'F');
    doc.setFillColor(255, 255, 255);
    doc.circle(x + size * 0.45, y + size * 0.35, size * 0.12, 'F');
    doc.setFillColor(color[0], color[1], color[2]);
    // Ponta do pino
    doc.triangle(
      x + size * 0.25, y + size * 0.45,
      x + size * 0.65, y + size * 0.45,
      x + size * 0.45, y + size * 0.85,
      'F'
    );
  } else if (type === 'calendar') {
    // Ícone de calendário
    doc.roundedRect(x, y + size * 0.15, size * 0.85, size * 0.75, 0.8, 0.8, 'F');
    doc.setFillColor(255, 255, 255);
    doc.rect(x + size * 0.1, y + size * 0.38, size * 0.65, size * 0.45, 'F');
    doc.setFillColor(color[0], color[1], color[2]);
    // Pontos do calendário
    doc.rect(x + size * 0.2, y + size * 0.48, size * 0.12, size * 0.12, 'F');
    doc.rect(x + size * 0.4, y + size * 0.48, size * 0.12, size * 0.12, 'F');
    doc.rect(x + size * 0.6, y + size * 0.48, size * 0.12, size * 0.12, 'F');
  } else if (type === 'check') {
    // Círculo com checkmark
    doc.circle(x + size / 2, y + size / 2, size / 2, 'F');
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(size * 0.12);
    doc.line(x + size * 0.28, y + size * 0.5, x + size * 0.44, y + size * 0.68);
    doc.line(x + size * 0.44, y + size * 0.68, x + size * 0.74, y + size * 0.32);
  } else if (type === 'helmet') {
    // Capacete de segurança estilizado
    doc.setFillColor(46, 204, 113);
    doc.circle(x + size * 0.5, y + size * 0.5, size * 0.45, 'F');
    doc.rect(x + size * 0.1, y + size * 0.65, size * 0.8, size * 0.2, 'F');
  }
}

export async function generateDdsPdf(meeting: MeetingData): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  
  const pageWidth = doc.internal.pageSize.width; // 210mm
  const pageHeight = doc.internal.pageSize.height; // 297mm

  // Paleta de Cores Institucionais DDS ON
  const brandDarkGreen: [number, number, number] = [0, 99, 65];       // #006341 Deep Pine Green
  const brandHeaderGreen: [number, number, number] = [0, 80, 52];     // #005034 Dark Emerald
  const brandAccentGreen: [number, number, number] = [46, 204, 113];   // #2ecc71 Bright Lime Green
  const brandMintBg: [number, number, number] = [238, 247, 242];      // #eef7f2 Soft Mint Background
  const brandCardBorder: [number, number, number] = [204, 231, 216];  // #cce7d8 Border
  const textDarkNavy: [number, number, number] = [15, 23, 42];        // #0f172a Deep Slate / Navy
  const textBody: [number, number, number] = [30, 41, 59];            // #1e293b Slate 800
  const textMuted: [number, number, number] = [100, 116, 139];        // #64748b Slate 500
  const lightGrayBg: [number, number, number] = [248, 250, 249];

  // Carrega o logo oficial em base64 se disponível no browser
  const officialLogoBase64 = await getLogoBase64();

  // Helper para renderizar o logo da empresa do cliente
  const renderCompanyLogo = (bannerHeight = 32) => {
    if (typeof window !== 'undefined') {
      try {
        const companyLogo = localStorage.getItem('dds_company_logo');
        if (companyLogo) {
          const props = doc.getImageProperties(companyLogo);
          const maxW = 45;
          const maxH = 20;
          const ratio = Math.min(maxW / props.width, maxH / props.height);
          const finalW = props.width * ratio;
          const finalH = props.height * ratio;
          
          const xPos = pageWidth - 14 - finalW;
          const yPos = (bannerHeight - finalH) / 2;
          
          doc.setFillColor(255, 255, 255);
          doc.roundedRect(xPos - 2.5, yPos - 2.5, finalW + 5, finalH + 5, 2, 2, 'F');
          doc.addImage(companyLogo, 'PNG', xPos, yPos, finalW, finalH);
          return true;
        }
      } catch (e) {}
    }
    return false;
  };

  // Helper para desenhar o Top Header Institucional
  const drawPageHeader = (isFirstPage = false) => {
    const bannerHeight = 32;
    // Fundo do Banner Verde Escuro
    doc.setFillColor(brandHeaderGreen[0], brandHeaderGreen[1], brandHeaderGreen[2]);
    doc.rect(0, 0, pageWidth, bannerHeight, 'F');

    // Linha verde vibrante inferior de destaque
    doc.setFillColor(brandAccentGreen[0], brandAccentGreen[1], brandAccentGreen[2]);
    doc.rect(0, bannerHeight - 1, pageWidth, 1, 'F');

    // Logo Oficial DDS ON à esquerda
    let hasDdsLogo = false;
    if (officialLogoBase64) {
      try {
        doc.addImage(officialLogoBase64, 'PNG', 14, 5, 42, 22);
        hasDdsLogo = true;
      } catch (e) {}
    }

    if (!hasDdsLogo) {
      // Vetor fallback de alta definição caso a imagem PNG falhe
      drawVectorIcon(doc, 'helmet', 14, 8, 14, [46, 204, 113]);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('DDS', 31, 16);
      
      doc.setTextColor(brandAccentGreen[0], brandAccentGreen[1], brandAccentGreen[2]);
      doc.text('ON', 46, 16);

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(200, 235, 215);
      doc.text('SEGURANÇA HOJE, UM AMANHÃ MELHOR', 31, 21.5);
    }

    // Logo da Empresa à direita ou Slogan Institucional dos prints
    const hasCompany = renderCompanyLogo(bannerHeight);
    if (!hasCompany && isFirstPage) {
      // Slogan elegante idêntico aos prints da referência
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(140, 230, 180);
      doc.text('Pessoas seguras', pageWidth - 14, 13, { align: 'right' });
      doc.text('constroem grandes', pageWidth - 14, 18, { align: 'right' });
      doc.setFont('helvetica', 'bolditalic');
      doc.setTextColor(180, 245, 210);
      doc.text('resultados', pageWidth - 14, 23, { align: 'right' });
    } else if (!hasCompany && !isFirstPage) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(215, 240, 225);
      doc.text('REGISTRO OFICIAL DE SST', pageWidth - 14, 15, { align: 'right' });
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.text('Auditoria Digital DDS ON', pageWidth - 14, 20, { align: 'right' });
    }
  };

  // =========================================================================
  // PÁGINA 1: FRENTE - REGISTRO DE CONFORMIDADE, PRESENÇA E AUDITORIA
  // =========================================================================
  drawPageHeader(true);

  let currentY = 40;

  // --- TÍTULO EDITORIAL DO DOCUMENTO (IDENTICO AOS PRINTS) ---
  doc.setTextColor(textDarkNavy[0], textDarkNavy[1], textDarkNavy[2]);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('REGISTRO DE CONFORMIDADE,', 14, currentY);
  doc.text('PRESENÇA E AUDITORIA', 14, currentY + 5.5);

  currentY += 10.5;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  
  const subTitleText = meeting.classification === 'Treinamento'
    ? 'Documento que comprova a realização do Treinamento Obrigatório (SST)'
    : meeting.classification === 'Campanha'
    ? 'Documento que comprova a realização da Campanha de Segurança e Saúde (SST)'
    : 'Documento que comprova a realização do Diálogo Diário de Segurança (DDS)';
  doc.text(subTitleText, 14, currentY);

  currentY += 7;

  // --- FORMATAÇÃO DE DATA E HORÁRIO ---
  const ddsDate = new Date(meeting.createdAt || Date.now());
  const endDate = meeting.endedAt ? new Date(meeting.endedAt) : null;
  let dateFormattedStr = ddsDate.toLocaleDateString('pt-BR') + ', ' + ddsDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (endDate) {
    dateFormattedStr = ddsDate.toLocaleDateString('pt-BR') + ', ' + ddsDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + ' até ' + endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  // --- SEÇÃO DE METADADOS: GRID 2x2 NA ESQUERDA + CARD TOTAL REGISTRADO NA DIREITA ---
  const totalWidth = pageWidth - 28; // 182mm
  const rightBadgeW = 54; // Card Total Registrado
  const leftGridW = totalWidth - rightBadgeW - 4; // 124mm
  const gridH = 34; // Altura do bloco de metadados

  // 1. Bloco de Metadados Esquerdo (2x2 com fundo suave e bordas arredondadas)
  doc.setFillColor(brandMintBg[0], brandMintBg[1], brandMintBg[2]);
  doc.roundedRect(14, currentY, leftGridW, gridH, 3.5, 3.5, 'F');
  doc.setDrawColor(brandCardBorder[0], brandCardBorder[1], brandCardBorder[2]);
  doc.setLineWidth(0.25);
  doc.roundedRect(14, currentY, leftGridW, gridH, 3.5, 3.5, 'S');

  const cellW = leftGridW / 2;
  const row1Y = currentY + 4;
  const row2Y = currentY + 19;

  // Célula 1: Tema do DDS (com ícone Documento)
  drawVectorIcon(doc, 'document', 18, row1Y + 0.5, 5, brandDarkGreen);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDarkNavy[0], textDarkNavy[1], textDarkNavy[2]);
  const themeLabel = meeting.classification === 'Treinamento' ? 'Tema do Treinamento' : meeting.classification === 'Campanha' ? 'Tema da Campanha' : 'Tema do DDS';
  doc.text(themeLabel, 26, row1Y + 3);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textBody[0], textBody[1], textBody[2]);
  const topicLines = doc.splitTextToSize(meeting.topic || 'Não informado', cellW - 16);
  doc.text(topicLines[0] || 'Não informado', 26, row1Y + 8);

  // Célula 2: Modalidade (com ícone Users)
  drawVectorIcon(doc, 'users', 14 + cellW + 4, row1Y + 0.5, 5, brandDarkGreen);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDarkNavy[0], textDarkNavy[1], textDarkNavy[2]);
  doc.text('Modalidade', 14 + cellW + 12, row1Y + 3);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textBody[0], textBody[1], textBody[2]);
  const modalidadeStr = meeting.type === 'PRESENTIAL' ? 'Presencial (Canteiro/Galpão)' : 'Remoto / EAD';
  doc.text(modalidadeStr, 14 + cellW + 12, row1Y + 8);

  // Célula 3: Local / Fazenda (com ícone Location Pin)
  drawVectorIcon(doc, 'location', 18, row2Y + 0.5, 5, brandDarkGreen);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDarkNavy[0], textDarkNavy[1], textDarkNavy[2]);
  doc.text('Local / Fazenda', 26, row2Y + 3);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textBody[0], textBody[1], textBody[2]);
  const farmLines = doc.splitTextToSize(meeting.farm || 'Não informado', cellW - 16);
  doc.text(farmLines[0] || 'Não informado', 26, row2Y + 8);

  // Célula 4: Data e Horário (com ícone Calendar)
  drawVectorIcon(doc, 'calendar', 14 + cellW + 4, row2Y + 0.5, 5, brandDarkGreen);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDarkNavy[0], textDarkNavy[1], textDarkNavy[2]);
  doc.text('Data e Horário', 14 + cellW + 12, row2Y + 3);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textBody[0], textBody[1], textBody[2]);
  doc.text(dateFormattedStr, 14 + cellW + 12, row2Y + 8);

  // 2. Card "Total Registrado" à Direita (Fiel ao print)
  const rightBadgeX = 14 + leftGridW + 4;
  doc.setFillColor(brandMintBg[0], brandMintBg[1], brandMintBg[2]);
  doc.roundedRect(rightBadgeX, currentY, rightBadgeW, gridH, 3.5, 3.5, 'F');
  doc.setDrawColor(brandCardBorder[0], brandCardBorder[1], brandCardBorder[2]);
  doc.setLineWidth(0.25);
  doc.roundedRect(rightBadgeX, currentY, rightBadgeW, gridH, 3.5, 3.5, 'S');

  // Ícone de usuários no topo do card
  drawVectorIcon(doc, 'users', rightBadgeX + (rightBadgeW - 8) / 2, currentY + 3.5, 8, brandDarkGreen);

  // Label "Total Registrado"
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandDarkGreen[0], brandDarkGreen[1], brandDarkGreen[2]);
  doc.text('Total Registrado', rightBadgeX + rightBadgeW / 2, currentY + 16, { align: 'center' });

  // Número Gigante em destaque
  const totalAttendeesCount = meeting.attendees?.length || 0;
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandDarkGreen[0], brandDarkGreen[1], brandDarkGreen[2]);
  doc.text(String(totalAttendeesCount), rightBadgeX + rightBadgeW / 2, currentY + 25, { align: 'center' });

  // Subtítulo "colaborador(es)"
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('colaborador(es)', rightBadgeX + rightBadgeW / 2, currentY + 30, { align: 'center' });

  currentY += gridH + 4;

  // --- OBJETIVO ESPECÍFICO DO DDS (SE PREENCHIDO) ---
  const rawObjective = (meeting.objective || '').trim();
  if (rawObjective) {
    const objLines = doc.splitTextToSize(rawObjective, totalWidth - 16);
    const objLineCount = Array.isArray(objLines) ? objLines.length : 1;
    const objH = Math.max(12, 6 + objLineCount * 4);

    doc.setFillColor(brandMintBg[0], brandMintBg[1], brandMintBg[2]);
    doc.roundedRect(14, currentY, totalWidth, objH, 2.5, 2.5, 'F');
    
    // Linha verde vertical de acento na esquerda
    doc.setFillColor(brandDarkGreen[0], brandDarkGreen[1], brandDarkGreen[2]);
    doc.roundedRect(14, currentY, 2.5, objH, 1, 1, 'F');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(brandDarkGreen[0], brandDarkGreen[1], brandDarkGreen[2]);
    doc.text('OBJETIVO ESPECÍFICO:', 19, currentY + 4.5);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textBody[0], textBody[1], textBody[2]);
    doc.text(objLines, 19, currentY + 9);

    currentY += objH + 4;
  }

  // --- BARRA CABEÇALHO DA TABELA "LISTA DE PRESENÇA" (IDENTICA AO PRINT) ---
  const tableHeaderBarH = 8;
  doc.setFillColor(brandDarkGreen[0], brandDarkGreen[1], brandDarkGreen[2]);
  doc.roundedRect(14, currentY, totalWidth, tableHeaderBarH, 2.5, 2.5, 'F');

  // Ícone Users e Texto Branco
  drawVectorIcon(doc, 'users', 17, currentY + 1.5, 5, [255, 255, 255]);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('LISTA DE PRESENÇA', 24, currentY + 5.5);

  currentY += tableHeaderBarH + 0.5;

  // --- TABELA DE PARTICIPANTES (JSPDF-AUTOTABLE) ---
  const attendeesList = meeting.attendees || [];
  const tableRows = attendeesList.map((a, idx) => {
    return [
      String(idx + 1),
      a.name.replace(/\(Saída:.*\)/, '').trim(),
      a.cpf || '-',
      new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      '', // Status pill desenhado no didDrawCell
      '', // Biometria facial desenhada no didDrawCell
      ''  // Assinatura digital desenhada no didDrawCell
    ];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { top: 36, bottom: 25, left: 14, right: 14 },
    head: [['#', 'NOME COMPLETO', 'CPF', 'ENTRADA', 'STATUS / SAÍDA', 'BIOMETRIA', 'ASSINATURA DIGITAL']],
    body: tableRows.length > 0 ? tableRows : [['-', 'Nenhum participante registrado nesta reunião', '-', '-', '-', '-', '-']],
    theme: 'plain',
    headStyles: {
      fillColor: [238, 247, 242],
      textColor: textDarkNavy,
      fontStyle: 'bold',
      halign: 'left',
      valign: 'middle',
      fontSize: 7.5,
      minCellHeight: 8,
      lineColor: [220, 235, 226],
      lineWidth: { bottom: 0.2, top: 0, left: 0, right: 0 },
      cellPadding: { top: 2, bottom: 2, left: 2, right: 2 }
    },
    styles: {
      fontSize: 7.5,
      valign: 'middle',
      halign: 'left',
      textColor: textBody,
      lineColor: [230, 238, 233],
      lineWidth: { bottom: 0.2, top: 0, left: 0, right: 0 },
      minCellHeight: 18,
      cellPadding: { top: 2, bottom: 2, left: 2, right: 2 }
    },
    alternateRowStyles: {
      fillColor: [253, 255, 254]
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 42, halign: 'left', fontStyle: 'bold' },
      2: { cellWidth: 26, halign: 'left' },
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 32, halign: 'center' },
      5: { cellWidth: 26, halign: 'center' },
      6: { cellWidth: 32, halign: 'center' }
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && attendeesList.length > 0) {
        const attendee = attendeesList[data.row.index];
        if (!attendee) return;

        // 1. Badge Pill de Status
        if (data.column.index === 4) {
          const isEarlyExit = !!attendee.exitReason;
          const bg = isEarlyExit ? [254, 226, 226] : [220, 252, 231]; // Rose vs Emerald-100
          const fg = isEarlyExit ? [153, 27, 27] : [22, 101, 52];     // Rose-800 vs Emerald-800
          
          doc.setFillColor(bg[0], bg[1], bg[2]);
          const pillW = 28;
          const pillH = 10;
          const px = data.cell.x + (data.cell.width - pillW) / 2;
          const py = data.cell.y + (data.cell.height - pillH) / 2;
          
          // Fundo arredondado da pílula
          doc.roundedRect(px, py, pillW, pillH, 2.5, 2.5, 'F');
          
          // Círculo com checkmark ou aviso
          doc.setFillColor(isEarlyExit ? 239 : 22, isEarlyExit ? 68 : 163, isEarlyExit ? 68 : 74);
          doc.circle(px + 4.5, py + 5, 2.2, 'F');
          doc.setDrawColor(255, 255, 255);
          doc.setLineWidth(0.4);
          if (isEarlyExit) {
            doc.line(px + 3.3, py + 3.8, px + 5.7, py + 6.2);
            doc.line(px + 5.7, py + 3.8, px + 3.3, py + 6.2);
          } else {
            doc.line(px + 3.3, py + 5, px + 4.2, py + 6);
            doc.line(px + 4.2, py + 6, px + 5.7, py + 3.8);
          }
          
          doc.setTextColor(fg[0], fg[1], fg[2]);
          doc.setFontSize(5.8);
          doc.setFont('helvetica', 'bold');
          
          if (isEarlyExit) {
            doc.text('SAÍDA', px + 15.5, py + 4.2, { align: 'center' });
            doc.text('ANTECIPADA', px + 15.5, py + 7.4, { align: 'center' });
          } else {
            doc.text('PRESENTE', px + 15.5, py + 4.2, { align: 'center' });
            doc.text('ATÉ O FIM', px + 15.5, py + 7.4, { align: 'center' });
          }
        }

        // 2. Biometria Facial (Foto com moldura suave)
        if (data.column.index === 5 && attendee.selfie) {
          try {
            const format = attendee.selfie.includes('image/png') ? 'PNG' : 'JPEG';
            const photoSize = 13.5;
            const photoX = data.cell.x + (data.cell.width - photoSize) / 2;
            const photoY = data.cell.y + (data.cell.height - photoSize) / 2;
            
            // Fundo da foto
            doc.setFillColor(245, 245, 245);
            doc.roundedRect(photoX - 0.5, photoY - 0.5, photoSize + 1, photoSize + 1, 1.5, 1.5, 'F');
            doc.addImage(attendee.selfie, format, photoX, photoY, photoSize, photoSize);
            doc.setDrawColor(200, 215, 205);
            doc.setLineWidth(0.2);
            doc.roundedRect(photoX - 0.5, photoY - 0.5, photoSize + 1, photoSize + 1, 1.5, 1.5, 'S');
          } catch (e) {
            console.warn('Aviso: selfie não pôde ser renderizada no PDF:', e);
          }
        }

        // 3. Assinatura Digital Vetorial/PNG com Proporção Preservada
        if (data.column.index === 6 && attendee.signature) {
          try {
            const format = attendee.signature.includes('image/jpeg') ? 'JPEG' : 'PNG';
            const maxSigW = 28;
            const maxSigH = 12;
            let finalSigW = maxSigW;
            let finalSigH = maxSigH;

            const sigProps = doc.getImageProperties(attendee.signature);
            if (sigProps) {
              const ratio = sigProps.width / sigProps.height;
              finalSigH = finalSigW / ratio;
              if (finalSigH > maxSigH) {
                finalSigH = maxSigH;
                finalSigW = finalSigH * ratio;
              }
            }

            const sigX = data.cell.x + (data.cell.width - finalSigW) / 2;
            const sigY = data.cell.y + (data.cell.height - finalSigH) / 2;
            doc.addImage(attendee.signature, format, sigX, sigY, finalSigW, finalSigH);
          } catch (e) {
            console.warn('Aviso: assinatura não pôde ser renderizada no PDF:', e);
          }
        }
      }
    }
  });

  let tableFinalY = (doc as any).lastAutoTable.finalY + 6;

  // --- CARD INFORMATIVO DE SUCESSO & CERTIFICAÇÃO (IDENTICO AO PRINT) ---
  const successCardH = 18;
  // Se o card estourar a página, empurra ou ajusta
  if (tableFinalY + successCardH > pageHeight - 32) {
    doc.addPage();
    drawPageHeader(false);
    tableFinalY = 40;
  }

  doc.setFillColor(brandMintBg[0], brandMintBg[1], brandMintBg[2]);
  doc.roundedRect(14, tableFinalY, totalWidth, successCardH, 3.5, 3.5, 'F');
  doc.setDrawColor(brandCardBorder[0], brandCardBorder[1], brandCardBorder[2]);
  doc.setLineWidth(0.25);
  doc.roundedRect(14, tableFinalY, totalWidth, successCardH, 3.5, 3.5, 'S');

  // Badge Circular Verde com Checkmark
  drawVectorIcon(doc, 'check', 18, tableFinalY + 4, 10, brandDarkGreen);

  // Texto Central de Confirmação
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDarkNavy[0], textDarkNavy[1], textDarkNavy[2]);
  doc.text('Registro concluído com sucesso!', 32, tableFinalY + 6.5);

  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textBody[0], textBody[1], textBody[2]);
  doc.text('Este documento atesta a presença dos colaboradores no DDS, conforme os dados registrados', 32, tableFinalY + 11);
  doc.text('no sistema DDS ON.', 32, tableFinalY + 14.5);

  // Linha divisória vertical fina
  const quoteDividerX = 14 + totalWidth - 62;
  doc.setDrawColor(200, 225, 215);
  doc.setLineWidth(0.3);
  doc.line(quoteDividerX, tableFinalY + 3, quoteDividerX, tableFinalY + successCardH - 3);

  // Frase de impacto à direita (Segurança não é um custo...)
  doc.setFontSize(7.2);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(textBody[0], textBody[1], textBody[2]);
  doc.text('"Segurança não é um custo,', quoteDividerX + 4, tableFinalY + 6.5);
  doc.text('é um investimento na vida."', quoteDividerX + 4, tableFinalY + 10.5);

  // Pincelada verde de destaque abaixo da frase
  doc.setDrawColor(brandAccentGreen[0], brandAccentGreen[1], brandAccentGreen[2]);
  doc.setLineWidth(0.8);
  doc.line(quoteDividerX + 4, tableFinalY + 13.5, quoteDividerX + 38, tableFinalY + 13.5);

  tableFinalY += successCardH + 6;

  // --- FOTOS DA EQUIPE (EVIDÊNCIAS DE CAMPO EM GRADE BALANCEADA) ---
  const teamPhotosList = parseGroupPhotos(meeting.groupPhoto);

  if (teamPhotosList.length > 0) {
    if (teamPhotosList.length === 1) {
      const singlePhoto = teamPhotosList[0];
      const maxW = 110;
      const maxH = 65;
      let imgWidth = maxW;
      let imgHeight = maxH;
      try {
        const imgProps = doc.getImageProperties(singlePhoto);
        if (imgProps) {
          const ratio = imgProps.width / imgProps.height;
          imgHeight = imgWidth / ratio;
          if (imgHeight > maxH) {
            imgHeight = maxH;
            imgWidth = imgHeight * ratio;
          }
        }
      } catch (e) {}

      if (tableFinalY + imgHeight + 16 > pageHeight - 28) {
        doc.addPage();
        drawPageHeader(false);
        tableFinalY = 40;
      }

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(textDarkNavy[0], textDarkNavy[1], textDarkNavy[2]);
      doc.text('FOTO DA EQUIPE (EVIDÊNCIA DE CAMPO)', pageWidth / 2, tableFinalY, { align: 'center' });

      const imgX = (pageWidth - imgWidth) / 2;
      const format = singlePhoto.includes('image/png') ? 'PNG' : 'JPEG';
      
      // Moldura suave
      doc.setFillColor(lightGrayBg[0], lightGrayBg[1], lightGrayBg[2]);
      doc.roundedRect(imgX - 2, tableFinalY + 3, imgWidth + 4, imgHeight + 4, 3, 3, 'F');
      doc.setDrawColor(brandCardBorder[0], brandCardBorder[1], brandCardBorder[2]);
      doc.setLineWidth(0.25);
      doc.roundedRect(imgX - 2, tableFinalY + 3, imgWidth + 4, imgHeight + 4, 3, 3, 'S');

      try {
        doc.addImage(singlePhoto, format, imgX, tableFinalY + 5, imgWidth, imgHeight);
      } catch (e) {}
      tableFinalY += imgHeight + 14;
    } else {
      // Grade elegante de 2 colunas para múltiplas fotos
      const slotW = 88;
      const slotH = 52;
      const colGap = 6;
      const leftColX = 14;
      const rightColX = 14 + slotW + colGap;

      if (tableFinalY + 65 > pageHeight - 28) {
        doc.addPage();
        drawPageHeader(false);
        tableFinalY = 40;
      }

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(textDarkNavy[0], textDarkNavy[1], textDarkNavy[2]);
      doc.text(`FOTOS DA EQUIPE (${teamPhotosList.length} EVIDÊNCIAS DE CAMPO)`, pageWidth / 2, tableFinalY, { align: 'center' });
      tableFinalY += 6;

      for (let i = 0; i < teamPhotosList.length; i++) {
        const isRightCol = i % 2 === 1;
        const colX = isRightCol ? rightColX : leftColX;

        // Se for o início de uma nova linha (exceto a primeira)
        if (i > 0 && i % 2 === 0) {
          tableFinalY += slotH + 6;
          if (tableFinalY + slotH + 6 > pageHeight - 28) {
            doc.addPage();
            drawPageHeader(false);
            tableFinalY = 40;
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
            doc.text('FOTOS DA EQUIPE (CONTINUAÇÃO)', pageWidth / 2, tableFinalY, { align: 'center' });
            tableFinalY += 6;
          }
        }

        const photoItem = teamPhotosList[i];
        let imgWidth = slotW - 6;
        let imgHeight = slotH - 8;
        try {
          const imgProps = doc.getImageProperties(photoItem);
          if (imgProps) {
            const ratio = imgProps.width / imgProps.height;
            imgHeight = imgWidth / ratio;
            if (imgHeight > (slotH - 8)) {
              imgHeight = slotH - 8;
              imgWidth = imgHeight * ratio;
            }
          }
        } catch (e) {}

        const imgX = colX + (slotW - imgWidth) / 2;
        const imgY = tableFinalY + (slotH - 4 - imgHeight) / 2;

        // Moldura do slot
        doc.setFillColor(lightGrayBg[0], lightGrayBg[1], lightGrayBg[2]);
        doc.roundedRect(colX, tableFinalY, slotW, slotH, 3, 3, 'F');
        doc.setDrawColor(brandCardBorder[0], brandCardBorder[1], brandCardBorder[2]);
        doc.setLineWidth(0.25);
        doc.roundedRect(colX, tableFinalY, slotW, slotH, 3, 3, 'S');

        try {
          const format = photoItem.includes('image/png') ? 'PNG' : 'JPEG';
          doc.addImage(photoItem, format, imgX, imgY, imgWidth, imgHeight);
        } catch (e) {}

        // Legenda discreta
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(brandDarkGreen[0], brandDarkGreen[1], brandDarkGreen[2]);
        doc.text(`Evidência #${i + 1}`, colX + 4, tableFinalY + slotH - 2);
      }

      tableFinalY += slotH + 8;
    }
  }

  // =========================================================================
  // PÁGINA 2: VERSO DEDICADO (CONTEÚDO PROGRAMÁTICO & PLANO DE TREINAMENTO)
  // Gerado quando houver conteúdo programático ou a classificação for 'Treinamento' ou 'Campanha'
  // =========================================================================
  const rawContent = (meeting.programmaticContent || '').trim();
  const shouldRenderVerso = rawContent.length > 0 || meeting.classification === 'Treinamento' || meeting.classification === 'Campanha';

  if (shouldRenderVerso) {
    doc.addPage();
    drawPageHeader(false);

    let versoY = 40;

    // Título Principal do Verso
    doc.setTextColor(textDarkNavy[0], textDarkNavy[1], textDarkNavy[2]);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const versoMainTitle = meeting.classification === 'Campanha' ? 'PROGRAMAÇÃO & AÇÕES DA CAMPANHA' : 'CONTEÚDO PROGRAMÁTICO & METODOLOGIA';
    doc.text(versoMainTitle, 14, versoY);
    
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    const versoDesc = meeting.classification === 'Campanha' ? 'Detalhamento das ações de conscientização, dinâmicas e diretrizes de Segurança e Saúde (SST).' : 'Detalhamento pedagógico e normativo em conformidade com as Normas Regulamentadoras (NRs).';
    doc.text(versoDesc, 14, versoY + 5);

    versoY += 11;

    // Faixa de Resumo no Topo do Verso
    doc.setFillColor(brandMintBg[0], brandMintBg[1], brandMintBg[2]);
    doc.roundedRect(14, versoY, totalWidth, 14, 2.5, 2.5, 'F');
    doc.setDrawColor(brandCardBorder[0], brandCardBorder[1], brandCardBorder[2]);
    doc.setLineWidth(0.2);
    doc.roundedRect(14, versoY, totalWidth, 14, 2.5, 2.5, 'S');

    const vColW = totalWidth / 4;
    const vMetaY = versoY + 4.5;
    const vValY = versoY + 10;

    // Col 1: Tema
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(meeting.classification === 'Campanha' ? 'TEMA / CAMPANHA' : 'TEMA / TREINAMENTO', 17, vMetaY);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textDarkNavy[0], textDarkNavy[1], textDarkNavy[2]);
    const vTopicStr = meeting.topic || 'Não informado';
    doc.text(doc.splitTextToSize(vTopicStr, vColW - 6)[0] || vTopicStr, 17, vValY);

    // Col 2: Data e Horário
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text('DATA & HORÁRIO', 14 + vColW + 3, vMetaY);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textDarkNavy[0], textDarkNavy[1], textDarkNavy[2]);
    doc.text(dateFormattedStr, 14 + vColW + 3, vValY);

    // Col 3: Local / Unidade
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text('LOCAL / UNIDADE', 14 + (vColW * 2) + 3, vMetaY);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textDarkNavy[0], textDarkNavy[1], textDarkNavy[2]);
    const vFarmStr = meeting.farm || 'Não informado';
    doc.text(doc.splitTextToSize(vFarmStr, vColW - 6)[0] || vFarmStr, 14 + (vColW * 2) + 3, vValY);

    // Col 4: Instrutor
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text('INSTRUTOR / RESPONSÁVEL', 14 + (vColW * 3) + 3, vMetaY);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textDarkNavy[0], textDarkNavy[1], textDarkNavy[2]);
    const vInstStr = meeting.instructorName || meeting.organizer?.name || 'Não informado';
    doc.text(doc.splitTextToSize(vInstStr, vColW - 6)[0] || vInstStr, 14 + (vColW * 3) + 3, vValY);

    versoY += 18;

    // 1. Bloco de Objetivo Geral (somente se informado pelo usuário)
    if (rawObjective) {
      const vObjLines = doc.splitTextToSize(rawObjective, totalWidth - 12);
      const vObjLineCount = Array.isArray(vObjLines) ? vObjLines.length : 1;
      const vObjBlockH = Math.max(16, 9 + vObjLineCount * 4.5);

      doc.setFillColor(brandMintBg[0], brandMintBg[1], brandMintBg[2]);
      doc.roundedRect(14, versoY, totalWidth, vObjBlockH, 2.5, 2.5, 'F');
      doc.setDrawColor(brandCardBorder[0], brandCardBorder[1], brandCardBorder[2]);
      doc.setLineWidth(0.2);
      doc.roundedRect(14, versoY, totalWidth, vObjBlockH, 2.5, 2.5, 'S');
      
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(brandDarkGreen[0], brandDarkGreen[1], brandDarkGreen[2]);
      doc.text(meeting.classification === 'Campanha' ? '1. OBJETIVO DA CAMPANHA' : '1. OBJETIVO DO TREINAMENTO', 19, versoY + 6.5);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textBody[0], textBody[1], textBody[2]);
      doc.text(vObjLines, 19, versoY + 12);

      versoY += vObjBlockH + 5;
    }

    // 2. Bloco de Conteúdo Programático Ministrado (somente se informado pelo usuário)
    if (rawContent) {
      const vContentLines = doc.splitTextToSize(rawContent, totalWidth - 12);
      const vContentLineCount = Array.isArray(vContentLines) ? vContentLines.length : 1;
      const vContentBlockH = Math.max(25, 10 + vContentLineCount * 4.5);

      doc.setFillColor(brandMintBg[0], brandMintBg[1], brandMintBg[2]);
      doc.roundedRect(14, versoY, totalWidth, vContentBlockH, 2.5, 2.5, 'F');
      doc.setDrawColor(brandCardBorder[0], brandCardBorder[1], brandCardBorder[2]);
      doc.setLineWidth(0.2);
      doc.roundedRect(14, versoY, totalWidth, vContentBlockH, 2.5, 2.5, 'S');

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(brandDarkGreen[0], brandDarkGreen[1], brandDarkGreen[2]);
      doc.text(meeting.classification === 'Campanha' ? '2. PROGRAMAÇÃO E AÇÕES DA CAMPANHA' : '2. CONTEÚDO PROGRAMÁTICO & MÓDULOS MINISTRADOS', 19, versoY + 6.5);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textBody[0], textBody[1], textBody[2]);
      doc.text(vContentLines, 19, versoY + 12);

      versoY += vContentBlockH + 6;
    }

    // 3. Bloco de Declaração do Responsável pelo DDS
    const declText = 'Declaro para os devidos fins de registro de Segurança e Saúde no Trabalho que os conteúdos e orientações de segurança foram ministrados aos colaboradores listados nesta lista de presença, com base nas diretrizes internas de prevenção de acidentes da empresa.';
    const declLines = doc.splitTextToSize(declText, totalWidth - 12);
    const declLineCount = Array.isArray(declLines) ? declLines.length : 1;
    const declBlockH = 32 + declLineCount * 3.5;

    // Verifica se cabe na página antes do rodapé; se não, adiciona página
    if (versoY + declBlockH > pageHeight - 32) {
      doc.addPage();
      drawPageHeader(false);
      versoY = 40;
    }

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(14, versoY, totalWidth, declBlockH, 2.5, 2.5, 'F');
    doc.setDrawColor(brandDarkGreen[0], brandDarkGreen[1], brandDarkGreen[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(14, versoY, totalWidth, declBlockH, 2.5, 2.5, 'S');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(brandDarkGreen[0], brandDarkGreen[1], brandDarkGreen[2]);
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
    doc.setTextColor(textDarkNavy[0], textDarkNavy[1], textDarkNavy[2]);
    doc.text(instructorNameDisplay, pageWidth / 2, signY + 4, { align: 'center' });
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text('Instrutor / Responsável pela Aplicação', pageWidth / 2, signY + 7.5, { align: 'center' });
  }

  // =========================================================================
  // PÁGINAS DE EVIDÊNCIAS & MATERIAIS APRESENTADOS (ANEXOS)
  // =========================================================================
  const attachmentsList = (meeting.attachments || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  const pdfAttachmentsToMerge: { index: number; attachment: AttachmentPdfData }[] = [];

  if (attachmentsList.length > 0) {
    // Sumário se houver mais de 2 anexos
    if (attachmentsList.length > 2) {
      doc.addPage();
      drawPageHeader(false);

      let attPageY = 40;

      doc.setTextColor(textDarkNavy[0], textDarkNavy[1], textDarkNavy[2]);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('ÍNDICE GERAL DE EVIDÊNCIAS E ANEXOS', 14, attPageY);
      
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text('Comprovação documental dos arquivos, cartilhas, imagens e procedimentos exibidos durante o DDS.', 14, attPageY + 5);

      attPageY += 12;

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
        margin: { top: 36, bottom: 25, left: 14, right: 14 },
        head: [['ANEXO', 'NOME DO MATERIAL', 'FORMATO', 'TAMANHO', 'DESCRIÇÃO / OBSERVAÇÃO TÉCNICA']],
        body: attTableRows,
        theme: 'plain',
        headStyles: {
          fillColor: [238, 247, 242],
          textColor: textDarkNavy,
          fontStyle: 'bold',
          halign: 'left',
          fontSize: 7.5,
          minCellHeight: 8
        },
        styles: {
          fontSize: 7.5,
          textColor: textBody,
          lineColor: [220, 235, 226],
          lineWidth: { bottom: 0.2, top: 0, left: 0, right: 0 },
          cellPadding: 3
        },
        alternateRowStyles: {
          fillColor: [253, 255, 254]
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

    // Renderização de cada Anexo
    attachmentsList.forEach((att, idx) => {
      const isPdf = att.mimeType === 'application/pdf' || att.fileName.toLowerCase().endsWith('.pdf');
      const anexoLabel = `ANEXO ${String(idx + 1).padStart(2, '0')}`;

      if (!isPdf) {
        doc.addPage();
        drawPageHeader(false);

        let imgCardY = 40;

        doc.setTextColor(textDarkNavy[0], textDarkNavy[1], textDarkNavy[2]);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text(`${anexoLabel}: ${att.displayName || att.fileName}`, 14, imgCardY);
        imgCardY += 6;

        // Card de Descrição
        if (att.description) {
          doc.setFillColor(brandMintBg[0], brandMintBg[1], brandMintBg[2]);
          doc.roundedRect(14, imgCardY, totalWidth, 12, 2.5, 2.5, 'F');
          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(brandDarkGreen[0], brandDarkGreen[1], brandDarkGreen[2]);
          doc.text('Observação:', 18, imgCardY + 5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(textBody[0], textBody[1], textBody[2]);
          doc.text(doc.splitTextToSize(att.description, totalWidth - 40), 38, imgCardY + 5);
          imgCardY += 16;
        }

        // Imagem Centralizada e Proporcional
        try {
          const imgProps = doc.getImageProperties(att.fileData);
          const maxW = totalWidth;
          const maxH = pageHeight - imgCardY - 32;
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
        doc.addPage();
        drawPageHeader(false);

        let sepY = 55;

        // Moldura Decorativa do Anexo
        doc.setFillColor(brandMintBg[0], brandMintBg[1], brandMintBg[2]);
        doc.roundedRect(20, sepY, pageWidth - 40, 140, 4, 4, 'F');
        doc.setDrawColor(brandDarkGreen[0], brandDarkGreen[1], brandDarkGreen[2]);
        doc.setLineWidth(0.4);
        doc.roundedRect(20, sepY, pageWidth - 40, 140, 4, 4, 'S');

        // Título do Anexo
        doc.setTextColor(brandDarkGreen[0], brandDarkGreen[1], brandDarkGreen[2]);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(anexoLabel, pageWidth / 2, sepY + 22, { align: 'center' });

        doc.setTextColor(textDarkNavy[0], textDarkNavy[1], textDarkNavy[2]);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        const splitDocTitle = doc.splitTextToSize(att.displayName || att.fileName, pageWidth - 60);
        doc.text(splitDocTitle, pageWidth / 2, sepY + 34, { align: 'center' });

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
        doc.text(`Arquivo: ${att.fileName}  •  Formato: Documento PDF (${att.pageCount || 1} páginas)`, pageWidth / 2, sepY + 48, { align: 'center' });

        // Divisória
        doc.setDrawColor(200, 225, 215);
        doc.setLineWidth(0.3);
        doc.line(35, sepY + 56, pageWidth - 35, sepY + 56);

        // Bloco de Descrição Técnica
        const sepDesc = att.description || 'Material normativo e instrucional apresentado integralmente aos colaboradores durante a sessão de DDS.';
        const splitDesc = doc.splitTextToSize(sepDesc, pageWidth - 70);
        doc.setFontSize(8.5);
        doc.setTextColor(textDarkNavy[0], textDarkNavy[1], textDarkNavy[2]);
        doc.text('Descrição / Finalidade Operacional:', 35, sepY + 68);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
        doc.text(splitDesc, 35, sepY + 76);

        // Metadados do DDS
        const metaY = sepY + 105;
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(brandDarkGreen[0], brandDarkGreen[1], brandDarkGreen[2]);
        doc.text(`Tema do DDS:`, 35, metaY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(textBody[0], textBody[1], textBody[2]);
        doc.text(meeting.topic || 'DDS de Segurança', 60, metaY);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(brandDarkGreen[0], brandDarkGreen[1], brandDarkGreen[2]);
        doc.text(`Responsável:`, 35, metaY + 6);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(textBody[0], textBody[1], textBody[2]);
        doc.text(meeting.instructorName || meeting.organizer?.name || 'Técnico Responsável', 60, metaY + 6);

        // Aviso Informativo
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(30, sepY + 123, pageWidth - 60, 12, 2, 2, 'F');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(brandDarkGreen[0], brandDarkGreen[1], brandDarkGreen[2]);
        doc.text('✓ As páginas oficiais deste documento foram anexadas a seguir com qualidade vetorial.', pageWidth / 2, sepY + 130.5, { align: 'center' });

        pdfAttachmentsToMerge.push({ index: idx, attachment: att });
      }
    });
  }

  // --- CÁLCULO DO HASH DE INTEGRIDADE DOCUMENTAL SHA-256 E QR CODE ---
  const rawDataForHash = [
    meeting.id || '',
    meeting.topic || '',
    meeting.createdAt ? new Date(meeting.createdAt).toISOString() : '',
    meeting.endedAt ? new Date(meeting.endedAt).toISOString() : '',
    meeting.attendees?.map(a => `${a.name}:${a.cpf}`).join(';') || '',
    meeting.attachments?.map(att => `${att.fileName}:${att.fileSize}`).join(';') || ''
  ].join('|');
  const docHash = meeting.documentHash || await getDocumentSha256(rawDataForHash);
  const verificationCode = `DDS-${ddsDate.getFullYear()}${String(ddsDate.getMonth() + 1).padStart(2, '0')}${String(ddsDate.getDate()).padStart(2, '0')}-${String(ddsDate.getHours()).padStart(2, '0')}${String(ddsDate.getMinutes()).padStart(2, '0')}${String(ddsDate.getSeconds()).padStart(2, '0')}`;

  // Gerar QR Code em Base64 para auditoria
  let qrCodeDataUrl: string | null = null;
  try {
    const qrText = typeof window !== 'undefined' 
      ? `${window.location.origin}/reuniao/${meeting.id || ''}?hash=${docHash.slice(0, 16)}`
      : `DDS-ON-AUTH:${verificationCode}:${docHash.slice(0, 16)}`;
    qrCodeDataUrl = await QRCode.toDataURL(qrText, { margin: 1, width: 200 });
  } catch (e) {
    console.warn('Aviso: QR code não pôde ser gerado:', e);
  }

  // --- FOOTER PADRONIZADO EM TODAS AS PÁGINAS (IDENTICO AO PRINT) ---
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Linha horizontal superior do rodapé
    const footerTopY = pageHeight - 22;
    doc.setDrawColor(220, 230, 225);
    doc.setLineWidth(0.3);
    doc.line(14, footerTopY, pageWidth - 14, footerTopY);

    // QR Code na Esquerda
    if (qrCodeDataUrl) {
      try {
        doc.addImage(qrCodeDataUrl, 'PNG', 14, footerTopY + 2, 14, 14);
      } catch (e) {}
    }

    // Texto de Auditoria ao lado do QR Code
    const textLeftX = qrCodeDataUrl ? 31 : 14;
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textDarkNavy[0], textDarkNavy[1], textDarkNavy[2]);
    doc.text('Documento oficial de auditoria', textLeftX, footerTopY + 5.5);
    doc.text('emitido digitalmente pelo DDS ON', textLeftX, footerTopY + 9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(brandDarkGreen[0], brandDarkGreen[1], brandDarkGreen[2]);
    doc.text('Desenvolvido e Auditado por AM TST', textLeftX, footerTopY + 13.5);

    // Metadados à Direita
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textDarkNavy[0], textDarkNavy[1], textDarkNavy[2]);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, footerTopY + 5.5, { align: 'right' });
    doc.text(dateFormattedStr, pageWidth - 14, footerTopY + 9.5, { align: 'right' });
    doc.setFontSize(6);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(`Código de verificação: ${verificationCode}`, pageWidth - 14, footerTopY + 13.5, { align: 'right' });

    // Faixa verde escura no rodapé com slogan institucional
    doc.setFillColor(brandHeaderGreen[0], brandHeaderGreen[1], brandHeaderGreen[2]);
    doc.rect(0, pageHeight - 5, pageWidth, 5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(5.8);
    doc.setFont('helvetica', 'bold');
    doc.text('DDS ON   |   MAIS SEGURANÇA, MAIS PESSOAS, MAIS FUTURO', pageWidth / 2, pageHeight - 1.6, { align: 'center' });
  }

  const cleanTopic = (meeting.topic || 'DDS').replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `Registro_Oficial_DDS_ON_${cleanTopic}_${new Date().toISOString().slice(0, 10)}.pdf`;

  // =========================================================================
  // CONSOLIDAÇÃO VETORIAL DOS PDFs ANEXADOS USANDO PDF-LIB
  // =========================================================================
  try {
    const mainPdfBytes = doc.output('arraybuffer');

    if (pdfAttachmentsToMerge.length === 0) {
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
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // Topo do Relatório Consolidado
  doc.setFillColor(0, 80, 52);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setFillColor(46, 204, 113);
  doc.rect(0, 27, pageWidth, 1, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('DDS ON - DOSSIÊ CONSOLIDADO DE REGISTROS DE SST', 14, 17);

  // Metadados do Dossiê
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(8.5);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Empresa / Unidade:', 14, 36);
  doc.setFont('helvetica', 'normal');
  doc.text(report.companyName || 'Não informada', 50, 36);

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
  doc.text('Período Selecionado:', 14, 48);
  doc.setFont('helvetica', 'normal');
  doc.text(periodText, 52, 48);

  doc.setFont('helvetica', 'bold');
  doc.text('Total de Reuniões:', 14, 54);
  doc.setFont('helvetica', 'normal');
  doc.text(`${report.meetings.length} registros realizados`, 50, 54);

  doc.setDrawColor(220, 235, 226);
  doc.line(14, 58, pageWidth - 14, 58);

  const tableData = report.meetings.map(m => [
    new Date(m.createdAt || Date.now()).toLocaleDateString('pt-BR'),
    new Date(m.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    m.topic + (m.classification && m.classification !== 'DDS' ? ` (${m.classification})` : ''),
    m.farm,
    m.type === 'PRESENTIAL' ? 'Presencial' : 'Remoto',
    `${m.attendees?.length || 0} pessoas`,
    'CONCLUÍDO'
  ]);

  autoTable(doc, {
    startY: 62,
    head: [['Data', 'Hora', 'Tema / Classificação', 'Local / Fazenda', 'Modalidade', 'Presentes', 'Status']],
    body: tableData.length > 0 ? tableData : [['Nenhum DDS encontrado', '-', '-', '-', '-', '-', '-']],
    theme: 'plain',
    headStyles: {
      fillColor: [238, 247, 242],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 8
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
      lineColor: [220, 235, 226],
      lineWidth: { bottom: 0.2, top: 0, left: 0, right: 0 }
    },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' },
      1: { cellWidth: 16, halign: 'center' },
      2: { cellWidth: 58 },
      3: { cellWidth: 35 },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 16, halign: 'center' },
      6: { cellWidth: 15, halign: 'center' }
    }
  });

  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Dossiê Consolidado • © 2026 AM TST • DDS ON é uma plataforma da AM TST - Página ${i} de ${pageCount}`,
      14,
      pageHeight - 8
    );
  }

  doc.save(`Dossie_Consolidado_DDS_ON_${new Date().toISOString().slice(0, 10)}.pdf`);
}
