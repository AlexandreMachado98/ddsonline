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

export function generateDdsPdf(meeting: MeetingData) {
  const doc = new jsPDF();

  // 1. Cabeçalho Corporativo
  doc.setFillColor(37, 99, 235); // Azul
  doc.rect(0, 0, 210, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('DDS ONLINE - REGISTRO DE CONFORMIDADE, PRESENÇA E AUDITORIA', 14, 17);

  // 2. Metadados
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

  // 3. Tabela de Presença e Registro de Saídas
  const tableRows = meeting.attendees.map(a => {
    const isEarlyExit = a.name.includes('(Saída:') || a.exitReason;
    const statusText = isEarlyExit ? `SAÍDA ANTECIPADA\n${a.exitReason || 'Justificada'}` : 'PRESENTE ATÉ O FIM';

    return [
      a.name.replace(/\(Saída:.*\)/, ''),
      a.cpf,
      new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      statusText,
      '', // Espaço para Selfie
      ''  // Espaço para Assinatura
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

        // Selfie na coluna 4
        if (data.column.index === 4 && attendee.selfie) {
          try {
            doc.addImage(attendee.selfie, 'JPEG', data.cell.x + 8, data.cell.y + 2, 14, 14);
          } catch (e) {}
        }

        // Assinatura na coluna 5
        if (data.column.index === 5 && attendee.signature) {
          try {
            doc.addImage(attendee.signature, 'PNG', data.cell.x + 6, data.cell.y + 3, 26, 12);
          } catch (e) {}
        }
      }
    }
  });

  // Rodapé
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
  doc.save(`Relatorio_Auditoria_DDS_${cleanTopic}_${new Date().toISOString().slice(0, 10)}.pdf`);
}