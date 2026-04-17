import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class TaskLabelBodyDto {
  @ApiProperty()
  @IsUUID()
  labelId!: string;
}
