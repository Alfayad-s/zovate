import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProjectsModule } from "./projects/projects.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { CacheModule } from "./cache/cache.module";
import { ChatModule } from "./chat/chat.module";
import { MessagesModule } from "./messages/messages.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { TasksModule } from "./tasks/tasks.module";
import { WorkspacesModule } from "./workspaces/workspaces.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env", "../../.env"],
    }),
    CacheModule,
    PrismaModule,
    RealtimeModule,
    ChatModule,
    MessagesModule,
    AuthModule.register(),
    ProjectsModule,
    TasksModule,
    WorkspacesModule,
    NotificationsModule,
  ],
})
export class AppModule {}
