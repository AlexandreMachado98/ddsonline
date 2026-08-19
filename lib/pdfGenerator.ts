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

// 1. RELATÓRIO INDIVIDUAL DE UM DDS
export function generateDdsPdf(meeting: MeetingData) {
  const doc = new jsPDF();

  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, 210, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('DDS ONLINE - REGISTRO DE CONFORMIDADE E AUDITORIA', 14, 17);

  doc.setTextColor(31, 41, 55);
  doc.setFontSize(9.5);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Tema do DDS:', 14, 35);
  doc.setFont('helvetica', 'normal');
  doc.text(meeting.topic || 'Não informado', 43, 35);

  doc.setFont('helvetica', 'bold');
  doc.text('Local / Fazenda:', 14, 42);
  doc.setFont('helvetica', 'normal');
  doc.text(meeting.farm || 'Não informado', 46, 42);

  doc.setFont('helvetica', 'bold');
  doc.text('Data e Horário:', 14, 49);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date(meeting.createdAt || Date.now()).toLocaleString('pt-BR'), 42, 49);

  doc.setFont('helvetica', 'bold');
  doc.text('Total Registrado:', 14, 56);
  doc.setFont('helvetica', 'normal');
  doc.text(`${meeting.attendees.length} colaborador(es)`, 47, 56);

  doc.setDrawColor(229, 231, 235);
  doc.line(14, 60, 196, 60);

  const tableRows = meeting.attendees.map(a => {
    const isEarlyExit = a.name.includes('(Saída:') || a.exitReason;
    const statusText = isEarlyExit ? `SAÍDA ANTECIPADA\n${a.exitReason || 'Justificada'}` : 'PRESENTE ATÉ O FIM';

    return [
      a.name.replace(/\(Saída:.*\)/, ''),
      a.cpf,
      new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      statusText,
      '',
      ''
    ];
  });

  autoTable(doc, {
    startY: 64,
    head: [['Nome Completo', 'CPF', 'Entrada', 'Status / Saída', 'Biometria', 'Assinatura Digital']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 8.5
    },
    styles: {
      fontSize: 8,
      valign: 'middle',
      minCellHeight: 18,
      cellPadding: 2
    },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 30, halign: 'center' },
      2: { cellWidth: 16, halign: 'center' },
      3: { cellWidth: 38, halign: 'center', fontSize: 7.5 },
      4: { cellWidth: 30, halign: 'center' },
      5: { cellWidth: 38, halign: 'center' }
    },
    didDrawCell: (data) => {
      if (data.section === 'body') {
        const attendee = meeting.attendees[data.row.index];
        if (!attendee) return;

        if (data.column.index === 4 && attendee.selfie) {
          try {
            doc.addImage(attendee.selfie, 'JPEG', data.cell.x + 8, data.cell.y + 2, 14, 14);
          } catch (e) {}
        }

        if (data.column.index === 5 && attendee.signature) {
          try {
            doc.addImage(attendee.signature, 'PNG', data.cell.x + 6, data.cell.y + 3, 26, 12);
          } catch (e) {}
        }
      }
    }
  });

  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(
      `Documento oficial de auditoria emitido digitalmente pelo DDS Online - Página ${i} de ${pageCount}`,
      14,
      doc.internal.pageSize.height - 8
    );
  }

  const cleanTopic = (meeting.topic || 'DDS').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Relatorio_DDS_${cleanTopic}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// 2. RELATÓRIO CONSOLIDADO DO PERÍODO / AUDITORIA GERAL
export function generateConsolidatedDdsPdf(report: ConsolidatedReportData) {
  const doc = new jsPDF();

  // Cabeçalho
  doc.setFillColor(15, 23, 42); // Slate escuro
  doc.rect(0, 0, 210, 30, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('DDS ONLINE - DOSSIÊ CONSOLIDADO DE AUDITORIA', 14, 15);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Relatório Geral de Conformidade e Treinamentos por Período', 14, 23);

  // Informações do Período e Responsável
  doc.setTextColor(31, 41, 55);
  doc.setFontSize(9.5);

  doc.setFont('helvetica', 'bold');
  doc.text('Responsável Técnico:', 14, 40);
  doc.setFont('helvetica', 'normal');
  doc.text(`${report.organizerName} (${report.organizerRole})`, 54, 40);

  doc.setFont('helvetica', 'bold');
  doc.text('Empresa / Unidade:', 14, 47);
  doc.setFont('helvetica', 'normal');
  doc.text(report.companyName || 'Não informada', 50, 47);

  const periodText = report.startDate || report.endDate 
    ? `${report.startDate || 'Início'} até ${report.endDate || 'Hoje'}` 
    : 'Todo o histórico';

  doc.setFont('helvetica', 'bold');
  doc.text('Período Selecionado:', 14, 54);
  doc.setFont('helvetica', 'normal');
  doc.text(periodText, 52, 54);

  const totalAttendees = report.meetings.reduce((acc, m) => acc + (m.attendees?.length || 0), 0);

  doc.setFont('helvetica', 'bold');
  doc.text('Total de Reuniões:', 130, 47);
  doc.setFont('helvetica', 'normal');
  doc.text(`${report.meetings.length} DDSs realizados`, 164, 47);

  doc.setFont('helvetica', 'bold');
  doc.text('Total de Presenças:', 130, 54);
  doc.setFont('helvetica', 'normal');
  doc.text(`${totalAttendees} participações validadas`, 165, 54);

  doc.setDrawColor(229, 231, 235);
  doc.line(14, 60, 196, 60);

  // Tabela Consolidada de Todas as Reuniões do Período
  const tableData = report.meetings.map(m => [
    new Date(m.createdAt || Date.now()).toLocaleDateString('pt-BR'),
    new Date(m.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    m.topic,
    m.farm,
    `${m.attendees?.length || 0} pessoas`,
    'CONCLUÍDO'
  ]);

  autoTable(doc, {
    startY: 65,
    head: [['Data', 'Hora', 'Tema do Diálogo (DDS)', 'Local / Fazenda', 'Presentes', 'Status']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5
    },
    styles: {
      fontSize: 8,
      cellPadding: 3
    },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' },
      1: { cellWidth: 16, halign: 'center' },
      2: { cellWidth: 70 },
      3: { cellWidth: 40 },
      4: { cellWidth: 22, halign: 'center' },
      5: { cellWidth: 22, halign: 'center' }
    }
  });

  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(
      `Dossiê consolidado emitido digitalmente pelo DDS Online em ${new Date().toLocaleDateString('pt-BR')} - Página ${i} de ${pageCount}`,
      14,
      doc.internal.pageSize.height - 8
    );
  }

  doc.save(`Dossie_Consolidado_DDS_${new Date().toISOString().slice(0, 10)}.pdf`);
}