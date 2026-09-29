"use client";

import { useId, useState, useTransition } from "react";

import { Spinner } from "@/components/ui/spinner";
import type { FuelOrderRequester } from "@/lib/api/ground";
import type { FuelOrderResponse, FuelOrderStatus } from "@/lib/api/types";
import type { FuelSupplierOption } from "@/lib/fuel";
import { cn } from "@/lib/utils";

import {
  amendFuelOrderAction,
  cancelFuelOrderAction,
  orderFuelForFlightAction,
  type FuelActionResult,
} from "./flight-fuel-actions";

/**
 * A flight's fuel: what is ordered, where it stands, and ordering or
 * changing it without leaving the page. Used by the dispatch packet and
 * the pilot's preflight (client, 27 Sep):
 *
 *   fuel ordering takes you to a different page and then you lose all
 *   your work on the dispatch page when you go back.
 *
 *   The pilot needs to be able to order/review fuel during the dispatch
 *   release process. So, if dispatch already ordered fuel, pilot needs
 *   to see that. The pilot may also want to take additional fuel so
 *   they might need to adjust or order more fuel.
 *
 * An open order (ordered or confirmed) can be adjusted or cancelled;
 * adjusting a confirmed one sends it back to the supplier to confirm.
 */

const STATUS_CLASS: Record<FuelOrderStatus, string> = {
  ordered: "border-status-blue/40 bg-status-blue/10 text-status-blue",
  confirmed: "border-status-blue/40 bg-status-blue/10 text-status-blue",
  fueled: "border-status-green/40 bg-status-green/10 text-status-green",
  discrepancy: "border-status-yellow/40 bg-status-yellow/10 text-status-yellow",
  cancelled: "border-border bg-card text-muted-foreground",
};

const FIELD =
  "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none";
const LABEL =
  "mb-1 block text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground";

const LIST_RANK: Record<FuelOrderStatus, number> = {
  ordered: 0,
  confirmed: 0,
  fueled: 1,
  discrepancy: 1,
  cancelled: 2,
};

function isOpen(order: FuelOrderResponse) {
  return order.status === "ordered" || order.status === "confirmed";
}

function neededBy(order: FuelOrderResponse): string | null {
  return order.requested_fuel_time
    ? `${order.requested_fuel_time.slice(11, 16)}Z`
    : null;
}

export function FlightFuel({
  flightId,
  flightNumber,
  base,
  source,
  orders,
  options,
  fuelTypeCode,
}: {
  flightId: string;
  flightNumber: string;
  base: string;
  /** Who is ordering here, for the order's status log. */
  source: FuelOrderRequester;
  /** This flight's orders, newest first. */
  orders: FuelOrderResponse[];
  /** The base's suppliers for this aircraft's fuel, default first. */
  options: FuelSupplierOption[];
  fuelTypeCode: string;
}) {
  const [ordering, setOrdering] = useState(false);
  const openOrders = orders.filter(isOpen);
  // What is still coming leads, then what was delivered: a pilot
  // opening preflight wants the fuel on its way, and a cancelled order
  // above it only reads as noise. Newest first within each.
  const listed = [...orders].sort((a, b) => LIST_RANK[a.status] - LIST_RANK[b.status]);

  return (
    <div className="space-y-3">
      {orders.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No fuel ordered for {flightNumber} yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {listed.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              flightId={flightId}
              source={source}
            />
          ))}
        </ul>
      )}

      {options.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          No supplier is set up for{" "}
          <span className="font-mono font-semibold">{base}</span> ·{" "}
          {fuelTypeCode}. Add one in Ground Ops → Fuel → Suppliers.
        </p>
      ) : ordering ? (
        <OrderForm
          flightId={flightId}
          source={source}
          options={options}
          onDone={() => setOrdering(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setOrdering(true)}
          className="rounded-md border border-primary/40 bg-background px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5"
        >
          {openOrders.length > 0 ? "Order more fuel" : "Order fuel"}
        </button>
      )}

      {options.length > 0 && (
        <p className="text-[0.65rem] text-muted-foreground">
          Orders go to the supplier as placed. Changing a confirmed order
          sends it back to them to confirm again.
        </p>
      )}
    </div>
  );
}

