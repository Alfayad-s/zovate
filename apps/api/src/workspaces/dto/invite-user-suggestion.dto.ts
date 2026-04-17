import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class InviteUserSuggestionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional({ nullable: true })
  fullName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  avatarUrl!: string | null;
}
