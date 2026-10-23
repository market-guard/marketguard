import { createHash } from 'node:crypto';
import { z } from 'zod';

const photo = z.string().max(2048).refine(value => {
  if (/^\/images\/[a-z\d-]+\.(jpg|png|webp|svg)$/i.test(value)) return true;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}, 'Photos must be HTTPS URLs.');
const resultSchema = z.object({
  prediction: z.enum(['fraud', 'trustworthy']),
  confidence: z.number().min(0).max(1),
  details: z.object({
    title: z.string().min(1).max(200),
    price: z.number().nonnegative().nullable(),
    currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
    year: z.number().int().min(1900).max(2100).nullable().default(null),
    mileage: z.number().nonnegative().nullable().default(null),
    location: z.string().max(200).default('Not provided'),
    transmission: z.string().max(100).default('Not provided'),
    seller_name: z.string().max(200).default('Not provided'),
    description: z.string().max(5000).default(''),
  }),
  photos: z.array(photo).max(20).default([]),
  reasons: z.array(z.string().min(1).max(500)).min(1).max(10),
});

export const samples = [
  { item: '104827365901284', title: '2021 BMW 3 Series', price: 28500, year: 2021, mileage: 32400, location: 'San Diego, CA', image: 'bmw', prediction: 'trustworthy', confidence: .96, seller: 'Alex Morgan' },
  { item: '108529374602183', title: '2020 Mercedes-Benz C-Class', price: 8900, year: 2020, mileage: 18500, location: 'Los Angeles, CA', image: 'mercedes', prediction: 'fraud', confidence: .94, seller: 'Chris Taylor' },
  { item: '102736485910283', title: '2022 Tesla Model 3', price: 31900, year: 2022, mileage: 24100, location: 'San Diego, CA', image: 'tesla', prediction: 'trustworthy', confidence: .98, seller: 'Jamie Wilson' },
  { item: '109283746501827', title: '2019 Porsche 911 Carrera', price: 22000, year: 2019, mileage: 12000, location: 'Irvine, CA', image: 'porsche', prediction: 'fraud', confidence: .91, seller: 'Sam Parker' },
  { item: '106473829105284', title: '2021 Audi A5 Sportback', price: 33800, year: 2021, mileage: 28700, location: 'Carlsbad, CA', image: 'audi', prediction: 'trustworthy', confidence: .92, seller: 'Jordan Lee' },
  { item: '103847265910283', title: '2020 Jeep Wrangler', price: 29400, year: 2020, mileage: 41300, location: 'Oceanside, CA', image: 'jeep', prediction: 'trustworthy', confidence: .95, seller: 'Casey Adams' },
];

export function validateListingUrl(input) {
  if (typeof input !== 'string' || input.length > 2048) throw new Error('Enter a valid Facebook Marketplace vehicle link.');
  let url;
  try { url = new URL(input.trim()); } catch { throw new Error('Enter a full Facebook Marketplace link, starting with https://.'); }
  if (url.protocol !== 'https:' || !['facebook.com', 'www.facebook.com', 'm.facebook.com', 'web.facebook.com'].includes(url.hostname) || url.username || url.password || url.port || !/^\/marketplace\/item\/[a-z\d_-]+\/?$/i.test(url.pathname)) {
    throw new Error('Use a Facebook Marketplace listing link: https://www.facebook.com/marketplace/item/123456789/');
  }
  return `https://www.facebook.com${url.pathname.replace(/\/?$/, '/')}`;
}

export function demoResult(listingUrl) {
  const item = new URL(listingUrl).pathname.split('/')[3];
  const fixture = samples.find(s => s.item === item) || samples[createHash('sha256').update(listingUrl).digest()[0] % samples.length];
  return { ...resultSchema.parse({
    prediction: fixture.prediction,
    confidence: fixture.confidence,
    details: { title: fixture.title, price: fixture.price, currency: 'USD', year: fixture.year, mileage: fixture.mileage, location: fixture.location, transmission: 'Automatic', seller_name: fixture.seller, description: 'An illustrative vehicle listing for exploring the Marketguard proof of concept. These details and photos are sample data, not fetched from the submitted listing.' },
    photos: [`/images/${fixture.image}.jpg`],
    reasons: fixture.prediction === 'fraud'
      ? ['The sample price is substantially below comparable vehicles.', 'The example seller requests a deposit before an in-person viewing.', 'The sample listing has limited ownership and vehicle history information.']
      : ['The sample asking price is consistent with comparable vehicles.', 'Vehicle details in this example are complete and consistent.', 'The example seller offers an in-person inspection and vehicle history.'],
  }), source: 'demo' };
}

/**
 * Model integration boundary. The backend POSTs { listing_url } to MODEL_API_URL.
 * See README.md for the response schema. Never silently substitutes a demo on failure.
 */
export async function analyzeListing(listingUrl, config = process.env) {
  if (!config.MODEL_API_URL) return demoResult(listingUrl);
  let endpoint;
  try { endpoint = new URL(config.MODEL_API_URL); } catch { throw new Error('The model API URL is not configured correctly.'); }
  if (!['https:', 'http:'].includes(endpoint.protocol)) throw new Error('The model API URL must use HTTP or HTTPS.');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(config.MODEL_API_KEY ? { Authorization: `Bearer ${config.MODEL_API_KEY}` } : {}) },
    body: JSON.stringify({ listing_url: listingUrl }),
    signal: AbortSignal.timeout(Number(config.MODEL_API_TIMEOUT_MS) || 30000),
    redirect: 'error',
  });
  if (!response.ok) throw new Error(`The model API returned an error (${response.status}). Please try again later.`);
  const raw = await response.json();
  // Accept the original brief's "thrust" typo plus common trust labels at the boundary.
  if (['trust', 'trusted', 'thrust'].includes(raw.prediction)) raw.prediction = 'trustworthy';
  const validated = resultSchema.safeParse(raw);
  if (!validated.success) throw new Error('The model API returned an unexpected response. Check the response contract in README.md.');
  return { ...validated.data, source: 'model' };
}
