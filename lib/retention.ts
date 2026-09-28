// lib/retention.ts
// Política de Retenção e Purga Operacional do DDS Online (v2.0)
// Cumprimento da Premissa de Privacidade e LGPD: minimização e expurgo de mídias brutas pós-fechamento com hash SHA-256.

import prisma from '@/lib/prisma';
import { logSecurityEvent } from '@/lib/auth';

// Tempo padrão de retenção de dados operacionais após encerramento do DDS (em horas)
export const DDS_RETENTION_HOURS = Number(process.env.DDS_RETENTION_HOURS) || 48;
export const ENABLE_AUTOMATIC_PURGE = process.env.ENABLE_AUTOMATIC_PURGE === 'true';

export interface PurgeOptions {
  dryRun?: boolean;
  organizerId?: string;
  retentionHours?: number;
}

export interface PurgeResult {
  success: boolean;
  isDryRun: boolean;
  retentionHoursUsed: number;
  meetingsEligible: number;
  meetingsPurged: number;
  attendeesCleaned: number;
  attachmentsCleaned: number;
  timestamp: string;
}

/**
 * Executa a purga de dados operacionais brutos (selfies, assinaturas e Base64 de arquivos)
 * de reuniões com status 'ENDED' cujo endedAt excedeu o período regulamentar de retenção.
 * 
 * SALVAGUARDA DE INTEGRIDADE (SST / MTE):
 * - Exige obrigatoriamente que a reunião possua 'documentHash' congelado antes de purgar.
 * - PRESERVA INTEGRALMENTE:
 *   - Hash criptográfico SHA-256 (documentHash)
 *   - Nomes, funções/cargos, horários de entrada e saída
 *   - Temas, fazenda, objetivo, conteúdo pedagógico, instrutor e datas
 *   - Metadados de arquivos (nome do arquivo, tamanho, tipo MIME e ordem)
 */
export async function purgeExpiredOperationalData(options: PurgeOptions = {}): Promise<PurgeResult> {
  const isDryRun = options.dryRun ?? false;
  const hours = options.retentionHours ?? DDS_RETENTION_HOURS;
  const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000);

  try {
    // 1. Localiza reuniões elegíveis (encerradas antes do cutoff e com hash gerado)
    const eligibleMeetings = await prisma.meeting.findMany({
      where: {
        status: 'ENDED',
        endedAt: { lte: cutoffDate },
        documentHash: { not: null },
        ...(options.organizerId ? { organizerId: options.organizerId } : {})
      },
      select: {
        id: true,
        topic: true,
        endedAt: true,
        _count: {
          select: {
            attendees: true,
            attachments: true
          }
        }
      }
    });

    const meetingsCount = eligibleMeetings.length;
    let totalAttendees = 0;
    let totalAttachments = 0;

    for (const m of eligibleMeetings) {
      totalAttendees += m._count.attendees;
      totalAttachments += m._count.attachments;
    }

    // Se for modo Dry-Run ou não houver reuniões elegíveis, retorna contadores sem alterar dados
    if (isDryRun || meetingsCount === 0) {
      return {
        success: true,
        isDryRun: true,
        retentionHoursUsed: hours,
        meetingsEligible: meetingsCount,
        meetingsPurged: 0,
        attendeesCleaned: totalAttendees,
        attachmentsCleaned: totalAttachments,
        timestamp: new Date().toISOString()
      };
    }

    const meetingIds = eligibleMeetings.map(m => m.id);

    // 2. Executa a limpeza operacional atômica
    await prisma.$transaction([
      // Limpa dados de arquivos mantendo metadados (fileName, size, mimeType)
      prisma.meetingAttachment.updateMany({
        where: { meetingId: { in: meetingIds } },
        data: { fileData: '' }
      }),
      // Limpa fotos e assinaturas mantendo os registros de presença (nome, CPF, horários)
      prisma.attendance.updateMany({
        where: { meetingId: { in: meetingIds } },
        data: { selfie: '', signature: '', exitSignature: null }
      }),
      // Limpa foto coletiva
      prisma.meeting.updateMany({
        where: { id: { in: meetingIds } },
        data: { groupPhoto: null }
      })
    ]);

    logSecurityEvent('ADMIN_ACTION', {
      reason: `RETENTION_PURGE_EXECUTED: ${meetingsCount} reuniões, ${totalAttendees} presenças e ${totalAttachments} anexos limpos (Retenção: ${hours}h)`
    });

    return {
      success: true,
      isDryRun: false,
      retentionHoursUsed: hours,
      meetingsEligible: meetingsCount,
      meetingsPurged: meetingsCount,
      attendeesCleaned: totalAttendees,
      attachmentsCleaned: totalAttachments,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('Erro ao executar purga de dados operacionais:', error);
    return {
      success: false,
      isDryRun,
      retentionHoursUsed: hours,
      meetingsEligible: 0,
      meetingsPurged: 0,
      attendeesCleaned: 0,
      attachmentsCleaned: 0,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Permite purga imediata sob demanda de uma reunião específica após o organizador baixar a ata oficial
 */
export async function purgeMeetingOperationalDataImmediate(meetingId: string, organizerId: string): Promise<boolean> {
  try {
    const meeting = await prisma.meeting.findFirst({
      where: { 
        id: meetingId, 
        organizerId,
        status: 'ENDED',
        documentHash: { not: null }
      }
    });

    if (!meeting) {
      return false;
    }

    await prisma.$transaction([
      prisma.meetingAttachment.updateMany({
        where: { meetingId },
        data: { fileData: '' }
      }),
      prisma.attendance.updateMany({
        where: { meetingId },
        data: { selfie: '', signature: '', exitSignature: null }
      }),
      prisma.meeting.update({
        where: { id: meetingId },
        data: { groupPhoto: null }
      })
    ]);

    logSecurityEvent('ADMIN_ACTION', {
      userId: organizerId,
      reason: `IMMEDIATE_PURGE_SUCCESS: Reunião ${meetingId} purgada manualmente pelo organizador`
    });

    return true;
  } catch (e) {
    console.error('Erro na purga manual de reunião:', e);
    return false;
  }
}
