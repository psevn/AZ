import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { encodeYjsDocument, restoreYjsDocument } from "../src/yjsPersistence";

describe("Yjs binary persistence", () => {
  it("restores a document from its persisted binary state", () => {
    const original = new Y.Doc();
    original.getText("content").insert(0, "AZ collaborative workspace");

    const restored = restoreYjsDocument(encodeYjsDocument(original));

    expect(restored.getText("content").toString()).toBe("AZ collaborative workspace");
    original.destroy();
    restored.destroy();
  });

  it("merges concurrent edits and keeps both changes after persistence", () => {
    const first = new Y.Doc();
    const second = new Y.Doc();

    first.getText("content").insert(0, "A");
    second.getText("content").insert(0, "B");

    Y.applyUpdate(first, encodeYjsDocument(second));
    Y.applyUpdate(second, encodeYjsDocument(first));

    const persisted = encodeYjsDocument(first);
    const restored = restoreYjsDocument(persisted);

    expect(restored.getText("content").toString()).toBe(second.getText("content").toString());
    expect(restored.getText("content").toString()).toContain("A");
    expect(restored.getText("content").toString()).toContain("B");

    first.destroy();
    second.destroy();
    restored.destroy();
  });
});
