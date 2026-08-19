import { describe, expect, test } from "vitest";
import {
  buildAwayStatus,
  clearAwayReservation,
  executeAwayShortcut,
  getAwayReservationPhase,
  parseAwayShortcut,
  parseKstAwayEndAt,
  saveAwayReservation,
  setVoiceChannelStatus,
} from "../utils/away-status.js";

describe("parseKstAwayEndAt", () => {
  test("uses today's requested KST time when it is still ahead", () => {
    const now = Date.parse("2026-08-20T07:15:00.000Z"); // 16:15 KST

    expect(parseKstAwayEndAt("18:30", now)).toBe(
      Date.parse("2026-08-20T09:30:00.000Z"),
    );
  });

  test("uses the next day when today's requested KST time already passed", () => {
    const now = Date.parse("2026-08-20T00:00:00.000Z"); // 09:00 KST

    expect(parseKstAwayEndAt("08:30", now)).toBe(
      Date.parse("2026-08-20T23:30:00.000Z"),
    );
  });

  test.each(["8:30", "24:00", "12:60", "점심"])(
    "rejects invalid time %s",
    (value) => {
      expect(() => parseKstAwayEndAt(value, 0)).toThrow("HH:MM");
    },
  );
});

test("parses only the silent away shortcut syntax", () => {
  expect(parseAwayShortcut("~08:30까지 함")).toEqual({
    time: "08:30",
    status: "⏳ 08:30까지 함",
  });
  expect(parseAwayShortcut("  ~23:05까지 함  ")).toEqual({
    time: "23:05",
    status: "⏳ 23:05까지 함",
  });
  expect(parseAwayShortcut("~13:00부터 15:00까지 자리 비움")).toEqual({
    startTime: "13:00",
    endTime: "15:00",
    status: "🚪 13:00부터 15:00까지 자리 비움",
  });
  expect(parseAwayShortcut("08:30까지 함")).toBeNull();
  expect(parseAwayShortcut("~8:30까지 함")).toBeNull();
  expect(parseAwayShortcut("~24:00까지 함")).toBeNull();
  expect(parseAwayShortcut("~08:30까지 함 오늘은 병원")).toBeNull();
  expect(parseAwayShortcut("~13:00부터 25:00까지 자리 비움")).toBeNull();
});

test("an admin shortcut deletes the trigger before activating the reservation", async () => {
  const events = [];

  const handled = await executeAwayShortcut({
    content: "~08:30까지 함",
    isAdmin: true,
    now: Date.parse("2026-08-20T00:00:00.000Z"),
    deleteTrigger: async () => events.push("deleted"),
    activate: async (reservation) => events.push(reservation),
  });

  expect(handled).toBe(true);
  expect(events).toEqual([
    "deleted",
    {
      endAt: Date.parse("2026-08-20T23:30:00.000Z"),
      status: "⏳ 08:30까지 함",
      time: "08:30",
    },
  ]);
});

test("ignores non-admin shortcuts and still activates when message deletion fails", async () => {
  const activations = [];
  const ignored = await executeAwayShortcut({
    content: "~08:30까지 함",
    isAdmin: false,
    deleteTrigger: async () => {
      throw new Error("must not run");
    },
    activate: async (reservation) => activations.push(reservation),
  });
  expect(ignored).toBe(false);
  expect(activations).toEqual([]);

  const deleteErrors = [];
  const handled = await executeAwayShortcut({
    content: "~08:30까지 함",
    isAdmin: true,
    now: Date.parse("2026-08-20T00:00:00.000Z"),
    deleteTrigger: async () => {
      throw new Error("missing permission");
    },
    onDeleteError: (error) => deleteErrors.push(error.message),
    activate: async (reservation) => activations.push(reservation.status),
  });

  expect(handled).toBe(true);
  expect(deleteErrors).toEqual(["missing permission"]);
  expect(activations).toEqual(["⏳ 08:30까지 함"]);
});

test("a range shortcut schedules the next KST start and an end after it", async () => {
  const activations = [];

  await executeAwayShortcut({
    content: "~23:00부터 01:00까지 자리 비움",
    isAdmin: true,
    now: Date.parse("2026-08-20T12:00:00.000Z"), // 21:00 KST
    deleteTrigger: async () => {},
    activate: async (reservation) => activations.push(reservation),
  });

  expect(activations).toEqual([
    {
      startAt: Date.parse("2026-08-20T14:00:00.000Z"),
      endAt: Date.parse("2026-08-20T16:00:00.000Z"),
      status: "🚪 23:00부터 01:00까지 자리 비움",
      startTime: "23:00",
      endTime: "01:00",
    },
  ]);
});

test("classifies persisted reservations for restart recovery", () => {
  const now = 1_000;
  expect(getAwayReservationPhase({ startAt: 2_000, endAt: 3_000 }, now)).toBe("pending");
  expect(getAwayReservationPhase({ startAt: 500, endAt: 3_000 }, now)).toBe("active");
  expect(getAwayReservationPhase({ endAt: 3_000 }, now)).toBe("active");
  expect(getAwayReservationPhase({ startAt: 500, endAt: 1_000 }, now)).toBe("expired");
  expect(getAwayReservationPhase({ startAt: 500, endAt: "bad" }, now)).toBe("invalid");
});

test("builds the channel status with an optional message", () => {
  expect(buildAwayStatus("08:30", "🏥 병원")).toBe(
    "🏥 병원 | 08:30까지 자리 비움",
  );
  expect(buildAwayStatus("08:30", "   ")).toBe("08:30까지 자리 비움");
});

test("saving a new reservation overwrites the previous guild reservation", () => {
  const root = {
    meta: {
      awayReservations: {
        guild1: { channelId: "old", endAt: 1, status: "old" },
      },
    },
  };

  saveAwayReservation(root, "guild1", {
    channelId: "study",
    endAt: 2,
    status: "08:30까지 자리 비움",
  });

  expect(root.meta.awayReservations.guild1).toEqual({
    channelId: "study",
    endAt: 2,
    status: "08:30까지 자리 비움",
  });
});

test("clearing a reservation removes only the requested guild", () => {
  const root = {
    meta: {
      awayReservations: {
        guild1: { channelId: "one", endAt: 1, status: "one" },
        guild2: { channelId: "two", endAt: 2, status: "two" },
      },
    },
  };

  expect(clearAwayReservation(root, "guild1")).toEqual({
    channelId: "one",
    endAt: 1,
    status: "one",
  });
  expect(root.meta.awayReservations).toEqual({
    guild2: { channelId: "two", endAt: 2, status: "two" },
  });
});

test("sets and clears Discord voice status through the voice-status REST endpoint", async () => {
  const requests = [];
  const rest = {
    async put(route, options) {
      requests.push({ route, options });
    },
  };

  await setVoiceChannelStatus(rest, "123", "🏥 병원 | 08:30까지 자리 비움");
  await setVoiceChannelStatus(rest, "123", null);

  expect(requests).toEqual([
    {
      route: "/channels/123/voice-status",
      options: { body: { status: "🏥 병원 | 08:30까지 자리 비움" } },
    },
    {
      route: "/channels/123/voice-status",
      options: { body: { status: null } },
    },
  ]);
});
