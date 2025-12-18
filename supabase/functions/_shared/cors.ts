// Allowed origins for CORS
const allowedOrigins = [
  // Desenvolvimento local
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:8080',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:8080',
  // PDV Total - Produção
  'https://pdvtotal.com',
  'https://www.pdvtotal.com',
  // PDV Slim - Produção
  'https://pdvslim.com',
  'https://www.pdvslim.com',
  'https://pdvslim.com.br',
  'https://www.pdvslim.com.br',
];

// Match dynamic domains (lovable + custom subdomains)
const dynamicDomainPatterns = [
  // Lovable domains
  /^https:\/\/[a-z0-9-]+\.lovable\.app$/,
  /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/,
  // PDV Total subdomains
  /^https:\/\/[a-z0-9-]+\.pdvtotal\.com$/,
  // PDV Slim subdomains
  /^https:\/\/[a-z0-9-]+\.pdvslim\.com$/,
  /^https:\/\/[a-z0-9-]+\.pdvslim\.com\.br$/,
];

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  
  const isAllowedOrigin = 
    allowedOrigins.includes(origin) ||
    dynamicDomainPatterns.some(pattern => pattern.test(origin));
  
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };
}

export function handleCorsPreflightRequest(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }
  return null;
}
