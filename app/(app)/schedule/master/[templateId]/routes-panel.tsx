"use client";

import { useState } from "react";

import { buttonSolid } from "@/components/ff/controls";
import { EmptyState } from "@/components/ff/empty-state";
import { Panel } from "@/components/ff/panel";
import { RemoveRowButton } from "@/components/settings/remove-row-button";
import type { ScheduleRoute } from "@/lib/api/master-schedule";
import type { AircraftListItem } from "@/lib/api/types";
import type { ZoneTable } from "@/lib/format/local-time";
import { daysText, legsRoute } from "@/lib/schedule/master";

import { removeRouteAction } from "../actions";
import { RouteForm } from "./route-form";

/** The flights on a schedule, with adding and changing them in place. */
export function RoutesPanel({
  templateId,
  routes,
  aircraft,
  zones,
  groundMinutes,
  canEdit,
}: {
  templateId: string;
  routes: ScheduleRoute[];
  aircraft: AircraftListItem[];
  zones: ZoneTable;
  groundMinutes: number;
  canEdit: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const formProps = { templateId, aircraft, zones, groundMinutes };
  const columns = canEdit ? 7 : 6;

  return (
    <Panel
      title={`Flights · ${routes.length}`}
      flush
      actions={
        canEdit && !adding ? (
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setAdding(true);
            }}
            className={`${buttonSolid} px-3 py-1.5`}
          >
            + Add Flight
          </button>
        ) : null
      }
    >
      {adding ? (
        <div className="border-b border-border p-5">
          <RouteForm {...formProps} onDone={() => setAdding(false)} />
        </div>
      ) : null}
      {routes.length === 0 ? (
        adding ? null : (
          <EmptyState>
            {canEdit ? "No flights yet. Add the flights you fly each week." : "No flights on this schedule yet."}
          </EmptyState>
        )
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="ff-thead">
              <tr>
                <th scope="col" className="px-4 py-2 font-semibold">Flight</th>
                <th scope="col" className="px-4 py-2 font-semibold">Route</th>
                <th scope="col" className="px-4 py-2 font-semibold">Operates</th>
                <th scope="col" className="px-4 py-2 font-semibold">Departs</th>
                <th scope="col" className="px-4 py-2 font-semibold">Arrives</th>
                <th scope="col" className="px-4 py-2 font-semibold">Aircraft</th>
                {canEdit ? <th scope="col" className="px-4 py-2" /> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {routes.map((route) =>
                editing === route.id ? (
                  <tr key={route.id}>
                    <td colSpan={columns} className="p-5">
                      <RouteForm {...formProps} route={route} onDone={() => setEditing(null)} />
                    </td>
                  </tr>
                ) : (
                  <tr key={route.id} className="hover:bg-accent">
                    <td className="whitespace-nowrap px-4 py-3 font-mono font-semibold text-foreground">
                      {route.flight_number}
                      {route.is_ifr ? <span className="eyebrow ml-2">IFR</span> : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className="whitespace-nowrap font-mono text-foreground">{legsRoute(route.legs)}</span>
                      {route.legs.length > 1 ? (
                        <div className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                          {route.legs.map((leg) => `${leg.departs}–${leg.arrives}`).join(", ")}
                        </div>
                      ) : null}
                      {route.notes ? <div className="text-xs text-muted-foreground">{route.notes}</div> : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{daysText(route.days_of_week)}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{route.legs[0].departs}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{route.legs[route.legs.length - 1].arrives}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="font-mono text-foreground">{route.aircraft.tail_number}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {route.aircraft.is_active ? route.aircraft.model : "not active"}
                      </span>
                    </td>
                    {canEdit ? (
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setAdding(false);
                            setEditing(route.id);
                          }}
                          aria-label={`Edit ${route.flight_number}`}
                          className="mr-3 text-xs text-primary hover:underline"
                        >
                          Edit
                        </button>
                        <RemoveRowButton
                          label={`Remove ${route.flight_number}`}
                          confirm={`Take ${route.flight_number} off this schedule? Flights already published stay on the Schedule.`}
                          action={removeRouteAction.bind(null, templateId, route.id)}
                        />
                      </td>
                    ) : null}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
