// src/audit/entities/audit-log.entity.ts
import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../BaseEntity';
import { User } from '../Auth & Role/User';

@Entity('audit_logs')
export class AuditLog extends BaseEntity {
  @Index()
  @Column({ length: 80 })
  action: string; // e.g., 'PROJECT_CREATED'

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  actor?: User;

  @Column({ type: 'text', nullable: true })
  details?: string; // JSON.stringify(...) de cambios

  @Index()
  @Column({ length: 50, nullable: true })
  targetType?: 'PROJECT' | 'POST' | 'FILE' | 'USER';

  @Index()
  @Column({ nullable: true })
  targetId?: string;
}
