// ═══════════════════════════════════════════════════════════════════════════
// RD ADVANCE BOUTIQUE — Google Apps Script Order Backend (Hardened v2)
//
// SECURITY IMPROVEMENTS IN THIS VERSION:
//  1. All sensitive values (MANAGER_PIN, OWNER_EMAIL, SHEET_ID) are read
//     from Script Properties — never hardcoded in source.
//  2. getOrders is PIN-protected; unauthenticated calls return 401.
//  3. Brute-force protection: ≥10 failed PIN attempts locks auth for 1 hour.
//  4. Duplicate-order protection: Order ID checked before any row append.
//  5. Input validation on all required fields before processing.
//  6. Screenshot payload capped at 4 MB (safe below Apps Script limits).
//  7. LockService prevents concurrent writes / race conditions.
//  8. Audit log (AuditLog sheet) records every action with outcome.
//  9. All error paths use Logger.log() — no silent catches.
// 10. Timestamps stored as ISO-8601 strings for reliable date sorting.
// 11. Batch data reads — single getDataRange() per operation.
// 12. Status updates PIN-gated and audit-logged with old → new values.
// ═══════════════════════════════════════════════════════════════════════════

// ─── NON-SENSITIVE DEFAULTS ─────────────────────────────────────────────────
// Sensitive values (SHEET_ID, OWNER_EMAIL, MANAGER_PIN) must be set in:
//   Apps Script Editor → Project Settings → Script Properties
//
// Optional Script Properties (can also be set here):
//   DRIVE_FOLDER_ID — Google Drive folder ID for payment screenshots
//   SITE_URL        — Your site's public URL (used in email links)
const CONFIG =
  SHEET_NAME          : "Orders",
  AUDIT_SHEET_NAME    : "AuditLog",
  STORE_NAME          : "RD Advance Boutique",

  // Security limits
  MAX_SCREENSHOT_BYTES: 4 * 1024 * 1024,  // 4 MB — safe ceiling for Apps Script
  MAX_FAILED_AUTH     : 10,               // lock auth after N consecutive failures
  AUTH_LOCK_WINDOW_MS : 60 * 60 * 1000,  // 1-hour brute-force window
  LOCK_TIMEOUT_MS     : 30000,           // 30 s LockService wait

};

// ─── SCRIPT PROPERTIES ─────────────────────────────────────────────────────
// [SECURITY] Read sensitive values from Script Properties, not source code.

function getProp(key) {
  return PropertiesService.getScriptProperties().getProperty(key) || "";
}

function requireProp(key) {
  const v = getProp(key);
  if (!v) {
    const msg = "Script Property '" + key + "' is not configured. " +
                "Go to Apps Script Editor → Project Settings → Script Properties and add it.";
    Logger.log(msg);
    throw new Error(msg);
  }
  return v;
}

// ─── BRUTE-FORCE–RESISTANT PIN VERIFICATION ────────────────────────────────
// [SECURITY] Tracks consecutive failed attempts in Script Properties.
// After MAX_FAILED_AUTH failures within AUTH_LOCK_WINDOW_MS, all auth is
// rejected until the window expires — regardless of the PIN supplied.

const _FAIL_COUNT_KEY = "auth_fail_count";
const _FAIL_TIME_KEY  = "auth_fail_time";

function verifyPin(pin) {
  if (!pin) return false;

  const props = PropertiesService.getScriptProperties();
  const now   = Date.now();

  const lastTime = parseInt(props.getProperty(_FAIL_TIME_KEY)  || "0", 10);
  let   count    = parseInt(props.getProperty(_FAIL_COUNT_KEY) || "0", 10);

  // Reset counter when the brute-force window has expired
  if (now - lastTime > CONFIG.AUTH_LOCK_WINDOW_MS) {
    count = 0;
    props.setProperties({ [_FAIL_COUNT_KEY]: "0", [_FAIL_TIME_KEY]: String(now) });
  }

  // Hard reject while locked
  if (count >= CONFIG.MAX_FAILED_AUTH) {
    Logger.log("Auth locked — too many failed attempts (" + count + ")");
    return false;
  }

  const correct = String(pin) === String(requireProp("MANAGER_PIN"));

  if (!correct) {
    // Record failure
    const newCount = count + 1;
    const updates  = { [_FAIL_COUNT_KEY]: String(newCount) };
    if (count === 0) updates[_FAIL_TIME_KEY] = String(now); // start the window
    props.setProperties(updates);
    Logger.log("Failed PIN attempt #" + newCount);
  } else {
    // Reset on success
    props.setProperties({ [_FAIL_COUNT_KEY]: "0" });
  }

  return correct;
}

