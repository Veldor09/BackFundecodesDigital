// src/users/entities/user-role.entity.ts
import { Entity, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../BaseEntity';
import { User } from './User';
import { Role } from './Role';

@Entity('user_roles')
@Unique(['user', 'role'])
export class UserRole extends BaseEntity {
  @ManyToOne(() => User, (u) => u.userRoles, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Role, (r) => r.userRoles, { onDelete: 'CASCADE' })
  role: Role;
}
