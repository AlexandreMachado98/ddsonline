
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
  createdAt?: number | string;
  endedAt?: string | null;
  instructorName?: string | null;
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

  // --- HEADER BANNER ---
  doc.setFillColor(darkGreen[0], darkGreen[1], darkGreen[2]);
  doc.rect(0, 0, pageWidth, 30, 'F');
  
  // Fake Logo "DDS ON"
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('DDS ON', 14, 18);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Plataforma de registro de presença online', 14, 24);
  
  currentY = 45;

  // --- MAIN TITLE ---
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('REGISTRO DE PRESENÇA', 14, currentY);
  
  currentY += 12;

  // --- CARDS ---
  const cardH = 15;
  const col1 = 14;
  const col2 = 82;
  const col3 = 150;
  const cardW = 65;
  const col3W = 46;

  const drawCard = (x: number, y: number, w: number, h: number, title: string, value: string) => {
    doc.setFillColor(lightGreenBg[0], lightGreenBg[1], lightGreenBg[2]);
    doc.roundedRect(x, y, w, h, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(title, x + 5, y + 6);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(value, x + 5, y + 11);
  };

  // Row 1
  drawCard(col1, currentY, cardW, cardH, 'Tema do DDS', meeting.topic || 'Não informado');
  drawCard(col2, currentY, cardW, cardH, 'Modalidade', meeting.type === 'PRESENTIAL' ? 'Presencial (Canteiro/Galpão)' : 'Remoto / Ao Vivo');
  
  // Right large card (Total)
  doc.setFillColor(lightGreenBg[0], lightGreenBg[1], lightGreenBg[2]);
  doc.roundedRect(col3, currentY, col3W, cardH * 2 + 3, 3, 3, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text('Total Registrado', col3 + (col3W/2), currentY + 8, { align: 'center' });
  doc.setFontSize(22);
  doc.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]);
  doc.text(String(meeting.attendees?.length || 0), col3 + (col3W/2), currentY + 20, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text('colaborador(es)', col3 + (col3W/2), currentY + 28, { align: 'center' });

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
  drawCard(col1, currentY, cardW * 2 + 17, cardH, 'Responsável pelo Treinamento', meeting.instructorName || meeting.organizer?.name || 'Não informado');

  currentY += cardH + 12;

  // --- TABLE ---
  
  // Green header above table
  doc.setFillColor(tableHeaderGreen[0], tableHeaderGreen[1], tableHeaderGreen[2]);
  doc.roundedRect(14, currentY, pageWidth - 28, 12, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('LISTA DE PRESENÇA', 22, currentY + 8);
  
  currentY += 12;
  
  const attendeesList = meeting.attendees || [];
  const tableRows = attendeesList.map((a, idx) => {
    return [
      String(idx + 1),
      a.name.replace(/\(Saída:.*\)/, '').trim(),
      a.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"),
      new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      '', // Status pill drawn manually
      '', // Selfie
      ''  // Signature
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'NOME COMPLETO', 'CPF', 'ENTRADA', 'STATUS / SAÍDA', 'BIOMETRIA', 'ASSINATURA DIGITAL']],
    body: tableRows.length > 0 ? tableRows : [['-', 'Nenhum participante', '-', '-', '-', '-', '-']],
    theme: 'grid',
    headStyles: {
      fillColor: lightGreenBg,
      textColor: textDark,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      fontSize: 8,
      minCellHeight: 10
    },
    styles: {
      fontSize: 8,
      valign: 'middle',
      halign: 'center',
      textColor: textDark,
      lineColor: [229, 231, 235],
      lineWidth: 0.1,
      minCellHeight: 18
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
          const pillH = 10;
          const px = data.cell.x + (data.cell.width - pillW) / 2;
          const py = data.cell.y + (data.cell.height - pillH) / 2;
          
          doc.roundedRect(px, py, pillW, pillH, 2, 2, 'F');
          
          // Fake check icon circle
          doc.setFillColor(tableHeaderGreen[0], tableHeaderGreen[1], tableHeaderGreen[2]);
          doc.circle(px + 6, py + 5, 2.5, 'F');
          
          doc.setTextColor(fg[0], fg[1], fg[2]);
          doc.setFontSize(6);
          doc.setFont('helvetica', 'bold');
          
          if(isEarlyExit) {
            doc.text('SAÍDA', px + 16, py + 4.5, { align: 'center' });
            doc.text('ANTECIPADA', px + 16, py + 7.5, { align: 'center' });
          } else {
            doc.text('PRESENTE', px + 17, py + 4.5, { align: 'center' });
            doc.text('ATÉ O FIM', px + 17, py + 7.5, { align: 'center' });
          }
        }

        // Selfie
        if (data.column.index === 5 && attendee.selfie) {
          try {
            doc.addImage(attendee.selfie, 'JPEG', data.cell.x + 6, data.cell.y + 2, 14, 14);
          } catch (e) {}
        }

        // Signature
        if (data.column.index === 6 && attendee.signature) {
          try {
            doc.addImage(attendee.signature, 'PNG', data.cell.x + 2, data.cell.y + 3, 29, 12);
          } catch (e) {}
        }
      }
    }
  });

  let finalY = (doc as any).lastAutoTable.finalY + 15;

  // --- GROUP PHOTO ---
  if (meeting.groupPhoto && meeting.groupPhoto.length > 50) {
    if (finalY + 90 > pageHeight - 30) {
      doc.addPage();
      finalY = 20;
    }
    try {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text('FOTO DA EQUIPE (EVIDÊNCIA)', 14, finalY);
      
      const imgProps = doc.getImageProperties(meeting.groupPhoto);
      let imgWidth = 100;
      let imgHeight = 56;
      if (imgProps) {
        const ratio = imgProps.width / imgProps.height;
        imgHeight = imgWidth / ratio;
      }
      
      const format = meeting.groupPhoto.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(meeting.groupPhoto, format, 14, finalY + 5, imgWidth, imgHeight);
      finalY += imgHeight + 15;
    } catch(e){}
  }


  // --- FOOTER PAGES ---
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
  doc.setFillColor(5, 150, 105); // Verde Esmeralda (Emerald 600)
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
    m.topic,
    m.farm,
    m.type === 'PRESENTIAL' ? '👥 Presencial' : '🎙️ Remoto',
    `${m.attendees?.length || 0} pessoas`,
    'CONCLUÍDO'
  ]);

  autoTable(doc, {
    startY: 64,
    head: [['Data', 'Hora', 'Tema do Treinamento', 'Local / Fazenda', 'Modalidade', 'Presentes', 'Status']],
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