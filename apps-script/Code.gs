// ═══════════════════════════════════════════════════════════════════════════
// RD ADVANCE BOUTIQUE — Google Apps Script Backend (v3 — Full Catalog + Orders)
//
// SECURITY:
//  1. MANAGER_PIN, OWNER_EMAIL, SHEET_ID read from Script Properties only.
//  2. All write/delete ops are PIN-protected.
//  3. Brute-force protection (10 failures → 1-hour lock).
//  4. LockService prevents concurrent writes.
//  5. Input validation before any sheet write.
//  6. Audit log for every significant action.
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG = {
  SHEET_NAME          : "Orders",
  AUDIT_SHEET_NAME    : "AuditLog",
  PRODUCTS_SHEET_NAME : "Products",
  CATEGORIES_SHEET_NAME: "Categories",
  STORE_NAME          : "RD Advance Boutique",
  MAX_SCREENSHOT_BYTES: 4 * 1024 * 1024,
  MAX_FAILED_AUTH     : 10,
  AUTH_LOCK_WINDOW_MS : 60 * 60 * 1000,
  LOCK_TIMEOUT_MS     : 30000,
};

// ─── SCRIPT PROPERTIES ───────────────────────────────────────────────────────

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

// ─── BRUTE-FORCE–RESISTANT PIN VERIFICATION ──────────────────────────────────

const _FAIL_COUNT_KEY = "auth_fail_count";
const _FAIL_TIME_KEY  = "auth_fail_time";

function verifyPin(pin) {
  if (!pin) return false;

  const props = PropertiesService.getScriptProperties();
  const now   = Date.now();

  const lastTime = parseInt(props.getProperty(_FAIL_TIME_KEY)  || "0", 10);
  let   count    = parseInt(props.getProperty(_FAIL_COUNT_KEY) || "0", 10);

  if (now - lastTime > CONFIG.AUTH_LOCK_WINDOW_MS) {
    count = 0;
    props.setProperties({ [_FAIL_COUNT_KEY]: "0", [_FAIL_TIME_KEY]: String(now) });
  }

  if (count >= CONFIG.MAX_FAILED_AUTH) {
    Logger.log("Auth locked — too many failed attempts (" + count + ")");
    return false;
  }

  const correct = String(pin) === String(requireProp("MANAGER_PIN"));

  if (!correct) {
    const newCount = count + 1;
    const updates  = { [_FAIL_COUNT_KEY]: String(newCount) };
    if (count === 0) updates[_FAIL_TIME_KEY] = String(now);
    props.setProperties(updates);
    Logger.log("Failed PIN attempt #" + newCount);
  } else {
    props.setProperties({ [_FAIL_COUNT_KEY]: "0" });
  }

  return correct;
}

// ─── RESPONSE HELPERS ────────────────────────────────────────────────────────

function corsResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function unauthorized(reason) {
  Logger.log("Unauthorized: " + (reason || "no reason"));
  return corsResponse({ ok: false, error: "Unauthorized" });
}

// ─── HTTP ROUTER ─────────────────────────────────────────────────────────────

function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents);
    const action = body.action || "";

    if (action === "submitOrder")    return corsResponse(handleSubmitOrder(body));
    if (action === "updateStatus")   return corsResponse(handleUpdateStatus(body));
    if (action === "verifyPin")      return corsResponse(handleVerifyPin(body));
    if (action === "updatePin")      return corsResponse(handleUpdatePin(body));
    if (action === "addProduct")     return corsResponse(handleAddProduct(body));
    if (action === "updateProduct")  return corsResponse(handleUpdateProduct(body));
    if (action === "deleteProduct")  return corsResponse(handleDeleteProduct(body));
    if (action === "addCategory")    return corsResponse(handleAddCategory(body));
    if (action === "updateCategory") return corsResponse(handleUpdateCategory(body));
    if (action === "deleteCategory") return corsResponse(handleDeleteCategory(body));

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

    if (action === "getOrders")    return handleGetOrders(e.parameter);
    if (action === "getProducts")  return handleGetProducts(e.parameter);
    if (action === "getProduct")   return handleGetProduct(e.parameter);
    if (action === "getCategories") return handleGetCategories(e.parameter);
    if (action === "ping")         return corsResponse({ ok: true, store: CONFIG.STORE_NAME });

    Logger.log("doGet: unknown action '" + action + "'");
    return corsResponse({ ok: false, error: "Unknown action: " + action });
  } catch (err) {
    Logger.log("doGet fatal error: " + err.message);
    return corsResponse({ ok: false, error: "Internal server error" });
  }
}

