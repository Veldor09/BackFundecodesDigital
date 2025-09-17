// src/projects/entities/project.entity.ts
import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../BaseEntity';
import { ProjectImage } from './ProjectImage';
import { Comment } from '../Comment/Comment';
import { VolunteerApplication } from '../Voluntarees/VolunteerApplication';

@Entity('projects')
export class Project extends BaseEntity {
  @Column({ length: 150 })
  title: string;

  @Column({ type: 'text' })
  summary: string;

  @Column({ length: 50, nullable: true })
  category?: string;

  @Column({ default: false })
  featured: boolean;

  @OneToMany(() => ProjectImage, (i) => i.project, { cascade: true })
  images: ProjectImage[];

  @OneToMany(() => Comment, (c) => c.project)
  comments: Comment[];

  @OneToMany(() => VolunteerApplication, (a) => a.project)
  applications: VolunteerApplication[];
}
