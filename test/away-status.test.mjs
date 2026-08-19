import { describe, expect, test } from "vitest";
import {
  buildAwayStatus,
  clearAwayReservation,
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
