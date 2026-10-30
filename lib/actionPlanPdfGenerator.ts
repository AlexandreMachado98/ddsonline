// lib/actionPlanPdfGenerator.ts
// Motor Profissional de Emissão de Relatórios em PDF para Planos de Ação (Individual & Consolidado)

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  cleanTextForPdf, 
  sanitizeMarkdownText, 
  normalizeImageDataUrl, 
  renderFormattedMarkdownInPdf 
} from '@/lib/pdfGenerator';
import { 
  calculateDeadlineState, 
  calculatePlanProgress,
  STATUS_LABELS, 
  PRIORITY_LABELS, 
  CRITICALITY_LABELS, 
  ORIGIN_LABELS,
  VERIFICATION_LABELS,
  ActionPlanStatus
} from '@/lib/actionPlanUtils';

export interface ActionPlanFullData {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  sector?: string | null;
  location?: string | null;
  identificationDate: string | Date;
  origin: string;
  category?: string | null;
  criticality: string;
  status: ActionPlanStatus;
  priority: string;
  problemDescription?: string | null;
  identifiedRisk?: string | null;
  potentialConsequences?: string | null;
  identifiedCause?: string | null;
  rootCause?: string | null;
  immediateMeasures?: string | null;
  additionalNotes?: string | null;
  actionDescription?: string | null;
  actionObjective?: string | null;
  expectedResult?: string | null;
  requiredResources?: string | null;
  completionCriteria?: string | null;
  startDate?: string | Date | null;
  dueDate?: string | Date | null;
  completedAt?: string | Date | null;
  originalDueDate?: string | Date | null;
  alertDaysBefore?: number;
  createdAt: string | Date;
  updatedAt: string | Date;
  company?: { name: string; document?: string | null } | null;
  creator?: { name: string; email: string; position?: string | null } | null;
  responsible?: { name: string; email: string; position?: string | null } | null;
  supervisor?: { name: string; email: string; position?: string | null } | null;
  verifier?: { name: string; email: string; position?: string | null } | null;
  tasks?: Array<{
    id: string;
    description: string;
    status: ActionPlanStatus;
    weight: number;
    dueDate?: string | Date | null;
    completedAt?: string | Date | null;
    notes?: string | null;
    responsible?: { name: string } | null;
  }>;
  attachments?: Array<{
    id: string;
    fileName: string;
    displayName?: string | null;
    mimeType: string;
    fileSize: number;
    fileData: string;
    caption?: string | null;
    evidenceType?: string | null; // BEFORE, DURING, AFTER, COMPLEMENTARY
    notes?: string | null;
    createdAt: string | Date;
  }>;
  history?: Array<{
    id: string;
    action: string;
    previousValue?: string | null;
    newValue?: string | null;
    details?: string | null;
    createdAt: string | Date;
    user: { name: string };
  }>;
  extensions?: Array<{
    id: string;
    currentDueDate: string | Date;
    requestedDueDate: string | Date;
    justification: string;
    status: string;
    approvedAt?: string | Date | null;
    requester: { name: string };
    approver?: { name: string } | null;
  }>;
  verification?: {
    result: string;
    notes?: string | null;
    evidenceData?: string | null;
    verifiedAt?: string | Date | null;
    verifier: { name: string };
  } | null;
}

// =========================================================================
// 1. RELATÓRIO INDIVIDUAL DO PLANO DE AÇÃO
// =========================================================================

