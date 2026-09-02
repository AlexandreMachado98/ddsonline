import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    // 1. Recebe os dados que vieram do formulário (celular/navegador)
    const body = await req.json();
    const { name, cpf, savedSelfie, savedSignature } = body;

    // 2. Procura se existe alguma reunião (DDS) rolando agora
    let meeting = await prisma.meeting.findFirst({
      where: { status: 'LIVE' }
    });

    // Se não achar nenhuma reunião aberta, cria uma de teste automaticamente
    if (!meeting) {
      meeting = await prisma.meeting.create({
        data: {
          topic: 'DDS de Teste Inicial',
          farm: 'Fazenda Modelo',
          status: 'LIVE'
        }
      });
    }

    // 3. Salva a presença do trabalhador no Banco de Dados
    const attendance = await prisma.attendance.create({
      data: {
        name,
        cpf,
        selfie: savedSelfie,
        signature: savedSignature,
        meetingId: meeting.id
      }
    });

    // 4. Responde para a tela que deu tudo certo
    return NextResponse.json({ success: true, message: "Salvo com sucesso!", data: attendance });
    
  } catch (error) {
    console.error("Erro na API:", error);
    return NextResponse.json(
      { success: false, error: 'Falha ao salvar os dados no banco.' }, 
      { status: 500 }
    );
  }
}