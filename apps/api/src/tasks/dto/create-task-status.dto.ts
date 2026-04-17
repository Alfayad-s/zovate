import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateTaskStatusDto {
  @ApiProperty({ example: "Review" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional({ example: "#6366f1" })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  color?: string;

  @ApiPropertyOptional({
    description: "Column order (decimal string). Omitted = append after last column.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  position?: string;
}
