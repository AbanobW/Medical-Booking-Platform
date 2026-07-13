"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
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
import { formatEGP } from "@/lib/site";
import type { ServicePackage } from "@/lib/types";

const packageSchema = z.object({
  name: z.string().min(2, "Give this package a name."),
  description: z.string().min(5, "Add a short description."),
  includes: z.array(z.string()).min(1, "Pick at least one service."),
  price: z.number().min(0, "Price can't be negative."),
  isActive: z.boolean(),
});

type PackageFormValues = z.infer<typeof packageSchema>;

const EMPTY: PackageFormValues = {
  name: "",
  description: "",
  includes: [],
  price: 0,
  isActive: true,
};

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
  const form = useForm<PackageFormValues>({
    resolver: zodResolver(packageSchema),
    defaultValues: pkg
      ? {
          name: pkg.name,
          description: pkg.description,
          includes: pkg.includes,
          price: pkg.price,
          isActive: pkg.isActive,
        }
      : EMPTY,
  });

  const create = useMutation(createPackage);
  const update = useMutation(updatePackage);
  const isPending = create.isPending || update.isPending;

  useEffect(() => {
    if (!open) return;

    form.reset(
      pkg
        ? {
            name: pkg.name,
            description: pkg.description,
            includes: pkg.includes,
            price: pkg.price,
            isActive: pkg.isActive,
          }
        : EMPTY,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pkg]);

  const includes = form.watch("includes");
  const price = form.watch("price");

  // The bundle is only worth buying if it undercuts the sum of its parts.
  const originalPrice = services
    .filter((s) => includes.includes(s.id))
    .reduce((sum, s) => sum + s.price, 0);
  const savings = Math.max(0, originalPrice - (price || 0));

  async function onSubmit(values: PackageFormValues) {
    const payload = {
      name: values.name,
      description: values.description,
      includes: values.includes,
      price: values.price,
      originalPrice,
      isActive: values.isActive,
    };

    try {
      if (pkg) {
        await update.mutate(providerId, pkg.id, payload);
        toast.success(`${values.name} updated.`);
      } else {
        await create.mutate(providerId, payload);
        toast.success(`${values.name} added.`);
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't save this package.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next: boolean) => onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{pkg ? "Edit package" : "Add package"}</DialogTitle>
          <DialogDescription>
            Bundle several services together at a discounted price.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="package-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Full body check-up"
                      className="h-10 rounded-xl"
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
                      rows={3}
                      placeholder="What's covered, and who it's for."
                      className="rounded-xl"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="includes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Included services</FormLabel>
                  <FormDescription>
                    Select everything this package covers.
                  </FormDescription>

                  <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border p-2">
                    {services.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground">
                        Add a service first — there&apos;s nothing to bundle yet.
                      </p>
                    ) : (
                      services.map((service) => {
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
                              {service.name}
                            </Label>
                            <span className="text-sm tabular-nums text-muted-foreground">
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
                  <FormLabel>Package price (EGP)</FormLabel>
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
                Sum of the included services
              </span>
              <span className="flex items-center gap-2">
                <span className="tabular-nums text-muted-foreground line-through">
                  {formatEGP(originalPrice)}
                </span>
                <span className="font-semibold tabular-nums text-success">
                  saves {formatEGP(savings)}
                </span>
              </span>
            </div>

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-xl border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Active</FormLabel>
                    <FormDescription>
                      Inactive packages are hidden from patients.
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
            Cancel
          </Button>
          <Button
            type="submit"
            form="package-form"
            disabled={isPending}
            className="h-10 rounded-xl px-4"
          >
            {isPending ? "Saving…" : pkg ? "Save changes" : "Add package"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
