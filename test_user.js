const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'apoiotst.ms@vistec.com.br' }
    });
    console.log("USER:", user);
  } catch(e) {
    console.log("ERROR:", e);
  }
}
main().finally(() => prisma.$disconnect());
