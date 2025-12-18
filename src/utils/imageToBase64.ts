/**
 * Cache em memória para logos (URL -> base64)
 * Evita fetch a cada impressão
 */
const logoCache = new Map<string, { base64: string; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutos de validade

/**
 * Limpa todo o cache de logos
 */
export function clearLogoCache(): void {
  logoCache.clear();
}

/**
 * Invalida uma URL específica do cache
 */
export function invalidateLogoCache(url: string): void {
  logoCache.delete(url);
}

/**
 * Extrai apenas o base64 puro de um data URL (remove o prefixo data:image/...;base64,)
 */
export function extractBase64Data(dataUrl: string): string {
  const base64Marker = ';base64,';
  const index = dataUrl.indexOf(base64Marker);
  return index !== -1 ? dataUrl.slice(index + base64Marker.length) : dataUrl;
}

/**
 * Redimensiona uma imagem para largura máxima especificada
 * Retorna o dataURL redimensionado
 */
export async function resizeImage(dataUrl: string, maxWidth: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Se a imagem já é menor que maxWidth, retorna original
      if (img.width <= maxWidth) {
        resolve(dataUrl);
        return;
      }
      
      const canvas = document.createElement('canvas');
      const scale = maxWidth / img.width;
      canvas.width = maxWidth;
      canvas.height = img.height * scale;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load image for resize'));
    img.src = dataUrl;
  });
}

/**
 * Fetches an image from URL and converts it to base64 data URI
 * Used for printing images via ESC/POS on thermal printers
 */
export async function imageUrlToBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error('Failed to fetch image:', response.status, response.statusText);
      return null;
    }
    
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => {
        console.error('FileReader error:', reader.error);
        reject(reader.error);
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting image to base64:', error);
    return null;
  }
}

/**
 * Versão com cache do imageUrlToBase64
 * Armazena em memória por 30 minutos para evitar fetch repetido
 */
export async function imageUrlToBase64Cached(url: string): Promise<string | null> {
  // Verificar cache válido
  const cached = logoCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('Logo loaded from cache');
    return cached.base64;
  }
  
  // Cache miss ou expirado - buscar da rede
  const base64 = await imageUrlToBase64(url);
  
  if (base64) {
    // Armazenar no cache
    logoCache.set(url, { base64, timestamp: Date.now() });
    console.log('Logo fetched and cached');
  }
  
  return base64;
}
