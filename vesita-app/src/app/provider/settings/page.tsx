"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, MapPin, Star } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { ProviderStatusBadge } from "@/components/provider/badges";
import { useCurrentProvider } from "@/components/provider/use-current-provider";
import { RatingStars } from "@/components/shared/rating";
import { EmptyState, ErrorState, ProfileSkeleton } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "@/hooks/use-async";
import { updateProviderProfile } from "@/lib/api/provider-admin";
import { getAreaName, getGovernorateName } from "@/lib/data/egypt";
import { formatDate } from "@/lib/format";
import { formatEGP } from "@/lib/site";

const profileSchema = z.object({
  name: z.string().min(3, "Your name is too short."),
  bio: z.string().min(20, "Write at least a couple of sentences."),
  phone: z
    .string()
    .regex(/^01[0-2,5]\d{8}$/, "Use an Egyptian mobile number, e.g. 01012345678."),
  address: z.string().min(5, "Add a street address."),
  price: z.number().min(0, "Price can't be negative."),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProviderSettingsPage() {
  const { providerId, provider, isLoading, error, refetch, setData } =
    useCurrentProvider();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: "", bio: "", phone: "", address: "", price: 0 },
  });

  const save = useMutation(updateProviderProfile);

  useEffect(() => {
    if (!provider) return;

    form.reset({
      name: provider.name,
      bio: provider.bio,
      phone: provider.phone,
      address: provider.address,
      price: provider.price,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  if (isLoading && !provider) return <ProfileSkeleton />;

  if (error) {
    return (
      <ErrorState
        title="Couldn't load your profile"
        description={error.message}
        onRetry={refetch}
      />
    );
  }

  if (!provider) {
    return (
      <EmptyState
        title="No provider profile"
        description="This account isn't linked to a provider listing yet."
      />
    );
  }

  async function onSubmit(values: ProfileFormValues) {
    try {
      const updated = await save.mutate(providerId, values);
      setData(updated);
      toast.success("Profile updated.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't save your profile.",
      );
    }
  }

  const priceLabel =
    provider.type === "doctor" ? "Consultation fee (EGP)" : "Starting price (EGP)";

  return (
    <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>
            This is what patients see on your listing and profile page.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} className="h-10 rounded-xl" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bio</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={5} className="rounded-xl" />
                    </FormControl>
                    <FormDescription>
                      Experience, sub-specialties, and what patients can expect.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          inputMode="tel"
                          placeholder="01012345678"
                          className="h-10 rounded-xl"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{priceLabel}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step={10}
                          value={String(field.value)}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                          onBlur={field.onBlur}
                          name={field.name}
                          className="h-10 rounded-xl"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input {...field} className="h-10 rounded-xl" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={save.isPending}
                className="h-10 rounded-xl px-4"
              >
                {save.isPending ? "Saving…" : "Save changes"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>Managed by the Vesita team.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <ProviderStatusBadge status={provider.status} />
          </div>

          <Separator />

          <div className="flex items-start justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-4" />
              Location
            </span>
            <span className="text-right text-sm font-medium">
              {getAreaName(provider.areaId)},{" "}
              {getGovernorateName(provider.governorateId)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarDays className="size-4" />
              Joined
            </span>
            <span className="text-sm font-medium">
              {formatDate(provider.joinedAt)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Star className="size-4" />
              Rating
            </span>
            <span className="flex items-center gap-2">
              <RatingStars value={provider.rating} size="sm" />
              <span className="text-sm font-medium tabular-nums">
                {provider.rating.toFixed(1)} ({provider.reviewCount})
              </span>
            </span>
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Listed price</span>
            <span className="text-sm font-medium tabular-nums">
              {formatEGP(provider.price)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
