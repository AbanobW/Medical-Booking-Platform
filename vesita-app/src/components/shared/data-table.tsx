"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFormat } from "@/lib/i18n/use-format";
import { cn } from "@/lib/utils";

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  /** Enables the search box and filters across every column. */
  searchPlaceholder?: string;
  pageSize?: number;
  /** Defaults to the shared "No results" copy. */
  emptyTitle?: string;
  emptyDescription?: string;
  /** Rendered to the right of the search box (filters, "Add" button…). */
  toolbar?: React.ReactNode;
  className?: string;
}

/**
 * A sortable, searchable, paginated table over TanStack Table.
 *
 * Filtering and pagination are client-side, which is right for the volumes here
 * (hundreds of rows). Swapping to server-side means passing
 * `manualPagination`/`manualFiltering` and lifting state — the column defs stay
 * as they are.
 */
export function DataTable<TData>({
  columns,
  data,
  searchPlaceholder,
  pageSize = 10,
  emptyTitle,
  emptyDescription,
  toolbar,
  className,
}: DataTableProps<TData>) {
  const t = useTranslations("common");
  const { formatNumber } = useFormat();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const rows = table.getRowModel().rows;
  const { pageIndex } = table.getState().pagination;
  const totalRows = table.getFilteredRowModel().rows.length;

  return (
    <div className={cn("space-y-4", className)}>
      {(searchPlaceholder || toolbar) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {searchPlaceholder && (
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-10 rounded-xl ps-9"
                aria-label={searchPlaceholder || t("table.search")}
              />
            </div>
          )}
          {toolbar && <div className="flex items-center gap-2">{toolbar}</div>}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border bg-card">
        {/* Wide tables scroll inside their own container, never the page body. */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => {
                    const canSort = header.column.getCanSort();

                    return (
                      <TableHead key={header.id} className="whitespace-nowrap">
                        {header.isPlaceholder ? null : canSort ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="inline-flex items-center gap-1.5 font-medium transition-colors hover:text-foreground"
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                            <ArrowUpDown
                              className={cn(
                                "size-3.5 transition-opacity",
                                header.column.getIsSorted()
                                  ? "opacity-100"
                                  : "opacity-40",
                              )}
                            />
                          </button>
                        ) : (
                          flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>

            <TableBody>
              {rows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={columns.length} className="p-0">
                    <EmptyState
                      title={emptyTitle ?? t("table.emptyTitle")}
                      description={emptyDescription ?? t("table.emptyDescription")}
                      className="rounded-none border-0 bg-transparent"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {totalRows > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            {t("labels.showing", {
              from: formatNumber(
                pageIndex * table.getState().pagination.pageSize + 1,
              ),
              to: formatNumber(
                Math.min(
                  (pageIndex + 1) * table.getState().pagination.pageSize,
                  totalRows,
                ),
              ),
              total: formatNumber(totalRows),
            })}
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="rounded-lg"
            >
              <ChevronLeft className="size-4 rtl:rotate-180" />
              {t("pagination.previous")}
            </Button>
            <span className="px-2 text-sm tabular-nums text-muted-foreground ltr-nums">
              {t("pagination.pageOfPages", {
                page: formatNumber(pageIndex + 1),
                pages: formatNumber(table.getPageCount()),
              })}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="rounded-lg"
            >
              {t("pagination.next")}
              <ChevronRight className="size-4 rtl:rotate-180" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export type { ColumnDef };
