// ═══════════════════════════════════════════════════════════════
// RD ADVANCE BOUTIQUE — Google Apps Script Order System
// Paste this entire file into your Apps Script project.
// ═══════════════════════════════════════════════════════════════

// ─── STEP 1: FILL IN THESE VALUES ───────────────────────────────
const CONFIG = {
  SHEET_ID       : "YOUR_GOOGLE_SHEET_ID",        // From sheet URL: /d/SHEET_ID/edit
  SHEET_NAME     : "Orders",                       // Tab name inside the sheet
  OWNER_EMAIL    : "your@email.com",               // Email for order notifications
  DRIVE_FOLDER_ID: "",                             // Optional: Google Drive folder for screenshots
  STORE_NAME     : "RD Advance Boutique",
  MANAGER_PIN    : "1234",                         // PIN for manage.html access (change this!)
  SITE_URL       : "https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPO_NAME",
};

// ─── CORS HELPER ─────────────────────────────────────────────────
function corsResponse(data) {
  const output = ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ─── ROUTER ──────────────────────────────────────────────────────
function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents);
    const action = body.action || "";

    if (action === "submitOrder")    return corsResponse(handleSubmitOrder(body));
    if (action === "updateStatus")   return corsResponse(handleUpdateStatus(body));
    if (action === "verifyPin")      return corsResponse(handleVerifyPin(body));

    return corsResponse({ ok: false, error: "Unknown action: " + action });
  } catch (err) {
    return corsResponse({ ok: false, error: err.message });
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action || "";
    if (action === "getOrders")  return corsResponse(handleGetOrders(e.parameter));
    if (action === "ping")       return corsResponse({ ok: true, store: CONFIG.STORE_NAME });
    return corsResponse({ ok: false, error: "Unknown action: " + action });
  } catch (err) {
    return corsResponse({ ok: false, error: err.message });
  }
}

// ─── SHEET SETUP ─────────────────────────────────────────────────
const HEADERS = [
  "Order ID", "Created Date", "Status",
  "Product ID", "Product Name", "Product URL", "Quantity",
  "Selected Options",
  "Customer Name", "Mobile Number", "Address", "City", "State", "Pincode",
  "Payment Method", "UTR Number", "Amount Paid", "Screenshot URL",
  "Notes",
];

function getSheet() {
  const ss    = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  let   sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    sheet.appendRow(HEADERS);
    // Format header row
    const hRange = sheet.getRange(1, 1, 1, HEADERS.length);
    hRange.setBackground("#2d1c12").setFontColor("#c9a45c").setFontWeight("bold");
    sheet.setFrozenRows(1);
    // Set column widths
    sheet.setColumnWidth(1, 130); // Order ID
    sheet.setColumnWidth(2, 160); // Date
    sheet.setColumnWidth(3, 160); // Status
    sheet.setColumnWidth(8, 240); // Options
    sheet.setColumnWidth(11, 240); // Address
  }
  return sheet;
}

// ─── VERIFY PIN ───────────────────────────────────────────────────
function handleVerifyPin(body) {
  if (String(body.pin) === String(CONFIG.MANAGER_PIN)) {
    return { ok: true };
  }
  return { ok: false, error: "Incorrect PIN" };
}

// ─── SUBMIT ORDER ─────────────────────────────────────────────────
function handleSubmitOrder(data) {
  const sheet = getSheet();

  // Save screenshot to Drive (if provided)
  let screenshotUrl = "";
  if (data.screenshotBase64) {
    screenshotUrl = saveScreenshotToDrive(data.orderId, data.screenshotBase64);
  }

  // Determine initial status
  const status = data.paymentMethod === "UPI"
    ? "Pending Verification"
    : "Confirmed – COD";

  // Build row matching HEADERS order
  const row = [
    data.orderId        || "",
    data.createdAt      || new Date().toLocaleString("en-IN"),
    status,
    data.productId      || "",
    data.productName    || "",
    data.productUrl     || "",
    data.quantity       || 1,
    JSON.stringify(data.selectedOptions || {}),
    data.customerName   || "",
    data.phone          || "",
    data.address        || "",
    data.city           || "",
    data.state          || "",
    data.pincode        || "",
    data.paymentMethod  || "",
    data.utrNumber      || "",
    data.amountPaid     || "",
    screenshotUrl,
    data.notes          || "",
  ];

  sheet.appendRow(row);

  // Color-code the new row by status
  styleNewRow(sheet, status);

  // Send email notification
  try { sendOrderNotification(data, status, screenshotUrl); } catch (_) {}

  return { ok: true, orderId: data.orderId, status };
}