function OrderRow({
  order,
  flightId,
  source,
}: {
  order: FuelOrderResponse;
  flightId: string;
  source: FuelOrderRequester;
}) {
  const [mode, setMode] = useState<"view" | "adjust" | "cancel">("view");
  const [gallons, setGallons] = useState(String(order.requested_quantity_gallons));
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const uid = useId();
  const when = neededBy(order);

  function run(action: () => Promise<FuelActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setMode("view");
        setText("");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <li className="rounded-md border border-border px-3 py-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span
          className={cn(
            "rounded-md border px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.06em]",
            STATUS_CLASS[order.status],
          )}
        >
          {order.status}
        </span>
        <span className="font-semibold tabular-nums text-foreground">
          {order.requested_quantity_gallons.toLocaleString()} gal
        </span>
        <span className="text-foreground">{order.fuel_type.label}</span>
        <span className="text-muted-foreground">· {order.supplier.name}</span>
        {when && <span className="text-muted-foreground">· by {when}</span>}
      </div>
      <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
        Ordered by {order.requested_by.full_name}
        {order.status === "fueled" && order.actual_quantity_gallons !== null
          ? ` · fueled ${order.actual_quantity_gallons.toLocaleString()} gal`
          : ""}
        {order.special_instructions ? ` · “${order.special_instructions}”` : ""}
      </p>

      {isOpen(order) && mode === "view" && (
        <div className="mt-1.5 flex gap-3">
          <button
            type="button"
            onClick={() => setMode("adjust")}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Adjust
          </button>
          <button
            type="button"
            onClick={() => setMode("cancel")}
            className="text-xs font-semibold text-muted-foreground hover:text-status-red"
          >
            Cancel order
          </button>
        </div>
      )}

      {mode === "adjust" && (
        <form
          className="mt-2 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() =>
              amendFuelOrderAction({
                flightId,
                orderId: order.id,
                source,
                gallons: Number(gallons),
                note: text,
              }),
            );
          }}
        >
          <div className="w-28">
            <label htmlFor={`${uid}-gal`} className={LABEL}>
              Gallons
            </label>
            <input
              id={`${uid}-gal`}
              type="number"
              inputMode="decimal"
              min={1}
              step={1}
              value={gallons}
              onChange={(e) => setGallons(e.target.value)}
              className={FIELD}
            />
          </div>
          <div className="min-w-40 flex-1">
            <label htmlFor={`${uid}-why`} className={LABEL}>
              Why (optional)
            </label>
            <input
              id={`${uid}-why`}
              type="text"
              maxLength={500}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. taking extra for weather at the destination"
              className={FIELD}
            />
          </div>
          <FormButtons pending={pending} submit="Save" onCancel={() => setMode("view")} />
        </form>
      )}

      {mode === "cancel" && (
        <form
          className="mt-2 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() =>
              cancelFuelOrderAction({ flightId, orderId: order.id, source, reason: text }),
            );
          }}
        >
          <div className="min-w-48 flex-1">
            <label htmlFor={`${uid}-reason`} className={LABEL}>
              Why cancel
            </label>
            <input
              id={`${uid}-reason`}
              type="text"
              maxLength={2000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className={FIELD}
            />
          </div>
          <FormButtons
            pending={pending}
            submit="Cancel order"
            danger
            disabled={!text.trim()}
            onCancel={() => setMode("view")}
          />
        </form>
      )}

      {error && (
        <p role="alert" className="mt-1.5 text-xs text-status-red">
          {error}
        </p>
      )}
    </li>
  );
}

function OrderForm({
  flightId,
  source,
  options,
  onDone,
}: {
  flightId: string;
  source: FuelOrderRequester;
  options: FuelSupplierOption[];
  onDone: () => void;
}) {
  const [choice, setChoice] = useState(options[0].key);
  const [gallons, setGallons] = useState("");
  const [time, setTime] = useState("");
  const [instructions, setInstructions] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const uid = useId();
  const option = options.find((o) => o.key === choice) ?? options[0];

  return (
    <form
      aria-label="Order fuel"
      className="space-y-3 rounded-md border border-border bg-background p-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await orderFuelForFlightAction({
            flightId,
            source,
            supplierId: option.supplierId,
            fuelTypeId: option.fuelTypeId,
            gallons: Number(gallons),
            neededBy: time,
            instructions,
          });
          if (result.ok) onDone();
          else setError(result.error);
        });
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor={`${uid}-supplier`} className={LABEL}>
            Supplier
          </label>
          <select
            id={`${uid}-supplier`}
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            className={FIELD}
          >
            {options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.supplierName} · {o.fuelTypeLabel}
                {o.pricePerGallon !== null
                  ? ` · $${o.pricePerGallon.toFixed(2)}/gal ${o.isContract ? "contract" : "spot"}`
                  : ""}
                {o.isDefault ? " · default" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${uid}-gal`} className={LABEL}>
            Gallons
          </label>
          <input
            id={`${uid}-gal`}
            type="number"
            inputMode="decimal"
            min={1}
            step={1}
            required
            value={gallons}
            onChange={(e) => setGallons(e.target.value)}
            placeholder="e.g. 80"
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-time`} className={LABEL}>
            Needed by (UTC, optional)
          </label>
          <input
            id={`${uid}-time`}
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className={cn(FIELD, "font-mono")}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${uid}-notes`} className={LABEL}>
            Special instructions (optional)
          </label>
          <input
            id={`${uid}-notes`}
            type="text"
            maxLength={2000}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="e.g. north ramp"
            className={FIELD}
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-xs text-status-red">
          {error}
        </p>
      )}
      <FormButtons
        pending={pending}
        submit="Place order"
        disabled={!gallons}
        onCancel={onDone}
      />
    </form>
  );
}

function FormButtons({
  pending,
  submit,
  onCancel,
  disabled = false,
  danger = false,
}: {
  pending: boolean;
  submit: string;
  onCancel: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="submit"
        disabled={pending || disabled}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50",
          danger
            ? "bg-status-red text-white hover:brightness-95"
            : "bg-primary text-primary-foreground hover:bg-brand-dark",
        )}
      >
        {pending && <Spinner size="xs" />}
        {submit}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className="text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        Back
      </button>
    </div>
  );
}
