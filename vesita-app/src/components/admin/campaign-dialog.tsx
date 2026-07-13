"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
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
import { PROVIDER_ROLES, type CashbackCampaign, type ProviderRole } from "@/lib/types";

const schema = z
  .object({
    name: z.string().min(3, "Give the campaign a name."),
    description: z.string().min(5, "Describe what patients get."),
    percentage: z
      .number({ message: "Enter a number." })
      .positive("Must be greater than zero.")
      .max(100, "Cashback cannot exceed 100%."),
    maxCashback: z
      .number({ message: "Enter a number." })
      .positive("Set a cap greater than zero."),
    startsAt: z.string().min(1, "Pick a start date."),
    endsAt: z.string().min(1, "Pick an end date."),
    appliesTo: z.array(z.enum(["doctor", "lab", "radiology"])),
  })
  .refine((values) => values.endsAt >= values.startsAt, {
    message: "The end date must fall after the start date.",
    path: ["endsAt"],
  });

type CampaignFormValues = z.infer<typeof schema>;

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
        toast.success(`${input.name} updated.`);
      } else {
        await create(input);
        toast.success(`${input.name} launched.`);
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save the campaign.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {campaign ? "Edit campaign" : "New cashback campaign"}
          </DialogTitle>
          <DialogDescription>
            Wallet credit returned to patients after a completed booking.
          </DialogDescription>
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
                  <FormLabel>Campaign name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Ramadan lab cashback"
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
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={2}
                      placeholder="Get 10% back as wallet credit on every lab test."
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
                    <FormLabel>Cashback (%)</FormLabel>
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
                    <FormLabel>Max. cashback (EGP)</FormLabel>
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
                    <FormDescription>Per booking.</FormDescription>
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
                    <FormLabel>Starts</FormLabel>
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
                    <FormLabel>Ends</FormLabel>
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
                  <FormLabel>Applies to</FormLabel>
                  <div className="flex flex-wrap gap-4 rounded-xl border p-4">
                    {PROVIDER_ROLES.map((role) => {
                      const { icon: Icon, label } = PROVIDER_TYPE_META[role];

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
                          {label}
                        </label>
                      );
                    })}
                  </div>
                  <FormDescription>
                    Leave every box unchecked to apply the campaign to all services.
                  </FormDescription>
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
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-10 rounded-xl px-4"
                disabled={isPending}
              >
                {isPending && <Loader2 className="size-4 animate-spin" />}
                {campaign ? "Save changes" : "Launch campaign"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
