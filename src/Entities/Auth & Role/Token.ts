// src/auth/entities/refresh-token.entity.ts
import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../BaseEntity';
import { User } from './User';

@Entity('refresh_tokens')
export class RefreshToken extends BaseEntity {
  @Index()
  @Column()
  tokenHash: string;

  @Column({ type: 'datetime' })
  expiresAt: Date;

  @ManyToOne(() => User, (u) => u.refreshTokens, { onDelete: 'CASCADE' })
  user: User;

  @Column({ default: false })
  revoked: boolean;
}
