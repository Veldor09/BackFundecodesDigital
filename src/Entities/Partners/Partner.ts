// src/partners/entities/partner.entity.ts
import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../BaseEntity';

@Entity('partners')
export class Partner extends BaseEntity {
  @Column({ length: 150 })
  name: string;

  @Column({ nullable: true })
  website?: string;

  @Column({ nullable: true })
  logoUrl?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ default: true })
  active: boolean;
}
