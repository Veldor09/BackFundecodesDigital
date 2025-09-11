import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding roles y permisos…');

  // 1) Permisos base
  const PERMISSIONS = [
    { key: 'users.manage', description: 'Gestionar usuarios' },
    { key: 'roles.manage', description: 'Gestionar roles y permisos' },
    { key: 'projects.manage', description: 'Gestionar proyectos' },
    { key: 'news.manage', description: 'Gestionar noticias' },
  ];

  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { description: p.description },
      create: p,
    });
  }

  // 2) Leer IDs de permisos
  const allPerms = await prisma.permission.findMany({
    select: { id: true, key: true },
  });
  const permIdByKey = Object.fromEntries(allPerms.map((p) => [p.key, p.id]));

  // 3) Roles con sus permisos
  const ROLES: Record<string, string[]> = {
    admin: ['users.manage', 'roles.manage', 'projects.manage', 'news.manage'],
    editor: ['projects.manage', 'news.manage'],
    viewer: [],
  };

  // 4) Upsert roles + conectar permisos
  for (const [name, keys] of Object.entries(ROLES)) {
    const connects = keys
      .map((k) => permIdByKey[k])
      .filter(Boolean)
      .map((id) => ({ id }));

    await prisma.role.upsert({
      where: { name },
      update: {
        // reset + conectar (cast para evitar error de tipos si el cliente está cacheado)
        permissions: { set: [], connect: connects } as any,
      },
      create: {
        name,
        permissions: { connect: connects } as any,
      },
    });
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
