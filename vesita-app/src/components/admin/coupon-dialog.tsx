"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
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
import { addDays, TODAY } from "@/lib/data/seed";
import { PROVIDER_ROLES, type Coupon, type ProviderRole } from "@/lib/types";
import { PROVIDER_TYPE_META } from "@/components/admin/badges";

const schema = z
  .object({
    code: z
      .string()
      .min(3, "Use at least 3 characters.")
      .max(24, "Keep it under 24 characters.")
      .regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, dashes and underscores only."),
    description: z.string().min(5, "Describe what this coupon is for."),
    discountType: z.enum(["percentage", "fixed"]),
    discountValue: z
      .number({ message: "Enter a number." })
      .positive("Must be greater than zero."),
    minOrderValue: z
      .number({ message: "Enter a number." })
      .min(0, "Cannot be negative."),
    maxDiscount: z
      .number({ message: "Enter a number." })
      .min(0, "Cannot be negative.")
      .optional(),
    usageLimit: z
      .number({ message: "Enter a number." })
      .int("Whole numbers only.")
      .min(1, "Allow at least one redemption."),
    expiresAt: z.string().min(1, "Pick an expiry date."),
    isActive: z.boolean(),
    appliesTo: z.array(z.enum(["doctor", "lab", "radiology"])),
  })
  .refine(
    (values) => values.discountType !== "percentage" || values.discountValue <= 100,
    { message: "A percentage discount cannot exceed 100.", path: ["discountValue"] },
  );

type CouponFormValues = z.infer<typeof schema>;

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
    expiresAt: addDays(TODAY, 30).toISOString().slice(0, 10),
    isActive: true,
    appliesTo: [],
  };
}

function valuesOf(coupon: Coupon): CouponFormValues {
  return {
    code: coupon.code,
    description: coupon.description,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    minOrderValue: coupon.minOrderValue,
    maxDiscount: coupon.maxDiscount,
    usageLimit: coupon.usageLimit,
    expiresAt: toDateInput(coupon.expiresAt),
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
        toast.success(`Coupon ${input.code} updated.`);
      } else {
        await create(input);
        toast.success(`Coupon ${input.code} created.`);
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the coupon.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{coupon ? "Edit coupon" : "New coupon"}</DialogTitle>
          <DialogDescription>
            Discount codes patients can apply at checkout.
          </DialogDescription>
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
                    <FormLabel>Code</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="SUMMER25"
                        className="h-11 rounded-xl uppercase"
                        autoComplete="off"
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
                    <FormLabel>Expires on</FormLabel>
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
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={2}
                      placeholder="25% off your first lab test this summer."
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
                    <FormLabel>Discount type</FormLabel>
                    <FormControl>
                      <AppSelect
                        value={field.value}
                        onValueChange={(value) =>
                          field.onChange(value as "percentage" | "fixed")
                        }
                        options={[
                          { value: "percentage", label: "Percentage (%)" },
                          { value: "fixed", label: "Fixed amount (EGP)" },
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
                        ? "Discount (%)"
                        : "Discount (EGP)"}
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
                    <FormLabel>Min. order (EGP)</FormLabel>
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
                    <FormLabel>Max. discount (EGP)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step={10}
                        placeholder="No cap"
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
                    <FormDescription>Percentage coupons only.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="usageLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usage limit</FormLabel>
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
                  <FormLabel>Applies to</FormLabel>
                  <div className="flex flex-wrap gap-4 rounded-xl border p-4">
                    {PROVIDER_ROLES.map((role) => {
                      const checked = field.value.includes(role);
                      const { icon: Icon, label } = PROVIDER_TYPE_META[role];

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
                          {label}
                        </label>
                      );
                    })}
                  </div>
                  <FormDescription>
                    Leave every box unchecked to apply the coupon to all services.
                  </FormDescription>
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
                    <FormLabel>Active</FormLabel>
                    <FormDescription>
                      Inactive coupons are rejected at checkout.
                    </FormDescription>
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
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-10 rounded-xl px-4"
                disabled={isPending}
              >
                {isPending && <Loader2 className="size-4 animate-spin" />}
                {coupon ? "Save changes" : "Create coupon"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
