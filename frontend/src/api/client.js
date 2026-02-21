const BASE = '/api';

function getToken() { return localStorage.getItem('fleet_token'); }

async function req(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  };
  const res = await fetch(BASE + path, opts);
  if (res.status === 401) { localStorage.removeItem('fleet_token'); window.location.href = '/login'; }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error');
  return data;
}

export const api = {
  get: (p) => req('GET', p),
  post: (p, b) => req('POST', p, b),
  put: (p, b) => req('PUT', p, b),
  delete: (p) => req('DELETE', p),

  // Auth
  login: (u, p) => req('POST', '/auth/login', { username: u, password: p }),

  // Dashboard
  dashVehicles: () => req('GET', '/dashboard/vehicles'),
  dashAlerts: () => req('GET', '/dashboard/alerts'),
  dashStats: () => req('GET', '/dashboard/stats'),
  dashFinancial: (year) => req('GET', `/dashboard/financial?year=${year}`),

  // Vehicles
  vehicles: (params='') => req('GET', `/vehicles${params}`),
  vehicle: (id) => req('GET', `/vehicles/${id}`),
  createVehicle: (d) => req('POST', '/vehicles', d),
  updateVehicle: (id, d) => req('PUT', `/vehicles/${id}`, d),
  deleteVehicle: (id) => req('DELETE', `/vehicles/${id}`),

  // Employees
  employees: () => req('GET', '/employees'),
  createEmployee: (d) => req('POST', '/employees', d),
  updateEmployee: (id, d) => req('PUT', `/employees/${id}`, d),
  deleteEmployee: (id) => req('DELETE', `/employees/${id}`),

  // Maintenance
  maintenance: (params='') => req('GET', `/maintenance${params}`),
  createMaintenance: (d) => req('POST', '/maintenance', d),
  updateMaintenance: (id, d) => req('PUT', `/maintenance/${id}`, d),
  deleteMaintenance: (id) => req('DELETE', `/maintenance/${id}`),

  // Inspections
  inspections: (params='') => req('GET', `/inspections${params}`),
  createInspection: (d) => req('POST', '/inspections', d),
  updateInspection: (id, d) => req('PUT', `/inspections/${id}`, d),
  deleteInspection: (id) => req('DELETE', `/inspections/${id}`),

  // Insurance
  policies: (params='') => req('GET', `/insurance${params}`),
  policy: (id) => req('GET', `/insurance/${id}`),
  createPolicy: (d) => req('POST', '/insurance', d),
  updatePolicy: (id, d) => req('PUT', `/insurance/${id}`, d),
  deletePolicy: (id) => req('DELETE', `/insurance/${id}`),
  updatePayment: (polId, payId, d) => req('PUT', `/insurance/${polId}/payments/${payId}`, d),

  // Fuel
  fuelInvoices: () => req('GET', '/fuel/invoices'),
  fuelInvoice: (id) => req('GET', `/fuel/invoices/${id}`),
  createFuelInvoice: (d) => req('POST', '/fuel/invoices', d),
  importFuelLines: (id, lines, replace) => req('POST', `/fuel/invoices/${id}/import-lines`, { lines, replace }),
  fuelCards: (params='') => req('GET', `/fuel/cards${params}`),
  createFuelCard: (d) => req('POST', '/fuel/cards', d),
  updateFuelCard: (id, d) => req('PUT', `/fuel/cards/${id}`, d),

  // Settings
  garages: () => req('GET', '/garages'),
  createGarage: (d) => req('POST', '/garages', d),
  updateGarage: (id, d) => req('PUT', `/garages/${id}`, d),
  securityCompanies: () => req('GET', '/security-companies'),
  paymentMethods: () => req('GET', '/payment-methods'),
  createPaymentMethod: (d) => req('POST', '/payment-methods', d),
  dieselRefunds: () => req('GET', '/diesel-refunds'),

  // Finance
  financeMonthly: (year, month) => req('GET', `/dashboard/monthly?year=${year}&month=${month}`),

  // Operator Licenses
  operatorLicenses: () => req('GET', '/operator-licenses'),
  createOperatorLicense: (d) => req('POST', '/operator-licenses', d),
  updateOperatorLicense: (id, d) => req('PUT', `/operator-licenses/${id}`, d),
  deleteOperatorLicense: (id) => req('DELETE', `/operator-licenses/${id}`),
};
