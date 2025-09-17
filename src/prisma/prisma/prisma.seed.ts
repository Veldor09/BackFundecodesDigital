// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'admin@fundecodes.org';
const ADMIN_PASS  = 'fundecodes2025';
const ADMIN_NAME  = 'Administrador Fundecodes';

async function main() {
  console.log('🌱 Sembrando roles, permisos y usuario admin…');

  /* ---------- 1.  Permisos ---------- */
  const PERMISSIONS = [
    { key: 'users.manage',  description: 'Gestionar usuarios' },
    { key: 'roles.manage',  description: 'Gestionar roles y permisos' },
    { key: 'projects.manage', description: 'Gestionar proyectos' },
    { key: 'news.manage',   description: 'Gestionar noticias' },
  ];

  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { description: p.description },
      create: p,
    });
  }

  /* ---------- 2.  Roles con permisos ---------- */
  const allPerms = await prisma.permission.findMany({ select: { id: true, key: true } });
  const permIdByKey = Object.fromEntries(allPerms.map((p) => [p.key, p.id]));

  const ROLES: Record<string, string[]> = {
    admin:  ['users.manage', 'roles.manage', 'projects.manage', 'news.manage'],
    editor: ['projects.manage', 'news.manage'],
    viewer: [],
  };

  for (const [name, keys] of Object.entries(ROLES)) {
    const connects = keys.map((k) => permIdByKey[k]).filter(Boolean).map((id) => ({ id }));
    await prisma.role.upsert({
      where: { name },
      update: { permissions: { set: [], connect: connects } as any },
      create: { name, permissions: { connect: connects } as any },
    });
  }

  /* ---------- 3.  Usuario admin por defecto ---------- */
  const adminRole = await prisma.role.findUnique({ where: { name: 'admin' } });
  if (!adminRole) throw new Error('Role "admin" no encontrado tras el seed de roles');

  const existingAdmin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!existingAdmin) {
    const hashed = await bcrypt.hash(ADMIN_PASS, 12);
    await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        name: ADMIN_NAME,
        password: hashed,
        approved: true,
        verified: true,
        roles: { create: { roleId: adminRole.id } },
      },
    });
    console.log('✅ Usuario admin creado.');
  } else {
    console.log('👤 Usuario admin ya existe.');
  }

  console.log('✅ Seed completado.');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });