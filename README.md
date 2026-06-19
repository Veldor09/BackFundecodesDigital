```markdown
# FUNDECODES Digital — Backend

API REST del sistema de gestión interna de FUNDECODES, desarrollada con NestJS, Prisma y PostgreSQL.

## Requisitos previos

- Node.js v18 o superior
- npm v9 o superior
- PostgreSQL 14 o superior

## Variables de entorno

Crear un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
DATABASE_URL="postgresql://USUARIO:CONTRASEÑA@localhost:5432/fundecodes"
JWT_SECRET="clave_secreta_segura"
PORT=3001
FRONTEND_URL="http://localhost:3000"
```

## Instalación

```bash
npm install
```

## Base de datos

Ejecutar las migraciones de Prisma para crear las tablas en la base de datos:

```bash
npx prisma migrate deploy
```

Para visualizar y administrar la base de datos en modo de desarrollo:

```bash
npx prisma studio
```

## Ejecutar el proyecto

```bash
# Modo desarrollo
npm run start:dev

# Modo producción
npm run start:prod
```

La API quedará disponible en `http://localhost:3001`.

## Módulos del sistema

| Módulo | Descripción |
|---|---|
| Auth | Autenticación con JWT, recuperación de contraseña |
| Users | Gestión de usuarios e invitaciones |
| Roles | Roles y permisos del sistema |
| Volunteer | Registro y gestión de voluntarios |
| Sanciones | Registro de sanciones a voluntarios |
| ProgramaVoluntariado | Programas de voluntariado y asignaciones |
| Collaborator | Colaboradores externos y asignación a proyectos |
| Projects | Proyectos con imágenes, documentos y estado |
| Areas | Áreas organizacionales |
| Billing | Solicitudes de facturación y pagos |
| Contabilidad | Cuentas, transacciones, presupuestos y documentos |
| Cuentas | Cuentas contables vinculadas a áreas |
| Visitaciones | Registro de visitas externas |
| Auditoria | Registro automático de acciones del sistema |
| Reportes | Generación de reportes en PDF y Excel |
| Dashboard | Cards generales del sistema |
| Files | Carga y gestión de archivos adjuntos |

## Estructura del proyecto

```
src/
├── auth/                  # Autenticación y autorización
├── SistemaAdmin/          # Módulos administrativos
│   ├── users/
│   ├── roles/
│   ├── Volunteer/
│   ├── sanciones/
│   ├── ProgramaVoluntariado/
│   ├── collaborator/
│   ├── projects/
│   ├── areas/
│   ├── billing/
│   ├── solicitudes/
│   ├── contabilidad/
│   ├── cuentas/
│   ├── visitaciones/
│   ├── auditoria/
│   ├── reportes/
│   ├── dashboard/
│   └── files/
└── main.ts
```

## Equipo

Proyecto desarrollado para FUNDECODES — Universidad Nacional de Costa Rica, Sede Regional Chorotega, Campus Nicoya.
```