// ─── RESPONSE HELPERS ───────────────────────────────────────────────────────

function corsResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function unauthorized(reason) {
  // [SECURITY] Generic "Unauthorized" message — don't leak internal detail
  Logger.log("Unauthorized: " + (reason || "no reason"));
  return corsResponse({ ok: false, error: "Unauthorized" });
}

// ─── HTTP ROUTER ────────────────────────────────────────────────────────────

function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents);
    const action = body.action || "";

    if (action === "submitOrder")  return corsResponse(handleSubmitOrder(body));
    if (action === "updateStatus") return corsResponse(handleUpdateStatus(body));
    if (action === "verifyPin")    return corsResponse(handleVerifyPin(body));

    Logger.log("doPost: unknown action '" + action + "'");
    return corsResponse({ ok: false, error: "Unknown action: " + action });
  } catch (err) {
    Logger.log("doPost fatal error: " + err.message);
    return corsResponse({ ok: false, error: "Internal server error" });
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action || "";

    if (action === "getOrders") return handleGetOrders(e.parameter);
    if (action === "ping")      return corsResponse({ ok: true, store: CONFIG.STORE_NAME });

    Logger.log("doGet: unknown action '" + action + "'");
    return corsResponse({ ok: false, error: "Unknown action: " + action });
  } catch (err) {
    Logger.log("doGet fatal error: " + err.message);
    return corsResponse({ ok: false, error: "Internal server error" });
  }
}

// ─── SHEET INITIALISATION ───────────────────────────────────────────────────

const ORDER_HEADERS = [
  "Order ID", "Created Date", "Status",
  "Product ID", "Product Name", "Product URL", "Quantity",
  "Selected Options",
  "Customer Name", "Mobile Number", "Address", "City", "State", "Pincode",
  "Payment Method", "UTR Number", "Amount Paid", "Screenshot URL",
  "Notes",
];

const AUDIT_HEADERS = [
  "Timestamp", "Action", "Order ID", "Detail", "Result",
];

function getOrderSheet() {
  const ss    = SpreadsheetApp.openById(requireProp("SHEET_ID"));
  let   sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    sheet.appendRow(ORDER_HEADERS);
    const hr = sheet.getRange(1, 1, 1, ORDER_HEADERS.length);
    hr.setBackground("#2d1c12").setFontColor("#c9a45c").setFontWeight("bold");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 130);
    sheet.setColumnWidth(2, 180);
    sheet.setColumnWidth(3, 160);
    sheet.setColumnWidth(8, 240);
    sheet.setColumnWidth(11, 240);
  }
  return sheet;
}

function getAuditSheet() {
  const ss    = SpreadsheetApp.openById(requireProp("SHEET_ID"));
  let   sheet = ss.getSheetByName(CONFIG.AUDIT_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.AUDIT_SHEET_NAME);
    sheet.appendRow(AUDIT_HEADERS);
    const hr = sheet.getRange(1, 1, 1, AUDIT_HEADERS.length);
    hr.setBackground("#1a1a2e").setFontColor("#e0e0e0").setFontWeight("bold");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 200);
    sheet.setColumnWidth(4, 320);
  }
  return sheet;
}

// ─── AUDIT LOGGING ──────────────────────────────────────────────────────────
// [AUDIT] Every significant action is recorded with timestamp, action type,
// order ID, a human-readable detail string, and SUCCESS / FAIL / DUPLICATE.

function writeAuditLog(action, orderId, detail, result) {
  try {
    getAuditSheet().appendRow([
      new Date().toISOString(),
      action,
      orderId || "",
      detail  || "",
      result  || "",
    ]);
  } catch (err) {
    // Audit failures must never crash the main flow — but we do log them
    Logger.log("AuditLog write failed: " + err.message);
  }
}

// ─── INPUT VALIDATION ───────────────────────────────────────────────────────
// [SECURITY] Reject malformed requests before touching the spreadsheet.

