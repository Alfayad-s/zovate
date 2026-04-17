import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class MarkMessageReadDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  channelId!: string;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  messageId!: string;
}
