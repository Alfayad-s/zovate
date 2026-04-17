import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateLabelDto {
  @ApiProperty({ example: "bug" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  name!: string;

  @ApiPropertyOptional({ example: "#ef4444" })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  color?: string;
}
