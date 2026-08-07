// Seed de usuários dev no Neon via Better Auth (hash correto de senha).
// Uso: DATABASE_URL="postgresql://..." npx tsx scripts/seed-neon.ts
import { hashPassword } from 'better-auth/crypto';
import { getDb } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { instituicoes, usuarios, accounts } from '@/lib/db/schema';

const SEED_USERS = [
  { email: 'admin@mock.ilpi', password: 'Admin123!', name: 'Admin Mock', role: 'admin' },
  { email: 'profissional@mock.ilpi', password: 'Prof123!', name: 'Dr. Mock', role: 'profissional' },
  { email: 'leitor@mock.ilpi', password: 'Leitor123!', name: 'Leitor Mock', role: 'usuario' },
] as const;

async function main() {
  const db = await getDb();

  // 1. Instituição (obrigatória: usuarios.instituicao_id NOT NULL)
  let inst = await db.query.instituicoes.findFirst({
    where: eq(instituicoes.nome, 'ILPI Mock'),
  });
  if (!inst) {
    const created = await db.insert(instituicoes).values({
      nome: 'ILPI Mock',
      cnpj: '00.000.000/0001-00',
    }).returning();
    inst = created[0];
    console.log(`instituição criada: ${inst.id}`);
  }

  // 2. Usuários + conta credential (hash de senha compatível com Better Auth)
  for (const u of SEED_USERS) {
    const existing = await db.query.usuarios.findFirst({
      where: eq(usuarios.email, u.email),
    });

    if (existing) {
      console.log(`já existe: ${u.email}`);
      continue;
    }

    const passwordHash = await hashPassword(u.password);
    const user = await db.insert(usuarios).values({
      instituicaoId: inst.id,
      nome: u.name,
      email: u.email,
      role: u.role,
      ativo: true,
    }).returning();

    await db.insert(accounts).values({
      userId: user[0].id,
      accountId: user[0].id,
      providerId: 'credential',
      password: passwordHash,
    });

    console.log(`criado: ${u.email} (${u.role})`);
  }

  console.log('Seed OK.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Falha no seed:', (err as Error).message);
  process.exit(1);
});
