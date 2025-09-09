// src/contacts/entities/contact-message.entity.ts
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../BaseEntity';

@Entity('contact_messages')
export class ContactMessage extends BaseEntity {
  @Column({ length: 120 })
  fullName: string;

  @Index()
  @Column({ length: 120 })
  email: string;

  @Column({ length: 30, nullable: true })
  phone?: string;

  @Column({ length: 150, nullable: true })
  subject?: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ default: 'RECEIVED' })
  status: 'RECEIVED' | 'IN_PROGRESS' | 'CLOSED';
}
