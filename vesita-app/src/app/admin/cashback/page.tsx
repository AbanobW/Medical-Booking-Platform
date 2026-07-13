"use client";

import { useState } from "react";
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
import { formatDateShort } from "@/lib/format";
import { formatEGP, formatNumber } from "@/lib/site";
import type { CashbackCampaign } from "@/lib/types";

export default function AdminCashbackPage() {
  const { data, error, isLoading, refetch } = useAsync(() => getCampaigns());

  const [editing, setEditing] = useState<CashbackCampaign | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<CashbackCampaign | null>(null);

  const { mutate: remove, isPending: isDeleting } = useMutation(deleteCampaign);

  async function confirmDelete() {
    if (!deleting) return;

    try {
      await remove(deleting.id);
      toast.success(`${deleting.name} deleted.`);
      setDeleting(null);
      refetch();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not delete the campaign.",
      );
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
      New campaign
    </Button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Cashback campaigns
          </h2>
          <p className="text-sm text-muted-foreground">
            Wallet credit returned to patients after a completed booking.
          </p>
        </div>
        {campaigns.length > 0 && newButton}
      </div>

      {isLoading ? (
        <ListSkeleton count={4} />
      ) : error ? (
        <ErrorState
          title="Couldn't load campaigns"
          description={error.message}
          onRetry={refetch}
        />
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={Gift}
          title="No cashback campaigns"
          description="Launch a campaign to give patients wallet credit back on their bookings."
          action={newButton}
        />
      ) : (
        <>
          <Reveal>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatisticsCard
                label="Active campaigns"
                value={`${activeCount} / ${campaigns.length}`}
                icon={Gift}
                tone="primary"
                hint="running right now"
              />
              <StatisticsCard
                label="Cashback issued"
                value={formatEGP(totalIssued)}
                icon={Coins}
                tone="warning"
                hint="across every campaign"
              />
              <StatisticsCard
                label="Redemptions"
                value={formatNumber(totalRedeemed)}
                icon={Users}
                tone="success"
                hint="patients who spent their credit"
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
                        {campaign.description}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit ${campaign.name}`}
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
                        aria-label={`Delete ${campaign.name}`}
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleting(campaign)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-4 sm:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Cashback</p>
                      <p className="font-semibold tabular-nums">
                        {campaign.percentage}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Cap / booking</p>
                      <p className="font-semibold tabular-nums">
                        {formatEGP(campaign.maxCashback)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Issued</p>
                      <p className="font-semibold tabular-nums">
                        {formatEGP(campaign.totalIssued)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Redeemed</p>
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
        title={`Delete ${deleting?.name ?? "this campaign"}?`}
        description="The campaign stops issuing cashback immediately. Credit already issued to patients stays in their wallets. This cannot be undone."
        confirmLabel="Delete campaign"
        isPending={isDeleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
