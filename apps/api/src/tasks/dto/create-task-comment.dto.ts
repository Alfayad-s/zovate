import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateTaskCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content!: string;

  @ApiPropertyOptional({ description: "Optional parent comment id for threads" })
  @IsOptional()
  @IsUUID()
  parentCommentId?: string | null;
}

