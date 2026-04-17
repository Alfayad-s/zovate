import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateWorkspaceDto {
  @ApiProperty({ example: "Acme Corp", minLength: 1, maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({
    description:
      "URL-safe slug; generated from name if omitted. Must be unique.",
    example: "acme-corp",
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  slug?: string;

  @ApiPropertyOptional({ description: "HTTPS URL for workspace logo" })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  logoUrl?: string;
}