// ─── SHEET HEADERS ───────────────────────────────────────────────────────────

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

const PRODUCT_HEADERS = [
  "id", "title", "slug", "shortDescription", "description",
  "category", "productType", "price", "discountPrice", "stock",
  "status", "featured", "image", "images", "colors", "sizes",
  "features", "tags", "occasions", "outfitCategory",
  "suggestedProducts", "compatibleWith",
  "seoTitle", "seoDescription", "createdAt", "updatedAt"
];

const CATEGORY_HEADERS = [
  "id", "name", "slug", "description", "status", "createdAt"
];

// ─── SHEET GETTERS ───────────────────────────────────────────────────────────

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

function getProductSheet() {
  const ss    = SpreadsheetApp.openById(requireProp("SHEET_ID"));
  let   sheet = ss.getSheetByName(CONFIG.PRODUCTS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.PRODUCTS_SHEET_NAME);
    sheet.appendRow(PRODUCT_HEADERS);
    const hr = sheet.getRange(1, 1, 1, PRODUCT_HEADERS.length);
    hr.setBackground("#1a0a12").setFontColor("#c9a45c").setFontWeight("bold");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 160);
    sheet.setColumnWidth(2, 220);
    sheet.setColumnWidth(5, 300);
  }
  return sheet;
}

function getCategorySheet() {
  const ss    = SpreadsheetApp.openById(requireProp("SHEET_ID"));
  let   sheet = ss.getSheetByName(CONFIG.CATEGORIES_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.CATEGORIES_SHEET_NAME);
    sheet.appendRow(CATEGORY_HEADERS);
    const hr = sheet.getRange(1, 1, 1, CATEGORY_HEADERS.length);
    hr.setBackground("#0a1a0a").setFontColor("#c9a45c").setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ─── AUDIT LOGGING ───────────────────────────────────────────────────────────

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
    Logger.log("AuditLog write failed: " + err.message);
  }
}

// ─── INPUT VALIDATION (ORDERS) ───────────────────────────────────────────────

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

  const digitsOnly = String(data.phone).replace(/[^\d]/g, "");
  if (digitsOnly.length < 7) {
    return { valid: false, error: "Invalid mobile number — must contain at least 7 digits." };
  }

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

// ─── VERIFY PIN ENDPOINT ─────────────────────────────────────────────────────

function handleVerifyPin(body) {
  const ok = verifyPin(body.pin);
  if (!ok) {
    writeAuditLog("VERIFY_PIN", "", "Failed PIN attempt from verifyPin endpoint", "FAIL");
    return { ok: false, error: "Incorrect PIN" };
  }
  writeAuditLog("VERIFY_PIN", "", "Successful PIN verification", "SUCCESS");
  return { ok: true };
}

function handleUpdatePin(body) {
  if (!verifyPin(body.pin)) {
    writeAuditLog("UPDATE_PIN", "", "Failed PIN attempt on updatePin", "FAIL");
    return { ok: false, error: "Incorrect current PIN" };
  }
  const newPin = String(body.newPin || "").trim();
  if (!newPin) return { ok: false, error: "New PIN is required" };
  if (newPin.length < 4) return { ok: false, error: "PIN must be at least 4 characters" };
  PropertiesService.getScriptProperties().setProperty("MANAGER_PIN", newPin);
  PropertiesService.getScriptProperties().setProperty("auth_fail_count", "0");
  writeAuditLog("UPDATE_PIN", "", "Manager PIN updated successfully", "SUCCESS");
  return { ok: true };
}

// ─── SUBMIT ORDER ─────────────────────────────────────────────────────────────

