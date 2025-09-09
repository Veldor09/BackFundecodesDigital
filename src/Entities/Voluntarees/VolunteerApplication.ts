// src/volunteers/entities/volunteer-application.entity.ts
import { Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from '../BaseEntity';
import { Volunteer } from './Volunteer';
import { Project } from '../Portfolio/Project';

export type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

@Entity('volunteer_applications')
export class VolunteerApplication extends BaseEntity {
  @ManyToOne(() => Volunteer, v => v.applications, { onDelete: 'CASCADE' })
  volunteer: Volunteer;

  @ManyToOne(() => Project, p => p.applications, { onDelete: 'CASCADE', nullable: true })
  project?: Project;

  @Column({ type: 'text', nullable: true })
  motivation?: string;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: ApplicationStatus;
}
