"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { authInputClassName, authLabelClassName } from "@/components/auth/auth-form-styles";
import { GoogleOAuthButton } from "@/components/auth/google-oauth-button";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useRegisterMutation } from "@/hooks/use-auth";
import { getAuthErrorMessage } from "@/lib/auth-errors";

const registerSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(128, "Password is too long"),
  username: z
    .string()
    .optional()
    .refine(
      (v) =>
        v === undefined ||
        v.trim().length === 0 ||
        (v.trim().length >= 2 && v.trim().length <= 64),
      "Username must be 2–64 characters or left empty",
    ),
});

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const registerMutation = useRegisterMutation();

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      username: "",
    },
  });

  async function onSubmit(values: RegisterValues) {
    const username = values.username?.trim();
    try {
      await registerMutation.mutateAsync({
        email: values.email,
        password: values.password,
        username:
          username && username.length >= 2 ? username : undefined,
      });
    } catch {
      /* surfaced via registerMutation.error */
    }
  }

  const formError = registerMutation.error
    ? getAuthErrorMessage(
        registerMutation.error,
        "Registration failed. Try a different email.",
      )
    : null;

  return (
    <div className="space-y-8">
      <GoogleOAuthButton className="h-12 rounded-xl border-neutral-200/90 bg-white text-[15px] font-medium shadow-sm hover:bg-neutral-50" />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-neutral-200/80" />
        </div>
        <div className="relative flex justify-center text-[11px] font-semibold uppercase tracking-[0.14em]">
          <span className="bg-[#fff] px-3 text-neutral-400">Or</span>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {formError ? (
          <p
            role="alert"
            className="rounded-xl border border-red-200/80 bg-red-50/90 px-4 py-3 text-sm text-red-800"
          >
            {formError}
          </p>
        ) : null}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel className={authLabelClassName}>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className={authInputClassName}
                  {...field}
                />
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel className={authLabelClassName}>Username</FormLabel>
              <FormControl>
                <Input
                  autoComplete="username"
                  placeholder="Optional"
                  className={authInputClassName}
                  {...field}
                />
              </FormControl>
              <FormDescription className="text-xs text-neutral-400">
                Optional — 2 to 64 characters.
              </FormDescription>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel className={authLabelClassName}>Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  className={authInputClassName}
                  {...field}
                />
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="h-12 w-full rounded-xl bg-primary text-[15px] font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
          disabled={
            form.formState.isSubmitting || registerMutation.isPending
          }
        >
          {form.formState.isSubmitting || registerMutation.isPending
            ? "Creating account…"
            : "Create account"}
        </Button>

        <p className="pt-1 text-center text-[15px] text-neutral-500">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </form>
    </Form>
    </div>
  );
}
