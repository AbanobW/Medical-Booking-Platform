"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "@/hooks/use-async";
import { createCoupon, updateCoupon, type CouponInput } from "@/lib/api/admin";
import { addDays, now } from "@/lib/time";
import { useApiError } from "@/lib/i18n/use-api-error";
import { useLabels } from "@/lib/i18n/use-labels";
import { PROVIDER_ROLES, type Coupon, type ProviderRole } from "@/lib/types";
import { PROVIDER_TYPE_META } from "@/components/admin/badges";

/** Only the message lookup is needed here — keeps the factory free of `next-intl` generics. */
type Translate = (key: string) => string;

/**
 * The schema is built from the translator, so a rejected field speaks the
 * user's language rather than English.
 */
const couponSchema = (t: Translate) =>
  z
    .object({
      code: z
        .string()
        .min(3, t("validation.codeMin"))
        .max(24, t("validation.codeMax"))
        .regex(/^[A-Za-z0-9_-]+$/, t("validation.codePattern")),
      description: z.string().min(5, t("validation.description")),
      discountType: z.enum(["percentage", "fixed"]),
      discountValue: z
        .number({ message: t("validation.number") })
        .positive(t("validation.positive")),
      minOrderValue: z
        .number({ message: t("validation.number") })
        .min(0, t("validation.notNegative")),
      maxDiscount: z
        .number({ message: t("validation.number") })
        .min(0, t("validation.notNegative"))
        .optional(),
      usageLimit: z
        .number({ message: t("validation.number") })
        .int(t("validation.whole"))
        .min(1, t("validation.minOne")),
      expiresAt: z.string().min(1, t("validation.expiry")),
      isActive: z.boolean(),
      appliesTo: z.array(z.enum(["doctor", "lab", "radiology"])),
    })
    .refine(
      (values) =>
        values.discountType !== "percentage" || values.discountValue <= 100,
      { message: t("validation.percentMax"), path: ["discountValue"] },
    );

type CouponFormValues = z.infer<ReturnType<typeof couponSchema>>;

/** `YYYY-MM-DD` for `<input type="date">`. */
const toDateInput = (iso: string) => iso.slice(0, 10);
const fromDateInput = (value: string) =>
  new Date(`${value}T23:59:59.000Z`).toISOString();

function emptyValues(): CouponFormValues {
  return {
    code: "",
    description: "",
    discountType: "percentage",
    discountValue: 10,
    minOrderValue: 0,
    maxDiscount: undefined,
    usageLimit: 100,
    expiresAt: addDays(now(), 30).toISOString().slice(0, 10),
    isActive: true,
    appliesTo: [],
  };
}

/**
 * The form edits more than `/v1/coupons` stores.
 *
 * Description, minimum-order and the usage limit have no column on the wire, so
 * an existing coupon opens with them blank rather than at a `0` the admin never
 * set — a "0 EGP minimum" they did not choose and cannot see is worse than an
 * empty field. Saving is refused anyway (`admin.updateCoupon` throws a 501)
 * until those columns exist.
 */
function valuesOf(coupon: Coupon): CouponFormValues {
  return {
    code: coupon.code,
    description: coupon.description ?? "",
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    minOrderValue: coupon.minOrderValue ?? 0,
    maxDiscount: coupon.maxDiscount,
    usageLimit: coupon.usageLimit ?? 0,
    expiresAt: coupon.expiresAt ? toDateInput(coupon.expiresAt) : "",
    isActive: coupon.isActive,
    appliesTo: coupon.appliesTo,
  };
}

/** Reads a number input, mapping "" to NaN so Zod reports it as required. */
const readNumber = (value: string) =>
  value === "" ? Number.NaN : Number(value);