function styleNewRow(sheet, status) {
  const row       = sheet.getLastRow();
  const range     = sheet.getRange(row, 1, 1, HEADERS.length);
  const colorMap  = {
    "Pending Verification" : "#fff3cd",
    "Confirmed – COD"      : "#d4edda",
    "Verified"             : "#cce5ff",
    "Completed"            : "#d6f5d6",
    "Cancelled"            : "#f8d7da",
    "Rejected"             : "#f8d7da",
  };
  const bg = colorMap[status] || "#ffffff";
  range.setBackground(bg);
}

// ─── SAVE SCREENSHOT TO DRIVE ─────────────────────────────────────
function saveScreenshotToDrive(orderId, base64Data) {
  try {
    const match    = base64Data.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return "";
    const mimeType = match[1];
    const ext      = mimeType.split("/")[1] || "jpg";
    const bytes    = Utilities.base64Decode(match[2]);
    const blob     = Utilities.newBlob(bytes, mimeType, orderId + "-payment." + ext);

    let folder;
    if (CONFIG.DRIVE_FOLDER_ID) {
      folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
    } else {
      const it = DriveApp.getFoldersByName("RD Boutique – Payment Screenshots");
      folder = it.hasNext() ? it.next() : DriveApp.createFolder("RD Boutique – Payment Screenshots");
    }

    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (err) {
    Logger.log("Drive upload error: " + err.message);
    return "";
  }
}

// ─── GET ORDERS ───────────────────────────────────────────────────
function handleGetOrders(params) {
  const sheet = getSheet();
  const data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return { ok: true, orders: [] };

  const headers = data[0];
  const orders  = data.slice(1).map((row, i) => {
    const obj = {};
    headers.forEach((h, j) => { obj[h] = row[j]; });
    obj._row = i + 2;

    // Parse selectedOptions JSON
    try { obj["Selected Options"] = JSON.parse(obj["Selected Options"]); }
    catch (_) {}

    return obj;
  });

  const sf       = params.status;
  const filtered = (sf && sf !== "all")
    ? orders.filter(o => o["Status"] === sf)
    : orders;

  filtered.sort((a, b) =>
    new Date(b["Created Date"]) - new Date(a["Created Date"])
  );

  return { ok: true, orders: filtered };
}

// ─── UPDATE STATUS ────────────────────────────────────────────────
function handleUpdateStatus(body) {
  const { orderId, status, pin } = body;
  if (String(pin) !== String(CONFIG.MANAGER_PIN)) {
    return { ok: false, error: "Unauthorized" };
  }

  const sheet   = getSheet();
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const oidCol  = headers.indexOf("Order ID") + 1;
  const stCol   = headers.indexOf("Status") + 1;

  for (let i = 1; i < data.length; i++) {
    if (data[i][oidCol - 1] === orderId) {
      sheet.getRange(i + 1, stCol).setValue(status);
      styleRowAt(sheet, i + 1, status);
      return { ok: true };
    }
  }
  return { ok: false, error: "Order not found" };
}

function styleRowAt(sheet, rowNum, status) {
  const colorMap = {
    "Pending Verification" : "#fff3cd",
    "Confirmed – COD"      : "#d4edda",
    "Verified"             : "#cce5ff",
    "Completed"            : "#d6f5d6",
    "Cancelled"            : "#f8d7da",
    "Rejected"             : "#f8d7da",
  };
  sheet.getRange(rowNum, 1, 1, HEADERS.length)
       .setBackground(colorMap[status] || "#ffffff");
}

// ─── EMAIL NOTIFICATION ───────────────────────────────────────────
function sendOrderNotification(data, status, screenshotUrl) {
  const optLines = Object.entries(data.selectedOptions || {})
    .map(([k, v]) => "  • " + k + ": " + v).join("\n");

  const manageUrl = CONFIG.SITE_URL + "/manage.html";

  const body = [
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "🛍️  NEW ORDER — " + CONFIG.STORE_NAME,
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "",
    "Order ID : " + data.orderId,
    "Date     : " + (data.createdAt || new Date().toLocaleString("en-IN")),
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
    data.utrNumber  ? "UTR      : " + data.utrNumber      : "",
    data.amountPaid ? "Amount   : ₹" + data.amountPaid    : "",
    screenshotUrl   ? "Screenshot: " + screenshotUrl       : "",
    data.notes      ? "\nNotes: " + data.notes             : "",
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "Manage orders: " + manageUrl,
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  ].filter(v => v !== null).join("\n");

  GmailApp.sendEmail(
    CONFIG.OWNER_EMAIL,
    "🛍️ New Order " + data.orderId + " — " + CONFIG.STORE_NAME,
    body
  );
}
