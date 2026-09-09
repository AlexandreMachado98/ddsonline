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
  const cutoffDate = new Date(Date.now() - DDS_RETENTION_HOURS * 60 * 60 * 1000);

  try {
    // 1. Busca reuniões encerradas que ultrapassaram a janela de retenção e ainda possuem dados operacionais
    const expiredMeetings = await prisma.meeting.findMany({
      where: {
        status: 'ENDED',
        endedAt: { lte: cutoffDate },
        ...(organizerId ? { organizerId } : {})
      },
      select: {
        id: true,
        topic: true,
        endedAt: true,
        documentHash: true
      },
      take: 20
    });

    if (expiredMeetings.length === 0) {
      return { meetingsPurged: 0, attendeesCleaned: 0, attachmentsCleaned: 0 };
    }

    const meetingIds = expiredMeetings.map(m => m.id);

    // 2. Remove o conteúdo binário bruto dos anexos (preservando nome, tamanho e descrição)
    const updatedAttachments = await prisma.meetingAttachment.updateMany({
      where: {
        meetingId: { in: meetingIds },
        fileData: { not: '' }
      },
      data: {
        fileData: '' // Esvazia o payload pesado
      }
    });

    // 3. Remove selfies e assinaturas dos participantes (preservando nomes e presenças)
    const updatedAttendees = await prisma.attendance.updateMany({
      where: {
        meetingId: { in: meetingIds },
        OR: [
          { selfie: { not: '' } },
          { signature: { not: '' } }
        ]
      },
      data: {
        selfie: '',
        signature: ''
      }
    });

    // 4. Remove a foto de equipe da reunião
    const updatedMeetings = await prisma.meeting.updateMany({
      where: {
        id: { in: meetingIds },
        groupPhoto: { not: null }
      },
      data: {
        groupPhoto: null
      }
    });

    logSecurityEvent('ADMIN_ACTION', {
      reason: `PURGE_OPERATIONAL_DATA: ${expiredMeetings.length} reuniões purgadas (Retenção: ${DDS_RETENTION_HOURS}h)`
    });

    return {
      meetingsPurged: updatedMeetings.count,
      attendeesCleaned: updatedAttendees.count,
      attachmentsCleaned: updatedAttachments.count
    };
  } catch (error) {
    console.error('Erro durante purga de dados operacionais:', error);
    return { meetingsPurged: 0, attendeesCleaned: 0, attachmentsCleaned: 0 };
  }
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
