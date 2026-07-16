import { SiteHeader } from "@/components/layout/site-header";

/** Booking chrome: header only — the wizard owns the rest of the viewport. */
export default function BookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <SiteHeader />
      <main className="flex-1">{children}</main>
    </div>
  );
}