function handleSubmitOrder(data) {
  const v = validateOrderPayload(data);
  if (!v.valid) {
    Logger.log("Order rejected (validation): " + v.error + " | orderId=" + (data.orderId || "N/A"));
    writeAuditLog("SUBMIT_ORDER", data.orderId, "Validation failed: " + v.error, "REJECT");
    return { ok: false, error: v.error };
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);
  } catch (err) {
    Logger.log("Lock timeout for order " + data.orderId + ": " + err.message);
    return { ok: false, error: "Server is temporarily busy. Please try again in a moment." };
  }

  try {
    const sheet   = getOrderSheet();
    const allData = sheet.getDataRange().getValues();
    const headers = allData[0];
    const oidIdx  = headers.indexOf("Order ID");
    const stIdx   = headers.indexOf("Status");

    for (let i = 1; i < allData.length; i++) {
      if (String(allData[i][oidIdx]) === String(data.orderId)) {
        const existingStatus = allData[i][stIdx] || "Pending Verification";
        Logger.log("Duplicate order blocked: " + data.orderId);
        writeAuditLog("SUBMIT_ORDER", data.orderId, "Duplicate submission rejected", "DUPLICATE");
        return { ok: true, orderId: data.orderId, status: existingStatus, duplicate: true };
      }
    }

    let screenshotUrl = "";
    if (data.screenshotBase64) {
      try {
        screenshotUrl = saveScreenshotToDrive(data.orderId, data.screenshotBase64);
      } catch (err) {
        Logger.log("Drive screenshot upload failed for " + data.orderId + ": " + err.message);
      }
    }

    const status = (data.paymentMethod === "UPI") ? "Pending Verification" : "Confirmed – COD";

    // Decrement stock if product ID provided
    if (data.productId) {
      try {
        decrementStock(data.productId, data.quantity || 1);
      } catch (err) {
        Logger.log("Stock decrement failed for " + data.productId + ": " + err.message);
      }
    }

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

    writeAuditLog(
      "SUBMIT_ORDER",
      data.orderId,
      "Customer: " + data.customerName + " | Product: " + (data.productName || "—") + " | Payment: " + status,
      "SUCCESS"
    );

    try {
      sendOrderNotification(data, status, screenshotUrl);
    } catch (err) {
      Logger.log("Email notification failed for " + data.orderId + ": " + err.message);
    }

    return { ok: true, orderId: data.orderId, status };

  } finally {
    lock.releaseLock();
  }
}

// ─── STOCK DECREMENT ─────────────────────────────────────────────────────────

function decrementStock(productId, qty) {
  const sheet   = getProductSheet();
  const allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) return;

  const headers  = allData[0];
  const idIdx    = headers.indexOf("id");
  const stockIdx = headers.indexOf("stock");
  const statusIdx = headers.indexOf("status");

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idIdx]) === String(productId)) {
      const current = parseInt(allData[i][stockIdx], 10) || 0;
      const newStock = Math.max(0, current - (qty || 1));
      sheet.getRange(i + 1, stockIdx + 1).setValue(newStock);
      if (newStock === 0) {
        sheet.getRange(i + 1, statusIdx + 1).setValue("out-of-stock");
      }
      Logger.log("Stock decremented for " + productId + ": " + current + " → " + newStock);
      return;
    }
  }
}

// ─── GET ORDERS (AUTH-REQUIRED) ──────────────────────────────────────────────

function handleGetOrders(params) {
  if (!verifyPin(params.pin)) {
    Logger.log("Unauthorized getOrders attempt");
    writeAuditLog("GET_ORDERS", "", "Unauthorized access attempt", "FAIL");
    return unauthorized("PIN required to fetch orders");
  }

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
    try { obj["Selected Options"] = JSON.parse(obj["Selected Options"]); } catch (_) {}
    return obj;
  });

  const sf       = params.status;
  const filtered = (sf && sf !== "all") ? orders.filter(o => o["Status"] === sf) : orders;
  filtered.sort((a, b) => new Date(b["Created Date"]) - new Date(a["Created Date"]));

  writeAuditLog("GET_ORDERS", "", "Returned " + filtered.length + " orders", "SUCCESS");
  return corsResponse({ ok: true, orders: filtered });
}

