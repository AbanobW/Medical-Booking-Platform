"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { RoleSwitcher } from "@/components/auth/role-switcher";
import { useAuth } from "@/components/providers/auth-provider";
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
import { Skeleton } from "@/components/ui/skeleton";
import { demoUserFor, HOME_FOR_ROLE } from "@/lib/api/auth";
import type { Role } from "@/lib/types";

const schema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

type LoginValues = z.infer<typeof schema>;

function GoogleIcon() {
  // lucide dropped brand marks in v1 — this is the official four-colour G.
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.63h6.2a5.3 5.3 0 0 1-2.3 3.48v2.89h3.72c2.18-2 3.44-4.96 3.44-8.55Z"
      />
      <path
        fill="#34A853"
        d="M12 23.5c3.11 0 5.72-1.03 7.62-2.8l-3.72-2.89c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.54-2.02-6.45-4.75H1.71v2.98A11.5 11.5 0 0 0 12 23.5Z"
      />
      <path
        fill="#FBBC05"
        d="M5.55 14.16a6.9 6.9 0 0 1 0-4.41V6.77H1.71a11.5 11.5 0 0 0 0 10.37l3.84-2.98Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.86c1.69 0 3.21.58 4.4 1.72l3.3-3.3C17.71 1.4 15.1.5 12 .5A11.5 11.5 0 0 0 1.71 6.77l3.84 2.98C6.46 6.88 9 4.86 12 4.86Z"
      />
    </svg>
  );
}

function LoginView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const { login, loginAs, loginWithGoogle } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [isSocialPending, setIsSocialPending] = useState(false);

  // The demo account is resolved from the live (localStorage-backed) dataset,
  // so it can only be read after hydration without risking a mismatch.
  const [demoEmail, setDemoEmail] = useState<string | null>(null);
  useEffect(() => setDemoEmail(demoUserFor("patient").email), []);

  const form = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  function land(role: Role) {
    router.push(next && next.startsWith("/") ? next : HOME_FOR_ROLE[role]);
  }

  async function onSubmit(values: LoginValues) {
    try {
      const user = await login(values.email, values.password);
      toast.success(`Welcome back, ${user.name.split(" ")[0]}.`);
      land(user.role);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "We couldn't sign you in.";
      form.setError("email", { message });
      toast.error(message);
    }
  }

  async function onDemoLogin(role: Role) {
    try {
      const user = await loginAs(role);
      toast.success(`Signed in as ${user.name} — ${role}.`);
      land(user.role);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Demo sign-in failed.",
      );
    }
  }

  async function onGoogle() {
    setIsSocialPending(true);
    try {
      const user = await loginWithGoogle();
      toast.success(`Welcome back, ${user.name.split(" ")[0]}.`);
      land(user.role);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Google sign-in failed.");
    } finally {
      setIsSocialPending(false);
    }
  }

  const isPending = form.formState.isSubmitting || isSocialPending;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to manage your appointments, results and favourites.
        </p>
      </header>

      <RoleSwitcher onSelect={onDemoLogin} disabled={isPending} />

      <div className="flex items-center gap-4">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          or sign in with email
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="h-11 rounded-xl"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Password</FormLabel>
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="size-3.5" />
                    ) : (
                      <Eye className="size-3.5" />
                    )}
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <FormControl>
                  <Input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="h-11 rounded-xl"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={isPending}
            className="h-11 w-full rounded-xl px-4"
          >
            {form.formState.isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <LogIn className="size-4" />
            )}
            Sign in
          </Button>
        </form>
      </Form>

      <Button
        type="button"
        variant="outline"
        onClick={() => void onGoogle()}
        disabled={isPending}
        className="h-11 w-full rounded-xl px-4"
      >
        {isSocialPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <GoogleIcon />
        )}
        Continue with Google
      </Button>

      <div className="rounded-xl border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Demo credentials</p>
        <p className="mt-1">
          Any seeded email signs in — try{" "}
          <code className="rounded bg-background px-1 py-0.5 font-mono text-[0.7rem] text-foreground">
            {demoEmail ?? "any seeded account"}
          </code>
          . The password isn&apos;t checked, so use anything with 6+ characters.
        </p>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}

function LoginSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-11 w-full rounded-xl" />
      <Skeleton className="h-11 w-full rounded-xl" />
    </div>
  );
}

export default function LoginPage() {
  // `useSearchParams` must sit inside a Suspense boundary or Next 15 fails the
  // production build with a missing-suspense-with-csr-bailout error.
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginView />
    </Suspense>
  );
}
