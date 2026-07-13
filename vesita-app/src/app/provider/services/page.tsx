"use client";

import { Clock, Droplet, Package, Pencil, Plus, Stethoscope, Trash2 } from "lucide-react";
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
import { formatDuration } from "@/lib/format";
import { formatEGP } from "@/lib/site";
import type { ProviderRole, ServicePackage } from "@/lib/types";

const TITLES: Record<ProviderRole, string> = {
  doctor: "Consultation types",
  lab: "Tests",
  radiology: "Scans",
};

const ADD_LABELS: Record<ProviderRole, string> = {
  doctor: "Add consultation type",
  lab: "Add test",
  radiology: "Add scan",
};

export default function ProviderServicesPage() {
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

  const type = provider.type;
  const hasPackages = type !== "doctor";

  const list = services.data?.services ?? [];
  const packages = services.data?.packages ?? [];

  async function onDeleteService(id: string, name: string) {
    try {
      await removeService.mutate(providerId, id);
      services.refetch();
      toast.success(`${name} deleted.`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't delete this service.",
      );
    }
  }

  async function onDeletePackage(id: string, name: string) {
    try {
      await removePackage.mutate(providerId, id);
      services.refetch();
      toast.success(`${name} deleted.`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't delete this package.",
      );
    }
  }

  function renderServices() {
    if (services.isLoading && !services.data) return <ListSkeleton count={5} />;

    if (services.error) {
      return (
        <ErrorState
          title="Couldn't load your services"
          description={services.error.message}
          onRetry={services.refetch}
        />
      );
    }

    if (list.length === 0) {
      return (
        <EmptyState
          icon={Stethoscope}
          title={`No ${TITLES[type].toLowerCase()} yet`}
          description="Patients can't book you until you offer at least one service."
          action={
            <Button
              className="h-10 rounded-xl px-4"
              onClick={() => {
                setEditingService(null);
                setServiceDialog(true);
              }}
            >
              <Plus className="size-4" />
              {ADD_LABELS[type]}
            </Button>
          }
        />
      );
    }

    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {list.map((service) => (
          <Card key={service.id}>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-semibold">{service.name}</h3>
                    <Badge
                      variant="secondary"
                      className={
                        service.isActive
                          ? "bg-success/10 text-success"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {service.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {service.kind !== "consultation" && (
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {service.nameAr} · {service.category}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${service.name}`}
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
                        aria-label={`Delete ${service.name}`}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    }
                    title={`Delete ${service.name}?`}
                    description="Patients will no longer be able to book it. Existing bookings are unaffected."
                    confirmLabel="Delete"
                    isPending={removeService.isPending}
                    onConfirm={() => onDeleteService(service.id, service.name)}
                  />
                </div>
              </div>

              <p className="line-clamp-2 text-sm text-muted-foreground">
                {service.description}
              </p>

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-semibold tabular-nums">
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
                      Results in {service.resultTimeHours}h
                    </span>
                    {service.fastingRequired && (
                      <Badge variant="outline" className="gap-1">
                        <Droplet className="size-3" />
                        Fasting
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
                      <Badge variant="outline">Contrast</Badge>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  function renderPackages() {
    if (services.isLoading && !services.data) return <ListSkeleton count={3} />;

    if (services.error) {
      return (
        <ErrorState
          title="Couldn't load your packages"
          description={services.error.message}
          onRetry={services.refetch}
        />
      );
    }

    if (packages.length === 0) {
      return (
        <EmptyState
          icon={Package}
          title="No packages yet"
          description="Bundle several services together at a discount."
          action={
            <Button
              className="h-10 rounded-xl px-4"
              onClick={() => {
                setEditingPackage(null);
                setPackageDialog(true);
              }}
            >
              <Plus className="size-4" />
              Add package
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
                      <h3 className="truncate font-semibold">{pkg.name}</h3>
                      <Badge
                        variant="secondary"
                        className={
                          pkg.isActive
                            ? "bg-success/10 text-success"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {pkg.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {included.length} service
                      {included.length === 1 ? "" : "s"} included
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit ${pkg.name}`}
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
                          aria-label={`Delete ${pkg.name}`}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      }
                      title={`Delete ${pkg.name}?`}
                      description="Patients will no longer be able to book this package."
                      confirmLabel="Delete"
                      isPending={removePackage.isPending}
                      onConfirm={() => onDeletePackage(pkg.id, pkg.name)}
                    />
                  </div>
                </div>

                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {pkg.description}
                </p>

                {included.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5">
                    {included.map((service) => (
                      <li key={service.id}>
                        <Badge variant="outline" className="font-normal">
                          {service.name}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold tabular-nums">
                    {formatEGP(pkg.price)}
                  </span>
                  {pkg.originalPrice > pkg.price && (
                    <>
                      <span className="tabular-nums text-muted-foreground line-through">
                        {formatEGP(pkg.originalPrice)}
                      </span>
                      <Badge
                        variant="secondary"
                        className="bg-success/10 text-success"
                      >
                        Save {formatEGP(pkg.originalPrice - pkg.price)}
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
            <TabsTrigger value="services">{TITLES[type]}</TabsTrigger>
            {hasPackages && <TabsTrigger value="packages">Packages</TabsTrigger>}
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
              {ADD_LABELS[type]}
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
                Add package
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
