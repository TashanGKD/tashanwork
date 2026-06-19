import { describe, expect, test } from "bun:test";

import {
  assertOpencodeProxyAllowed,
  normalizeOpencodeFileUrl,
  sanitizeOpencodeProxyBody,
  sanitizeOpencodeRequestPayload,
} from "./server.js";
import { ApiError } from "./errors.js";
import type { Actor, TokenScope } from "./types.js";

const actor = (scope: TokenScope | undefined): Actor => ({ type: "remote", scope });

const PERMISSION_REPLY_PATH = "/opencode/permission/req_123/reply";

describe("assertOpencodeProxyAllowed", () => {
  test("collaborators can reply to permission requests (#1918)", () => {
    // The SPA's only credential is the collaborator-scoped client token
    // (OPENWORK_TOKEN); an owner-only gate made every permission dialog
    // un-answerable.
    expect(() =>
      assertOpencodeProxyAllowed(actor("collaborator"), "POST", PERMISSION_REPLY_PATH),
    ).not.toThrow();
  });

  test("owners can reply to permission requests", () => {
    expect(() =>
      assertOpencodeProxyAllowed(actor("owner"), "POST", PERMISSION_REPLY_PATH),
    ).not.toThrow();
  });

  test("viewers cannot send any mutating request", () => {
    expect(() =>
      assertOpencodeProxyAllowed(actor("viewer"), "POST", PERMISSION_REPLY_PATH),
    ).toThrow(ApiError);
    expect(() =>
      assertOpencodeProxyAllowed(actor("viewer"), "POST", "/opencode/session/s1/command"),
    ).toThrow(ApiError);
  });

  test("viewers can still read", () => {
    expect(() =>
      assertOpencodeProxyAllowed(actor("viewer"), "GET", "/opencode/permission"),
    ).not.toThrow();
  });

  test("missing scope defaults to viewer (read-only)", () => {
    expect(() =>
      assertOpencodeProxyAllowed(actor(undefined), "POST", PERMISSION_REPLY_PATH),
    ).toThrow(ApiError);
    expect(() =>
      assertOpencodeProxyAllowed(actor(undefined), "GET", "/opencode/permission"),
    ).not.toThrow();
  });
});

describe("OpenCode proxy file URL sanitization", () => {
  test("normalizes Windows file URLs before proxying to OpenCode", () => {
    expect(normalizeOpencodeFileUrl("C:\\Users\\omar\\list.csv")).toBe("file:///C:/Users/omar/list.csv");
    expect(normalizeOpencodeFileUrl("C:/Users/omar/list.csv")).toBe("file:///C:/Users/omar/list.csv");
    expect(normalizeOpencodeFileUrl("/C:/Users/omar/list.csv")).toBe("file:///C:/Users/omar/list.csv");
    expect(normalizeOpencodeFileUrl("file://C:/Users/omar/list.csv")).toBe("file:///C:/Users/omar/list.csv");
    expect(normalizeOpencodeFileUrl("file:/C:/Users/omar/list.csv")).toBe("file:///C:/Users/omar/list.csv");
    expect(normalizeOpencodeFileUrl("file:///C%3A/Users/omar/list.csv")).toBe("file:///C:/Users/omar/list.csv");
  });

  test("recursively normalizes file part URLs in prompt payloads", () => {
    expect(
      sanitizeOpencodeRequestPayload({
        parts: [
          {
            type: "file",
            url: "file://C:/Users/omar/list.csv",
          },
        ],
      }),
    ).toEqual({
      parts: [
        {
          type: "file",
          url: "file:///C:/Users/omar/list.csv",
        },
      ],
    });
  });

  test("sanitizes JSON proxy body and removes stale content length", async () => {
    const headers = new Headers({
      "content-type": "application/json",
      "content-length": "999",
    });
    const body = new TextEncoder().encode(
      JSON.stringify({
        parts: [{ type: "file", url: "file://C:/Users/omar/list.csv" }],
      }),
    ).buffer;

    const sanitized = sanitizeOpencodeProxyBody(headers, body);
    expect(headers.has("content-length")).toBe(false);
    expect(JSON.parse(String(sanitized))).toEqual({
      parts: [{ type: "file", url: "file:///C:/Users/omar/list.csv" }],
    });
  });

  test("sanitizes prompt proxy JSON even when content type is missing", async () => {
    const headers = new Headers();
    const body = new TextEncoder().encode(
      JSON.stringify({
        parts: [{ type: "file", url: "C:\\Users\\omar\\list.csv" }],
      }),
    ).buffer;

    const sanitized = sanitizeOpencodeProxyBody(headers, body, { forceJson: true });
    expect(JSON.parse(String(sanitized))).toEqual({
      parts: [{ type: "file", url: "file:///C:/Users/omar/list.csv" }],
    });
  });
});
