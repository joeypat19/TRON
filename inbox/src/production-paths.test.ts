import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return readFiles(fullPath);
    }

    if (!/\.(ts|tsx)$/.test(entry.name) || /\.test\.(ts|tsx)$/.test(entry.name)) {
      return [];
    }

    return [fs.readFileSync(fullPath, "utf8")];
  });
}

describe("production mail paths", () => {
  it("do not include mock inbox data", () => {
    const code = readFiles(path.join(process.cwd(), "src", "app", "mail")).join("\n");

    expect(code).not.toMatch(/mock inbox|mockEmails|dummy messages|seed inbox data/i);
  });

  it("does not reference old legacy icon assets", () => {
    const code = readFiles(path.join(process.cwd(), "src")).join("\n");
    const publicAssets = fs
      .readdirSync(path.join(process.cwd(), "public"), { recursive: true })
      .map(String)
      .join("\n");
    const oldIconPattern = new RegExp(["at", "om"].join(""), "i");

    expect(`${code}\n${publicAssets}`).not.toMatch(oldIconPattern);
  });

  it("uses the current Inbox brand assets in access and loading screens", () => {
    const files = [
      path.join(process.cwd(), "src", "components", "brand", "logo.tsx"),
      path.join(process.cwd(), "src", "components", "auth", "gmail-access-state.tsx"),
      path.join(process.cwd(), "src", "app", "loading.tsx"),
    ];

    const code = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
    expect(code).toContain("/brand/tron-logo.png");
  });

  it("does not advertise removed custom favicon assets", () => {
    const files = [
      path.join(process.cwd(), "src", "app", "layout.tsx"),
      path.join(process.cwd(), "src", "app", "manifest.ts"),
    ];

    const code = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");

    expect(code).not.toMatch(/favicon\.ico|apple-touch-icon\.png|\/icon\.png/);
  });
});
