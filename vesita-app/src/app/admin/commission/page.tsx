"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calculator, Loader2, Percent } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { PROVIDER_TYPE_META } from "@/components/admin/badges";
import { ErrorState } from "@/components/shared/states";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { useAsync, useMutation } from "@/hooks/use-async";
import { getCommission, updateCommission } from "@/lib/api/admin";
import { formatDate } from "@/lib/format";
import { formatEGP } from "@/lib/site";
import { PROVIDER_ROLES, type CommissionSettings, type ProviderRole } from "@/lib/types";

/** The consultation price the worked example is calculated against. */
const SAMPLE = 500;

const pct = z
  .number({ message: "Enter a number." })
  .min(0, "Cannot be negative.")
  .max(100, "Cannot exceed 100%.");

const schema = z.object({
  doctor: pct,
  lab: pct,
  radiology: pct,
  platformFee: z
    .number({ message: "Enter a number." })
    .min(0, "Cannot be negative.")
    .max(1000, "That is unrealistically high."),
  vatPercentage: pct,
});

type CommissionFormValues = z.infer<typeof schema>;

const readNumber = (value: string) => (value === "" ? Number.NaN : Number(value));

/** The platform's take on one booking, given the current settings. */
function breakdown(total: number, rate: number, platformFee: number, vat: number) {
  const commission = (total * rate) / 100;
  const vatAmount = ((commission + platformFee) * vat) / 100;

  return {
    commission,
    platformFee,
    vatAmount,
    // VAT is collected for the tax authority, so it isn't platform earnings.
    platformEarns: commission + platformFee,
    providerReceives: total - commission,
    patientPays: total + platformFee + vatAmount,
  };
}

