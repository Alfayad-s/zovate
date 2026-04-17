import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class AssignTaskUserDto {
  @ApiProperty({ description: "Workspace member user id" })
  @IsUUID()
  userId!: string;
}
