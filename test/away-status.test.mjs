import { describe, expect, test } from "vitest";
import {
  clearAwayReservation,
  createAwayReservationFromInput,
  getAwayReservationPhase,
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

test("keeps the message as-is and expires at its last clock time", () => {
  expect(
    createAwayReservationFromInput(
      "밥 먹으러 감 00:30까지",
      Date.parse("2026-08-20T00:00:00.000Z"),
    ),
  ).toEqual({
    time: "00:30",
    endAt: Date.parse("2026-08-20T15:30:00.000Z"),
    status: "밥 먹으러 감 00:30까지",
  });
});

test.each([
  "🍚 밥 먹으러 감 00:30까지",
  "10:00~18:00 자리 비움 · 병원, 컬활 시험",
  "08:30까지 함",
  "2교시 09:00까지",
])("shows %s exactly as typed", (content) => {
  expect(
    createAwayReservationFromInput(content, Date.parse("2026-08-20T00:00:00.000Z"))
      .status,
  ).toBe(content);
});

test("expires at the last clock time when the message holds a range", () => {
  const reservation = createAwayReservationFromInput(
    "23:00~01:00 자리 비움",
    Date.parse("2026-08-20T12:00:00.000Z"),
  );

  expect(reservation.time).toBe("01:00");
  expect(reservation.endAt).toBe(Date.parse("2026-08-20T16:00:00.000Z"));
});

test.each(["밥 먹으러 감", "8:30까지 함", "24:00까지 함", "   "])(
  "rejects content without a usable clock time: %s",
  (content) => {
    expect(() => createAwayReservationFromInput(content, 0)).toThrow("내용은");
  },
);

test("classifies persisted reservations for restart recovery", () => {
  const now = 1_000;
  expect(getAwayReservationPhase({ endAt: 3_000 }, now)).toBe("active");
  expect(getAwayReservationPhase({ startAt: 2_000, endAt: 3_000 }, now)).toBe("active");
  expect(getAwayReservationPhase({ endAt: 1_000 }, now)).toBe("expired");
  expect(getAwayReservationPhase({ endAt: "bad" }, now)).toBe("invalid");
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
