// prisma/seed.ts
import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const ADMIN_EMAIL = 'admin@fundecodes.org'
const ADMIN_PASS  = 'fundecodes2025'
const ADMIN_NAME  = 'Administrador Fundecodes'

async function main() {
  console.log('🌱 Sembrando roles, permisos y usuario admin…')

  const MODULE_PERMS = [
    { key: 'voluntario:access',   description: 'Acceso al módulo de Voluntariado' },
    { key: 'sanciones:access',    description: 'Acceso al módulo de Sanciones' },
    { key: 'projects:access',    description: 'Acceso al módulo de Proyectos' },
    { key: 'solicitudes:access',  description: 'Acceso al módulo de Solicitudes' },
    { key: 'facturas:access',     description: 'Acceso al módulo de Facturas' },
    { key: 'contabilidad:access', description: 'Acceso al módulo de Contabilidad' },
  ]
  const MANAGE_PERMS = [
    { key: 'users.manage',    description: 'Gestionar usuarios' },
    { key: 'roles.manage',    description: 'Gestionar roles y permisos' },
    { key: 'projects.manage', description: 'Gestionar proyectos' },
    { key: 'news.manage',     description: 'Gestionar noticias' },
  ]
  const ALL_PERMS = [...MODULE_PERMS, ...MANAGE_PERMS]

  for (const p of ALL_PERMS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { description: p.description },
      create: p,
    })
  }

  const ROLE_TO_PERMS: Record<string, string[]> = {
    admin: ALL_PERMS.map(p => p.key),
    voluntario: ['voluntario:access'],
    colaboradorfacturas: ['facturas:access','solicitudes:access'],
    colaboradorvoluntariado: ['voluntario:access','sanciones:access'],
    colaboradorproyecto: ['projects:access'],
    colaboradorcontabilidad: ['contabilidad:access','solicitudes:access','facturas:access'],
    colaboradorvoluntario: ['voluntario:access','sanciones:access'],
  }

  for (const [name, keys] of Object.entries(ROLE_TO_PERMS)) {
    await prisma.role.upsert({
      where: { name },
      update: { permissions: { set: [], connect: keys.map(key => ({ key })) } as any },
      create: { name, permissions: { connect: keys.map(key => ({ key })) } as any },
    })
  }

  const adminRole = await prisma.role.findUnique({ where: { name: 'admin' } })
  if (!adminRole) throw new Error('Role "admin" no encontrado')

  const existingAdmin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } })
  if (!existingAdmin) {
    const hashed = await bcrypt.hash(ADMIN_PASS, 12)
    await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        name: ADMIN_NAME,
        password: hashed,
        approved: true,
        verified: true,
        roles: { create: { roleId: adminRole.id } }, // UserRole
      },
    })
    console.log('✅ Usuario admin creado.')
  } else {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: existingAdmin.id, roleId: adminRole.id } },
      update: {},
      create: { userId: existingAdmin.id, roleId: adminRole.id },
    })
    console.log('👤 Usuario admin ya existía; rol admin verificado.')
  }

  console.log('✅ Seed completado.')
}

main()
  .catch((e) => { console.error('❌ Seed error:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
