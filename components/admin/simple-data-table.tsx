"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useHeaderActions } from "@/components/providers/header-actions-provider";

interface SimpleDataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchKey?: string;
  onAdd?: () => void;
  onRowClick?: (data: TData) => void;
  showColumnToggle?: boolean;
  title?: string;
  loading?: boolean;
  defaultSorting?: SortingState;
  headerExtra?: React.ReactNode;
  globalFilter?: string;
  onGlobalFilterChange?: (value: string) => void;
  globalFilterFn?: (row: any, columnId: string, filterValue: string) => boolean;
  rowClassName?: (data: TData) => string;
  rowDataId?: (data: TData) => string;
}

export function SimpleDataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  onAdd,
  onRowClick,
  showColumnToggle = true,
  title,
  loading,
  headerExtra,
  globalFilter: externalGlobalFilter,
  onGlobalFilterChange,
  globalFilterFn,
  rowClassName,
  rowDataId,
  defaultSorting = [],
}: SimpleDataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>(defaultSorting);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    ...(externalGlobalFilter !== undefined && { globalFilterFn: globalFilterFn || "includesString" }),
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      ...(externalGlobalFilter !== undefined && { globalFilter: externalGlobalFilter }),
    },
    ...(onGlobalFilterChange && { onGlobalFilterChange }),
    initialState: {
      pagination: {
        pageSize: 99999,
      },
    },
  });

  const { setActions, setLeftContent } = useHeaderActions();

  // Use useLayoutEffect to set header actions synchronously,
  // preventing race conditions where old page cleanup wipes new page's actions
  React.useLayoutEffect(() => {
    const headerContent = (
      <div className="flex items-center gap-2">
        {headerExtra}
        {externalGlobalFilter !== undefined && onGlobalFilterChange ? (
          <Input
            placeholder="Search..."
            value={externalGlobalFilter}
            onChange={(event) => onGlobalFilterChange(event.target.value)}
            className="max-w-sm h-8"
          />
        ) : searchKey ? (
          <Input
            placeholder={`Filter by ${searchKey}...`}
            value={
              (table.getColumn(searchKey)?.getFilterValue() as string) ?? ""
            }
            onChange={(event) =>
              table.getColumn(searchKey)?.setFilterValue(event.target.value)
            }
            className="max-w-sm h-8"
          />
        ) : null}
        {showColumnToggle && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="ml-auto h-8">
                Columns <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {onAdd && (
          <Button onClick={onAdd} size="sm" className="h-8">
            <Plus className="mr-2 h-4 w-4" /> Add New
          </Button>
        )}
      </div>
    );

    setActions(headerContent);

    if (title) {
      setLeftContent(
        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          {title}
        </h1>
      );
    }

    // Re-assert after a tick to survive any stale cleanup from a previous page
    const timer = setTimeout(() => {
      setActions(headerContent);
      if (title) {
        setLeftContent(
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            {title}
          </h1>
        );
      }
    }, 50);

    return () => {
      clearTimeout(timer);
      setActions(null);
      setLeftContent(null);
    };
  }, [
    setActions,
    setLeftContent,
    title,
    table,
    searchKey,
    onAdd,
    showColumnToggle,
    headerExtra,
    externalGlobalFilter,
    onGlobalFilterChange,
  ]);

  return (
    <div className="w-full h-full flex flex-col gap-2 overflow-hidden">
      <div className="rounded-md border flex-1 overflow-auto bg-background min-h-0 relative scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-800">
        <table className="relative w-full border-separate border-spacing-0">
          <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent border-none">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="sticky top-0 bg-background z-20 border-b backdrop-blur-sm text-[14px] font-normal">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  data-row-id={rowDataId?.(row.original)}
                  onClick={() => onRowClick?.(row.original)}
                  className={`${onRowClick ? "cursor-pointer" : ""} ${rowClassName?.(row.original) || ""}`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-0.5 h-8 text-[14px] font-normal">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </table>
      </div>

    </div>
  );
}
