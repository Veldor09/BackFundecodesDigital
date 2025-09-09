// src/users/entities/role.entity.ts
import { Column, Entity, OneToMany, Unique } from 'typeorm';
import { BaseEntity } from '../BaseEntity';
import { UserRole } from './UserRole';

@Entity('roles')
@Unique(['name'])
export class Role extends BaseEntity {
  @Column({ length: 50 })
  name: 'ADMIN' | 'EDITOR' | 'VOLUNTEER' | 'USER';

  @Column({ length: 150, nullable: true })
  description?: string;

  @OneToMany(() => UserRole, ur => ur.role)
  userRoles: UserRole[];
}
