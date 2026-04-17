import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

export class UpdateTaskDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  statusId?: string;

  @ApiPropertyOptional({ enum: ["low", "medium", "high", "urgent"] })
  @IsOptional()
  @IsString()
  @IsIn(["low", "medium", "high", "urgent"])
  priority?: string;

  @ApiPropertyOptional({ description: "ISO 8601 date-time; omit field to leave unchanged" })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({
    description: "ISO 8601 end date-time for ranged calendar tasks; omit field to leave unchanged",
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: "Sort order within the status column (decimal string)",
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  position?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}
