import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

const VISIBILITY = ["workspace", "private", "public"] as const;

export class CreateProjectDto {
  @ApiProperty({ example: "Website redesign", minLength: 1, maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ maxLength: 10_000 })
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  description?: string;

  @ApiPropertyOptional({
    enum: VISIBILITY,
    default: "workspace",
  })
  @IsOptional()
  @IsString()
  @IsIn([...VISIBILITY])
  visibility?: (typeof VISIBILITY)[number];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}
