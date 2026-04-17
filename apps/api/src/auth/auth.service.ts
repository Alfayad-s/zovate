import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import type { Profile } from "passport-google-oauth20";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUserDto, AuthTokensDto } from "./dto/auth-response.dto";
import type { LoginDto } from "./dto/login.dto";
import type { RegisterDto } from "./dto/register.dto";
import type { UpdateProfileDto } from "./dto/update-profile.dto";
import { assertPresetAvatarUrl } from "./assert-preset-avatar-url";
import { SupabaseStorageService } from "../storage/supabase-storage.service";
import type { JwtPayload } from "./jwt.strategy";

const SALT_ROUNDS = 12;

const OAUTH_ACCOUNT_TYPE = "oauth";
const GOOGLE_PROVIDER = "google";
const GOOGLE_OAUTH_SCOPE = "email profile";

const publicUserSelect = {
  id: true,
  email: true,
  username: true,
  fullName: true,
  bio: true,
  avatarUrl: true,
  isVerified: true,
} as const;

type PublicUserFields = {
  id: string;
  email: string;
  username: string | null;
  fullName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly storage: SupabaseStorageService,
    private readonly config: ConfigService,
  ) {}

  private toPublicUser(user: PublicUserFields): AuthUserDto {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      isVerified: user.isVerified,
    };
  }

  issueTokensForUser(user: PublicUserFields): AuthTokensDto {
    return {
      access_token: this.signToken(user.id, user.email),
      user: this.toPublicUser(user),
    };
  }

  private signToken(userId: string, email: string): string {
    const payload: JwtPayload = { sub: userId, email };
    return this.jwt.sign(payload);
  }

  async register(dto: RegisterDto): Promise<AuthTokensDto> {
    const email = dto.email.toLowerCase().trim();
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          username: dto.username?.trim() ?? undefined,
        },
        select: publicUserSelect,
      });

      return {
        access_token: this.signToken(user.id, user.email),
        user: this.toPublicUser(user),
      };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new ConflictException("Email or username already in use");
      }
      throw e;
    }
  }

  async login(dto: LoginDto): Promise<AuthTokensDto> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        ...publicUserSelect,
        passwordHash: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt || !user.passwordHash) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException("Invalid email or password");
    }

    return {
      access_token: this.signToken(user.id, user.email),
      user: this.toPublicUser({
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        isVerified: user.isVerified,
      }),
    };
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<AuthUserDto> {
    const hasField =
      dto.fullName !== undefined ||
      dto.bio !== undefined ||
      dto.avatarUrl !== undefined;
    if (!hasField) {
      const u = await this.prisma.user.findUnique({
        where: { id: userId },
        select: publicUserSelect,
      });
      if (!u) {
        throw new UnauthorizedException();
      }
      return this.toPublicUser(u);
    }

    const data: Prisma.UserUpdateInput = {};
    if (dto.fullName !== undefined) {
      const v = dto.fullName.trim();
      data.fullName = v.length === 0 ? null : v;
    }
    if (dto.bio !== undefined) {
      const v = dto.bio.trim();
      data.bio = v.length === 0 ? null : v;
    }
    if (dto.avatarUrl !== undefined) {
      const v = dto.avatarUrl.trim();
      if (v.length === 0) {
        data.avatarUrl = null;
      } else {
        const frontend = this.config.get<string>("FRONTEND_URL");
        data.avatarUrl = assertPresetAvatarUrl(v, frontend);
      }
    }
    if (Object.keys(data).length === 0) {
      const u = await this.prisma.user.findUnique({
        where: { id: userId },
        select: publicUserSelect,
      });
      if (!u) {
        throw new UnauthorizedException();
      }
      return this.toPublicUser(u);
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: publicUserSelect,
    });
    return this.toPublicUser(user);
  }

  async setAvatarFromUpload(
    userId: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<AuthUserDto> {
    const url = await this.storage.uploadAvatarObject(userId, buffer, mimeType);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: url },
      select: publicUserSelect,
    });
    return this.toPublicUser(user);
  }

  /**
   * Links Google to {@link Account} (provider + providerAccountId) and the local {@link User}.
   */
  async upsertGoogleUser(params: {
    profile: Profile;
    accessToken: string;
    refreshToken: string | null;
  }): Promise<PublicUserFields> {
    const { profile, accessToken, refreshToken } = params;
    const providerAccountId = profile.id;
    const email = profile.emails?.[0]?.value?.toLowerCase().trim();
    if (!email) {
      throw new UnauthorizedException("Google did not return an email");
    }

    const fullName = profile.displayName?.trim() || null;
    const avatarUrl = profile.photos?.[0]?.value ?? null;

    const tokenPayload = {
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      scope: GOOGLE_OAUTH_SCOPE,
    };

    const existingAccount = await this.prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: GOOGLE_PROVIDER,
          providerAccountId,
        },
      },
      include: {
        user: true,
      },
    });

    if (existingAccount) {
      if (existingAccount.user.deletedAt) {
        throw new UnauthorizedException("Account is disabled");
      }

      const [user] = await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: existingAccount.userId },
          data: {
            fullName: fullName ?? existingAccount.user.fullName,
            avatarUrl: avatarUrl ?? existingAccount.user.avatarUrl,
            isVerified: true,
          },
          select: publicUserSelect,
        }),
        this.prisma.account.update({
          where: { id: existingAccount.id },
          data: tokenPayload,
        }),
      ]);

      return user;
    }

    const existingEmail = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingEmail) {
      if (existingEmail.deletedAt) {
        throw new UnauthorizedException("Account is disabled");
      }

      try {
        await this.prisma.account.create({
          data: {
            userId: existingEmail.id,
            type: OAUTH_ACCOUNT_TYPE,
            provider: GOOGLE_PROVIDER,
            providerAccountId,
            ...tokenPayload,
          },
        });

        return this.prisma.user.update({
          where: { id: existingEmail.id },
          data: {
            fullName: fullName ?? existingEmail.fullName,
            avatarUrl: avatarUrl ?? existingEmail.avatarUrl,
            isVerified: true,
          },
          select: publicUserSelect,
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          throw new ConflictException(
            "This Google account is already linked elsewhere",
          );
        }
        throw e;
      }
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            fullName,
            avatarUrl,
            isVerified: true,
          },
          select: publicUserSelect,
        });

        await tx.account.create({
          data: {
            userId: user.id,
            type: OAUTH_ACCOUNT_TYPE,
            provider: GOOGLE_PROVIDER,
            providerAccountId,
            ...tokenPayload,
          },
        });

        return user;
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new ConflictException("Could not create or link Google account");
      }
      throw e;
    }
  }
}