// ─── UPDATE STATUS (AUTH-REQUIRED) ───────────────────────────────────────────

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
    const oidCol  = headers.indexOf("Order ID") + 1;
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

// ─── ROW STYLING (ORDERS) ────────────────────────────────────────────────────

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

// ─── DRIVE SCREENSHOT STORAGE ────────────────────────────────────────────────

function saveScreenshotToDrive(orderId, base64Data) {
  const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid base64 image format");

  const mimeType = match[1];
  const ext      = mimeType.split("/")[1] || "jpg";
  const bytes    = Utilities.base64Decode(match[2]);
  const blob     = Utilities.newBlob(bytes, mimeType, orderId + "-payment." + ext);

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

// ─── PRODUCTS: HELPERS ───────────────────────────────────────────────────────

const PRODUCT_JSON_FIELDS = [
  "images", "colors", "sizes", "features", "tags",
  "occasions", "suggestedProducts", "compatibleWith"
];

function rowsToProductObjects(headers, rows) {
  return rows.map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? row[i] : ""; });
    PRODUCT_JSON_FIELDS.forEach(f => {
      const v = obj[f];
      if (typeof v === "string" && v.trim()) {
        try { obj[f] = JSON.parse(v); }
        catch (_) { obj[f] = v.split("\n").map(s => s.trim()).filter(Boolean); }
      } else if (!Array.isArray(v)) {
        obj[f] = [];
      }
    });
    obj.featured      = obj.featured === true || obj.featured === "TRUE" || obj.featured === "true";
    obj.price         = parseFloat(obj.price)         || 0;
    obj.discountPrice = parseFloat(obj.discountPrice) || 0;
    obj.stock         = parseInt(obj.stock, 10)        || 0;
    return obj;
  });
}

function productObjectToRow(headers, obj) {
  return headers.map(h => {
    const v = obj[h];
    if (PRODUCT_JSON_FIELDS.includes(h)) return Array.isArray(v) ? JSON.stringify(v) : (v || "[]");
    if (typeof v === "boolean") return v;
    return v !== undefined && v !== null ? String(v) : "";
  });
}

function makeProductId(title) {
  return title.toLowerCase()
    .replace(/[^a-z0-9\s]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

// ─── PRODUCTS: GET ALL (public) ───────────────────────────────────────────────

function handleGetProducts(params) {
  const sheet   = getProductSheet();
  const allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) return corsResponse({ ok: true, products: [] });

  const headers  = allData[0];
  let   products = rowsToProductObjects(headers, allData.slice(1));

  if (params.status && params.status !== "all") {
    products = products.filter(p => p.status === params.status);
  }

  return corsResponse({ ok: true, products });
}

// ─── PRODUCTS: GET ONE (public) ───────────────────────────────────────────────

function handleGetProduct(params) {
  if (!params.id) return corsResponse({ ok: false, error: "id is required" });

  const sheet   = getProductSheet();
  const allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) return corsResponse({ ok: false, error: "Product not found" });

  const headers  = allData[0];
  const idIdx    = headers.indexOf("id");
  const slugIdx  = headers.indexOf("slug");

  for (let i = 1; i < allData.length; i++) {
    const rowId   = String(allData[i][idIdx]);
    const rowSlug = String(allData[i][slugIdx]);
    if (rowId === params.id || rowSlug === params.id) {
      const product = rowsToProductObjects(headers, [allData[i]])[0];
      return corsResponse({ ok: true, product });
    }
  }

  return corsResponse({ ok: false, error: "Product not found" });
}

// ─── PRODUCTS: ADD (PIN-protected) ────────────────────────────────────────────

