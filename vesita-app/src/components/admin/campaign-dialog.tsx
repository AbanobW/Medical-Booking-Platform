"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { PROVIDER_TYPE_META } from "@/components/admin/badges";
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
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "@/hooks/use-async";
import {
  createCampaign,
  updateCampaign,
  type CampaignInput,
} from "@/lib/api/admin";
import { addDays, TODAY } from "@/lib/data/seed";
import { useApiError } from "@/lib/i18n/use-api-error";
import { useLabels } from "@/lib/i18n/use-labels";
import { PROVIDER_ROLES, type CashbackCampaign, type ProviderRole } from "@/lib/types";

type Translate = (key: string) => string;

/** Validation copy comes from the catalogue, so a rejected field speaks the user's language. */
const campaignSchema = (t: Translate) =>
  z
    .object({
      name: z.string().min(3, t("validation.name")),
      description: z.string().min(5, t("validation.description")),
      percentage: z
        .number({ message: t("validation.number") })
        .positive(t("validation.positive"))
        .max(100, t("validation.max100")),
      maxCashback: z
        .number({ message: t("validation.number") })
        .positive(t("validation.capPositive")),
      startsAt: z.string().min(1, t("validation.start")),
      endsAt: z.string().min(1, t("validation.end")),
      appliesTo: z.array(z.enum(["doctor", "lab", "radiology"])),
    })
    .refine((values) => values.endsAt >= values.startsAt, {
      message: t("validation.endAfterStart"),
      path: ["endsAt"],
    });

type CampaignFormValues = z.infer<ReturnType<typeof campaignSchema>>;

const toDateInput = (iso: string) => iso.slice(0, 10);
const fromStart = (value: string) =>
  new Date(`${value}T00:00:00.000Z`).toISOString();
const fromEnd = (value: string) =>
  new Date(`${value}T23:59:59.000Z`).toISOString();

function emptyValues(): CampaignFormValues {
  return {
    name: "",
    description: "",
    percentage: 10,
    maxCashback: 100,
    startsAt: TODAY.toISOString().slice(0, 10),
    endsAt: addDays(TODAY, 30).toISOString().slice(0, 10),
    appliesTo: [],
  };
}

function valuesOf(campaign: CashbackCampaign): CampaignFormValues {
  return {
    name: campaign.name,
    description: campaign.description,
    percentage: campaign.percentage,
    maxCashback: campaign.maxCashback,
    startsAt: toDateInput(campaign.startsAt),
    endsAt: toDateInput(campaign.endsAt),
    appliesTo: campaign.appliesTo,
  };
}

const readNumber = (value: string) => (value === "" ? Number.NaN : Number(value));

export function CampaignDialog({
  open,
  onOpenChange,
  campaign,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` = create mode. */
  campaign: CashbackCampaign | null;
  onSaved: () => void;
}) {
  const t = useTranslations("admin.campaignDialog");
  const tCommon = useTranslations("common");
  const L = useLabels();
  const describeError = useApiError();

  const schema = useMemo(() => campaignSchema(t), [t]);

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues(),
  });

  useEffect(() => {
    if (open) form.reset(campaign ? valuesOf(campaign) : emptyValues());
  }, [open, campaign, form]);

  const { mutate: create, isPending: isCreating } = useMutation(createCampaign);
  const { mutate: update, isPending: isUpdating } = useMutation(updateCampaign);
  const isPending = isCreating || isUpdating;

  async function onSubmit(values: CampaignFormValues) {
    const input: CampaignInput = {
      name: values.name,
      description: values.description,
      percentage: values.percentage,
      maxCashback: values.maxCashback,
      startsAt: fromStart(values.startsAt),
      endsAt: fromEnd(values.endsAt),
      appliesTo: values.appliesTo,
    };

    try {
      if (campaign) {
        await update(campaign.id, input);
        toast.success(t("toastUpdated", { name: input.name }));
      } else {
        await create(input);
        toast.success(t("toastCreated", { name: input.name }));
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
          <DialogTitle>{campaign ? t("titleEdit") : t("titleNew")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-5"
            noValidate
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("fields.name")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t("placeholders.name")}
                      className="h-11 rounded-xl"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                name="percentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fields.percentage")}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={100}
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

              <FormField
                control={form.control}
                name="maxCashback"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fields.maxCashback")}</FormLabel>
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
                    <FormDescription>{t("maxCashbackHint")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="startsAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fields.startsAt")}</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" className="h-11 rounded-xl" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endsAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fields.endsAt")}</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" className="h-11 rounded-xl" />
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
                      const { icon: Icon } = PROVIDER_TYPE_META[role];

                      return (
                        <label
                          key={role}
                          className="flex cursor-pointer items-center gap-2 text-sm font-medium"
                        >
                          <Checkbox
                            checked={field.value.includes(role)}
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
                {campaign ? tCommon("actions.saveChanges") : t("submitNew")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
