"use client";

import { useMemo, useState } from "react";
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
import { formatDateShort, initialsOf, timeAgo } from "@/lib/format";
import { ROLE_LABELS, type Role, type User, type UserStatus } from "@/lib/types";

const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as Role[]).map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
}));

const STATUS_OPTIONS: { value: UserStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "suspended", label: "Suspended" },
];

/**
 * The server API paginates, but the admin table wants client-side sorting and
 * search across the whole filtered set. We therefore pull the full slice for
 * the chosen role/status filters and let `DataTable` own paging — one
 * pagination model, never two.
 */
const FULL_PAGE = 1000;

export default function AdminUsersPage() {
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
          ? `${user.name} has been suspended.`
          : `${user.name} is active again.`,
      );
      setPendingSuspend(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the user.");
    }
  }

  const columns = useMemo<ColumnDef<User, unknown>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: "User",
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
        header: "Email",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.email}</span>
        ),
      },
      {
        id: "phone",
        accessorKey: "phone",
        header: "Phone",
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums text-muted-foreground">
            {row.original.phone}
          </span>
        ),
      },
      {
        id: "role",
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => <RoleBadge role={row.original.role} />,
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <UserStatusBadge status={row.original.status} />,
      },
      {
        id: "joined",
        accessorKey: "createdAt",
        header: "Joined",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatDateShort(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "lastActive",
        accessorKey: "lastActiveAt",
        header: "Last active",
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
              Activate
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
              Suspend
            </Button>
          );
        },
      },
    ],
    // `changeStatus` is stable enough for the cell closure; `isPending` gates it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isPending],
  );

  const filters = (
    <>
      <AppSelect
        value={role}
        onValueChange={setRole}
        options={ROLE_OPTIONS}
        emptyOption="All roles"
        aria-label="Filter by role"
        className="h-10 w-40"
      />
      <AppSelect
        value={status}
        onValueChange={setStatus}
        options={STATUS_OPTIONS}
        emptyOption="All statuses"
        aria-label="Filter by status"
        className="h-10 w-40"
      />
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Users</h2>
          <p className="text-sm text-muted-foreground">
            {data
              ? `${data.total} account${data.total === 1 ? "" : "s"} matching the current filters`
              : "Patients, providers and administrators"}
          </p>
        </div>
        {isPending && (
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Saving…
          </span>
        )}
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} columns={6} />
      ) : error ? (
        <ErrorState
          title="Couldn't load users"
          description={error.message}
          onRetry={refetch}
        />
      ) : (
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          searchPlaceholder="Search name, email or phone…"
          toolbar={filters}
          pageSize={10}
          emptyTitle="No users found"
          emptyDescription="Try a different search term, role or status."
        />
      )}

      <ConfirmDialog
        open={pendingSuspend !== null}
        onOpenChange={(open) => !open && setPendingSuspend(null)}
        title={`Suspend ${pendingSuspend?.name ?? "this user"}?`}
        description="They will be signed out and blocked from booking. If this account owns a provider profile, that listing is pulled from search too. You can reactivate them at any time."
        confirmLabel="Suspend account"
        isPending={isPending}
        onConfirm={() => {
          if (pendingSuspend) void changeStatus(pendingSuspend, "suspended");
        }}
      />
    </div>
  );
}
