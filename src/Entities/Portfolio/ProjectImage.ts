// src/projects/entities/project-image.entity.ts
import { Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from '../BaseEntity';
import { Project } from './Project';

@Entity('project_images')
export class ProjectImage extends BaseEntity {
  @ManyToOne(() => Project, (p) => p.images, { onDelete: 'CASCADE' })
  project: Project;

  @Column()
  url: string;

  @Column({ nullable: true })
  alt?: string;

  @Column({ type: 'int', default: 0 })
  orderIndex: number;
}
