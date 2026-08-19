import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

// Conexão direta para evitar qualquer erro de atalho
const prisma = new PrismaClient();

// 1. GET: Busca a reunião ao vivo e as presenças
export async function GET() {
  try {
    const meeting = await prisma.meeting.findFirst({
      where: { status: 'LIVE' },
      include: { 
        attendees: { 
          orderBy: { createdAt: 'desc' } 
        } 
      }
    });
    return NextResponse.json({ success: true, meeting });
  } catch (error) {
    console.error("Erro no GET /api/reuniao:", error);
    return NextResponse.json({ success: false, error: 'Erro ao buscar' }, { status: 500 });
  }
}

// 2. POST: Abre uma nova sala de DDS
export async function POST(req: Request) {
  try {
    const { topic, farm } = await req.json();

    // Encerra reuniões antigas
    await prisma.meeting.updateMany({
      where: { status: 'LIVE' },
      data: { status: 'ENDED' }
    });

    // Cria a nova sala
    const newMeeting = await prisma.meeting.create({
      data: { topic, farm, status: 'LIVE' }
    });
    
    return NextResponse.json({ success: true, meeting: newMeeting });
  } catch (error) {
    console.error("Erro no POST /api/reuniao:", error);
    return NextResponse.json({ success: false, error: 'Erro ao criar' }, { status: 500 });
  }
}

// 3. PUT: Encerra a reunião ativa
export async function PUT() {
  try {
    await prisma.meeting.updateMany({
      where: { status: 'LIVE' },
      data: { status: 'ENDED' }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro no PUT /api/reuniao:", error);
    return NextResponse.json({ success: false, error: 'Erro ao encerrar' }, { status: 500 });
  }
}