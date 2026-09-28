import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const users = [
    { name: 'Alice Smith', email: 'alice@example.com', password: 'password123' },
    { name: 'Bob Jones', email: 'bob@example.com', password: 'password123' },
    { name: 'Charlie Brown', email: 'charlie@example.com', password: 'password123' },
    { name: 'Diana Prince', email: 'diana@example.com', password: 'password123' }
  ];

  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (!existing) {
      const hashedPassword = await bcrypt.hash(u.password, 10);
      await prisma.user.create({
        data: {
          name: u.name,
          email: u.email,
          passwordHash: hashedPassword
        }
      });
      console.log(`Created user: ${u.name}`);
    }
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
