import { Module } from "@nestjs/common";
import { RealtimeModule } from "../realtime/realtime.module";
import { WorkspacesModule } from "../workspaces/workspaces.module";
import { LabelsController } from "./labels.controller";
import { TaskStatusesController } from "./task-statuses.controller";
import { TaskCommentsController } from "./task-comments.controller";
import { TasksController } from "./tasks.controller";
import { TaskCommentsService } from "./task-comments.service";
import { TasksService } from "./tasks.service";

@Module({
  imports: [WorkspacesModule, RealtimeModule],
  controllers: [
    TasksController,
    TaskStatusesController,
    LabelsController,
    TaskCommentsController,
  ],
  providers: [TasksService, TaskCommentsService],
  exports: [TasksService],
})
export class TasksModule {}
