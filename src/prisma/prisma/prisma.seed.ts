// prisma/seed.ts
import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const ADMIN_EMAIL = 'admin@fundecodes.org'
const ADMIN_PASS  = process.env.ADMIN_DEFAULT_PASSWORD || 'fundecodes2025'
const ADMIN_NAME  = 'Administrador Fundecodes'
const ADMIN_FORCE_RESET = (process.env.ADMIN_FORCE_RESET || 'false').toLowerCase() === 'true'

async function main() {
  console.log('🌱 Sembrando roles, permisos y usuario admin…')

  const MODULE_PERMS = [
    { key: 'voluntario:access',   description: 'Acceso al módulo de Voluntariado' },
    { key: 'sanciones:access',    description: 'Acceso al módulo de Sanciones' },
    { key: 'projects:access',     description: 'Acceso al módulo de Proyectos' },
    { key: 'solicitudes:access',  description: 'Acceso al módulo de Solicitudes' },
    { key: 'facturas:access',     description: 'Acceso al módulo de Facturas' },
    { key: 'contabilidad:access', description: 'Acceso al módulo de Contabilidad' },
    { key: 'programavoluntariado:access', description: 'Acceso al módulo de Programa Voluntariado' },
    { key: 'reportes:access', description: 'Acceso al módulo de Reportes' },
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
    colaboradorvoluntariado: ['voluntario:access','sanciones:access','programavoluntariado:access'],
    colaboradorproyecto: ['projects:access'],
    colaboradorcontabilidad: ['contabilidad:access','solicitudes:access','facturas:access'],
    colaboradorvoluntario: ['voluntario:access','sanciones:access','programavoluntariado:access'],
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
  const hashed = await bcrypt.hash(ADMIN_PASS, 12)

  if (!existingAdmin) {
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
    // Forzar actualización de password si está vacío o si ADMIN_FORCE_RESET=true
    if (ADMIN_FORCE_RESET || !existingAdmin.password) {
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: { password: hashed, approved: true, verified: true },
      })
      console.log('🔑 Password del admin actualizado por seed.')
    }
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
