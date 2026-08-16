'use client';

import type { DroneCommand, DroneSummary } from '@fleet-tracker/shared';
import { useDroneCommand } from '@/hooks/useQueries';
import { Panel } from './Panel';

const COMMANDS: DroneCommand[] = ['PAUSE', 'RESUME', 'RTB', 'RESET'];

export function FleetList({
  drones,
  selectedDroneId,
  onSelect,
}: {
  drones: DroneSummary[];
  selectedDroneId: string;
  onSelect(droneId: string): void;
}): React.JSX.Element {
  const command = useDroneCommand();

  return (
    <Panel
      title="Fleet"
      header={
        <span className="rounded-full bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-slate-400">
          {drones.length}
        </span>
      }
    >
      <ul className="space-y-2">
        {drones.map((drone) => (
          <li key={drone.droneId}>
            <button
              type="button"
              onClick={() => onSelect(drone.droneId)}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm ${
                drone.droneId === selectedDroneId
                  ? 'bg-slate-700/70 text-slate-100'
                  : 'text-slate-300 hover:bg-slate-800/70'
              }`}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: drone.colour }}
              />
              <span className="flex-1 truncate">{drone.name}</span>
              <span className="font-mono text-xs text-slate-400">
                {drone.battery.toFixed(0)}%
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-3 grid grid-cols-4 gap-1">
        {COMMANDS.map((action) => (
          <button
            key={action}
            type="button"
            disabled={command.isPending}
            onClick={() => command.mutate({ droneId: selectedDroneId, command: action })}
            className="rounded bg-slate-800 px-1 py-1.5 text-[11px] text-slate-200 hover:bg-slate-700 disabled:opacity-50"
          >
            {action}
          </button>
        ))}
      </div>

      {command.isError && (
        <p className="mt-2 text-xs text-rose-400">Command failed — is the server running?</p>
      )}
    </Panel>
  );
}
