function setting(name: string, fallback?: string): string {
  const value: unknown = import.meta.env[name] ?? fallback;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Set ${name} in .env.local; see .env.example.`);
  }
  return value;
}

export const config = {
  ovokBaseUrl: setting("VITE_OVOK_API_BASE_URL", "https://api.sandbox.ovok.com"),
  tenantCode: setting("VITE_OVOK_TENANT_CODE"),
  supabaseUrl: setting("VITE_SUPABASE_URL", "http://127.0.0.1:54321"),
  stationName: setting("VITE_STATION_NAME", "Measurement station"),
};
