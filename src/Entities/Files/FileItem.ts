// src/storage/entities/file-item.entity.ts
import { Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from '../BaseEntity';
import { Folder } from './Folder';
import { User } from '../Auth & Role/User';

@Entity('file_items')
export class FileItem extends BaseEntity {
  @Column({ length: 180 })
  name: string;

  @Column()
  url: string; // ubicación en S3/Local

  @Column({ length: 80, nullable: true })
  mimeType?: string;

  @ManyToOne(() => Folder, { onDelete: 'SET NULL', nullable: true })
  folder?: Folder;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  owner?: User;

  @Column({ type: 'bigint', default: 0 })
  size: number;
}