export default function AdminCommissionPage() {
  const { data, error, isLoading, refetch } = useAsync(() => getCommission());

  const form = useForm<CommissionFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      doctor: 10,
      lab: 10,
      radiology: 10,
      platformFee: 0,
      vatPercentage: 14,
    },
  });

  const { reset } = form;

  useEffect(() => {
    if (!data) return;
    reset({
      doctor: data.doctor,
      lab: data.lab,
      radiology: data.radiology,
      platformFee: data.platformFee,
      vatPercentage: data.vatPercentage,
    });
  }, [data, reset]);

  const { mutate, isPending } = useMutation(updateCommission);

  async function onSubmit(values: CommissionFormValues) {
    try {
      await mutate(values);
      toast.success("Commission settings saved.");
      refetch();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save the settings.",
      );
    }
  }

  // The worked example recomputes on every keystroke / slider drag.
  const live = form.watch();
  const safe = (value: number) => (Number.isFinite(value) ? value : 0);

  if (isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Skeleton className="h-[520px] rounded-2xl" />
        <Skeleton className="h-[380px] rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Couldn't load commission settings"
        description={error.message}
        onRetry={refetch}
      />
    );
  }

  if (!data) {
    return (
      <ErrorState
        title="No commission settings"
        description="The platform has no commission configuration to edit."
        onRetry={refetch}
      />
    );
  }

  const doctorExample = breakdown(
    SAMPLE,
    safe(live.doctor),
    safe(live.platformFee),
    safe(live.vatPercentage),
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-start">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Commission rates</CardTitle>
              <CardDescription>
                The share Vesita takes from each completed booking, by provider
                type. Last updated {formatDate(data.updatedAt)}.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-8">
              {PROVIDER_ROLES.map((role: ProviderRole) => {
                const { icon: Icon, label } = PROVIDER_TYPE_META[role];

                return (
                  <FormField
                    key={role}
                    control={form.control}
                    name={role as keyof CommissionSettings & ProviderRole}
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between gap-4">
                          <FormLabel className="flex items-center gap-2">
                            <Icon
                              className="size-4 text-muted-foreground"
                              aria-hidden
                            />
                            {label} commission
                          </FormLabel>

                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              step={0.5}
                              value={Number.isNaN(field.value) ? "" : field.value}
                              onChange={(e) =>
                                field.onChange(readNumber(e.target.value))
                              }
                              onBlur={field.onBlur}
                              name={field.name}
                              aria-label={`${label} commission percentage`}
                              className="h-10 w-24 rounded-xl text-right tabular-nums"
                            />
                            <span className="text-sm text-muted-foreground">%</span>
                          </div>
                        </div>

                        <FormControl>
                          <Slider
                            value={Number.isNaN(field.value) ? 0 : field.value}
                            min={0}
                            max={40}
                            step={0.5}
                            onValueChange={(value: number | readonly number[]) =>
                              field.onChange(
                                typeof value === "number" ? value : value[0],
                              )
                            }
                            className="py-2"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                );
              })}

              <div className="grid gap-5 border-t pt-6 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="platformFee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Platform fee (EGP)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={Number.isNaN(field.value) ? "" : field.value}
                          onChange={(e) => field.onChange(readNumber(e.target.value))}
                          onBlur={field.onBlur}
                          name={field.name}
                          className="h-11 rounded-xl tabular-nums"
                        />
                      </FormControl>
                      <FormDescription>
                        A flat fee added to every booking.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="vatPercentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>VAT (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={Number.isNaN(field.value) ? "" : field.value}
                          onChange={(e) => field.onChange(readNumber(e.target.value))}
                          onBlur={field.onBlur}
                          name={field.name}
                          className="h-11 rounded-xl tabular-nums"
                        />
                      </FormControl>
                      <FormDescription>
                        Charged on the commission and the platform fee.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-6">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-xl px-4"
                  disabled={isPending || !form.formState.isDirty}
                  onClick={() =>
                    reset({
                      doctor: data.doctor,
                      lab: data.lab,
                      radiology: data.radiology,
                      platformFee: data.platformFee,
                      vatPercentage: data.vatPercentage,
                    })
                  }
                >
                  Reset
                </Button>
                <Button
                  type="submit"
                  className="h-10 rounded-xl px-4"
                  disabled={isPending}
                >
                  {isPending && <Loader2 className="size-4 animate-spin" />}
                  Save settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>

      <div className="space-y-6 lg:sticky lg:top-24">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="size-4 text-primary" aria-hidden />
              Worked example
            </CardTitle>
            <CardDescription>
              On an {formatEGP(SAMPLE)} consultation, the platform earns{" "}
              <span className="font-semibold text-foreground">
                {formatEGP(Math.round(doctorExample.platformEarns))}
              </span>{" "}
              and the doctor receives{" "}
              <span className="font-semibold text-foreground">
                {formatEGP(Math.round(doctorExample.providerReceives))}
              </span>
              .
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-2 text-sm">
            <Row label="Consultation price" value={formatEGP(SAMPLE)} />
            <Row
              label={`Commission (${safe(live.doctor)}%)`}
              value={`− ${formatEGP(Math.round(doctorExample.commission))}`}
            />
            <Row
              label="Platform fee"
              value={`+ ${formatEGP(Math.round(doctorExample.platformFee))}`}
            />
            <Row
              label={`VAT (${safe(live.vatPercentage)}%)`}
              value={`+ ${formatEGP(Math.round(doctorExample.vatAmount))}`}
            />

            <div className="mt-3 space-y-2 border-t pt-3">
              <Row
                label="Patient pays"
                value={formatEGP(Math.round(doctorExample.patientPays))}
                strong
              />
              <Row
                label="Doctor receives"
                value={formatEGP(Math.round(doctorExample.providerReceives))}
                strong
              />
              <Row
                label="Platform earns"
                value={formatEGP(Math.round(doctorExample.platformEarns))}
                strong
              />
            </div>

            <p className="pt-2 text-xs text-muted-foreground">
              VAT is collected on the platform&apos;s fee and commission, and
              remitted to the tax authority — it is not platform earnings.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Percent className="size-4 text-muted-foreground" aria-hidden />
              Across provider types
            </CardTitle>
            <CardDescription>
              What the platform takes from an {formatEGP(SAMPLE)} booking of each
              type.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 text-sm">
            {PROVIDER_ROLES.map((role) => {
              const rate = safe(live[role]);
              const result = breakdown(
                SAMPLE,
                rate,
                safe(live.platformFee),
                safe(live.vatPercentage),
              );
              const { label } = PROVIDER_TYPE_META[role];

              return (
                <div
                  key={role}
                  className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {rate}% commission
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">
                      {formatEGP(Math.round(result.platformEarns))}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      provider keeps{" "}
                      {formatEGP(Math.round(result.providerReceives))}
                    </p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={strong ? "font-medium" : "text-muted-foreground"}>
        {label}
      </span>
      <span
        className={
          strong ? "font-semibold tabular-nums" : "tabular-nums text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}
