// Keep the original operation parameters across timeouts, refreshes and code edits.
export function pendingBorrowKey(userId, bookId, barcode) {
  const storageKey = `borrow:${userId}:${bookId}`;
  const saved = sessionStorage.getItem(storageKey);
  let operation;
  if (saved) {
    try { operation = JSON.parse(saved); } catch (err) {
      // Upgrade pending operation keys created by the earlier client.
      if (/^[A-Za-z0-9_-]{16,128}$/.test(saved)) operation = { requestId: saved, barcode };
    }
  }
  if (!operation?.requestId) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    operation = { requestId: Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join(''), barcode };
  }
  sessionStorage.setItem(storageKey, JSON.stringify(operation));
  return { ...operation, clear() { sessionStorage.removeItem(storageKey); } };
}