export function CouponDialog({
  open,
  onOpenChange,
  coupon,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` = create mode. */
  coupon: Coupon | null;
  onSaved: () => void;
}) {
  const t = useTranslations("admin.couponDialog");
  const tCommon = useTranslations("common");
  const L = useLabels();
  const describeError = useApiError();

  const schema = useMemo(() => couponSchema(t), [t]);

  const form = useForm<CouponFormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues(),
  });

  // Re-seed the form whenever the dialog opens on a different coupon.
  useEffect(() => {
    if (open) form.reset(coupon ? valuesOf(coupon) : emptyValues());
  }, [open, coupon, form]);

  const { mutate: create, isPending: isCreating } = useMutation(createCoupon);
  const { mutate: update, isPending: isUpdating } = useMutation(updateCoupon);
  const isPending = isCreating || isUpdating;

  const discountType = form.watch("discountType");

  async function onSubmit(values: CouponFormValues) {
    const input: CouponInput = {
      code: values.code.toUpperCase(),
      description: values.description,
      discountType: values.discountType,
      discountValue: values.discountValue,
      minOrderValue: values.minOrderValue,
      maxDiscount:
        values.discountType === "percentage" ? values.maxDiscount : undefined,
      usageLimit: values.usageLimit,
      expiresAt: fromDateInput(values.expiresAt),
      isActive: values.isActive,
      appliesTo: values.appliesTo,
    };

    try {
      if (coupon) {
        await update(coupon.id, input);
        toast.success(t("toastUpdated", { code: input.code }));
      } else {
        await create(input);
        toast.success(t("toastCreated", { code: input.code }));
      }
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(describeError(error));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{coupon ? t("titleEdit") : t("titleNew")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-5"
            noValidate
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fields.code")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t("placeholders.code")}
                        className="h-11 rounded-xl uppercase"
                        autoComplete="off"
                        dir="ltr"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expiresAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fields.expiresAt")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="date"
                        className="h-11 rounded-xl"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("fields.description")}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={2}
                      placeholder={t("placeholders.description")}
                      className="rounded-xl"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="discountType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fields.discountType")}</FormLabel>
                    <FormControl>
                      <AppSelect
                        value={field.value}
                        onValueChange={(value) =>
                          field.onChange(value as "percentage" | "fixed")
                        }
                        options={[
                          {
                            value: "percentage",
                            label: t("discountTypes.percentage"),
                          },
                          { value: "fixed", label: t("discountTypes.fixed") },
                        ]}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="discountValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {discountType === "percentage"
                        ? t("fields.discountPercent")
                        : t("fields.discountFixed")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={Number.isNaN(field.value) ? "" : field.value}
                        onChange={(e) => field.onChange(readNumber(e.target.value))}
                        onBlur={field.onBlur}
                        name={field.name}
                        className="h-11 rounded-xl"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="minOrderValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fields.minOrder")}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step={10}
                        value={Number.isNaN(field.value) ? "" : field.value}
                        onChange={(e) => field.onChange(readNumber(e.target.value))}
                        onBlur={field.onBlur}
                        name={field.name}
                        className="h-11 rounded-xl"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="maxDiscount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fields.maxDiscount")}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step={10}
                        placeholder={t("placeholders.maxDiscount")}
                        disabled={discountType !== "percentage"}
                        value={
                          field.value === undefined || Number.isNaN(field.value)
                            ? ""
                            : field.value
                        }
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value),
                          )
                        }
                        onBlur={field.onBlur}
                        name={field.name}
                        className="h-11 rounded-xl"
                      />
                    </FormControl>
                    <FormDescription>{t("maxDiscountHint")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="usageLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fields.usageLimit")}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={Number.isNaN(field.value) ? "" : field.value}
                        onChange={(e) => field.onChange(readNumber(e.target.value))}
                        onBlur={field.onBlur}
                        name={field.name}
                        className="h-11 rounded-xl"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="appliesTo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("fields.appliesTo")}</FormLabel>
                  <div className="flex flex-wrap gap-4 rounded-xl border p-4">
                    {PROVIDER_ROLES.map((role) => {
                      const checked = field.value.includes(role);
                      const { icon: Icon } = PROVIDER_TYPE_META[role];

                      return (
                        <label
                          key={role}
                          className="flex cursor-pointer items-center gap-2 text-sm font-medium"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(next: boolean) => {
                              const set = new Set<ProviderRole>(field.value);
                              if (next) set.add(role);
                              else set.delete(role);
                              field.onChange(
                                PROVIDER_ROLES.filter((r) => set.has(r)),
                              );
                            }}
                          />
                          <Icon className="size-4 text-muted-foreground" aria-hidden />
                          {L.providerType(role)}
                        </label>
                      );
                    })}
                  </div>
                  <FormDescription>{t("appliesToHint")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-xl border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>{t("fields.active")}</FormLabel>
                    <FormDescription>{t("activeHint")}</FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={(next: boolean) => field.onChange(next)}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl px-4"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                {tCommon("actions.cancel")}
              </Button>
              <Button
                type="submit"
                className="h-10 rounded-xl px-4"
                disabled={isPending}
              >
                {isPending && <Loader2 className="size-4 animate-spin" />}
                {coupon ? tCommon("actions.saveChanges") : t("submitNew")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
