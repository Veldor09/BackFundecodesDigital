// src/SistemaAdmin/projects/dto/project-status.enum.ts
export const ProjectStatusEnum = {
  EN_PROCESO: 'EN_PROCESO',
  FINALIZADO: 'FINALIZADO',
  PAUSADO: 'PAUSADO',
} as const;

export type ProjectStatus = typeof ProjectStatusEnum[keyof typeof ProjectStatusEnum];

