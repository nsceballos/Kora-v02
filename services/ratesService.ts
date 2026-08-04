import { UsdRates } from '../types';

/**
 * Kora Rates Service - cotización del dólar automática.
 *
 * Trae los valores de dolarapi.com (API pública, sin credenciales, con CORS
 * habilitado, así que se llama directo desde el navegador). Se usa el valor
 * de **venta**, que es la cotización de referencia habitual.
 *
 * La última cotización buena queda cacheada en localStorage: si la API está
 * caída o no hay conexión, la app sigue funcionando con ese último valor en
 * vez de quedarse sin cotización.
 */

const API_URL = 'https://dolarapi.com/v1/dolares';
const CACHE_KEY = 'kora_usd_rates';

/** Se considera fresca durante 30 minutos; después se vuelve a consultar. */
const MAX_AGE_MS = 30 * 60 * 1000;

/**
 * Último recurso: solo se usan si la API falla Y no hay nada cacheado (por
 * ejemplo, la primera vez que se abre la app sin conexión). `updatedAt: ''`
 * marca que no son valores reales, para que la UI lo avise.
 */
export const FALLBACK_RATES: UsdRates = { official: 980, blue: 1240, updatedAt: '' };

interface DolarApiEntry {
  casa?: string;
  venta?: number;
}

function readCache(): UsdRates | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.official === 'number' && typeof parsed?.blue === 'number' && parsed.official > 0 && parsed.blue > 0) {
      return { official: parsed.official, blue: parsed.blue, updatedAt: String(parsed.updatedAt || '') };
    }
  } catch {}
  return null;
}

function writeCache(rates: UsdRates) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(rates));
  } catch {}
}

function isFresh(rates: UsdRates | null): boolean {
  if (!rates?.updatedAt) return false;
  const age = Date.now() - new Date(rates.updatedAt).getTime();
  return Number.isFinite(age) && age >= 0 && age < MAX_AGE_MS;
}

export const ratesService = {
  /** Cotización cacheada (o los valores de respaldo si nunca se pudo traer una). */
  getCached(): UsdRates {
    return readCache() ?? FALLBACK_RATES;
  },

  /** Consulta la API. Lanza un Error si falla o si la respuesta no trae ambas cotizaciones. */
  async fetchFresh(): Promise<UsdRates> {
    const response = await fetch(API_URL, { headers: { 'Accept': 'application/json' } });
    if (!response.ok) throw new Error(`No se pudo obtener la cotización (HTTP ${response.status}).`);

    const list: DolarApiEntry[] = await response.json();
    if (!Array.isArray(list)) throw new Error('Respuesta inesperada de la API de cotizaciones.');

    const pick = (casa: string): number => {
      const value = list.find(e => e?.casa === casa)?.venta;
      return typeof value === 'number' && value > 0 ? value : 0;
    };

    const official = pick('oficial');
    const blue = pick('blue');
    if (!official || !blue) throw new Error('La API no devolvió las cotizaciones oficial y blue.');

    const rates: UsdRates = { official, blue, updatedAt: new Date().toISOString() };
    writeCache(rates);
    return rates;
  },

  /**
   * Cotización lista para usar. Devuelve la cacheada si sigue fresca; si no,
   * consulta la API y, ante un fallo, cae de nuevo al último valor conocido.
   */
  async load(force = false): Promise<UsdRates> {
    const cached = readCache();
    if (!force && isFresh(cached)) return cached!;

    try {
      return await this.fetchFresh();
    } catch (e) {
      console.warn('No se pudo actualizar la cotización del dólar:', e);
      return cached ?? FALLBACK_RATES;
    }
  },
};