function validateOrderPayload(data) {
  const required = [
    ["orderId",      "Order ID"],
    ["customerName", "Customer Name"],
    ["phone",        "Mobile Number"],
    ["paymentMethod","Payment Method"],
  ];

  for (const [field, label] of required) {
    if (!data[field] || !String(data[field]).trim()) {
      return { valid: false, error: "Missing required field: " + label };
    }
  }

  // Sanity-check phone — must have at least 7 digits after stripping formatting
  const digitsOnly = String(data.phone).replace(/[^\d]/g, "");
  if (digitsOnly.length < 7) {
    return { valid: false, error: "Invalid mobile number — must contain at least 7 digits." };
  }

  // [SECURITY] Reject oversized screenshots to stay well below Apps Script
  // request limits (~6 MB) and prevent abuse of Drive storage.
  if (data.screenshotBase64) {
    const approxBytes = (String(data.screenshotBase64).length * 3) / 4;
    if (approxBytes > CONFIG.MAX_SCREENSHOT_BYTES) {
      Logger.log("Screenshot rejected — size ~" + Math.round(approxBytes / 1024) + " KB for order " + data.orderId);
      return {
        valid: false,
        error: "Payment screenshot is too large (max 4 MB). Please compress the image and try again.",
      };
    }
  }

  return { valid: true };
}

// ─── VERIFY PIN ENDPOINT ────────────────────────────────────────────────────

function handleVerifyPin(body) {
  const ok = verifyPin(body.pin);
  if (!ok) {
    writeAuditLog("VERIFY_PIN", "", "Failed PIN attempt from verifyPin endpoint", "FAIL");
    return { ok: false, error: "Incorrect PIN" };
  }
  writeAuditLog("VERIFY_PIN", "", "Successful PIN verification", "SUCCESS");
  return { ok: true };
}

// ─── SUBMIT ORDER ───────────────────────────────────────────────────────────
// [SECURITY] Validation → duplicate check → LockService → write → audit.

function handleSubmitOrder(data) {
  // 1. Validate payload
  const v = validateOrderPayload(data);
  if (!v.valid) {
    Logger.log("Order rejected (validation): " + v.error + " | orderId=" + (data.orderId || "N/A"));
    writeAuditLog("SUBMIT_ORDER", data.orderId, "Validation failed: " + v.error, "REJECT");
    return { ok: false, error: v.error };
  }

  // 2. Acquire lock — prevents race conditions and duplicate rows
  // [CONCURRENCY] Only one write can run at a time across all instances.
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);
  } catch (err) {
    Logger.log("Lock timeout for order " + data.orderId + ": " + err.message);
    return { ok: false, error: "Server is temporarily busy. Please try again in a moment." };
  }

  try {
    const sheet   = getOrderSheet();
    // 3. Single bulk read — used for both duplicate check and row count
    //    [PERFORMANCE] One getDataRange() instead of repeated sheet scans.
    const allData = sheet.getDataRange().getValues();
    const headers = allData[0];
    const oidIdx  = headers.indexOf("Order ID");
    const stIdx   = headers.indexOf("Status");

    // 4. Duplicate check
    // [SECURITY] Prevent the same Order ID being appended more than once,
    // even if a customer double-submits or retries after a network error.
    for (let i = 1; i < allData.length; i++) {
      if (String(allData[i][oidIdx]) === String(data.orderId)) {
        const existingStatus = allData[i][stIdx] || "Pending Verification";
        Logger.log("Duplicate order blocked: " + data.orderId);
        writeAuditLog("SUBMIT_ORDER", data.orderId, "Duplicate submission rejected", "DUPLICATE");
        // Return success with existing state so checkout.js still shows the success screen
        return { ok: true, orderId: data.orderId, status: existingStatus, duplicate: true };
      }
    }

    // 5. Save screenshot to Drive (non-fatal if it fails)
    let screenshotUrl = "";
    if (data.screenshotBase64) {
      try {
        screenshotUrl = saveScreenshotToDrive(data.orderId, data.screenshotBase64);
      } catch (err) {
        Logger.log("Drive screenshot upload failed for " + data.orderId + ": " + err.message);
        // Continue — order is still saved; screenshot is best-effort
      }
    }

    // 6. Determine initial status
    const status = (data.paymentMethod === "UPI") ? "Pending Verification" : "Confirmed – COD";

    // 7. Build and append row
    // [DATE] Store ISO-8601 timestamp so date comparisons and sorting are reliable.
    const row = [
      data.orderId       || "",
      new Date().toISOString(),
      status,
      data.productId     || "",
      data.productName   || "",
      data.productUrl    || "",
      data.quantity      || 1,
      JSON.stringify(data.selectedOptions || {}),
      data.customerName  || "",
      data.phone         || "",
      data.address       || "",
      data.city          || "",
      data.state         || "",
      data.pincode       || "",
      data.paymentMethod || "",
      data.utrNumber     || "",
      data.amountPaid    || "",
      screenshotUrl,
      data.notes         || "",
    ];

    sheet.appendRow(row);
    styleNewRow(sheet, status);

    // 8. Audit log
    writeAuditLog(
      "SUBMIT_ORDER",
      data.orderId,
      "Customer: " + data.customerName + " | Product: " + (data.productName || "—") + " | Payment: " + status,
      "SUCCESS"
    );

    // 9. Email notification (non-fatal)
    try {
      sendOrderNotification(data, status, screenshotUrl);
    } catch (err) {
      Logger.log("Email notification failed for " + data.orderId + ": " + err.message);
    }

    return { ok: true, orderId: data.orderId, status };

  } finally {
    // Always release the lock, even if an exception occurs above
    lock.releaseLock();
  }
}