export async function generateActionPlanIndividualPdf(plan: ActionPlanFullData): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // Paleta de Cores Corporativas
  const navyDark: [number, number, number] = [15, 31, 56];
  const bluePrimary: [number, number, number] = [37, 99, 235];
  const emeraldAccent: [number, number, number] = [16, 185, 129];
  const textDark: [number, number, number] = [15, 23, 42];
  const textMuted: [number, number, number] = [100, 116, 139];
  const borderLight: [number, number, number] = [226, 232, 240];
  const bgCard: [number, number, number] = [248, 250, 252];

  // Insere a imagem sem deformar: mantém a proporção original e centraliza
  // dentro da área disponível, seja a foto horizontal, vertical ou captura de tela.
  const addImageContained = (fileData: string, x: number, y: number, maxW: number, maxH: number) => {
    const imageData = normalizeImageDataUrl(fileData);
    const imageProps = doc.getImageProperties(imageData);
    if (!imageProps.width || !imageProps.height) {
      throw new Error('Não foi possível identificar as dimensões da evidência.');
    }

    const scale = Math.min(maxW / imageProps.width, maxH / imageProps.height);
    const imageW = imageProps.width * scale;
    const imageH = imageProps.height * scale;
    const imageX = x + (maxW - imageW) / 2;
    const imageY = y + (maxH - imageH) / 2;
    doc.addImage(imageData, 'JPEG', imageX, imageY, imageW, imageH);
  };

  let currentY = 0;

  // Função para desenhar cabeçalho corporativo institucional
  const renderHeader = () => {
    doc.setFillColor(navyDark[0], navyDark[1], navyDark[2]);
    doc.rect(0, 0, pageWidth, 26, 'F');

    doc.setFillColor(bluePrimary[0], bluePrimary[1], bluePrimary[2]);
    doc.rect(0, 25, pageWidth, 1.2, 'F');

    // Logo / Nome DDS ON
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('DDS ON', 14, 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(203, 213, 225);
    doc.text('MÓDULO DE GESTÃO DE PLANOS DE AÇÃO & NÃO CONFORMIDADES', 14, 21);

    // Código do Plano em destaque no header à direita
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(plan.code, pageWidth - 14, 13, { align: 'right' });

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(`Emissão: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - 14, 19, { align: 'right' });

    // Logo da Empresa
    if (typeof window !== 'undefined') {
      try {
        const companyLogo = localStorage.getItem('dds_company_logo');
        if (companyLogo) {
          const props = doc.getImageProperties(companyLogo);
          const maxW = 40;
          const maxH = 18;
          const ratio = Math.min(maxW / props.width, maxH / props.height);
          const finalW = props.width * ratio;
          const finalH = props.height * ratio;
          const xPos = pageWidth - 60 - finalW;
          const yPos = (24 - finalH) / 2;
          doc.addImage(companyLogo, 'PNG', xPos, yPos, finalW, finalH);
        }
      } catch (e) {}
    }
  };

  // Função para desenhar rodapé com numeração
  const addFooter = () => {
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
      doc.setLineWidth(0.2);
      doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text(`DDS-ON SST - Relatório Técnico do Plano de Ação ${plan.code} | Documento Oficial`, 14, pageHeight - 7);
      doc.text(`Página ${i} de ${totalPages}`, pageWidth - 14, pageHeight - 7, { align: 'right' });
    }
  };

  // 1. Renderiza Header na Página 1
  renderHeader();
  currentY = 32;

  // Título do Plano de Ação
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  const splitTitle = doc.splitTextToSize(cleanTextForPdf(plan.title), pageWidth - 28);
  doc.text(splitTitle, 14, currentY);
  currentY += (splitTitle.length * 5.5) + 3;

  // Faixa de Status, Prioridade, Criticidade e Progresso
  const progress = calculatePlanProgress(plan.tasks || [], plan.status);
  const deadline = calculateDeadlineState(plan.dueDate, plan.completedAt, plan.status, plan.alertDaysBefore || 7);

  doc.setFillColor(bgCard[0], bgCard[1], bgCard[2]);
  doc.roundedRect(14, currentY, pageWidth - 28, 14, 2, 2, 'F');
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.setLineWidth(0.2);
  doc.roundedRect(14, currentY, pageWidth - 28, 14, 2, 2, 'S');

  const colW = (pageWidth - 28) / 5;
  const lineY1 = currentY + 4.5;
  const lineY2 = currentY + 10;

  // Status
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('STATUS', 17, lineY1);
  doc.setFontSize(8);
  doc.setTextColor(bluePrimary[0], bluePrimary[1], bluePrimary[2]);
  doc.text(STATUS_LABELS[plan.status] || plan.status, 17, lineY2);

  // Situação do Prazo
  doc.setFontSize(6.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('SITUAÇÃO DO PRAZO', 14 + colW + 2, lineY1);
  doc.setFontSize(8);
  if (deadline.isOverdue) {
    doc.setTextColor(225, 29, 72);
  } else {
    doc.setTextColor(16, 185, 129);
  }
  doc.text(deadline.label, 14 + colW + 2, lineY2);

  // Prioridade
  doc.setFontSize(6.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('PRIORIDADE', 14 + (colW * 2) + 2, lineY1);
  doc.setFontSize(8);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(PRIORITY_LABELS[plan.priority as keyof typeof PRIORITY_LABELS] || plan.priority, 14 + (colW * 2) + 2, lineY2);

  // Criticidade
  doc.setFontSize(6.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('CRITICIDADE', 14 + (colW * 3) + 2, lineY1);
  doc.setFontSize(8);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(CRITICALITY_LABELS[plan.criticality as keyof typeof CRITICALITY_LABELS] || plan.criticality, 14 + (colW * 3) + 2, lineY2);

  // Progresso
  doc.setFontSize(6.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('PROGRESSO GERAL', 14 + (colW * 4) + 2, lineY1);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(emeraldAccent[0], emeraldAccent[1], emeraldAccent[2]);
  doc.text(`${progress}% Concluído`, 14 + (colW * 4) + 2, lineY2);

  currentY += 18;

  // --- SEÇÃO 1: IDENTIFICAÇÃO E ENVOLVIDOS ---
  doc.setFillColor(navyDark[0], navyDark[1], navyDark[2]);
  doc.rect(14, currentY, 2.5, 6, 'F');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(navyDark[0], navyDark[1], navyDark[2]);
  doc.text('1. IDENTIFICAÇÃO & ATRIBUIÇÕES', 19, currentY + 4.5);
  currentY += 8;

  const identRows = [
    [
      { content: 'Empresa / Unidade:', styles: { fontStyle: 'bold' } },
      plan.company?.name || 'Não informada',
      { content: 'Origem do Plano:', styles: { fontStyle: 'bold' } },
      ORIGIN_LABELS[plan.origin] || plan.origin
    ],
    [
      { content: 'Setor / Área:', styles: { fontStyle: 'bold' } },
      plan.sector || '-',
      { content: 'Local Específico:', styles: { fontStyle: 'bold' } },
      plan.location || '-'
    ],
    [
      { content: 'Responsável Principal:', styles: { fontStyle: 'bold' } },
      plan.responsible?.name ? `${plan.responsible.name} (${plan.responsible.position || 'Responsável'})` : 'Não atribuído',
      { content: 'Criador da Ação:', styles: { fontStyle: 'bold' } },
      plan.creator?.name || 'Sistema'
    ],
    [
      { content: 'Supervisor / Gestor:', styles: { fontStyle: 'bold' } },
      plan.supervisor?.name || 'Não atribuído',
      { content: 'Verificador de Eficácia:', styles: { fontStyle: 'bold' } },
      plan.verifier?.name || 'Não atribuído'
    ],
    [
      { content: 'Data de Identificação:', styles: { fontStyle: 'bold' } },
      new Date(plan.identificationDate).toLocaleDateString('pt-BR'),
      { content: 'Prazo Final de Conclusão:', styles: { fontStyle: 'bold' } },
      plan.dueDate ? new Date(plan.dueDate).toLocaleDateString('pt-BR') : 'A definir'
    ],
    ...(plan.completedAt ? [
      [
        { content: 'Data Efetiva de Conclusão:', styles: { fontStyle: 'bold' } },
        new Date(plan.completedAt).toLocaleDateString('pt-BR'),
        { content: 'Conformidade de Prazo:', styles: { fontStyle: 'bold' } },
        deadline.label
      ]
    ] : [])
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: 14, right: 14 },
    body: identRows as any,
    theme: 'plain',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.8,
      textColor: textDark,
      lineColor: borderLight,
      lineWidth: 0.1
    },
    columnStyles: {
      0: { cellWidth: 38, fillColor: [248, 250, 252], textColor: textMuted },
      1: { cellWidth: 53 },
      2: { cellWidth: 38, fillColor: [248, 250, 252], textColor: textMuted },
      3: { cellWidth: 53 }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // --- SEÇÃO 2: DIAGNÓSTICO DO PROBLEMA & CAUSA RAIZ ---
  doc.setFillColor(navyDark[0], navyDark[1], navyDark[2]);
  doc.rect(14, currentY, 2.5, 6, 'F');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('2. DIAGNÓSTICO DO PROBLEMA & ANÁLISE DE RISCO', 19, currentY + 4.5);
  currentY += 8;

  const problemSections = [
    { label: 'Descrição da Situação / Não Conformidade:', text: plan.problemDescription || plan.description || 'Não detalhada.' },
    { label: 'Risco Identificado & Perigos:', text: plan.identifiedRisk || 'Não informado.' },
    { label: 'Consequências Potenciais:', text: plan.potentialConsequences || 'Não informadas.' },
    { label: 'Causa Imediata / Causa Raiz:', text: plan.rootCause ? `${plan.rootCause} (Causa Raiz)` : (plan.identifiedCause || 'Em investigação.') },
    { label: 'Medidas Imediatas / Bloqueios Adotados:', text: plan.immediateMeasures || 'Nenhuma medida imediata registrada.' }
  ];

  const problemTableBody = problemSections.map(s => [
    { content: s.label, styles: { fontStyle: 'bold' } },
    cleanTextForPdf(s.text)
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: 14, right: 14 },
    body: problemTableBody as any,
    theme: 'plain',
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: textDark,
      lineColor: borderLight,
      lineWidth: 0.1
    },
    columnStyles: {
      0: { cellWidth: 55, fillColor: [248, 250, 252], textColor: textMuted },
      1: { cellWidth: pageWidth - 28 - 55 }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // Verifica quebra de página antes da seção 3
  if (currentY > pageHeight - 65) {
    doc.addPage();
    renderHeader();
    currentY = 32;
  }

  // --- SEÇÃO 3: PLANO DE AÇÃO PROPOSTO (5W2H) ---
  doc.setFillColor(navyDark[0], navyDark[1], navyDark[2]);
  doc.rect(14, currentY, 2.5, 6, 'F');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('3. PLANO DE AÇÃO PROPOSTO & METAS', 19, currentY + 4.5);
  currentY += 8;

  const actionTableBody = [
    [{ content: 'Ação Corretiva / Preventiva:', styles: { fontStyle: 'bold' } }, cleanTextForPdf(plan.actionDescription || 'Ação padrão definida.')],
    [{ content: 'Objetivo Específico:', styles: { fontStyle: 'bold' } }, cleanTextForPdf(plan.actionObjective || '-')],
    [{ content: 'Resultado Esperado:', styles: { fontStyle: 'bold' } }, cleanTextForPdf(plan.expectedResult || '-')],
    [{ content: 'Recursos Necessários:', styles: { fontStyle: 'bold' } }, cleanTextForPdf(plan.requiredResources || 'Recursos ordinários.')],
    [{ content: 'Critério de Conclusão / Aceite:', styles: { fontStyle: 'bold' } }, cleanTextForPdf(plan.completionCriteria || 'Verificação de conformidade no local.')]
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: 14, right: 14 },
    body: actionTableBody as any,
    theme: 'plain',
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: textDark,
      lineColor: borderLight,
      lineWidth: 0.1
    },
    columnStyles: {
      0: { cellWidth: 55, fillColor: [248, 250, 252], textColor: textMuted },
      1: { cellWidth: pageWidth - 28 - 55 }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // Verifica quebra de página para a tabela de Subações
  if (currentY > pageHeight - 60) {
    doc.addPage();
    renderHeader();
    currentY = 32;
  }

  // --- SEÇÃO 4: CRONOGRAMA DE SUBAÇÕES / ETAPAS ---
  doc.setFillColor(navyDark[0], navyDark[1], navyDark[2]);
  doc.rect(14, currentY, 2.5, 6, 'F');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('4. ETAPAS EXECUTIVAS & SUBAÇÕES', 19, currentY + 4.5);
  currentY += 8;

  const taskRows = (plan.tasks || []).map((t, idx) => {
    const tDeadline = calculateDeadlineState(t.dueDate, t.completedAt, t.status);
    return [
      String(idx + 1),
      cleanTextForPdf(t.description),
      t.responsible?.name || plan.responsible?.name || 'Não atribuído',
      t.dueDate ? new Date(t.dueDate).toLocaleDateString('pt-BR') : '-',
      `Peso ${t.weight || 1}`,
      STATUS_LABELS[t.status] || t.status,
      tDeadline.label
    ];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: 14, right: 14 },
    head: [['#', 'DESCRIÇÃO DA ETAPA', 'RESPONSÁVEL', 'PRAZO', 'PESO', 'STATUS', 'SITUAÇÃO']],
    body: taskRows.length > 0 ? taskRows : [['-', 'Nenhuma subação cadastrada (plano executado em etapa única)', '-', '-', '-', '-', '-']],
    theme: 'plain',
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: textDark,
      fontSize: 7,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 7.2,
      cellPadding: 1.8,
      textColor: textDark,
      lineColor: borderLight,
      lineWidth: { bottom: 0.1, top: 0, left: 0, right: 0 }
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 62 },
      2: { cellWidth: 32 },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 14, halign: 'center' },
      5: { cellWidth: 24 },
      6: { cellWidth: 24 }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // --- SEÇÃO 5: REGISTRO DE EVIDÊNCIAS FOTOGRÁFICAS (ANTES, DURANTE, DEPOIS) ---
  const allAttachments = plan.attachments || [];
  const validPhotos = allAttachments.filter(a => 
    a && a.fileData && (
      (a.mimeType && (a.mimeType.startsWith('image/') || a.mimeType.includes('jpeg') || a.mimeType.includes('png') || a.mimeType.includes('webp'))) ||
      a.fileData.startsWith('data:image/') ||
      ['BEFORE', 'DURING', 'AFTER', 'COMPLEMENTARY'].includes(a.evidenceType || '')
    )
  );

  const nonPhotoAttachments = allAttachments.filter(a => !validPhotos.includes(a));

  if (validPhotos.length > 0) {
    if (currentY > pageHeight - 85) {
      doc.addPage();
      renderHeader();
      currentY = 32;
    }

    doc.setFillColor(navyDark[0], navyDark[1], navyDark[2]);
    doc.rect(14, currentY, 2.5, 6, 'F');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text('5. EVIDÊNCIAS FOTOGRÁFICAS & COMPROVAÇÃO DE EXECUÇÃO', 19, currentY + 4.5);
    currentY += 9;

    // Agrupa fotos: Antes, Durante, Depois, Complementar
    const beforePhotos = validPhotos.filter(p => p.evidenceType === 'BEFORE');
    const afterPhotos = validPhotos.filter(p => p.evidenceType === 'AFTER');

    // Comparativo Antes/Depois com imagens maiores e proporção preservada.
    if (beforePhotos.length > 0 && afterPhotos.length > 0) {
      const boxW = (pageWidth - 32) / 2;
      const boxH = 72;
      const pBefore = beforePhotos[0];
      const pAfter = afterPhotos[0];

      if (currentY + boxH > pageHeight - 18) {
        doc.addPage();
        renderHeader();
        currentY = 32;
      }

      // Card Antes
      doc.setFillColor(254, 242, 242);
      doc.roundedRect(14, currentY, boxW, boxH, 2, 2, 'F');
      doc.setDrawColor(254, 205, 211);
      doc.roundedRect(14, currentY, boxW, boxH, 2, 2, 'S');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(225, 29, 72);
      doc.text('ANTES DA INTERVENÇÃO', 16, currentY + 5);

      try {
        addImageContained(pBefore.fileData, 16, currentY + 8, boxW - 4, 49);
      } catch (e) {}

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      const beforeCaption = doc.splitTextToSize(
        cleanTextForPdf(pBefore.caption || pBefore.displayName || 'Condição inicial identificada'),
        boxW - 8
      ).slice(0, 2);
      doc.text(beforeCaption, 16, currentY + boxH - 5);

      // Card Depois
      const xAfter = 14 + boxW + 4;
      doc.setFillColor(236, 253, 245);
      doc.roundedRect(xAfter, currentY, boxW, boxH, 2, 2, 'F');
      doc.setDrawColor(167, 243, 208);
      doc.roundedRect(xAfter, currentY, boxW, boxH, 2, 2, 'S');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 185, 129);
      doc.text('DEPOIS DA INTERVENÇÃO', xAfter + 2, currentY + 5);

      try {
        addImageContained(pAfter.fileData, xAfter + 2, currentY + 8, boxW - 4, 49);
      } catch (e) {}

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      const afterCaption = doc.splitTextToSize(
        cleanTextForPdf(pAfter.caption || pAfter.displayName || 'Resultado após implementação'),
        boxW - 8
      ).slice(0, 2);
      doc.text(afterCaption, xAfter + 2, currentY + boxH - 5);

      currentY += boxH + 6;
    }

    // Demais evidências em duas colunas, com área de imagem ampliada.
    const remainingPhotos = validPhotos.filter(p =>
      !(beforePhotos.length > 0 && afterPhotos.length > 0 && (p === beforePhotos[0] || p === afterPhotos[0]))
    );

    if (remainingPhotos.length > 0) {
      const gridW = (pageWidth - 32) / 2;
      const gridH = 70;

      for (let i = 0; i < remainingPhotos.length; i += 2) {
        if (currentY + gridH > pageHeight - 18) {
          doc.addPage();
          renderHeader();
          currentY = 32;
        }

        const p1 = remainingPhotos[i];
        const p2 = remainingPhotos[i + 1];

        // Card da primeira evidência
        doc.setFillColor(bgCard[0], bgCard[1], bgCard[2]);
        doc.roundedRect(14, currentY, gridW, gridH, 1.5, 1.5, 'F');
        doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
        doc.roundedRect(14, currentY, gridW, gridH, 1.5, 1.5, 'S');

        try {
          addImageContained(p1.fileData, 16, currentY + 3, gridW - 4, 51);
        } catch (e) {}

        const p1TypeLabel = p1.evidenceType === 'BEFORE' ? 'ANTES' :
                            p1.evidenceType === 'AFTER' ? 'DEPOIS' :
                            p1.evidenceType === 'DURING' ? 'DURANTE' : 'COMPLEMENTAR';
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(textDark[0], textDark[1], textDark[2]);
        const p1Caption = doc.splitTextToSize(
          cleanTextForPdf(`[${p1TypeLabel}] ${p1.caption || p1.displayName || p1.fileName}`),
          gridW - 8
        ).slice(0, 2);
        doc.text(p1Caption, 16, currentY + gridH - 5);

        // Card da segunda evidência, quando houver
        if (p2) {
          const x2 = 14 + gridW + 4;
          doc.setFillColor(bgCard[0], bgCard[1], bgCard[2]);
          doc.roundedRect(x2, currentY, gridW, gridH, 1.5, 1.5, 'F');
          doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
          doc.roundedRect(x2, currentY, gridW, gridH, 1.5, 1.5, 'S');

          try {
            addImageContained(p2.fileData, x2 + 2, currentY + 3, gridW - 4, 51);
          } catch (e) {}

          const p2TypeLabel = p2.evidenceType === 'BEFORE' ? 'ANTES' :
                              p2.evidenceType === 'AFTER' ? 'DEPOIS' :
                              p2.evidenceType === 'DURING' ? 'DURANTE' : 'COMPLEMENTAR';
          doc.setFontSize(6.5);
          const p2Caption = doc.splitTextToSize(
            cleanTextForPdf(`[${p2TypeLabel}] ${p2.caption || p2.displayName || p2.fileName}`),
            gridW - 8
          ).slice(0, 2);
          doc.text(p2Caption, x2 + 2, currentY + gridH - 5);
        }

        currentY += gridH + 4;
      }
    }
  }

  // Se houver laudos / documentos anexos que não são imagens
  if (nonPhotoAttachments.length > 0) {
    if (currentY > pageHeight - 50) {
      doc.addPage();
      renderHeader();
      currentY = 32;
    }

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(navyDark[0], navyDark[1], navyDark[2]);
    doc.text('DOCUMENTOS, LAUDOS E ARQUIVOS COMPLEMENTARES ANEXADOS:', 14, currentY + 4);
    currentY += 6;

    const docRows = nonPhotoAttachments.map((att, idx) => [
      String(idx + 1),
      cleanTextForPdf(att.displayName || att.fileName),
      att.mimeType || 'Documento',
      att.fileSize ? `${Math.round(att.fileSize / 1024)} KB` : 'Anexo',
      cleanTextForPdf(att.caption || 'Documento comprobatório')
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: 14, right: 14 },
      head: [['#', 'Arquivo', 'Tipo MIME', 'Tamanho', 'Descrição']],
      body: docRows,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1.5, textColor: textDark },
      headStyles: { fillColor: [241, 245, 249], textColor: textMuted, fontStyle: 'bold' }
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // --- SEÇÃO 6: VERIFICAÇÃO DE EFICÁCIA (VALIDAÇÃO SST) ---
  if (currentY > pageHeight - 55) {
    doc.addPage();
    renderHeader();
    currentY = 32;
  }

  doc.setFillColor(navyDark[0], navyDark[1], navyDark[2]);
  doc.rect(14, currentY, 2.5, 6, 'F');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('6. VERIFICAÇÃO DE EFICÁCIA & ENCERRAMENTO', 19, currentY + 4.5);
  currentY += 8;

  const verif = plan.verification;
  const verifResult = (verif?.result || 'PENDING') as keyof typeof VERIFICATION_LABELS;

  const verifTableBody = [
    [
      { content: 'Resultado da Validação:', styles: { fontStyle: 'bold' } },
      VERIFICATION_LABELS[verifResult] || 'Pendente de Verificação',
      { content: 'Data da Verificação:', styles: { fontStyle: 'bold' } },
      verif?.verifiedAt ? new Date(verif.verifiedAt).toLocaleDateString('pt-BR') : 'Aguardando validação'
    ],
    [
      { content: 'Responsável pela Validação:', styles: { fontStyle: 'bold' } },
      verif?.verifier?.name || plan.verifier?.name || 'Gestor de SST / Auditor Designado',
      { content: 'Data de Conclusão Efetiva:', styles: { fontStyle: 'bold' } },
      plan.completedAt ? new Date(plan.completedAt).toLocaleDateString('pt-BR') : 'Não concluído'
    ],
    [
      { content: 'Parecer Técnico de Eficácia:', styles: { fontStyle: 'bold' } },
      { content: cleanTextForPdf(verif?.notes || 'Medida em processo de implementação e acompanhamento de eficácia.'), colSpan: 3 }
    ]
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: 14, right: 14 },
    body: verifTableBody as any,
    theme: 'plain',
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: textDark,
      lineColor: borderLight,
      lineWidth: 0.1
    },
    columnStyles: {
      0: { cellWidth: 42, fillColor: [248, 250, 252], textColor: textMuted },
      1: { cellWidth: 49 },
      2: { cellWidth: 42, fillColor: [248, 250, 252], textColor: textMuted },
      3: { cellWidth: 49 }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // --- SEÇÃO 7: PRORROGAÇÕES E HISTÓRICO DE PRAZOS ---
  if (plan.extensions && plan.extensions.length > 0) {
    if (currentY > pageHeight - 45) {
      doc.addPage();
      renderHeader();
      currentY = 32;
    }

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text('Histórico de Prorrogações de Prazo:', 14, currentY);
    currentY += 4;

    const extRows = plan.extensions.map(e => [
      new Date(e.currentDueDate).toLocaleDateString('pt-BR'),
      new Date(e.requestedDueDate).toLocaleDateString('pt-BR'),
      cleanTextForPdf(e.justification),
      e.status === 'APPROVED' ? 'Aprovada' : e.status === 'REJECTED' ? 'Rejeitada' : 'Pendente',
      e.approver?.name || '-'
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: 14, right: 14 },
      head: [['PRAZO ANTERIOR', 'NOVO PRAZO', 'JUSTIFICATIVA REGISTRADA', 'STATUS', 'APROVADO POR']],
      body: extRows,
      theme: 'plain',
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: textDark,
        fontSize: 6.8,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 6.8,
        cellPadding: 1.5,
        textColor: textDark,
        lineColor: borderLight,
        lineWidth: 0.1
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // --- ASSINATURAS FINAIS DOS RESPONSÁVEIS ---
  if (currentY > pageHeight - 35) {
    doc.addPage();
    renderHeader();
    currentY = 40;
  }

  const signW = (pageWidth - 38) / 3;
  const signY = pageHeight - 28;

  // Responsável
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.setLineWidth(0.3);
  doc.line(14, signY, 14 + signW, signY);
  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(plan.responsible?.name || 'Responsável pela Execução', 14 + (signW / 2), signY + 3.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('Executante Principal', 14 + (signW / 2), signY + 7, { align: 'center' });

  // Supervisor
  const signX2 = 14 + signW + 5;
  doc.line(signX2, signY, signX2 + signW, signY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(plan.supervisor?.name || 'Supervisor / Gestor', signX2 + (signW / 2), signY + 3.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('Supervisão Operacional', signX2 + (signW / 2), signY + 7, { align: 'center' });

  // Verificador SST
  const signX3 = signX2 + signW + 5;
  doc.line(signX3, signY, signX3 + signW, signY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(plan.verifier?.name || 'Auditor / Gestor SST', signX3 + (signW / 2), signY + 3.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('Validação de Eficácia', signX3 + (signW / 2), signY + 7, { align: 'center' });

  // Finaliza com numeração de páginas em todas as folhas
  addFooter();

  // Salva e aciona download automático no navegador
  doc.save(`Plano_Acao_${plan.code}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// =========================================================================
// 2. RELATÓRIO CONSOLIDADO DE PLANOS DE AÇÃO (ANALÍTICO COM KPI)
// =========================================================================

export interface ConsolidatedReportFilters {
  status?: string;
  priority?: string;
  responsible?: string;
  startDate?: string;
  endDate?: string;
  companyName?: string;
}

export async function generateActionPlanConsolidatedPdf(
  plans: ActionPlanFullData[],
  filters: ConsolidatedReportFilters = {}
): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  const navyDark: [number, number, number] = [15, 31, 56];
  const bluePrimary: [number, number, number] = [37, 99, 235];
  const textDark: [number, number, number] = [15, 23, 42];
  const textMuted: [number, number, number] = [100, 116, 139];
  const borderLight: [number, number, number] = [226, 232, 240];

  // Header Corporativo Landscape
  const renderLandscapeHeader = () => {
    doc.setFillColor(navyDark[0], navyDark[1], navyDark[2]);
    doc.rect(0, 0, pageWidth, 24, 'F');
    doc.setFillColor(bluePrimary[0], bluePrimary[1], bluePrimary[2]);
    doc.rect(0, 23, pageWidth, 1, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('DDS ON', 14, 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225);
    doc.text('RELATÓRIO CONSOLIDADO GERENCIAL DE PLANOS DE AÇÃO & NÃO CONFORMIDADES', 14, 20);

    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Emissão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, pageWidth - 14, 14, { align: 'right' });
    if (filters.companyName) {
      doc.text(`Empresa: ${filters.companyName}`, pageWidth - 14, 19, { align: 'right' });
    }
  };

  renderLandscapeHeader();
  let currentY = 30;

  // --- KPIS RESUMO EXECUTIVO ---
  const total = plans.length;
  const completed = plans.filter(p => p.status === 'COMPLETED').length;
  const inProgress = plans.filter(p => p.status === 'IN_PROGRESS').length;
  const overdue = plans.filter(p => calculateDeadlineState(p.dueDate, p.completedAt, p.status).isOverdue).length;
  const awaitingVal = plans.filter(p => p.status === 'AWAITING_VALIDATION').length;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const cardW = (pageWidth - 28 - 20) / 5;
  const kpis = [
    { label: 'TOTAL DE PLANOS', value: String(total), color: textDark },
    { label: 'EM ANDAMENTO', value: String(inProgress), color: [37, 99, 235] },
    { label: 'AGUARDANDO VALIDAÇÃO', value: String(awaitingVal), color: [217, 119, 6] },
    { label: 'VENCIDOS', value: String(overdue), color: [225, 29, 72] },
    { label: 'TAXA DE CONCLUSÃO', value: `${rate}%`, color: [16, 185, 129] }
  ];

  kpis.forEach((k, i) => {
    const x = 14 + (i * (cardW + 5));
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, currentY, cardW, 14, 2, 2, 'F');
    doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
    doc.roundedRect(x, currentY, cardW, 14, 2, 2, 'S');

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(k.label, x + 3, currentY + 4.5);

    doc.setFontSize(11);
    doc.setTextColor(k.color[0], k.color[1], k.color[2]);
    doc.text(k.value, x + 3, currentY + 11.5);
  });

  currentY += 19;

  // --- TABELA CONSOLIDADA ---
  const tableData = plans.map(p => {
    const deadline = calculateDeadlineState(p.dueDate, p.completedAt, p.status);
    const progress = calculatePlanProgress(p.tasks || [], p.status);
    return [
      p.code,
      cleanTextForPdf(p.title),
      p.sector || '-',
      ORIGIN_LABELS[p.origin] || p.origin,
      p.responsible?.name || 'Não atribuído',
      PRIORITY_LABELS[p.priority as keyof typeof PRIORITY_LABELS] || p.priority,
      STATUS_LABELS[p.status] || p.status,
      p.dueDate ? new Date(p.dueDate).toLocaleDateString('pt-BR') : '-',
      deadline.label,
      `${progress}%`
    ];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: 14, right: 14, bottom: 15 },
    head: [['CÓDIGO', 'TÍTULO DO PLANO', 'SETOR', 'ORIGEM', 'RESPONSÁVEL', 'PRIORIDADE', 'STATUS', 'PRAZO', 'SITUAÇÃO', 'PROG.']],
    body: tableData.length > 0 ? tableData : [['-', 'Nenhum plano de ação encontrado para os filtros selecionados.', '-', '-', '-', '-', '-', '-', '-', '-']],
    theme: 'plain',
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: textDark,
      fontSize: 7,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 7,
      cellPadding: 1.8,
      textColor: textDark,
      lineColor: borderLight,
      lineWidth: { bottom: 0.1, top: 0, left: 0, right: 0 }
    },
    columnStyles: {
      0: { cellWidth: 26, fontStyle: 'bold' },
      1: { cellWidth: 70 },
      2: { cellWidth: 24 },
      3: { cellWidth: 28 },
      4: { cellWidth: 34 },
      5: { cellWidth: 18, halign: 'center' },
      6: { cellWidth: 24 },
      7: { cellWidth: 18, halign: 'center' },
      8: { cellWidth: 26 },
      9: { cellWidth: 14, halign: 'center' }
    }
  });

  // Numeração de páginas no rodapé
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
    doc.line(14, pageHeight - 10, pageWidth - 14, pageHeight - 10);
    doc.setFontSize(7);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(`DDS-ON SST - Relatório Consolidado de Planos de Ação`, 14, pageHeight - 6);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - 14, pageHeight - 6, { align: 'right' });
  }

  doc.save(`Consolidado_Planos_Acao_${new Date().toISOString().slice(0, 10)}.pdf`);
}
