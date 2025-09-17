export class VisionDto {
  title: string;
  content: string;
  imageUrl: string;
}

export class MissionDto {
  title: string;
  content: string;
  imageUrl: string;
}

export class CollaboratorDto {
  id: string;
  name: string;
  role: string;
  photoUrl: string;
}

export class CommentItemDto {
  id: string;
  author: string;
  text: string;
  visible: boolean;
}

export class InformationalPageDto {
  vision: VisionDto;
  mission: MissionDto;
  collaborators: CollaboratorDto[];
  comments: CommentItemDto[];
}
