"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, MapPin, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";
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
import { DASH } from "@/lib/i18n/format";
import { useApiError } from "@/lib/i18n/use-api-error";
import { useDomain, useFormat } from "@/lib/i18n/use-format";

function profileSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(3, t("settings.validation.name")),
    // The bio is what a patient reads on the listing, so it is stored in both
    // languages and both halves are required.
    bio: z.string().min(20, t("settings.validation.bio")),
    bioAr: z.string().min(20, t("settings.validation.bioArabic")),
    phone: z
      .string()
      .regex(/^01[0-2,5]\d{8}$/, t("settings.validation.phone")),
    address: z.string().min(5, t("settings.validation.address")),
    // The API has no price column to read back, so the field starts empty
    // rather than at a fabricated zero.
    price: z.number().min(0, t("settings.validation.priceNegative")).nullable(),
  });
}

type ProfileFormValues = z.infer<ReturnType<typeof profileSchema>>;

export default function ProviderSettingsPage() {
  const t = useTranslations("provider");
  const tCommon = useTranslations("common");
  const describeError = useApiError();
  const { formatDate, formatEGP, formatNumber } = useFormat();
  const { getAreaName, getGovernorateName } = useDomain();

  const { providerId, provider, isLoading, error, refetch, setData } =
    useCurrentProvider();

  const schema = useMemo(
    () => profileSchema((key) => t(key as never)),
    [t],
  );

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      bio: "",
      bioAr: "",
      phone: "",
      address: "",
      price: null,
    },
  });

  const save = useMutation(updateProviderProfile);

  useEffect(() => {
    if (!provider) return;

    form.reset({
      name: provider.name,
      bio: provider.bio?.en ?? "",
      bioAr: provider.bio?.ar ?? "",
      phone: provider.phone ?? "",
      address: provider.address ?? "",
      price: provider.price,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  if (isLoading && !provider) return <ProfileSkeleton />;

  if (error) {
    return (
      <ErrorState
        title={t("shared.profileError")}
        description={describeError(error)}
        onRetry={refetch}
      />
    );
  }

  if (!provider) {
    return (
      <EmptyState
        title={t("shared.noProfileTitle")}
        description={t("shared.noProfileDescription")}
      />
    );
  }

  async function onSubmit(values: ProfileFormValues) {
    try {
      const updated = await save.mutate(providerId, {
        name: values.name,
        bio: { en: values.bio.trim(), ar: values.bioAr.trim() },
        phone: values.phone,
        address: values.address,
        price: values.price,
      });
      setData(updated);
      toast.success(t("settings.updated"));
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  const priceLabel =
    provider.type === "doctor"
      ? t("settings.consultationFee")
      : t("settings.startingPrice");

  return (
    <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.profileTitle")}</CardTitle>
          <CardDescription>{t("settings.profileDescription")}</CardDescription>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("settings.name")}</FormLabel>
                    <FormControl>
                      <Input {...field} className="h-10 rounded-xl" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("settings.bioEnglish")}</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          dir="ltr"
                          rows={5}
                          className="rounded-xl text-start"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bioAr"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("settings.bioArabic")}</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          dir="rtl"
                          rows={5}
                          className="rounded-xl text-start"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t("settings.bioHint")}
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("settings.phone")}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          inputMode="tel"
                          dir="ltr"
                          placeholder={t("settings.phonePlaceholder")}
                          className="h-10 rounded-xl text-start"
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
                          value={field.value === null ? "" : String(field.value)}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === "" ? null : Number(e.target.value),
                            )
                          }
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
                    <FormLabel>{t("settings.address")}</FormLabel>
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
                {save.isPending
                  ? tCommon("states.saving")
                  : tCommon("actions.saveChanges")}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">{t("settings.accountTitle")}</CardTitle>
          <CardDescription>{t("settings.accountDescription")}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {t("settings.status")}
            </span>
            <ProviderStatusBadge status={provider.status} />
          </div>

          <Separator />

          <div className="flex items-start justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-4" />
              {t("settings.location")}
            </span>
            <span className="text-end text-sm font-medium">
              {provider.areaId && provider.governorateId
                ? t("settings.locationValue", {
                    area: getAreaName(provider.areaId),
                    governorate: getGovernorateName(provider.governorateId),
                  })
                : DASH}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarDays className="size-4" />
              {t("settings.joined")}
            </span>
            <span className="text-sm font-medium">
              {formatDate(provider.joinedAt)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Star className="size-4" />
              {t("settings.rating")}
            </span>
            <span className="flex items-center gap-2">
              {provider.rating === null ? (
                <span className="text-sm font-medium">{DASH}</span>
              ) : (
                <>
                  <RatingStars value={provider.rating} size="sm" />
                  <span className="ltr-nums text-sm font-medium tabular-nums">
                    {t("settings.ratingValue", {
                      rating: provider.rating.toFixed(1),
                      count: formatNumber(provider.reviewCount),
                    })}
                  </span>
                </>
              )}
            </span>
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">
              {t("settings.listedPrice")}
            </span>
            <span className="ltr-nums text-sm font-medium tabular-nums">
              {formatEGP(provider.price)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
