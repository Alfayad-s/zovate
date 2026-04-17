export {};

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      username: string | null;
      fullName: string | null;
      bio: string | null;
      avatarUrl: string | null;
      isVerified: boolean;
    }
  }
}
