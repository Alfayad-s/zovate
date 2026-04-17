import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

export class CreateTaskDto {
  @ApiProperty({ example: "Ship onboarding v2" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title!: string;

  @ApiProperty({ description: "Project this task belongs to" })
  @IsUUID()
  projectId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  description?: string;

  @ApiPropertyOptional({ description: "Kanban column; default: first column by position" })
  @IsOptional()
  @IsUUID()
  statusId?: string;

  @ApiPropertyOptional({ enum: ["low", "medium", "high", "urgent"], default: "medium" })
  @IsOptional()
  @IsString()
  @IsIn(["low", "medium", "high", "urgent"])
  priority?: string;

  @ApiPropertyOptional({ description: "ISO 8601 date-time" })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: "ISO 8601 end date-time for ranged calendar tasks" })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: "Sort order within the status column (decimal string, e.g. 0, 1000)",
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  position?: string;

  @ApiPropertyOptional({
    description: "Workspace members to assign when the task is created (deduplicated server-side).",
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID("4", { each: true })
  assigneeUserIds?: string[];
}
