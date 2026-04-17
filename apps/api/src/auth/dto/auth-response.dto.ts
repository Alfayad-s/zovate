import { ApiProperty } from "@nestjs/swagger";

export class AuthUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true })
  username!: string | null;

  @ApiProperty({ nullable: true })
  fullName!: string | null;

  @ApiProperty({ nullable: true, description: "Profile image URL" })
  avatarUrl!: string | null;

  @ApiProperty({ nullable: true, description: "Short biography" })
  bio!: string | null;

  @ApiProperty()
  isVerified!: boolean;
}

export class AuthTokensDto {
  @ApiProperty({ description: "JWT access token (Bearer)" })
  access_token!: string;

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}

export class MeResponseDto {
  @ApiProperty({ type: AuthUserDto, description: "Authenticated user (from JWT)" })
  user!: AuthUserDto;
}
