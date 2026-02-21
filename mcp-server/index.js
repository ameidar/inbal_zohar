#!/usr/bin/env node
/**
 * MCP Server — Fleet Management System
 * Connects Claude Desktop to the fleet management API.
 *
 * Config (env vars or .env):
 *   FLEET_API_URL  — e.g. http://129.159.133.209:3010
 *   FLEET_API_KEY  — X-API-Key value
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

// ── Config ──────────────────────────────────────────────────────────────────
const BASE_URL = (process.env.FLEET_API_URL || 'http://129.159.133.209:3010').replace(/\/$/, '');
const API_KEY  = process.env.FLEET_API_KEY  || '';

// ── API helper ───────────────────────────────────────────────────────────────
async function api(path, params = {}) {
  const url = new URL(`${BASE_URL}/api/v1${path}`);
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') url.searchParams.set(k, v); });

  const res = await fetch(url.toString(), { headers: { 'X-API-Key': API_KEY } });
  if (!res.ok) throw new Error(`Fleet API ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Tool definitions ─────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: 'fleet_get_summary',
    description: 'Get a dashboard summary: vehicle counts by status, upcoming maintenance (next 30 days), expiring insurance policies (next 60 days), and recent failed inspections.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'fleet_list_vehicles',
    description: 'List all vehicles in the fleet. Filter by status (פעיל/מושבת/נמכר), asset_type (מכונית/משאית/נגרר), or free-text search (q).',
    inputSchema: {
      type: 'object',
      properties: {
        status:     { type: 'string', description: 'Filter by status: פעיל, מושבת, נמכר, בהקפאה' },
        asset_type: { type: 'string', description: 'Filter by type: מכונית, משאית, נגרר, צמ"ה, כלי תפעולי' },
        q:          { type: 'string', description: 'Free-text search (vehicle number, nickname, manufacturer)' },
      },
    },
  },
  {
    name: 'fleet_get_vehicle',
    description: 'Get full details of a single vehicle: info, assigned employees, maintenance history, inspections, insurance policies.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Vehicle ID (internal DB id)' },
      },
      required: ['id'],
    },
  },
  {
    name: 'fleet_list_maintenance',
    description: 'List maintenance records. Filter by vehicle_id, status, or date range (from/to as YYYY-MM-DD).',
    inputSchema: {
      type: 'object',
      properties: {
        vehicle_id: { type: 'number', description: 'Filter by vehicle ID' },
        status:     { type: 'string', description: 'Filter by status: ממתין, בתהליך, הושלם' },
        from:       { type: 'string', description: 'From date YYYY-MM-DD' },
        to:         { type: 'string', description: 'To date YYYY-MM-DD' },
      },
    },
  },
  {
    name: 'fleet_list_inspections',
    description: 'List vehicle inspections. Filter by vehicle_id or date range.',
    inputSchema: {
      type: 'object',
      properties: {
        vehicle_id: { type: 'number', description: 'Filter by vehicle ID' },
        from:       { type: 'string', description: 'From date YYYY-MM-DD' },
        to:         { type: 'string', description: 'To date YYYY-MM-DD' },
      },
    },
  },
  {
    name: 'fleet_list_insurance',
    description: 'List insurance policies. Filter by vehicle_id or status (פעילה/לא פעילה).',
    inputSchema: {
      type: 'object',
      properties: {
        vehicle_id: { type: 'number', description: 'Filter by vehicle ID' },
        status:     { type: 'string', description: 'Filter by status: פעילה' },
      },
    },
  },
  {
    name: 'fleet_list_employees',
    description: 'List employees. Filter by active status or search by name/phone.',
    inputSchema: {
      type: 'object',
      properties: {
        active: { type: 'boolean', description: 'Filter active (true) or inactive (false)' },
        q:      { type: 'string',  description: 'Search by name, ID number, or phone' },
      },
    },
  },
  {
    name: 'fleet_list_fuel_cards',
    description: 'List fuel cards, optionally filtered by vehicle.',
    inputSchema: {
      type: 'object',
      properties: {
        vehicle_id: { type: 'number', description: 'Filter by vehicle ID' },
      },
    },
  },
];

// ── Server ────────────────────────────────────────────────────────────────────
const server = new Server(
  { name: 'fleet-management', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;

  try {
    let result;

    switch (name) {
      case 'fleet_get_summary':
        result = await api('/summary');
        break;

      case 'fleet_list_vehicles':
        result = await api('/vehicles', { status: args.status, asset_type: args.asset_type, q: args.q });
        break;

      case 'fleet_get_vehicle':
        result = await api(`/vehicles/${args.id}`);
        break;

      case 'fleet_list_maintenance':
        result = await api('/maintenance', { vehicle_id: args.vehicle_id, status: args.status, from: args.from, to: args.to });
        break;

      case 'fleet_list_inspections':
        result = await api('/inspections', { vehicle_id: args.vehicle_id, from: args.from, to: args.to });
        break;

      case 'fleet_list_insurance':
        result = await api('/insurance', { vehicle_id: args.vehicle_id, status: args.status });
        break;

      case 'fleet_list_employees':
        result = await api('/employees', { active: args.active, q: args.q });
        break;

      case 'fleet_list_fuel_cards':
        result = await api('/fuel-cards', { vehicle_id: args.vehicle_id });
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!API_KEY) {
    console.error('[fleet-mcp] WARNING: FLEET_API_KEY is not set');
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[fleet-mcp] Fleet Management MCP server running');
}

main().catch(err => {
  console.error('[fleet-mcp] Fatal:', err);
  process.exit(1);
});
