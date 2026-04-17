import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { HealthStatus } from "@repo/shared-types";
import { AuthGuard } from "@nestjs/passport";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { AuthTokensDto, MeResponseDto } from "./dto/auth-response.dto";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get("health")
  @ApiOperation({ summary: "Liveness check (no auth)" })
  health(): HealthStatus {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create account (bcrypt password + JWT)" })
  @ApiResponse({ status: 201, type: AuthTokensDto })
  @ApiResponse({ status: 409, description: "Email or username taken" })
  register(@Body() dto: RegisterDto): Promise<AuthTokensDto> {
    return this.auth.register(dto);
  }

  @Post("login")
  @ApiOperation({ summary: "Sign in with email & password" })
  @ApiResponse({ status: 200, type: AuthTokensDto })
  @ApiResponse({ status: 401, description: "Invalid credentials" })
  login(@Body() dto: LoginDto): Promise<AuthTokensDto> {
    return this.auth.login(dto);
  }

  @Get("me")
  @UseGuards(AuthGuard("jwt"))
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Current user from JWT" })
  @ApiResponse({ status: 200, type: MeResponseDto })
  @ApiResponse({ status: 401, description: "Missing or invalid Bearer token" })
  me(@Req() req: Request) {
    return { user: req.user };
  }

  @Patch("me")
  @UseGuards(AuthGuard("jwt"))
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Update profile (name, bio)" })
  @ApiResponse({ status: 200, type: MeResponseDto })
  async updateMe(
    @Req() req: Request,
    @Body() dto: UpdateProfileDto,
  ): Promise<MeResponseDto> {
    const user = req.user as Express.User;
    const next = await this.auth.updateProfile(user.id, dto);
    return { user: next };
  }

  @Post("me/avatar")
  @UseGuards(AuthGuard("jwt"))
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Upload avatar image (multipart field: file). Uses Supabase Storage.",
  })
  @ApiResponse({ status: 200, type: MeResponseDto })
  async uploadAvatar(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<MeResponseDto> {
    if (!file?.buffer) {
      throw new BadRequestException("Missing file field: file");
    }
    const user = req.user as Express.User;
    const next = await this.auth.setAvatarFromUpload(
      user.id,
      file.buffer,
      file.mimetype,
    );
    return { user: next };
  }
}
