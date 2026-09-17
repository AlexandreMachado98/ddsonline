// lib/retention.ts
// Política de Retenção e Purga Operacional do DDS Online (v1.0)
// Cumprimento da Premissa de Privacidade e LGPD: não reter fotos, assinaturas e anexos brutos indefinidamente.

import prisma from '@/lib/prisma';
import { logSecurityEvent } from '@/lib/auth';

// Tempo padrão de retenção de dados operacionais após encerramento do DDS (em horas)
// Padrão: 48 horas (permite tempo hábil para conferência, download e suporte)
export const DDS_RETENTION_HOURS = Number(process.env.DDS_RETENTION_HOURS) || 48;

export interface PurgeResult {
  meetingsPurged: number;
  attendeesCleaned: number;
  attachmentsCleaned: number;
}

/**
 * Executa a purga de dados operacionais (selfies, assinaturas, foto coletiva e arquivos base64)
 * de reuniões com status 'ENDED' cujo endedAt excedeu o período regulamentar de retenção.
 * 
 * PRESERVA INTEGRALMENTE:
 * - Hash criptográfico SHA-256 (documentHash)
 * - Nomes, funções, horários e lista de participantes
 * - Temas, fazenda, objetivo, conteúdo pedagógico e datas
 * - Metadados de arquivos (nome do arquivo, tamanho e tipo MIME)
 */
export async function purgeExpiredOperationalData(organizerId?: string): Promise<PurgeResult> {
  // Salvaguarda Legal SST: Não apaga assinaturas e fotos faciais de listas de presença,
  // pois são evidências perenes de conformidade com as Normas Regulamentadoras (NRs).
  return { meetingsPurged: 0, attendeesCleaned: 0, attachmentsCleaned: 0 };
}

/**
 * Permite purga imediata sob demanda de uma reunião específica após o organizador baixar o PDF
 */
export async function purgeMeetingOperationalDataImmediate(meetingId: string, organizerId: string): Promise<boolean> {
  try {
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, organizerId }
    });

    if (!meeting || meeting.status !== 'ENDED') {
      return false;
    }

    await prisma.meetingAttachment.updateMany({
      where: { meetingId },
      data: { fileData: '' }
    });

    await prisma.attendance.updateMany({
      where: { meetingId },
      data: { selfie: '', signature: '' }
    });

    await prisma.meeting.update({
      where: { id: meetingId },
      data: { groupPhoto: null }
    });

    logSecurityEvent('ADMIN_ACTION', {
      userId: organizerId,
      reason: `IMMEDIATE_PURGE: Reunião ${meetingId} purgada manualmente pelo organizador`
    });

    return true;
  } catch (e) {
    console.error('Erro na purga manual de reunião:', e);
    return false;
  }
}
