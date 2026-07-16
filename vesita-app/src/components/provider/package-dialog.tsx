"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import type { EditableService } from "@/components/provider/service-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "@/hooks/use-async";
import { createPackage, updatePackage } from "@/lib/api/provider-admin";
import { useApiError } from "@/lib/i18n/use-api-error";
import { useDomain, useFormat } from "@/lib/i18n/use-format";
import type { ServicePackage } from "@/lib/types";

function packageSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(2, t("packageDialog.validation.name")),
    nameAr: z.string().min(2, t("packageDialog.validation.nameArabic")),
    description: z.string().min(5, t("packageDialog.validation.description")),
    descriptionAr: z
      .string()
      .min(5, t("packageDialog.validation.descriptionArabic")),
    includes: z.array(z.string()).min(1, t("packageDialog.validation.includes")),
    price: z.number().min(0, t("packageDialog.validation.priceNegative")),
    isActive: z.boolean(),
  });
}

type PackageFormValues = z.infer<ReturnType<typeof packageSchema>>;

/** A service the API gave a price for — the only kind that can be bundled. */
type PricedService = EditableService & { price: number };

const EMPTY: PackageFormValues = {
  name: "",
  nameAr: "",
  description: "",
  descriptionAr: "",
  includes: [],
  price: 0,
  isActive: true,
};

/** A package is stored bilingually; the form edits both halves. */
function toFormValues(pkg: ServicePackage | null): PackageFormValues {
  if (!pkg) return EMPTY;

  return {
    name: pkg.name,
    nameAr: pkg.nameAr,
    description: pkg.description.en,
    descriptionAr: pkg.description.ar,
    includes: pkg.includes,
    price: pkg.price,
    isActive: pkg.isActive,
  };
}

export function PackageDialog({
  providerId,
  services,
  pkg,
  open,
  onOpenChange,
  onSaved,
}: {
  providerId: string;
  /** The tests / scans that can be bundled. */
  services: EditableService[];
  /** `null` = create. */
  pkg: ServicePackage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const t = useTranslations("provider");
  const tCommon = useTranslations("common");
  const describeError = useApiError();
  const { formatEGP } = useFormat();
  const { named } = useDomain();

  const schema = useMemo(
    () => packageSchema((key) => t(key as never)),
    [t],
  );

  const form = useForm<PackageFormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(pkg),
  });

  const create = useMutation(createPackage);
  const update = useMutation(updatePackage);
  const isPending = create.isPending || update.isPending;

  useEffect(() => {
    if (!open) return;

    form.reset(toFormValues(pkg));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pkg]);

  const includes = form.watch("includes");
  const price = form.watch("price");

  // A bundle's list price is the sum of its parts, so a service the API has no
  // price for cannot be bundled — it would silently count as free.
  const bundleable = useMemo(
    () => services.filter((s): s is PricedService => s.price !== null),
    [services],
  );

  // The bundle is only worth buying if it undercuts the sum of its parts.
  const originalPrice = bundleable
    .filter((s) => includes.includes(s.id))
    .reduce((sum, s) => sum + s.price, 0);
  const savings = Math.max(0, originalPrice - (price || 0));

  async function onSubmit(values: PackageFormValues) {
    const payload = {
      kind: "package" as const,
      name: values.name,
      nameAr: values.nameAr,
      description: {
        en: values.description.trim(),
        ar: values.descriptionAr.trim(),
      },
      includes: values.includes,
      price: values.price,
      originalPrice,
      isActive: values.isActive,
    };

    try {
      if (pkg) {
        await update.mutate(providerId, pkg.id, payload);
        toast.success(t("packageDialog.updated", { name: values.name }));
      } else {
        await create.mutate(providerId, payload);
        toast.success(t("packageDialog.added", { name: values.name }));
      }
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(describeError(error));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next: boolean) => onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {pkg ? t("packageDialog.editTitle") : t("packageDialog.addTitle")}
          </DialogTitle>
          <DialogDescription>{t("packageDialog.description")}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="package-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("packageDialog.nameEnglish")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        dir="ltr"
                        placeholder={t("packageDialog.namePlaceholder")}
                        className="h-10 rounded-xl text-start"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nameAr"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("packageDialog.nameArabic")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        dir="rtl"
                        placeholder={t("packageDialog.namePlaceholderAr")}
                        className="h-10 rounded-xl text-start"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("packageDialog.descriptionEnglish")}</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        dir="ltr"
                        rows={3}
                        placeholder={t("packageDialog.descriptionPlaceholder")}
                        className="rounded-xl text-start"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="descriptionAr"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("packageDialog.descriptionArabic")}</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        dir="rtl"
                        rows={3}
                        placeholder={t("packageDialog.descriptionPlaceholderAr")}
                        className="rounded-xl text-start"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="includes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("packageDialog.includes")}</FormLabel>
                  <FormDescription>
                    {t("packageDialog.includesHint")}
                  </FormDescription>

                  <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border p-2">
                    {bundleable.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground">
                        {t("packageDialog.noServices")}
                      </p>
                    ) : (
                      bundleable.map((service) => {
                        const checked = field.value.includes(service.id);

                        return (
                          <div
                            key={service.id}
                            className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50"
                          >
                            <Checkbox
                              id={`include-${service.id}`}
                              checked={checked}
                              onCheckedChange={(next: boolean) =>
                                field.onChange(
                                  next
                                    ? [...field.value, service.id]
                                    : field.value.filter(
                                        (id: string) => id !== service.id,
                                      ),
                                )
                              }
                            />
                            <Label
                              htmlFor={`include-${service.id}`}
                              className="flex-1 cursor-pointer font-normal"
                            >
                              {named(service)}
                            </Label>
                            <span className="ltr-nums text-sm tabular-nums text-muted-foreground">
                              {formatEGP(service.price)}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("packageDialog.price")}</FormLabel>
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

            <div className="flex items-center justify-between rounded-xl bg-muted/50 p-4 text-sm">
              <span className="text-muted-foreground">
                {t("packageDialog.sum")}
              </span>
              <span className="flex items-center gap-2">
                <span className="ltr-nums tabular-nums text-muted-foreground line-through">
                  {formatEGP(originalPrice)}
                </span>
                <span className="font-semibold tabular-nums text-success">
                  {t("packageDialog.saves", { amount: formatEGP(savings) })}
                </span>
              </span>
            </div>

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-xl border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>{t("packageDialog.active")}</FormLabel>
                    <FormDescription>
                      {t("packageDialog.activeHint")}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={(checked: boolean) => field.onChange(checked)}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-10 rounded-xl px-4"
          >
            {tCommon("actions.cancel")}
          </Button>
          <Button
            type="submit"
            form="package-form"
            disabled={isPending}
            className="h-10 rounded-xl px-4"
          >
            {isPending
              ? tCommon("states.saving")
              : pkg
                ? tCommon("actions.saveChanges")
                : t("packageDialog.addTitle")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
