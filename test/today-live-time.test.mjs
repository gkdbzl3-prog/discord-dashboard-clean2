import fs from "node:fs";
import vm from "node:vm";
import { expect, test } from "vitest";

function loadTodayWindow(nowMs) {
  const context = {
    console,
    Date: class extends Date {
      constructor(...args) {
        super(...(args.length ? args : [nowMs]));
      }

      static now() {
        return nowMs;
      }
    },
    URLSearchParams,
    location: { search: "" },
    localStorage: { getItem: () => null },
    document: {
      addEventListener: () => {},
      getElementById: () => null,
      querySelector: () => null,
    },
    window: {},
    setInterval: () => 0,
    clearInterval: () => {},
    fetch: async () => ({ ok: true, json: async () => ({}) }),
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("public/today.js", "utf8"), context);
  return context.window;
}

test("live timeline counts from original camera start, not auto-split currentStart", () => {
  const now = new Date("2026-05-25T03:00:00.000Z").getTime();
  const oneHourAgo = now - 60 * 60 * 1000;
  const fortyThreeSecondsAgo = now - 43 * 1000;
  const window = loadTodayWindow(now);

  const user = {
    isOnline: true,
    eventStart: oneHourAgo,
    currentStart: fortyThreeSecondsAgo,
    totalSeconds: 0,
    sessions: [],
  };

  expect(window.getTodaySeconds(user)).toBe(3600);
  expect(window.getLiveTotalSeconds(user)).toBe(3600);
});
