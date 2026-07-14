"use client";

import { Clock, Droplet, Package, Pencil, Plus, Stethoscope, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/provider/confirm-dialog";
import { PackageDialog } from "@/components/provider/package-dialog";
import {
  ServiceDialog,
  type EditableService,
} from "@/components/provider/service-dialog";
import { useCurrentProvider } from "@/components/provider/use-current-provider";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAsync, useMutation } from "@/hooks/use-async";
import {
  deletePackage,
  deleteService,
  getServices,
} from "@/lib/api/provider-admin";
import { useApiError } from "@/lib/i18n/use-api-error";
import { useDomain, useFormat } from "@/lib/i18n/use-format";
import type { ProviderRole, ServicePackage } from "@/lib/types";

const TITLE_KEYS = {
  doctor: "services.titleDoctor",
  lab: "services.titleLab",
  radiology: "services.titleRadiology",
} as const;

const ADD_KEYS = {
  doctor: "services.addDoctor",
  lab: "services.addLab",
  radiology: "services.addRadiology",
} as const;

const EMPTY_KEYS = {
  doctor: "services.emptyDoctor",
  lab: "services.emptyLab",
  radiology: "services.emptyRadiology",
} as const;

export default function ProviderServicesPage() {
  const t = useTranslations("provider");
  const tCommon = useTranslations("common");
  const describeError = useApiError();
  const { formatDuration, formatEGP, formatNumber } = useFormat();
  const { named, localized, locale } = useDomain();

  const { providerId, provider, isLoading, error, refetch } = useCurrentProvider();

  const services = useAsync(() => getServices(providerId), [providerId]);

  const removeService = useMutation(deleteService);
  const removePackage = useMutation(deletePackage);

  const [serviceDialog, setServiceDialog] = useState(false);
  const [editingService, setEditingService] = useState<EditableService | null>(null);
  const [packageDialog, setPackageDialog] = useState(false);
  const [editingPackage, setEditingPackage] = useState<ServicePackage | null>(null);

  if (isLoading && !provider) {
    return <ListSkeleton count={5} />;
  }
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

  const type: ProviderRole = provider.type;
  const hasPackages = type !== "doctor";

  const list = services.data?.services ?? [];
  const packages = services.data?.packages ?? [];

  async function onDeleteService(id: string, name: string) {
    try {
      await removeService.mutate(providerId, id);
      services.refetch();
      toast.success(t("services.deleted", { name }));
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  async function onDeletePackage(id: string, name: string) {
    try {
      await removePackage.mutate(providerId, id);
      services.refetch();
      toast.success(t("services.deleted", { name }));
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  function renderServices() {
    if (services.isLoading && !services.data) return <ListSkeleton count={5} />;

    if (services.error) {
      return (
        <ErrorState
          title={t("services.servicesError")}
          description={describeError(services.error)}
          onRetry={services.refetch}
        />
      );
    }

    if (list.length === 0) {
      return (
        <EmptyState
          icon={Stethoscope}
          title={t(EMPTY_KEYS[type])}
          description={t("services.emptyDescription")}
          action={
            <Button
              className="h-10 rounded-xl px-4"
              onClick={() => {
                setEditingService(null);
                setServiceDialog(true);
              }}
            >
              <Plus className="size-4" />
              {t(ADD_KEYS[type])}
            </Button>
          }
        />
      );
    }

    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {list.map((service) => {
          const name = named(service);

          return (
            <Card key={service.id}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold">{name}</h3>
                      <Badge
                        variant="secondary"
                        className={
                          service.isActive
                            ? "bg-success/10 text-success"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {service.isActive
                          ? t("shared.active")
                          : t("shared.inactive")}
                      </Badge>
                    </div>
                    {service.kind !== "consultation" && (
                      // The name in the *other* language, so a provider editing
                      // a bilingual catalogue can see both at a glance.
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {locale === "ar" ? service.name : service.nameAr} ·{" "}
                        {service.category}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("services.editAria", { name })}
                      onClick={() => {
                        setEditingService(service);
                        setServiceDialog(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>

                    <ConfirmDialog
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("services.deleteAria", { name })}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      }
                      title={t("services.deleteTitle", { name })}
                      description={t("services.deleteServiceDescription")}
                      confirmLabel={tCommon("actions.delete")}
                      isPending={removeService.isPending}
                      onConfirm={() => onDeleteService(service.id, name)}
                    />
                  </div>
                </div>

                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {localized(service.description)}
                </p>

                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="ltr-nums font-semibold tabular-nums">
                    {formatEGP(service.price)}
                  </span>

                  {service.kind === "consultation" && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Clock className="size-3.5" />
                      {formatDuration(service.durationMinutes)}
                    </span>
                  )}

                  {service.kind === "test" && (
                    <>
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Clock className="size-3.5" />
                        {t("services.resultsIn", {
                          hours: formatNumber(service.resultTimeHours),
                        })}
                      </span>
                      {service.fastingRequired && (
                        <Badge variant="outline" className="gap-1">
                          <Droplet className="size-3" />
                          {t("services.fasting")}
                        </Badge>
                      )}
                    </>
                  )}

                  {service.kind === "scan" && (
                    <>
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Clock className="size-3.5" />
                        {formatDuration(service.durationMinutes)}
                      </span>
                      {service.contrastRequired && (
                        <Badge variant="outline">{t("services.contrast")}</Badge>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  function renderPackages() {
    if (services.isLoading && !services.data) return <ListSkeleton count={3} />;

    if (services.error) {
      return (
        <ErrorState
          title={t("services.packagesError")}
          description={describeError(services.error)}
          onRetry={services.refetch}
        />
      );
    }

    if (packages.length === 0) {
      return (
        <EmptyState
          icon={Package}
          title={t("services.noPackagesTitle")}
          description={t("services.noPackagesDescription")}
          action={
            <Button
              className="h-10 rounded-xl px-4"
              onClick={() => {
                setEditingPackage(null);
                setPackageDialog(true);
              }}
            >
              <Plus className="size-4" />
              {t("services.addPackage")}
            </Button>
          }
        />
      );
    }

    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {packages.map((pkg) => {
          const included = list.filter((s) => pkg.includes.includes(s.id));

          return (
            <Card key={pkg.id}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold">{named(pkg)}</h3>
                      <Badge
                        variant="secondary"
                        className={
                          pkg.isActive
                            ? "bg-success/10 text-success"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {pkg.isActive ? t("shared.active") : t("shared.inactive")}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {t("services.includedCount", { count: included.length })}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("services.editAria", { name: named(pkg) })}
                      onClick={() => {
                        setEditingPackage(pkg);
                        setPackageDialog(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>

                    <ConfirmDialog
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("services.deleteAria", { name: named(pkg) })}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      }
                      title={t("services.deleteTitle", { name: named(pkg) })}
                      description={t("services.deletePackageDescription")}
                      confirmLabel={tCommon("actions.delete")}
                      isPending={removePackage.isPending}
                      onConfirm={() => onDeletePackage(pkg.id, named(pkg))}
                    />
                  </div>
                </div>

                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {localized(pkg.description)}
                </p>

                {included.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5">
                    {included.map((service) => (
                      <li key={service.id}>
                        <Badge variant="outline" className="font-normal">
                          {named(service)}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex items-center gap-2 text-sm">
                  <span className="ltr-nums font-semibold tabular-nums">
                    {formatEGP(pkg.price)}
                  </span>
                  {pkg.originalPrice > pkg.price && (
                    <>
                      <span className="ltr-nums tabular-nums text-muted-foreground line-through">
                        {formatEGP(pkg.originalPrice)}
                      </span>
                      <Badge
                        variant="secondary"
                        className="bg-success/10 text-success"
                      >
                        {t("services.saveAmount", {
                          amount: formatEGP(pkg.originalPrice - pkg.price),
                        })}
                      </Badge>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="services" className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="services">{t(TITLE_KEYS[type])}</TabsTrigger>
            {hasPackages && (
              <TabsTrigger value="packages">{t("services.packages")}</TabsTrigger>
            )}
          </TabsList>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              className="h-10 rounded-xl px-4"
              onClick={() => {
                setEditingService(null);
                setServiceDialog(true);
              }}
            >
              <Plus className="size-4" />
              {t(ADD_KEYS[type])}
            </Button>

            {hasPackages && (
              <Button
                variant="outline"
                className="h-10 rounded-xl px-4"
                onClick={() => {
                  setEditingPackage(null);
                  setPackageDialog(true);
                }}
              >
                <Package className="size-4" />
                {t("services.addPackage")}
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="services">{renderServices()}</TabsContent>
        {hasPackages && (
          <TabsContent value="packages">{renderPackages()}</TabsContent>
        )}
      </Tabs>

      <ServiceDialog
        providerId={providerId}
        providerType={type}
        service={editingService}
        open={serviceDialog}
        onOpenChange={setServiceDialog}
        onSaved={() => {
          services.refetch();
          refetch();
        }}
      />

      {hasPackages && (
        <PackageDialog
          providerId={providerId}
          services={list}
          pkg={editingPackage}
          open={packageDialog}
          onOpenChange={setPackageDialog}
          onSaved={() => {
            services.refetch();
            refetch();
          }}
        />
      )}
    </div>
  );
}
