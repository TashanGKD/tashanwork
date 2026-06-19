import { describe, expect, test } from "bun:test";

import {
  firstLineLocalFileParts,
  localFilePathToFileUrl,
} from "../src/react-app/domains/session/sync/prompt-file-parts";
import {
  normalizeOpencodeFileUrl,
  sanitizeOpencodeRequestPayload,
} from "../src/app/lib/opencode";
import { getSlashCommandQuery, parseSlashCommandInvocation } from "../src/react-app/domains/session/surface/composer/slash-command";

describe("first-line local file parts", () => {
  test("does not implicitly attach tilde paths from typed text", () => {
    expect(
      firstLineLocalFileParts(
      "check ~/code/research/openwork-users/list.csv\nits a list of unique email domains",
      "/Users/omar/code/openwork",
      ),
    ).toEqual([]);
  });

  test("only detects paths from the first line", () => {
    const parts = firstLineLocalFileParts(
      "summarize this\n~/code/research/openwork-users/list.csv",
      "/Users/omar/code/openwork",
    );

    expect(parts).toEqual([]);
  });

  test("does not treat Tashan digital employee commands as local files", () => {
    expect(
      firstLineLocalFileParts(
        "/tashan-digital-employees/knowledge-navigator 整理当前项目资料",
        "C:/Users/omar/code/openwork",
      ),
    ).toEqual([]);
  });

  test("does not treat URL paths as local files", () => {
    const parts = firstLineLocalFileParts(
      "check https://example.com/research/list.csv",
      "/Users/omar/code/openwork",
    );

    expect(parts).toEqual([]);
  });

  test("does not implicitly attach file URLs from typed text", () => {
    expect(firstLineLocalFileParts("check file://C:/Users/omar/list.csv", "C:/Users/omar/code/openwork")).toEqual([]);
  });

  test("does not implicitly attach Windows absolute paths from typed text", () => {
    expect(firstLineLocalFileParts("check C:\\Users\\omar\\list.csv", "C:/Users/omar/code/openwork")).toEqual([]);
    expect(firstLineLocalFileParts("check C:/Users/omar/list.csv", "C:/Users/omar/code/openwork")).toEqual([]);
  });

  test("formats local Windows paths as absolute file URLs", () => {
    expect(localFilePathToFileUrl("C:\\Users\\omar\\list.csv")).toBe("file:///C:/Users/omar/list.csv");
    expect(localFilePathToFileUrl("C:/Users/omar/list.csv")).toBe("file:///C:/Users/omar/list.csv");
    expect(localFilePathToFileUrl("/C:/Users/omar/list.csv")).toBe("file:///C:/Users/omar/list.csv");
  });

  test("normalizes file URLs at the OpenCode request boundary", () => {
    expect(normalizeOpencodeFileUrl("C:\\Users\\omar\\list.csv")).toBe("file:///C:/Users/omar/list.csv");
    expect(normalizeOpencodeFileUrl("C:/Users/omar/list.csv")).toBe("file:///C:/Users/omar/list.csv");
    expect(normalizeOpencodeFileUrl("/C:/Users/omar/list.csv")).toBe("file:///C:/Users/omar/list.csv");
    expect(normalizeOpencodeFileUrl("file://C:/Users/omar/list.csv")).toBe("file:///C:/Users/omar/list.csv");
    expect(normalizeOpencodeFileUrl("file:/C:/Users/omar/list.csv")).toBe("file:///C:/Users/omar/list.csv");
    expect(normalizeOpencodeFileUrl("file:///C%3A/Users/omar/list.csv")).toBe("file:///C:/Users/omar/list.csv");
  });

  test("recursively sanitizes OpenCode prompt payloads", () => {
    expect(
      sanitizeOpencodeRequestPayload({
        parts: [
          {
            type: "file",
            url: "C:\\Users\\omar\\list.csv",
            filename: "list.csv",
          },
        ],
      }),
    ).toEqual({
      parts: [
        {
          type: "file",
          url: "file:///C:/Users/omar/list.csv",
          filename: "list.csv",
        },
      ],
    });
  });
});

describe("slash-command parsing", () => {
  test("parses command invocations", () => {
    expect(parseSlashCommandInvocation("/compact")).toEqual({ name: "compact", arguments: "" });
    expect(parseSlashCommandInvocation("/review this diff")).toEqual({ name: "review", arguments: "this diff" });
  });

  test("does not parse absolute file paths as commands", () => {
    expect(parseSlashCommandInvocation("/Users/omar/code/openwork/apps/app/src/file.ts\nwhy does this fail?")).toBeNull();
    expect(getSlashCommandQuery("/Users/omar/code/file.ts")).toBeNull();
  });
});
