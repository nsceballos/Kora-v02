/**
 * Kora Backend - Google Apps Script
 */

const SS = SpreadsheetApp.getActiveSpreadsheet();
const SHEETS = {
  TRANSACTIONS: 'Transacciones',
  ACCOUNTS: 'Cuentas',
  CATEGORIES: 'Categorias',
  BUDGETS: 'Presupuestos'
};

/**
 * GET Handler
 */
function doGet(e) {
  // Manejo robusto de parámetros inexistentes
  if (!e || !e.parameter) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'active', message: 'Kora API is running' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // JSONP Callback
  if (e.parameter.callback) {
    const res = getAppData();
    return ContentService.createTextOutput(e.parameter.callback + '(' + JSON.stringify(res) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  // Default GET
  return ContentService.createTextOutput(JSON.stringify(getAppData()))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * POST Handler
 */
function doPost(e) {
  let request;
  
  // Parseo seguro del body
  try {
    if (e && e.postData && e.postData.contents) {
      request = JSON.parse(e.postData.contents);
    } else {
      throw new Error("No data received");
    }
  } catch (err) {
    return createJsonResponse({ error: "Invalid JSON", details: err.message });
  }

  const { action, data } = request;
  let result = { success: false };

  try {
    switch (action) {
      case 'getAppData': result = getAppData(); break;
      case 'saveTransaction': result = saveTransaction(data); break;
      case 'saveAccount': result = saveAccount(data); break;
      case 'saveCategories': result = saveCategories(data); break;
      case 'saveBudgets': result = saveBudgets(data); break;
      case 'deleteTransaction': result = deleteRow(SHEETS.TRANSACTIONS, data.id); break;
      case 'deleteAccount': result = deleteRow(SHEETS.ACCOUNTS, data.id); break;
      default: result = { error: "Action '" + action + "' not recognized" };
    }
  } catch (err) {
    result = { error: err.message, stack: err.stack };
  }

  return createJsonResponse(result);
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// --- Database Logic ---

function setupDatabase() {
  Object.values(SHEETS).forEach(name => {
    if (!SS.getSheetByName(name)) SS.insertSheet(name);
  });
  
  initSheet(SHEETS.TRANSACTIONS, ['ID', 'Fecha', 'Concepto', 'Monto', 'Moneda', 'Categoria', 'Cuenta Origen', 'Cuenta Destino', 'Tipo', 'Compartido', 'Responsable', 'Saldado']);
  initSheet(SHEETS.ACCOUNTS, ['ID', 'Nombre', 'Tipo', 'Saldo', 'Moneda', 'Cierre', 'Vencimiento']);
  initSheet(SHEETS.BUDGETS, ['Categoria', 'Limite']);
}

function initSheet(name, headers) {
  const sheet = SS.getSheetByName(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
}

function getAppData() {
  setupDatabase();
  return {
    transactions: getSheetData(SHEETS.TRANSACTIONS),
    accounts: getSheetData(SHEETS.ACCOUNTS),
    categories: getSheetData(SHEETS.CATEGORIES).map(r => r.nombre || r.Nombre),
    budgets: getSheetData(SHEETS.BUDGETS)
  };
}

function saveTransaction(t) {
  setupDatabase();
  const sheet = SS.getSheetByName(SHEETS.TRANSACTIONS);
  const data = sheet.getDataRange().getValues();
  let rowIdx = -1;
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(t.id)) { rowIdx = i + 1; break; }
  }

  const vals = [
    t.id, t.date, t.concept, t.amount, t.currency, 
    t.category || 'Varios', t.sourceAccount, t.destinationAccount || '', 
    t.type, t.isShared ? 'SI' : 'NO', t.paidBy || '', t.isSettled ? 'SI' : 'NO'
  ];

  if (rowIdx !== -1) sheet.getRange(rowIdx, 1, 1, vals.length).setValues([vals]);
  else sheet.appendRow(vals);
  return { success: true, id: t.id };
}

function saveAccount(acc) {
  setupDatabase();
  const sheet = SS.getSheetByName(SHEETS.ACCOUNTS);
  const data = sheet.getDataRange().getValues();
  let rowIdx = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(acc.id)) { rowIdx = i + 1; break; }
  }
  const vals = [acc.id, acc.name, acc.type, acc.balance, acc.currency, acc.closingDate || '', acc.dueDate || ''];
  if (rowIdx !== -1) sheet.getRange(rowIdx, 1, 1, vals.length).setValues([vals]);
  else sheet.appendRow(vals);
  return { success: true, id: acc.id };
}

function saveCategories(categories) {
  setupDatabase();
  const sheet = SS.getSheetByName(SHEETS.CATEGORIES);
  sheet.clear();
  sheet.appendRow(['Nombre']);
  if (categories && categories.length) {
    categories.filter(c => c).forEach(c => sheet.appendRow([c]));
  }
  return { success: true };
}

function saveBudgets(budgets) {
  setupDatabase();
  const sheet = SS.getSheetByName(SHEETS.BUDGETS);
  sheet.clear();
  sheet.appendRow(['Categoria', 'Limite']);
  if (budgets && budgets.length) {
    budgets.forEach(b => sheet.appendRow([b.category, b.limit]));
  }
  return { success: true };
}

function getSheetData(sheetName) {
  const sheet = SS.getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => {
      let val = row[i];
      if (h === 'Compartido' || h === 'Saldado') val = (val === 'SI');
      if (val instanceof Date) val = val.toISOString().split('T')[0];
      obj[toCamelCase(h)] = val;
    });
    return obj;
  });
}

function toCamelCase(str) {
  const map = {
    'ID': 'id', 'Fecha': 'date', 'Concepto': 'concept', 'Monto': 'amount',
    'Moneda': 'currency', 'Categoria': 'category', 'Cuenta Origen': 'sourceAccount',
    'Cuenta Destino': 'destinationAccount', 'Tipo': 'type', 'Compartido': 'isShared',
    'Responsable': 'paidBy', 'Saldado': 'isSettled', 'Nombre': 'name',
    'Saldo': 'balance', 'Cierre': 'closingDate', 'Vencimiento': 'dueDate', 'Limite': 'limit'
  };
  return map[str] || str.toLowerCase().replace(/\s/g, '');
}

function deleteRow(sheetName, id) {
  const sheet = SS.getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: 'Row not found' };
}