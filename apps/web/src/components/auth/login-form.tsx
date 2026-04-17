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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { useLoginMutation } from "@/hooks/use-auth";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const loginMutation = useLoginMutation();

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: LoginValues) {
    try {
      await loginMutation.mutateAsync(values);
    } catch {
      /* surfaced via loginMutation.error */
    }
  }

  const formError = loginMutation.error
    ? getAuthErrorMessage(
        loginMutation.error,
        "Sign in failed. Check your credentials.",
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
          name="password"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel className={authLabelClassName}>Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="current-password"
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
          disabled={form.formState.isSubmitting || loginMutation.isPending}
        >
          {form.formState.isSubmitting || loginMutation.isPending
            ? "Signing in…"
            : "Sign in"}
        </Button>

        <p className="pt-1 text-center text-[15px] text-neutral-500">
          No account?{" "}
          <Link
            href="/register"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Create one
          </Link>
        </p>
      </form>
    </Form>
    </div>
  );
}