function handleAddProduct(body) {
  if (!verifyPin(body.pin)) {
    writeAuditLog("ADD_PRODUCT", "", "Unauthorized attempt", "FAIL");
    return { ok: false, error: "Unauthorized" };
  }
  if (!body.product || !body.product.title) return { ok: false, error: "Product title is required" };

  const lock = LockService.getScriptLock();
  try { lock.waitLock(CONFIG.LOCK_TIMEOUT_MS); }
  catch (e) { return { ok: false, error: "Server busy — please retry" }; }

  try {
    const sheet   = getProductSheet();
    const allData = sheet.getDataRange().getValues();
    const headers = allData[0];
    const idIdx   = headers.indexOf("id");

    const product = body.product;
    let baseId = product.id || makeProductId(product.title);
    let finalId = baseId;
    const existing = allData.slice(1).map(r => String(r[idIdx]));
    let suffix = 1;
    while (existing.includes(finalId)) { finalId = baseId + "-" + (suffix++); }

    product.id        = finalId;
    product.slug      = product.slug || finalId;
    product.createdAt = product.createdAt || new Date().toISOString();
    product.updatedAt = new Date().toISOString();

    sheet.appendRow(productObjectToRow(headers, product));
    writeAuditLog("ADD_PRODUCT", product.id, "Added: " + product.title, "SUCCESS");
    return { ok: true, id: product.id };
  } finally { lock.releaseLock(); }
}

// ─── PRODUCTS: UPDATE (PIN-protected) ────────────────────────────────────────

function handleUpdateProduct(body) {
  if (!verifyPin(body.pin)) {
    writeAuditLog("UPDATE_PRODUCT", "", "Unauthorized attempt", "FAIL");
    return { ok: false, error: "Unauthorized" };
  }
  if (!body.product || !body.product.id) return { ok: false, error: "Product id is required" };

  const lock = LockService.getScriptLock();
  try { lock.waitLock(CONFIG.LOCK_TIMEOUT_MS); }
  catch (e) { return { ok: false, error: "Server busy — please retry" }; }

  try {
    const sheet   = getProductSheet();
    const allData = sheet.getDataRange().getValues();
    const headers = allData[0];
    const idIdx   = headers.indexOf("id");

    const product = body.product;
    product.updatedAt = new Date().toISOString();

    for (let i = 1; i < allData.length; i++) {
      if (String(allData[i][idIdx]) === String(product.id)) {
        sheet.getRange(i + 1, 1, 1, headers.length)
             .setValues([productObjectToRow(headers, product)]);
        writeAuditLog("UPDATE_PRODUCT", product.id, "Updated: " + product.title, "SUCCESS");
        return { ok: true };
      }
    }

    Logger.log("handleUpdateProduct: not found — " + product.id);
    return { ok: false, error: "Product not found" };
  } finally { lock.releaseLock(); }
}

// ─── PRODUCTS: DELETE (PIN-protected) ────────────────────────────────────────

function handleDeleteProduct(body) {
  if (!verifyPin(body.pin)) {
    writeAuditLog("DELETE_PRODUCT", body.id || "", "Unauthorized attempt", "FAIL");
    return { ok: false, error: "Unauthorized" };
  }
  if (!body.id) return { ok: false, error: "id is required" };

  const lock = LockService.getScriptLock();
  try { lock.waitLock(CONFIG.LOCK_TIMEOUT_MS); }
  catch (e) { return { ok: false, error: "Server busy — please retry" }; }

  try {
    const sheet   = getProductSheet();
    const allData = sheet.getDataRange().getValues();
    const headers = allData[0];
    const idIdx   = headers.indexOf("id");

    for (let i = 1; i < allData.length; i++) {
      if (String(allData[i][idIdx]) === String(body.id)) {
        sheet.deleteRow(i + 1);
        writeAuditLog("DELETE_PRODUCT", body.id, "Deleted product", "SUCCESS");
        return { ok: true };
      }
    }

    return { ok: false, error: "Product not found" };
  } finally { lock.releaseLock(); }
}

// ─── CATEGORIES: GET ALL (public) ─────────────────────────────────────────────

function handleGetCategories(params) {
  const sheet   = getCategorySheet();
  const allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) return corsResponse({ ok: true, categories: [] });

  const headers    = allData[0];
  const categories = allData.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });

  return corsResponse({ ok: true, categories });
}

// ─── CATEGORIES: ADD (PIN-protected) ──────────────────────────────────────────