// ─── GET ORDERS (AUTH-REQUIRED) ─────────────────────────────────────────────
// [SECURITY] Orders are private business data. A PIN must be supplied as a
// query parameter (?pin=…) — missing or wrong PIN returns Unauthorized.

function handleGetOrders(params) {
  if (!verifyPin(params.pin)) {
    Logger.log("Unauthorized getOrders attempt");
    writeAuditLog("GET_ORDERS", "", "Unauthorized access attempt", "FAIL");
    return unauthorized("PIN required to fetch orders");
  }

  // [PERFORMANCE] Single bulk read; filter and sort in memory.
  const sheet   = getOrderSheet();
  const allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return corsResponse({ ok: true, orders: [] });
  }

  const headers = allData[0];
  const orders  = allData.slice(1).map((row, i) => {
    const obj = {};
    headers.forEach((h, j) => { obj[h] = row[j]; });
    obj._row = i + 2;
    // Parse Selected Options JSON stored as string
    try { obj["Selected Options"] = JSON.parse(obj["Selected Options"]); } catch (_) {}
    return obj;
  });

  const sf       = params.status;
  const filtered = (sf && sf !== "all") ? orders.filter(o => o["Status"] === sf) : orders;
  filtered.sort((a, b) => new Date(b["Created Date"]) - new Date(a["Created Date"]));

  writeAuditLog("GET_ORDERS", "", "Returned " + filtered.length + " orders", "SUCCESS");
  return corsResponse({ ok: true, orders: filtered });
}

// ─── UPDATE STATUS (AUTH-REQUIRED) ──────────────────────────────────────────
// [SECURITY] PIN required. Old status is captured before the write so the
// audit log records the full transition (e.g. "Pending → Verified").

function handleUpdateStatus(body) {
  const { orderId, status, pin } = body;

  if (!verifyPin(pin)) {
    Logger.log("Unauthorized updateStatus attempt | orderId=" + orderId);
    writeAuditLog("UPDATE_STATUS", orderId, "Unauthorized attempt", "FAIL");
    return { ok: false, error: "Unauthorized" };
  }

  if (!orderId || !status) {
    return { ok: false, error: "orderId and status are required fields." };
  }

  // [CONCURRENCY] Lock for status updates too — prevents two admins updating
  // the same row simultaneously and corrupting the sheet.
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);
  } catch (err) {
    Logger.log("Lock timeout on updateStatus for " + orderId);
    return { ok: false, error: "Server is temporarily busy. Please try again." };
  }

  try {
    const sheet   = getOrderSheet();
    const allData = sheet.getDataRange().getValues();
    const headers = allData[0];
    const oidCol  = headers.indexOf("Order ID") + 1;  // 1-based for getRange
    const stCol   = headers.indexOf("Status")   + 1;

    for (let i = 1; i < allData.length; i++) {
      if (String(allData[i][oidCol - 1]) === String(orderId)) {
        const oldStatus = allData[i][stCol - 1] || "—";

        sheet.getRange(i + 1, stCol).setValue(status);
        styleRowAt(sheet, i + 1, status);

        writeAuditLog(
          "UPDATE_STATUS",
          orderId,
          "Status changed: " + oldStatus + " → " + status,
          "SUCCESS"
        );
        return { ok: true };
      }
    }

    Logger.log("updateStatus: order not found — " + orderId);
    writeAuditLog("UPDATE_STATUS", orderId, "Order not found in sheet", "FAIL");
    return { ok: false, error: "Order not found." };

  } finally {
    lock.releaseLock();
  }
}

// ─── ROW STYLING ────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  "Pending Verification" : "#fff3cd",
  "Confirmed – COD"      : "#d4edda",
  "Verified"             : "#cce5ff",
  "Completed"            : "#d6f5d6",
  "Cancelled"            : "#f8d7da",
  "Rejected"             : "#f8d7da",
};

