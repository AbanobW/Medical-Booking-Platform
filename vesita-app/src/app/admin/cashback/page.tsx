"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Coins, Gift, Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { AppliesToBadges, CampaignStatusBadge } from "@/components/admin/badges";
import { CampaignDialog } from "@/components/admin/campaign-dialog";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Reveal } from "@/components/shared/motion";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/shared/states";
import { StatisticsCard } from "@/components/shared/statistics-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAsync, useMutation } from "@/hooks/use-async";
import { deleteCampaign, getCampaigns } from "@/lib/api/admin";
import { useApiError } from "@/lib/i18n/use-api-error";
import { useDomain, useFormat } from "@/lib/i18n/use-format";
import type { CashbackCampaign } from "@/lib/types";

export default function AdminCashbackPage() {
  const t = useTranslations("admin");
  const describeError = useApiError();
  const { formatDateShort, formatEGP, formatNumber } = useFormat();
  const { localized } = useDomain();

  const { data, error, isLoading, refetch } = useAsync(() => getCampaigns());

  const [editing, setEditing] = useState<CashbackCampaign | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<CashbackCampaign | null>(null);

  const { mutate: remove, isPending: isDeleting } = useMutation(deleteCampaign);

  async function confirmDelete() {
    if (!deleting) return;

    try {
      await remove(deleting.id);
      toast.success(t("cashback.deleted", { name: deleting.name }));
      setDeleting(null);
      refetch();
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  const campaigns = data ?? [];
  const activeCount = campaigns.filter((c) => c.status === "active").length;
  const totalIssued = campaigns.reduce((sum, c) => sum + c.totalIssued, 0);
  const totalRedeemed = campaigns.reduce((sum, c) => sum + c.redeemedCount, 0);

  const newButton = (
    <Button
      className="h-10 rounded-xl px-4"
      onClick={() => {
        setEditing(null);
        setDialogOpen(true);
      }}
    >
      <Plus className="size-4" />
      {t("cashback.new")}
    </Button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {t("cashback.title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("cashback.subtitle")}</p>
        </div>
        {campaigns.length > 0 && newButton}
      </div>

      {isLoading ? (
        <ListSkeleton count={4} />
      ) : error ? (
        <ErrorState
          title={t("cashback.errorTitle")}
          description={describeError(error)}
          onRetry={refetch}
        />
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={Gift}
          title={t("cashback.emptyTitle")}
          description={t("cashback.emptyDescription")}
          action={newButton}
        />
      ) : (
        <>
          <Reveal>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatisticsCard
                label={t("cashback.stats.active")}
                value={`${formatNumber(activeCount)} / ${formatNumber(campaigns.length)}`}
                icon={Gift}
                tone="primary"
                hint={t("cashback.stats.activeHint")}
              />
              <StatisticsCard
                label={t("cashback.stats.issued")}
                value={formatEGP(totalIssued)}
                icon={Coins}
                tone="warning"
                hint={t("cashback.stats.issuedHint")}
              />
              <StatisticsCard
                label={t("cashback.stats.redemptions")}
                value={formatNumber(totalRedeemed)}
                icon={Users}
                tone="success"
                hint={t("cashback.stats.redemptionsHint")}
              />
            </div>
          </Reveal>

          <div className="grid gap-5 lg:grid-cols-2">
            {campaigns.map((campaign) => (
              <Card key={campaign.id} className="transition-shadow hover:shadow-card">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-semibold">{campaign.name}</h3>
                        <CampaignStatusBadge status={campaign.status} />
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {localized(campaign.description)}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("cashback.editAria", { name: campaign.name })}
                        onClick={() => {
                          setEditing(campaign);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("cashback.deleteAria", { name: campaign.name })}
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleting(campaign)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-4 sm:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {t("cashback.card.cashback")}
                      </p>
                      <p className="ltr-nums font-semibold tabular-nums">
                        {formatNumber(campaign.percentage)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {t("cashback.card.cap")}
                      </p>
                      <p className="font-semibold tabular-nums">
                        {formatEGP(campaign.maxCashback)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {t("cashback.card.issued")}
                      </p>
                      <p className="font-semibold tabular-nums">
                        {formatEGP(campaign.totalIssued)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {t("cashback.card.redeemed")}
                      </p>
                      <p className="font-semibold tabular-nums">
                        {formatNumber(campaign.redeemedCount)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <AppliesToBadges appliesTo={campaign.appliesTo} />
                    <p className="text-xs text-muted-foreground">
                      {formatDateShort(campaign.startsAt)} –{" "}
                      {formatDateShort(campaign.endsAt)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <CampaignDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        campaign={editing}
        onSaved={refetch}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("cashback.deleteConfirm.title", {
          name: deleting?.name ?? t("cashback.deleteConfirm.fallbackName"),
        })}
        description={t("cashback.deleteConfirm.description")}
        confirmLabel={t("cashback.deleteConfirm.confirmLabel")}
        isPending={isDeleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
