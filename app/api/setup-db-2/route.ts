import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "Meeting" ADD COLUMN "endedAt" TIMESTAMP(3);');
  } catch (error) {
    console.error('endedAt error', error);
  }

  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "Meeting" ADD COLUMN "instructorName" TEXT;');
  } catch (error) {
    console.error('instructorName error', error);
  }

  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "Meeting" ADD COLUMN "classification" TEXT DEFAULT \'DDS\';');
  } catch (error) {
    console.error('classification error', error);
  }

  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "Meeting" ADD COLUMN "objective" TEXT;');
  } catch (error) {
    console.error('objective error', error);
  }

  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "Meeting" ADD COLUMN "programmaticContent" TEXT;');
  } catch (error) {
    console.error('programmaticContent error', error);
  }

  return NextResponse.json({ success: true, message: 'Schema updated successfully.' });
}
