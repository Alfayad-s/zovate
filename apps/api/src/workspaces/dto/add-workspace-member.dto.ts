import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsIn, IsNotEmpty, IsString } from "class-validator";

/** Matches schema: OWNER | ADMIN | MEMBER | VIEWER — OWNER is not assignable via invite. */
export const WORKSPACE_MEMBER_ROLES = ["ADMIN", "MEMBER", "VIEWER"] as const;
export type WorkspaceMemberRoleInvite = (typeof WORKSPACE_MEMBER_ROLES)[number];

export class AddWorkspaceMemberDto {
  @ApiProperty({ example: "teammate@company.com" })
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @ApiProperty({
    enum: WORKSPACE_MEMBER_ROLES,
    example: "MEMBER",
    description: "Role for the new member (not OWNER).",
  })
  @IsIn([...WORKSPACE_MEMBER_ROLES])
  role!: WorkspaceMemberRoleInvite;
}
