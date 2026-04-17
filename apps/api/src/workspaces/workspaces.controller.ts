import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { AuthGuard } from "@nestjs/passport";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { Request } from "express";
import { AddWorkspaceMemberDto } from "./dto/add-workspace-member.dto";
import { CreateWorkspaceDto } from "./dto/create-workspace.dto";
import { InviteUserSuggestionDto } from "./dto/invite-user-suggestion.dto";
import { UpdateWorkspaceDto } from "./dto/update-workspace.dto";
import { WorkspaceInvitationSentDto } from "./dto/workspace-invitation-sent.dto";
import { WorkspaceMemberDto } from "./dto/workspace-member-response.dto";
import { WorkspaceDto } from "./dto/workspace-response.dto";
import { WorkspacesService } from "./workspaces.service";
import { WorkspaceGuard, WorkspaceIdParam } from "./workspace.guard";

@ApiTags("workspaces")
@Controller("workspaces")
@UseGuards(AuthGuard("jwt"))
@ApiBearerAuth("access-token")
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a workspace (you become owner)" })
  @ApiResponse({ status: 201, type: WorkspaceDto })
  @ApiResponse({ status: 409, description: "Slug conflict" })
  async create(
    @Req() req: Request,
    @Body() dto: CreateWorkspaceDto,
  ): Promise<WorkspaceDto> {
    const user = req.user as Express.User;
    return this.workspaces.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: "List workspaces you belong to" })
  @ApiResponse({ status: 200, type: [WorkspaceDto] })
  async list(@Req() req: Request): Promise<WorkspaceDto[]> {
    const user = req.user as Express.User;
    return this.workspaces.findAllForUser(user.id);
  }

  @Post("invitations/:invitationId/accept")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Accept a workspace invitation (invitee only)" })
  @ApiResponse({ status: 200, description: "{ outcome: ACCEPTED }" })
  async acceptInvitation(
    @Req() req: Request,
    @Param("invitationId", ParseUUIDPipe) invitationId: string,
  ): Promise<{ outcome: "ACCEPTED" | "REJECTED" }> {
    const user = req.user as Express.User;
    return this.workspaces.respondToInvitation(user.id, invitationId, true);
  }

  @Post("invitations/:invitationId/reject")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reject a workspace invitation (invitee only)" })
  @ApiResponse({ status: 200, description: "{ outcome: REJECTED }" })
  async rejectInvitation(
    @Req() req: Request,
    @Param("invitationId", ParseUUIDPipe) invitationId: string,
  ): Promise<{ outcome: "ACCEPTED" | "REJECTED" }> {
    const user = req.user as Express.User;
    return this.workspaces.respondToInvitation(user.id, invitationId, false);
  }

  @Get(":workspaceId/members/invite-suggestions")
  @UseGuards(WorkspaceGuard)
  @ApiOperation({
    summary:
      "Search users by email or name to invite (owner or admin). Query: q (min 2 chars).",
  })
  @ApiResponse({ status: 200, type: [InviteUserSuggestionDto] })
  async inviteUserSuggestions(
    @Req() req: Request,
    @Param("workspaceId", ParseUUIDPipe) workspaceId: string,
    @Query("q") q: string | undefined,
  ): Promise<InviteUserSuggestionDto[]> {
    const user = req.user as Express.User;
    return this.workspaces.searchUsersForInvite(user.id, workspaceId, q ?? "");
  }

  @Get(":workspaceId/members")
  @UseGuards(WorkspaceGuard)
  @ApiOperation({ summary: "List members of a workspace" })
  @ApiResponse({ status: 200, type: [WorkspaceMemberDto] })
  @ApiResponse({ status: 404 })
  async listMembers(
    @Req() req: Request,
    @Param("workspaceId", ParseUUIDPipe) workspaceId: string,
  ): Promise<WorkspaceMemberDto[]> {
    const user = req.user as Express.User;
    return this.workspaces.listMembers(user.id, workspaceId);
  }

  @Post(":workspaceId/members")
  @UseGuards(WorkspaceGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      "Invite a user by email (owner or admin). Sends a notification; they join when they accept.",
  })
  @ApiResponse({ status: 201, type: WorkspaceInvitationSentDto })
  @ApiResponse({ status: 403 })
  @ApiResponse({ status: 404 })
  @ApiResponse({ status: 409 })
  async addMember(
    @Req() req: Request,
    @Param("workspaceId", ParseUUIDPipe) workspaceId: string,
    @Body() dto: AddWorkspaceMemberDto,
  ): Promise<WorkspaceInvitationSentDto> {
    const user = req.user as Express.User;
    return this.workspaces.addMember(user.id, workspaceId, dto);
  }

  @Delete(":workspaceId/members/:userId")
  @UseGuards(WorkspaceGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      "Remove a member or leave the workspace (cannot remove the owner)",
  })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 403 })
  @ApiResponse({ status: 404 })
  async removeMember(
    @Req() req: Request,
    @Param("workspaceId", ParseUUIDPipe) workspaceId: string,
    @Param("userId", ParseUUIDPipe) userId: string,
  ): Promise<void> {
    const user = req.user as Express.User;
    await this.workspaces.removeMember(user.id, workspaceId, userId);
  }

  @Get(":id")
  @WorkspaceIdParam("id")
  @UseGuards(WorkspaceGuard)
  @ApiOperation({ summary: "Get a workspace by id" })
  @ApiResponse({ status: 200, type: WorkspaceDto })
  @ApiResponse({ status: 404 })
  async getOne(
    @Req() req: Request,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<WorkspaceDto> {
    const user = req.user as Express.User;
    return this.workspaces.findOne(user.id, id);
  }

  @Patch(":id")
  @WorkspaceIdParam("id")
  @UseGuards(WorkspaceGuard)
  @ApiOperation({
    summary: "Update workspace (owner or admin)",
  })
  @ApiResponse({ status: 200, type: WorkspaceDto })
  @ApiResponse({ status: 403 })
  @ApiResponse({ status: 404 })
  @ApiResponse({ status: 409 })
  async update(
    @Req() req: Request,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkspaceDto,
  ): Promise<WorkspaceDto> {
    const user = req.user as Express.User;
    return this.workspaces.update(user.id, id, dto);
  }

  @Post(":id/logo")
  @WorkspaceIdParam("id")
  @UseGuards(WorkspaceGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  @ApiOperation({
    summary: "Upload workspace logo (multipart field: file). Uses Supabase Storage.",
  })
  @ApiResponse({ status: 200, type: WorkspaceDto })
  @ApiResponse({ status: 403 })
  async uploadLogo(
    @Req() req: Request,
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<WorkspaceDto> {
    if (!file?.buffer) {
      throw new BadRequestException("Missing file field: file");
    }
    const user = req.user as Express.User;
    return this.workspaces.setLogoFromUpload(
      user.id,
      id,
      file.buffer,
      file.mimetype,
    );
  }

  @Delete(":id")
  @WorkspaceIdParam("id")
  @UseGuards(WorkspaceGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Soft-delete workspace (owner only)" })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 403 })
  @ApiResponse({ status: 404 })
  async remove(
    @Req() req: Request,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    const user = req.user as Express.User;
    await this.workspaces.remove(user.id, id);
  }
}
