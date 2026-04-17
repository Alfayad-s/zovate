import { BadRequestException, Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";

import { ChatOgPreviewService, type OgPreview } from "./chat-og-preview.service";

@ApiTags("chat")
@Controller("chat")
@UseGuards(AuthGuard("jwt"))
@ApiBearerAuth("access-token")
export class ChatOgPreviewController {
  constructor(private readonly og: ChatOgPreviewService) {}

  @Get("og-preview")
  @ApiOperation({ summary: "Fetch OG metadata for a URL (cached)" })
  @ApiQuery({ name: "url", required: true })
  @ApiResponse({ status: 200 })
  async preview(@Query("url") url: string | undefined): Promise<OgPreview | null> {
    const raw = url?.trim();
    if (!raw) throw new BadRequestException("url is required.");
    return this.og.preview(raw);
  }
}

