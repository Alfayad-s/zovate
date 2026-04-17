import { Module } from "@nestjs/common";
import { RealtimeModule } from "../realtime/realtime.module";
import { SupabaseStorageService } from "../storage/supabase-storage.service";
import { WorkspacesController } from "./workspaces.controller";
import { WorkspacesService } from "./workspaces.service";
import { WorkspaceGuard } from "./workspace.guard";

@Module({
  imports: [RealtimeModule],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, WorkspaceGuard, SupabaseStorageService],
  exports: [WorkspacesService, WorkspaceGuard],
})
export class WorkspacesModule {}
