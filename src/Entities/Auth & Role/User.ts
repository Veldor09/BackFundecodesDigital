// src/users/entities/user.entity.ts
import { Column, Entity, OneToMany, Unique } from 'typeorm';
import { BaseEntity } from '../BaseEntity';
import { UserRole } from './UserRole';
import { RefreshToken } from './Token';

@Entity('users')
@Unique(['email'])
export class User extends BaseEntity {
  @Column({ length: 120 })
  fullName: string;

  @Column({ length: 120 })
  email: string;

  @Column({ select: false })
  passwordHash: string;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => UserRole, ur => ur.user, { cascade: true })
  userRoles: UserRole[];

  @OneToMany(() => RefreshToken, t => t.user, { cascade: true })
  refreshTokens: RefreshToken[];
}
