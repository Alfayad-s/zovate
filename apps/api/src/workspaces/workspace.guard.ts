import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { WorkspacesService } from "./workspaces.service";

/** Metadata: route param holding the workspace UUID (default `workspaceId`). */
export const WORKSPACE_ID_PARAM_KEY = "workspaceIdParam";

export const WorkspaceIdParam = (paramName: string) =>
  SetMetadata(WORKSPACE_ID_PARAM_KEY, paramName);

/**
 * Requires JWT (use after `AuthGuard('jwt')`). Ensures `req.user` is a member
 * of the workspace given by the route param (see `WorkspaceIdParam`).
 */
@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(
    private readonly workspaces: WorkspacesService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const paramName =
      this.reflector.getAllAndOverride<string>(WORKSPACE_ID_PARAM_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? "workspaceId";

    const req = context.switchToHttp().getRequest<{
      user?: { id: string };
      params: Record<string, string>;
    }>();
    const userId = req.user?.id;
    if (!userId) {
      throw new ForbiddenException();
    }

    const raw = req.params[paramName];
    if (typeof raw !== "string" || raw.trim().length === 0) {
      throw new BadRequestException("Missing workspace id.");
    }

    await this.workspaces.assertWorkspaceMember(userId, raw);
    return true;
  }
}