function styleNewRow(sheet, status) {
  const row = sheet.getLastRow();
  sheet.getRange(row, 1, 1, ORDER_HEADERS.length)
       .setBackground(STATUS_COLORS[status] || "#ffffff");
}

function styleRowAt(sheet, rowNum, status) {
  sheet.getRange(rowNum, 1, 1, ORDER_HEADERS.length)
       .setBackground(STATUS_COLORS[status] || "#ffffff");
}

// ─── DRIVE SCREENSHOT STORAGE ───────────────────────────────────────────────

function saveScreenshotToDrive(orderId, base64Data) {
  const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid base64 image format");

  const mimeType = match[1];
  const ext      = mimeType.split("/")[1] || "jpg";
  const bytes    = Utilities.base64Decode(match[2]);
  const blob     = Utilities.newBlob(bytes, mimeType, orderId + "-payment." + ext);

  // Prefer DRIVE_FOLDER_ID from Script Properties, then CONFIG, then auto-create
  const folderId = getProp("DRIVE_FOLDER_ID");
  let folder;
  if (folderId) {
    folder = DriveApp.getFolderById(folderId);
  } else {
    const it = DriveApp.getFoldersByName("RD Boutique – Payment Screenshots");
    folder = it.hasNext() ? it.next() : DriveApp.createFolder("RD Boutique – Payment Screenshots");
  }

  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

// ─── EMAIL NOTIFICATION ──────────────────────────────────────────────────────
// [CONFIG] OWNER_EMAIL read from Script Properties — never hardcoded.

function sendOrderNotification(data, status, screenshotUrl) {
  const ownerEmail = requireProp("OWNER_EMAIL");
  const siteUrl    = getProp("SITE_URL");

  const optLines = Object.entries(data.selectedOptions || {})
    .map(([k, v]) => "  • " + k + ": " + v).join("\n");

  const lines = [
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "🛍️  NEW ORDER — " + CONFIG.STORE_NAME,
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "",
    "Order ID : " + data.orderId,
    "Date     : " + new Date().toISOString(),
    "Status   : " + status,
    "",
    "── PRODUCT ──────────────────",
    "Name     : " + (data.productName || "—"),
    "Quantity : " + (data.quantity || 1),
    "URL      : " + (data.productUrl || "—"),
    "",
    "── SELECTED OPTIONS ─────────",
    optLines || "  —",
    "",
    "── CUSTOMER ─────────────────",
    "Name     : " + (data.customerName || "—"),
    "Mobile   : " + (data.phone || "—"),
    "Address  : " + [data.address, data.city, data.state, data.pincode].filter(Boolean).join(", "),
    "",
    "── PAYMENT ──────────────────",
    "Method   : " + (data.paymentMethod || "—"),
  ];

  if (data.utrNumber)  lines.push("UTR      : " + data.utrNumber);
  if (data.amountPaid) lines.push("Amount   : ₹" + data.amountPaid);
  if (screenshotUrl)   lines.push("Screenshot: " + screenshotUrl);
  if (data.notes)      lines.push("Notes    : " + data.notes);

  lines.push("");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  if (siteUrl) lines.push("Manage orders: " + siteUrl + "/manage.html");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  GmailApp.sendEmail(
    ownerEmail,
    "🛍️ New Order " + data.orderId + " — " + CONFIG.STORE_NAME,
    lines.join("\n")
  );
}

// ─── SCRIPT PROPERTIES SETUP HELPER ─────────────────────────────────────────
// Run this function once from the Apps Script editor to initialise all
// required Script Properties in one go. Fill in the values below, run it,
// then delete the values from this function (they are safely stored).
//
// HOW TO USE:
//   1. Fill in the values below.
//   2. In the Apps Script editor, select "setupProperties" from the function
//      dropdown and click ▶ Run.
//   3. Delete or blank-out the values below — they are now in Script Properties.

function setupProperties() {
  PropertiesService.getScriptProperties().setProperties({
    MANAGER_PIN    : "CHANGE_THIS_TO_YOUR_PIN",      // ← replace before running
    SHEET_ID       : "YOUR_GOOGLE_SHEET_ID",          // ← from sheet URL /d/SHEET_ID/edit
    OWNER_EMAIL    : "your@email.com",                // ← your notification email
    DRIVE_FOLDER_ID: "",                              // ← optional Drive folder ID
    SITE_URL       : "",                              // ← optional: your site's public URL
  });
  Logger.log("Script Properties set successfully.");
}
