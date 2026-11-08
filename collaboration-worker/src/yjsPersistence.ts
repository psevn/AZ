import * as Y from "yjs";

/** Rehydrate a persisted Yjs binary update into a fresh document instance. */
export function restoreYjsDocument(saved?: Uint8Array): Y.Doc {
  const document = new Y.Doc();
  if (saved) Y.applyUpdate(document, saved);
  return document;
}

/** Encode the complete CRDT state; never persist derived HTML/JSON as source of truth. */
export function encodeYjsDocument(document: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(document);
}
