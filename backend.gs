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

function doGet(e) {
  // Soporte para JSONP si fuera necesario, aunque fetch standard es preferible
  if (e.parameter.callback) {
    const res = getAppData();
    return ContentService.createTextOutput(e.parameter.callback + '(' + JSON.stringify(res) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return HtmlService.createHtmlOutput('Kora API Active').setTitle('Kora Backend');
}

function doPost(e) {
  let request;
  try {
    request = JSON.parse(e.postData.contents);
  } catch (err) {
    return createJsonResponse({ error: "Invalid JSON" });
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
      default: result = { error: "Action '" + action + "' not recognized" };
    }
  } catch (err) {
    result = { error: err.message };
  }

  return createJsonResponse(result);
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function setupDatabase() {
  Object.values(SHEETS).forEach(name => {
    if (!SS.getSheetByName(name)) SS.insertSheet(name);
  });

  const tSheet = SS.getSheetByName(SHEETS.TRANSACTIONS);
  if (tSheet.getLastRow() === 0) {
    tSheet.appendRow(['ID', 'Fecha', 'Concepto', 'Monto', 'Moneda', 'Categoria', 'Cuenta Origen', 'Cuenta Destino', 'Tipo', 'Compartido', 'Responsable', 'Saldado']);
  }

  const aSheet = SS.getSheetByName(SHEETS.ACCOUNTS);
  if (aSheet.getLastRow() === 0) {
    aSheet.appendRow(['ID', 'Nombre', 'Tipo', 'Saldo', 'Moneda', 'Cierre', 'Vencimiento']);
  }
  
  const bSheet = SS.getSheetByName(SHEETS.BUDGETS);
  if (bSheet.getLastRow() === 0) {
    bSheet.appendRow(['Categoria', 'Limite']);
  }
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
    if (data[i][0] === t.id) { rowIdx = i + 1; break; }
  }

  const vals = [
    t.id, t.date, t.concept, t.amount, t.currency, 
    t.category || 'Varios', t.sourceAccount, t.destinationAccount || '', 
    t.type, t.isShared ? 'SI' : 'NO', t.paidBy || 'Yo', t.isSettled ? 'SI' : 'NO'
  ];

  if (rowIdx !== -1) sheet.getRange(rowIdx, 1, 1, vals.length).setValues([vals]);
  else sheet.appendRow(vals);
  return { success: true };
}

function saveAccount(acc) {
  setupDatabase();
  const sheet = SS.getSheetByName(SHEETS.ACCOUNTS);
  const data = sheet.getDataRange().getValues();
  let rowIdx = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === acc.id) { rowIdx = i + 1; break; }
  }
  const vals = [acc.id, acc.name, acc.type, acc.balance, acc.currency, acc.closingDate || '', acc.dueDate || ''];
  if (rowIdx !== -1) sheet.getRange(rowIdx, 1, 1, 7).setValues([vals]);
  else sheet.appendRow(vals);
  return { success: true };
}

function saveCategories(categories) {
  setupDatabase();
  const sheet = SS.getSheetByName(SHEETS.CATEGORIES);
  sheet.clear();
  sheet.appendRow(['Nombre']);
  categories.filter(c => c).forEach(c => sheet.appendRow([c]));
  return { success: true };
}

function saveBudgets(budgets) {
  setupDatabase();
  const sheet = SS.getSheetByName(SHEETS.BUDGETS);
  sheet.clear();
  sheet.appendRow(['Categoria', 'Limite']);
  budgets.forEach(b => sheet.appendRow([b.category, b.limit]));
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