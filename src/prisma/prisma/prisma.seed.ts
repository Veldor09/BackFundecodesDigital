// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Evitar duplicar si ya hay datos
  const existing = await prisma.project.count();
  if (existing > 0) {
    console.log('Seed: ya existen proyectos, no se crean nuevos.');
    return;
  }

  await prisma.project.createMany({
    data: [
      {
        title: 'Reforestación Río Verde',
        slug: 'reforestacion-rio-verde',
        summary: 'Plantación de 500 árboles nativos',
        category: 'ambiental',
        status: 'EN_PROCESO',
        place: 'Nicoya',
        area: 'Conservación',
        published: true,
      },
      {
        title: 'Capacitación de voluntarios 2025',
        slug: 'capacitacion-voluntarios-2025',
        summary: 'Formación básica y avanzada',
        category: 'social',
        status: 'FINALIZADO',
        place: 'Santa Cruz',
        area: 'Educación',
        published: true,
      },
      {
        title: 'Monitoreo de calidad de agua',
        slug: 'monitoreo-calidad-agua',
        summary: 'Muestreo mensual y reporte abierto',
        category: 'ambiental',
        status: 'EN_PROCESO',
        place: 'Hojancha',
        area: 'Hídrica',
        published: false,
      },
    ],
  });

  console.log('Seed: proyectos de ejemplo creados.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
  