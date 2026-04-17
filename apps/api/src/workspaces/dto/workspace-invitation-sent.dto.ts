import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class InvitationWorkspaceSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiPropertyOptional({ nullable: true })
  logoUrl!: string | null;
}

export class InvitationUserSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional({ nullable: true })
  fullName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  avatarUrl!: string | null;
}

/** Returned when an admin invites someone — creates a pending invitation + notification. */
export class WorkspaceInvitationSentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  workspaceId!: string;

  @ApiProperty()
  invitedUserId!: string;

  @ApiProperty({ description: "ADMIN | MEMBER | VIEWER" })
  role!: string;

  @ApiProperty({ example: "PENDING" })
  status!: string;

  @ApiProperty()
  invitedById!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ type: InvitationUserSummaryDto })
  invitedUser!: InvitationUserSummaryDto;

  @ApiProperty({ type: InvitationWorkspaceSummaryDto })
  workspace!: InvitationWorkspaceSummaryDto;
}
