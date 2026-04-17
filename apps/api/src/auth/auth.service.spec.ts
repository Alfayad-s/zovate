import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import * as bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";

jest.mock("bcrypt", () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue("hashed-password"),
}));

import { PrismaService } from "../prisma/prisma.service";
import { SupabaseStorageService } from "../storage/supabase-storage.service";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  let service: AuthService;
  let prisma: {
    user: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let jwt: { sign: jest.Mock };
  let storage: { uploadAvatarObject: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    jwt = { sign: jest.fn().mockReturnValue("jwt-token") };
    storage = { uploadAvatarObject: jest.fn() };
    config = {
      get: jest.fn((key: string) =>
        key === "FRONTEND_URL" ? "http://localhost:3000" : undefined,
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: SupabaseStorageService, useValue: storage },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe("register", () => {
    it("creates user and returns access token", async () => {
      const created = {
        id: "u1",
        email: "a@b.com",
        username: null as string | null,
        fullName: null as string | null,
        bio: null as string | null,
        avatarUrl: null as string | null,
        isVerified: false,
      };
      prisma.user.create.mockResolvedValue(created);

      const result = await service.register({
        email: "A@B.com",
        password: "secret123",
      });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: "a@b.com",
          }),
        }),
      );
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: "u1", email: "a@b.com" }),
      );
      expect(result.access_token).toBe("jwt-token");
      expect(result.user.email).toBe("a@b.com");
    });

    it("throws ConflictException on unique violation", async () => {
      const err = new Prisma.PrismaClientKnownRequestError("dup", {
        code: "P2002",
        clientVersion: "test",
      });
      prisma.user.create.mockRejectedValue(err);

      await expect(
        service.register({ email: "a@b.com", password: "secret123" }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("login", () => {
    it("returns tokens when password matches", async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.user.findUnique.mockResolvedValue({
        id: "u1",
        email: "a@b.com",
        username: null,
        fullName: "Test",
        bio: null,
        avatarUrl: null,
        isVerified: true,
        passwordHash: "stored-hash",
        deletedAt: null,
      });

      const result = await service.login({
        email: "a@b.com",
        password: "secret123",
      });

      expect(result.user.id).toBe("u1");
      expect(result.access_token).toBe("jwt-token");
    });

    it("throws when user missing", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: "a@b.com", password: "x" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe("updateProfile", () => {
    it("updates fullName and bio", async () => {
      prisma.user.update.mockResolvedValue({
        id: "u1",
        email: "a@b.com",
        username: null,
        fullName: "Jane",
        bio: "Hello",
        avatarUrl: null,
        isVerified: true,
      });

      const out = await service.updateProfile("u1", {
        fullName: "Jane",
        bio: "Hello",
      });

      expect(prisma.user.update).toHaveBeenCalled();
      expect(out.fullName).toBe("Jane");
      expect(out.bio).toBe("Hello");
    });
  });
});
