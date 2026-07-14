"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Ban, CircleCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { RoleBadge, UserStatusBadge } from "@/components/admin/badges";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { DataTable, type ColumnDef } from "@/components/shared/data-table";
import { ErrorState, TableSkeleton } from "@/components/shared/states";
import { AppSelect } from "@/components/ui/app-select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAsync, useMutation } from "@/hooks/use-async";
import { getUsers, setUserStatus } from "@/lib/api/admin";
import { useApiError } from "@/lib/i18n/use-api-error";
import { useFormat } from "@/lib/i18n/use-format";
import { useLabels } from "@/lib/i18n/use-labels";
import { ROLE_LABELS, type Role, type User, type UserStatus } from "@/lib/types";

/** The enum key lists — the *words* come from `useLabels()`, never from here. */
const ROLES = Object.keys(ROLE_LABELS) as Role[];
const USER_STATUSES: UserStatus[] = ["active", "pending", "suspended"];

/**
 * The server API paginates, but the admin table wants client-side sorting and
 * search across the whole filtered set. We therefore pull the full slice for
 * the chosen role/status filters and let `DataTable` own paging — one
 * pagination model, never two.
 */
const FULL_PAGE = 1000;

export default function AdminUsersPage() {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const L = useLabels();
  const describeError = useApiError();
  const { formatDateShort, initialsOf, timeAgo } = useFormat();

  const [role, setRole] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  const { data, error, isLoading, refetch } = useAsync(
    () =>
      getUsers({
        role: (role || undefined) as Role | undefined,
        status: (status || undefined) as UserStatus | undefined,
        page: 1,
        pageSize: FULL_PAGE,
      }),
    [role, status],
  );

  const { mutate, isPending } = useMutation(setUserStatus);
  const [pendingSuspend, setPendingSuspend] = useState<User | null>(null);

  async function changeStatus(user: User, next: UserStatus) {
    try {
      await mutate(user.id, next);
      toast.success(
        next === "suspended"
          ? t("users.toast.suspended", { name: user.name })
          : t("users.toast.activated", { name: user.name }),
      );
      setPendingSuspend(null);
      refetch();
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  const roleOptions = useMemo(
    () => ROLES.map((r) => ({ value: r, label: L.role(r) })),
    [L],
  );

  const statusOptions = useMemo(
    () => USER_STATUSES.map((s) => ({ value: s, label: L.userStatus(s) })),
    [L],
  );

  const columns = useMemo<ColumnDef<User, unknown>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: t("users.columns.user"),
        cell: ({ row }) => {
          const user = row.original;
          return (
            <div className="flex items-center gap-3">
              <Avatar className="size-9 shrink-0">
                <AvatarImage src={user.avatar} alt="" />
                <AvatarFallback className="text-xs">
                  {initialsOf(user.name)}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium whitespace-nowrap">{user.name}</span>
            </div>
          );
        },
      },
      {
        id: "email",
        accessorKey: "email",
        header: t("users.columns.email"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.email}</span>
        ),
      },
      {
        id: "phone",
        accessorKey: "phone",
        header: t("users.columns.phone"),
        cell: ({ row }) => (
          <span className="ltr-nums whitespace-nowrap tabular-nums text-muted-foreground">
            {row.original.phone}
          </span>
        ),
      },
      {
        id: "role",
        accessorKey: "role",
        header: t("users.columns.role"),
        cell: ({ row }) => <RoleBadge role={row.original.role} />,
      },
      {
        id: "status",
        accessorKey: "status",
        header: t("users.columns.status"),
        cell: ({ row }) => <UserStatusBadge status={row.original.status} />,
      },
      {
        id: "joined",
        accessorKey: "createdAt",
        header: t("users.columns.joined"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatDateShort(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "lastActive",
        accessorKey: "lastActiveAt",
        header: t("users.columns.lastActive"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {timeAgo(row.original.lastActiveAt)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const user = row.original;

          return user.status === "suspended" ? (
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              disabled={isPending}
              onClick={() => changeStatus(user, "active")}
            >
              <CircleCheck className="size-3.5" />
              {t("users.actions.activate")}
            </Button>
          ) : (
            <Button
              variant="destructive"
              size="sm"
              className="rounded-lg"
              disabled={isPending}
              onClick={() => setPendingSuspend(user)}
            >
              <Ban className="size-3.5" />
              {t("users.actions.suspend")}
            </Button>
          );
        },
      },
    ],
    // `changeStatus` is stable enough for the cell closure; `isPending` gates it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isPending, t, formatDateShort, initialsOf, timeAgo],
  );

  const filters = (
    <>
      <AppSelect
        value={role}
        onValueChange={setRole}
        options={roleOptions}
        emptyOption={t("users.filters.allRoles")}
        aria-label={t("users.filters.roleAria")}
        className="h-10 w-40"
      />
      <AppSelect
        value={status}
        onValueChange={setStatus}
        options={statusOptions}
        emptyOption={t("users.filters.allStatuses")}
        aria-label={t("users.filters.statusAria")}
        className="h-10 w-40"
      />
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {t("users.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {data
              ? t("users.count", { count: data.total })
              : t("users.subtitle")}
          </p>
        </div>
        {isPending && (
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {tCommon("states.saving")}
          </span>
        )}
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} columns={6} />
      ) : error ? (
        <ErrorState
          title={t("users.errorTitle")}
          description={describeError(error)}
          onRetry={refetch}
        />
      ) : (
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          searchPlaceholder={t("users.searchPlaceholder")}
          toolbar={filters}
          pageSize={10}
          emptyTitle={t("users.emptyTitle")}
          emptyDescription={t("users.emptyDescription")}
        />
      )}

      <ConfirmDialog
        open={pendingSuspend !== null}
        onOpenChange={(open) => !open && setPendingSuspend(null)}
        title={t("users.confirm.title", {
          name: pendingSuspend?.name ?? t("users.confirm.fallbackName"),
        })}
        description={t("users.confirm.description")}
        confirmLabel={t("users.confirm.confirmLabel")}
        isPending={isPending}
        onConfirm={() => {
          if (pendingSuspend) void changeStatus(pendingSuspend, "suspended");
        }}
      />
    </div>
  );
}
