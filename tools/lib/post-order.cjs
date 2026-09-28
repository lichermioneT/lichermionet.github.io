"use strict";

// One shared ordering definition for category pages, columns and chapter navigation.
const SORT_FIELDS = Object.freeze({ manual_order: 1, date: 1, title: 1 });
function normalizeOrder(raw) {
  const value = typeof raw === "number" ? raw
    : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
  return Number.isSafeInteger(value) && value > 0 ? value : Number.MAX_SAFE_INTEGER;
}
module.exports = { SORT_FIELDS, normalizeOrder };
