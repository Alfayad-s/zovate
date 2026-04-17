import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class NotificationWorkspaceSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  logoUrl!: string | null;
}

export class NotificationActorDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional({ nullable: true })
  fullName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  avatarUrl!: string | null;
}

export class NotificationDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  workspaceId!: string;

  @ApiProperty({ example: "WORKSPACE_INVITE" })
  type!: string;

  @ApiProperty()
  entityType!: string;

  @ApiProperty()
  entityId!: string;

  @ApiPropertyOptional({ nullable: true })
  triggeredById!: string | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  data!: Record<string, unknown> | null;

  @ApiProperty()
  isRead!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ type: NotificationWorkspaceSummaryDto })
  workspace!: NotificationWorkspaceSummaryDto;

  @ApiPropertyOptional({ type: NotificationActorDto, nullable: true })
  triggeredBy!: NotificationActorDto | null;
}
