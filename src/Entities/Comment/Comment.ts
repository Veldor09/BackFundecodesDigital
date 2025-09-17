// src/social/entities/comment.entity.ts
import { Column, Entity, ManyToOne, Index } from 'typeorm';
import { BaseEntity } from '../BaseEntity';
import { User } from '../Auth & Role/User';
import { Project } from '../Portfolio/Project';
import { Post } from '../Web/Post';

@Entity('comments')
export class Comment extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  author?: User;

  @Column({ type: 'text' })
  content: string;

  // Comentarios asociados a Project o Post (dos FKs opcionales)
  @ManyToOne(() => Project, (p) => p.comments, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  project?: Project;

  @ManyToOne(() => Post, (p) => p.comments, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  post?: Post;

  @Index()
  @Column({ default: true })
  isVisible: boolean;
}