function handleAddCategory(body) {
  if (!verifyPin(body.pin)) {
    writeAuditLog("ADD_CATEGORY", "", "Unauthorized attempt", "FAIL");
    return { ok: false, error: "Unauthorized" };
  }
  if (!body.category || !body.category.name) return { ok: false, error: "Category name is required" };

  const lock = LockService.getScriptLock();
  try { lock.waitLock(CONFIG.LOCK_TIMEOUT_MS); }
  catch (e) { return { ok: false, error: "Server busy — please retry" }; }

  try {
    const sheet = getCategorySheet();
    const cat   = body.category;
    if (!cat.id)   cat.id   = cat.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!cat.slug) cat.slug = cat.id;
    cat.createdAt = cat.createdAt || new Date().toISOString();

    const row = CATEGORY_HEADERS.map(h => cat[h] !== undefined ? String(cat[h]) : "");
    sheet.appendRow(row);
    writeAuditLog("ADD_CATEGORY", cat.id, "Added: " + cat.name, "SUCCESS");
    return { ok: true, id: cat.id };
  } finally { lock.releaseLock(); }
}

// ─── CATEGORIES: UPDATE (PIN-protected) ───────────────────────────────────────

function handleUpdateCategory(body) {
  if (!verifyPin(body.pin)) {
    writeAuditLog("UPDATE_CATEGORY", "", "Unauthorized attempt", "FAIL");
    return { ok: false, error: "Unauthorized" };
  }
  if (!body.category || !body.category.id) return { ok: false, error: "Category id is required" };

  const lock = LockService.getScriptLock();
  try { lock.waitLock(CONFIG.LOCK_TIMEOUT_MS); }
  catch (e) { return { ok: false, error: "Server busy — please retry" }; }

  try {
    const sheet   = getCategorySheet();
    const allData = sheet.getDataRange().getValues();
    const headers = allData[0];
    const idIdx   = headers.indexOf("id");
    const cat     = body.category;

    for (let i = 1; i < allData.length; i++) {
      if (String(allData[i][idIdx]) === String(cat.id)) {
        const row = CATEGORY_HEADERS.map(h => cat[h] !== undefined ? String(cat[h]) : "");
        sheet.getRange(i + 1, 1, 1, headers.length).setValues([row]);
        writeAuditLog("UPDATE_CATEGORY", cat.id, "Updated: " + cat.name, "SUCCESS");
        return { ok: true };
      }
    }

    return { ok: false, error: "Category not found" };
  } finally { lock.releaseLock(); }
}

// ─── CATEGORIES: DELETE (PIN-protected) ───────────────────────────────────────

function handleDeleteCategory(body) {
  if (!verifyPin(body.pin)) {
    writeAuditLog("DELETE_CATEGORY", body.id || "", "Unauthorized attempt", "FAIL");
    return { ok: false, error: "Unauthorized" };
  }
  if (!body.id) return { ok: false, error: "id is required" };

  const lock = LockService.getScriptLock();
  try { lock.waitLock(CONFIG.LOCK_TIMEOUT_MS); }
  catch (e) { return { ok: false, error: "Server busy — please retry" }; }

  try {
    const sheet   = getCategorySheet();
    const allData = sheet.getDataRange().getValues();
    const headers = allData[0];
    const idIdx   = headers.indexOf("id");

    for (let i = 1; i < allData.length; i++) {
      if (String(allData[i][idIdx]) === String(body.id)) {
        sheet.deleteRow(i + 1);
        writeAuditLog("DELETE_CATEGORY", body.id, "Deleted category", "SUCCESS");
        return { ok: true };
      }
    }

    return { ok: false, error: "Category not found" };
  } finally { lock.releaseLock(); }
}

// ─── SCRIPT PROPERTIES SETUP HELPER ─────────────────────────────────────────

function setupProperties() {
  PropertiesService.getScriptProperties().setProperties({
    MANAGER_PIN    : "Rajdeep@7123",
    SHEET_ID       : "125LTGCl9VJ-Gp4nGxv1Kh8sUek7rzNFeyO64RqB9QJA",
    OWNER_EMAIL    : "anubhav7123@gmail.com",
    DRIVE_FOLDER_ID: "",
    SITE_URL       : "https://anubhav536.github.io/RD-Advance-Boutique/",
  });
  Logger.log("Script Properties set successfully.");
}
