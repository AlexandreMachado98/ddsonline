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
  type?: string;
  createdAt?: string;
  groupPhoto?: string | null;
  attendees: Attendee[];
}

export function generateDdsPdf(meeting: MeetingData) {
  const doc = new jsPDF();

  // 1. Cabeçalho Corporativo DDS ON
  doc.setFillColor(5, 150, 105); // Verde Esmeralda (Emerald 600)
  doc.rect(0, 0, 210, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('DDS ON - REGISTRO DE CONFORMIDADE, PRESENÇA E AUDITORIA', 14, 17);

  // 2. Metadados do DDS
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
  doc.text('Modalidade:', 120, 35);
  doc.setFont('helvetica', 'normal');
  doc.text(meeting.type === 'PRESENTIAL' ? 'Presencial (Canteiro/Galpão)' : 'Remoto / Ao Vivo', 145, 35);

  doc.setFont('helvetica', 'bold');
  doc.text('Data e Horário:', 14, 49);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date(meeting.createdAt || Date.now()).toLocaleString('pt-BR'), 42, 49);

  doc.setFont('helvetica', 'bold');
  doc.text('Total Registrado:', 14, 56);
  doc.setFont('helvetica', 'normal');
  doc.text(`${meeting.attendees?.length || 0} colaborador(es)`, 47, 56);

  doc.setDrawColor(229, 231, 235);
  doc.line(14, 60, 196, 60);

  // 3. Tabela de Presença e Registro de Saídas
  const attendeesList = meeting.attendees || [];
  const tableRows = attendeesList.map(a => {
    const isEarlyExit = a.name.includes('(Saída:') || a.exitReason;
    const statusText = isEarlyExit ? `SAÍDA ANTECIPADA\n${a.exitReason || 'Justificada'}` : 'PRESENTE ATÉ O FIM';

    return [
      a.name.replace(/\(Saída:.*\)/, '').trim(),
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
    body: tableRows.length > 0 ? tableRows : [['Nenhum participante registrado', '-', '-', '-', '-', '-']],
    theme: 'grid',
    headStyles: {
      fillColor: [5, 150, 105],
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
      if (data.section === 'body' && attendeesList.length > 0) {
        const attendee = attendeesList[data.row.index];
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

  // 4. RENDERIZAÇÃO DA FOTO EM GRUPO (EVIDÊNCIA COLETIVA)
  if (meeting.groupPhoto && typeof meeting.groupPhoto === 'string' && meeting.groupPhoto.length > 50) {
    try {
      const finalTableY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 80;
      
      // Cálculo proporcional e seguro das dimensões da foto
      let imgWidth = 170;
      let imgHeight = 85;

      try {
        const imgProps = doc.getImageProperties(meeting.groupPhoto);
        if (imgProps && imgProps.width && imgProps.height) {
          const aspectRatio = imgProps.width / imgProps.height;
          const maxAllowedWidth = 170;
          const maxAllowedHeight = 95;

          if (aspectRatio >= (maxAllowedWidth / maxAllowedHeight)) {
            // Imagem horizontal (landscape)
            imgWidth = maxAllowedWidth;
            imgHeight = Math.round(maxAllowedWidth / aspectRatio);
          } else {
            // Imagem vertical (portrait) ou quadrada
            imgHeight = maxAllowedHeight;
            imgWidth = Math.round(maxAllowedHeight * aspectRatio);
          }
        }
      } catch (propErr) {
        console.warn('[PDF] Usando dimensões padrão para a foto em grupo:', propErr);
      }

      const totalSectionHeight = imgHeight + 24; // Barra de título + imagem + legenda
      const pageHeight = doc.internal.pageSize.height;
      const bottomLimit = pageHeight - 18;

      let sectionY = finalTableY + 10;

      // Se a tabela ocupou quase a página inteira, cria uma nova página dedicada para a foto
      if (sectionY + totalSectionHeight > bottomLimit) {
        doc.addPage();
        sectionY = 20;
      }

      // Faixa de Título da Seção (Emerald)
      doc.setFillColor(5, 150, 105);
      doc.roundedRect(14, sectionY, 182, 7, 1.5, 1.5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.text('REGISTRO FOTOGRÁFICO COLETIVO (EVIDÊNCIA DE SEGURANÇA DDS ON)', 18, sectionY + 4.8);

      // Moldura e Imagem Centralizada
      const posX = (210 - imgWidth) / 2;
      const posY = sectionY + 10;

      doc.setDrawColor(203, 213, 225);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(posX - 1.5, posY - 1.5, imgWidth + 3, imgHeight + 3, 2, 2, 'FD');

      // Inserção da Imagem no PDF
      const format = meeting.groupPhoto.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(meeting.groupPhoto, format, posX, posY, imgWidth, imgHeight);

      // Legenda de Conformidade
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(
        'Evidência fotográfica coletiva registrada durante a realização do DDS - Conformidade com as Normas Regulamentadoras (NRs)',
        105,
        posY + imgHeight + 5.5,
        { align: 'center' }
      );

    } catch (photoErr) {
      console.error('[PDF] Erro ao renderizar a foto em grupo no PDF:', photoErr);
    }
  }

  // 5. Rodapé Oficial DDS ON com Numeração em Todas as Páginas
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(156, 163, 175);
    doc.text(
      `Documento oficial de auditoria emitido digitalmente pelo DDS ON • Desenvolvido e Auditado por AM TST - Página ${i} de ${pageCount}`,
      14,
      doc.internal.pageSize.height - 8
    );
  }

  const cleanTopic = (meeting.topic || 'DDS').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Relatorio_Auditoria_DDS_ON_${cleanTopic}_${new Date().toISOString().slice(0, 10)}.pdf`);
}