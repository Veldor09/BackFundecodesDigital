// src/web/entities/post.entity.ts
import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../BaseEntity';
import { Comment } from '../Comment/Comment';

@Entity('posts')
export class Post extends BaseEntity {
  @Column({ length: 180 })
  title: string;

  @Column({ length: 220, nullable: true })
  excerpt?: string;

  @Column({ type: 'longtext' })
  body: string;

  @Column({ length: 120, nullable: true })
  slug?: string;

  @Column({ default: false })
  published: boolean;

  @OneToMany(() => Comment, (c) => c.post)
  comments: Comment[];
}
