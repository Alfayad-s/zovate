import { ApiProperty } from "@nestjs/swagger";

export class ProjectDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ format: "uuid" })
  workspaceId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty()
  visibility!: string;

  @ApiProperty({ format: "uuid" })
  createdById!: string;

  @ApiProperty()
  isArchived!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
