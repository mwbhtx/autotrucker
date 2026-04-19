import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { SyncAllButton } from "./SyncAllButton";
import * as api from "../api";

vi.mock("../api");

const now = new Date("2026-04-18T12:00:00.000Z");

describe("SyncAllButton", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("renders 'Sync Orders' when ready (cooldown elapsed)", () => {
    render(
      <SyncAllButton
        activeSyncTask={null}
        nextSyncAvailableAt={now.toISOString()}
        onSyncStarted={vi.fn()}
        onSyncFinished={vi.fn()}
      />,
    );
    const btn = screen.getByRole("button");
    expect(btn).toHaveTextContent(/sync orders/i);
    expect(btn).toBeEnabled();
  });

  it("renders 'Sync Orders' when never synced (nextSyncAvailableAt null)", () => {
    render(
      <SyncAllButton
        activeSyncTask={null}
        nextSyncAvailableAt={null}
        onSyncStarted={vi.fn()}
        onSyncFinished={vi.fn()}
      />,
    );
    const btn = screen.getByRole("button");
    expect(btn).toHaveTextContent(/sync orders/i);
    expect(btn).toBeEnabled();
  });

  it("renders 'Syncing N/M' and is disabled when in-flight", () => {
    render(
      <SyncAllButton
        activeSyncTask={{
          task_id: "t1",
          task_status: "processing",
          orders_total: 200,
          orders_completed: 60,
          updated_at: now.toISOString(),
        }}
        nextSyncAvailableAt={new Date(
          now.getTime() + 15 * 60_000,
        ).toISOString()}
        onSyncStarted={vi.fn()}
        onSyncFinished={vi.fn()}
      />,
    );
    const btn = screen.getByRole("button");
    expect(btn).toHaveTextContent(/syncing 60\/200/i);
    expect(btn).toBeDisabled();
  });

  it("renders countdown in cooldown", () => {
    // Use real time minus a known offset so we don't have to fake the system clock.
    const future = new Date(Date.now() + 12 * 60_000).toISOString();
    render(
      <SyncAllButton
        activeSyncTask={null}
        nextSyncAvailableAt={future}
        onSyncStarted={vi.fn()}
        onSyncFinished={vi.fn()}
      />,
    );
    const btn = screen.getByRole("button");
    expect(btn).toHaveTextContent(/available in 12m/i);
    expect(btn).toBeDisabled();
  });

  it("calls syncAllAssignedOrders on click and invokes onSyncStarted", async () => {
    (api.syncAllAssignedOrders as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        task_id: "t2",
        orders_total: 5,
        next_sync_available_at: new Date(Date.now() + 15 * 60_000).toISOString(),
      },
    );
    const onSyncStarted = vi.fn();
    render(
      <SyncAllButton
        activeSyncTask={null}
        nextSyncAvailableAt={null}
        onSyncStarted={onSyncStarted}
        onSyncFinished={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(api.syncAllAssignedOrders).toHaveBeenCalled());
    expect(onSyncStarted).toHaveBeenCalledWith(
      expect.objectContaining({ task_id: "t2", orders_total: 5 }),
    );
  });
});
