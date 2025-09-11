// src/storage/entities/access-control-entry.entity.ts
import { Column, Entity, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../BaseEntity';
import { FileItem } from './FileItem';
import { User } from '../Auth & Role/User';
import { Role } from '../Auth & Role/Role';

@Entity('access_control_entries')
@Unique(['file', 'user', 'role'])
export class AccessControlEntry extends BaseEntity {
  @ManyToOne(() => FileItem, { onDelete: 'CASCADE' })
  file: FileItem;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  user?: User;

  @ManyToOne(() => Role, { onDelete: 'CASCADE', nullable: true })
  role?: Role;

  @Column({ default: false })
  canRead: boolean;

  @Column({ default: false })
  canWrite: boolean;

  @Column({ default: false })
  canDelete: boolean;
}
