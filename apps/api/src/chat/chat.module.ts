import { Module } from "@nestjs/common";

import { MessagesModule } from "../messages/messages.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { SupabaseStorageService } from "../storage/supabase-storage.service";
import { ChatAttachmentsController } from "./chat-attachments.controller";
import { ChatChannelsController } from "./chat-channels.controller";
import { ChatChannelsService } from "./chat-channels.service";
import { ChatOgPreviewController } from "./chat-og-preview.controller";
import { ChatGateway } from "./chat.gateway";
import { ChatMessagesService } from "./chat-messages.service";
import { ChatOgPreviewService } from "./chat-og-preview.service";
import { ChatPresenceService } from "./chat-presence.service";

@Module({
  imports: [RealtimeModule, MessagesModule],
  controllers: [
    ChatChannelsController,
    ChatAttachmentsController,
    ChatOgPreviewController,
  ],
  providers: [
    ChatGateway,
    ChatMessagesService,
    ChatPresenceService,
    ChatChannelsService,
    ChatOgPreviewService,
    SupabaseStorageService,
  ],
})
export class ChatModule {}
