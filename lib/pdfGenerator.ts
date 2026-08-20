 import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Attendee {
  id: string;
  name: string;
  cpf: string;
  selfie?: string;
  signature?: string;
  createdAt: string;
  exitReason?: string;
  exitSignature?: string;
  leftAt?: string;
}

interface MeetingData {
  topic: string;
  farm: string;
  createdAt?: string;
  attendees: Attendee[];
}

interface ConsolidatedReportData {
  organizerName: string;
  organizerRole: string;
  companyName: string;
  startDate?: string;
  endDate?: string;
  meetings: MeetingData[];
}

// 1. ATA INDIVIDUAL DE DDS (DDS ON)
export function generateDdsPdf(meeting: MeetingData) {
  const doc = new jsPDF();

  // Topo Verde Segurança + Grafite
  doc.setFillColor(15, 23, 42); // Grafite escuro
  doc.rect(0, 0, 210, 28, 'F');

  doc.setFillColor(22, 163, 74); // Verde DDS ON
  doc.rect(0, 26, 210, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('DDS ON', 14, 14);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(134, 239, 172);
  doc.text('ATA OFICIAL DE DIÁLOGO DIÁRIO DE SEGURANÇA E AUDITORIA', 14, 20);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('REGISTRO DE CONFORMIDADE NR', 200, 16, { align: 'right' });

  // Metadados
  doc.setTextColor(31, 41, 55);
  doc.setFontSize(9);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Tema do Treinamento:', 14, 38);
  doc.setFont('helvetica', 'normal');
  doc.text(meeting.topic || 'Não informado', 52, 38);

  doc.setFont('helvetica', 'bold');
  doc.text('Unidade / Fazenda:', 14, 44);
  doc.setFont('helvetica', 'normal');
  doc.text(meeting.farm || 'Não informado', 46, 44);

  doc.setFont('helvetica', 'bold');
  doc.text('Data e Horário:', 14, 50);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date(meeting.createdAt || Date.now()).toLocaleString('pt-BR'), 40, 50);

  doc.setFont('helvetica', 'bold');
  doc.text('Total de Participantes:', 14, 56);
  doc.setFont('helvetica', 'normal');
  doc.text(`${meeting.attendees.length} colaborador(es) auditado(s)`, 52, 56);

  doc.setDrawColor(22, 163, 74);
  doc.setLineWidth(0.3);
  doc.line(14, 60, 196, 60);

  const tableRows = meeting.attendees.map(a => {
    const isEarlyExit = Boolean(a.exitReason || a.exitSignature);
    const exitTime = a.leftAt ? new Date(a.leftAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const statusText = isEarlyExit 
      ? `SAÍDA ANTECIPADA (${exitTime})\nMotivo: ${a.exitReason}` 
      : 'PRESENTE ATÉ O FIM';

    return [
      a.name.replace(/\(Saída:.*\)/, ''),
      a.cpf,
      new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      '',
      '',
      statusText,
      ''
    ];
  });

  autoTable(doc, {
    startY: 64,
    head: [['Colaborador', 'CPF', 'Entrada', 'Biometria Facial', 'Assinatura Entrada', 'Status / Saída', 'Assinatura Saída']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [21, 128, 61],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 7.5
    },
    styles: {
      fontSize: 7,
      valign: 'middle',
      minCellHeight: 18,
      cellPadding: 1.5
    },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 26, halign: 'center' },
      2: { cellWidth: 14, halign: 'center' },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 30, halign: 'center' },
      5: { cellWidth: 36, halign: 'center', fontSize: 6.5 },
      6: { cellWidth: 30, halign: 'center' }
    },
    didDrawCell: (data) => {
      if (data.section === 'body') {
        const attendee = meeting.attendees[data.row.index];
        if (!attendee) return;

        if (data.column.index === 3 && attendee.selfie) {
          try {
            doc.addImage(attendee.selfie, 'JPEG', data.cell.x + 4, data.cell.y + 2, 14, 14);
          } catch (e) {}
        }

        if (data.column.index === 4 && attendee.signature) {
          try {
            doc.addImage(attendee.signature, 'PNG', data.cell.x + 3, data.cell.y + 3, 24, 12);
          } catch (e) {}
        }

        if (data.column.index === 6 && attendee.exitSignature) {
          try {
            doc.addImage(attendee.exitSignature, 'PNG', data.cell.x + 3, data.cell.y + 3, 24, 12);
          } catch (e) {}
        }
      }
    }
  });

  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `DDS ON • Consultoria e Tecnologia: AM TST (amtst.vercel.app) | Página ${i} de ${pageCount}`,
      14,
      doc.internal.pageSize.height - 8
    );
  }

  const cleanTopic = (meeting.topic || 'DDS').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`DDS_ON_Ata_${cleanTopic}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// 2. RELATÓRIO CONSOLIDADO DO PERÍODO
export function generateConsolidatedDdsPdf(report: ConsolidatedReportData) {
  const doc = new jsPDF();

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 28, 'F');

  doc.setFillColor(22, 163, 74);
  doc.rect(0, 26, 210, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('DDS ON - DOSSIÊ CONSOLIDADO DE AUDITORIA', 14, 14);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(134, 239, 172);
  doc.text('RELATÓRIO GERAL DE TREINAMENTOS E PRESENÇAS POR PERÍODO', 14, 20);

  doc.setTextColor(31, 41, 55);
  doc.setFontSize(9);

  doc.setFont('helvetica', 'bold');
  doc.text('Responsável Técnico:', 14, 38);
  doc.setFont('helvetica', 'normal');
  doc.text(`${report.organizerName} (${report.organizerRole})`, 54, 38);

  doc.setFont('helvetica', 'bold');
  doc.text('Empresa / Unidade:', 14, 44);
  doc.setFont('helvetica', 'normal');
  doc.text(report.companyName || 'Não informada', 50, 44);

  const periodText = report.startDate || report.endDate 
    ? `${report.startDate || 'Início'} até ${report.endDate || 'Hoje'}` 
    : 'Todo o histórico';

  doc.setFont('helvetica', 'bold');
  doc.text('Período Selecionado:', 14, 50);
  doc.setFont('helvetica', 'normal');
  doc.text(periodText, 52, 50);

  const totalAttendees = report.meetings.reduce((acc, m) => acc + (m.attendees?.length || 0), 0);

  doc.setFont('helvetica', 'bold');
  doc.text('Total de Reuniões:', 130, 44);
  doc.setFont('helvetica', 'normal');
  doc.text(`${report.meetings.length} DDSs realizados`, 164, 44);

  doc.setFont('helvetica', 'bold');
  doc.text('Total de Presenças:', 130, 50);
  doc.setFont('helvetica', 'normal');
  doc.text(`${totalAttendees} presenças auditadas`, 165, 50);

  doc.setDrawColor(22, 163, 74);
  doc.line(14, 56, 196, 56);

  const tableData = report.meetings.map(m => [
    new Date(m.createdAt || Date.now()).toLocaleDateString('pt-BR'),
    new Date(m.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    m.topic,
    m.farm,
    `${m.attendees?.length || 0} colaboradores`,
    'CONCLUÍDO'
  ]);

  autoTable(doc, {
    startY: 61,
    head: [['Data', 'Hora', 'Tema do Treinamento', 'Local / Fazenda', 'Presentes', 'Status']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [21, 128, 61],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2.5
    },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' },
      1: { cellWidth: 16, halign: 'center' },
      2: { cellWidth: 70 },
      3: { cellWidth: 40 },
      4: { cellWidth: 24, halign: 'center' },
      5: { cellWidth: 20, halign: 'center' }
    }
  });

  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `DDS ON • Consultoria e Tecnologia: AM TST (amtst.vercel.app) | Página ${i} de ${pageCount}`,
      14,
      doc.internal.pageSize.height - 8
    );
  }

  doc.save(`DDS_ON_Dossie_Consolidado_${new Date().toISOString().slice(0, 10)}.pdf`);
}