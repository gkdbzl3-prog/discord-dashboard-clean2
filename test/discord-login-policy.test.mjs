import { expect, test } from "vitest";
import { shouldLoginDiscordClient } from "../utils/discord-login-policy.js";

test("skips Discord gateway login for local runs by default", () => {
  expect(shouldLoginDiscordClient({ DISCORD_TOKEN: "token" })).toEqual({
    ok: false,
    reason: "local-discord-login-disabled",
  });
});

test("allows Discord gateway login on Fly", () => {
  expect(shouldLoginDiscordClient({ DISCORD_TOKEN: "token", FLY_APP_NAME: "zzozzozzo" })).toEqual({
    ok: true,
    reason: "enabled",
  });
});

test("allows explicit local Discord gateway login override", () => {
  expect(shouldLoginDiscordClient({
    DISCORD_TOKEN: "token",
    ENABLE_LOCAL_DISCORD_LOGIN: "true",
  })).toEqual({
    ok: true,
    reason: "enabled",
  });
});

test("skips Discord gateway login without a token", () => {
  expect(shouldLoginDiscordClient({ FLY_APP_NAME: "zzozzozzo" })).toEqual({
    ok: false,
    reason: "missing-token",
  });
});
