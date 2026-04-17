import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class WorkspaceMemberUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional({ nullable: true })
  fullName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  avatarUrl!: string | null;
}

export class WorkspaceMemberDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  workspaceId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ description: "OWNER | ADMIN | MEMBER | VIEWER" })
  role!: string;

  @ApiProperty()
  joinedAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  invitedById!: string | null;

  @ApiProperty({ type: WorkspaceMemberUserDto })
  user!: WorkspaceMemberUserDto;
}
