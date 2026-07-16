"use client";

import { ThemeProvider } from "next-themes";
import { DirectionProvider } from "@/components/ui/direction-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/components/providers/auth-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {/*
        Base UI reads the reading direction from context, not from `<html dir>` —
        without this every Base UI control does left-to-right maths in Arabic.
      */}
      <DirectionProvider>
        <AuthProvider>
          <TooltipProvider delay={200}>
            {children}
            <Toaster position="top-right" richColors closeButton />
          </TooltipProvider>
        </AuthProvider>
      </DirectionProvider>
    </ThemeProvider>
  );
}
