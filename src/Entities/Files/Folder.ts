// src/storage/entities/folder.entity.ts
import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../BaseEntity';

@Entity('folders')
export class Folder extends BaseEntity {
  @Column({ length: 150 })
  name: string;

  @ManyToOne(() => Folder, f => f.children, { onDelete: 'CASCADE', nullable: true })
  parent?: Folder;

  @OneToMany(() => Folder, f => f.parent)
  children: Folder[];
}
