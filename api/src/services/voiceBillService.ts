import { pool } from '../db/pool';
import { VoiceBillParser, ParsedSlots, SupportedLanguage, CONVERSATIONAL_STOP_WORDS, PHONE_RELATED_WORDS } from './voiceBillParser';
import { InvoiceService } from './invoiceService';
import { PaymentService } from './paymentService';
import { isIndianName } from '../data/indianNames';
import Decimal from 'decimal.js';

export interface OllamaLineItem {
  product: string | null;
  qty: number | null;
  price: number | null;
  discount_percent: number | null;
}

export interface OllamaExtractionResult {
  customer_name: string | null;
  phone: string | null;
  line_items: OllamaLineItem[];
}

export interface SlotSourceMeta {
  customerName?: 'llm' | 'deterministic';
  phone?: 'llm' | 'deterministic';
  productName?: 'llm' | 'deterministic';
  qty?: 'llm' | 'deterministic' | 'agreement';
  unitPrice?: 'llm' | 'deterministic' | 'agreement';
  discountPercent?: 'llm' | 'deterministic' | 'agreement';
}

export interface DraftLineItem {
  id: string;
  productId?: number;
  productName: string;
  matchedName?: string;
  qty: number;
  unitPrice: number;
  discountPercent: number;
  taxRate: number;
  lineTotal: string;
  isPriceAssumed?: boolean;
  isQtyAssumed?: boolean;
  qtyNeedsReview?: boolean;
  priceNeedsReview?: boolean;
  discountNeedsReview?: boolean;
  qtySource?: 'llm' | 'deterministic' | 'agreement';
  priceSource?: 'llm' | 'deterministic' | 'agreement';
}

export interface VoiceBillSession {
  sessionId: string;
  customerName?: string;
  phone?: string;
  customerId?: number;
  lineItems: DraftLineItem[];
  language: SupportedLanguage;
  status: 'collecting' | 'ready_for_confirm' | 'confirmed';
  notes: string[];
  lastUpdateNote?: string;
  ambiguousCandidates?: { id: number; name: string; salesPrice: string }[];
  invoiceId?: number;
  invoiceNumber?: string;
  paymentNumber?: string;
  paymentStatus?: 'paid' | 'not_paid';
  pdfUrl?: string;
  grandTotal: string;
  updatedAt: Date;
  isNameInferred?: boolean;
  isPriceAssumed?: boolean;
  isQtyAssumed?: boolean;
  confidenceNotes?: { en: string[]; hi: string[] };
  disagreementWarnings?: { en: string[]; hi: string[] };
  slotSources?: SlotSourceMeta;
  pendingSlot?: 'product' | 'quantity' | 'unitPrice' | 'customerName' | 'phone';
}

export interface ChatMessageResponse {
  reply: string;
  language: SupportedLanguage;
  session: VoiceBillSession;
  readyForConfirm: boolean;
  isConfirmed: boolean;
  options?: string[];
}

// Common Hindi to English furniture transliteration / keywords dictionary
const HINDI_PRODUCT_KEYWORD_MAP: Record<string, string> = {
  'टीवी यूनिट': 'Alder TV Unit',
  'टीवी': 'TV Unit',
  'डेस्क': 'Writing Desk',
  'कुर्सी': 'Chair',
  'चेयर': 'Chair',
  'टेबल': 'Table',
  'डाइनिंग टेबल': 'Dining Table',
  'कॉफ़ी टेबल': 'Coffee Table',
  'मेज़': 'Desk',
  'सोफा': 'Sofa',
  'अलमारी': 'Wardrobe',
  'बुककेस': 'Bookcase',
  'कैबिनेट': 'Cabinet',
  'बेड': 'Bed',
  'बिस्तर': 'Bed',
  'स्टूल': 'Stool',
  'लैंप': 'Lamp',
  'लाइट': 'Light',
  'ओक': 'Oak',
  'टीक': 'Teak',
  'वॉलनट': 'Walnut',
};

export class VoiceBillService {
  // In-memory sessions store (cleaned up after 2 hours)
  private static sessions: Map<string, VoiceBillSession> = new Map();

  static getOrCreateSession(sessionId?: string): VoiceBillSession {
    const id = sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    if (!this.sessions.has(id)) {
      this.sessions.set(id, {
        sessionId: id,
        lineItems: [],
        language: 'en',
        status: 'collecting',
        notes: [],
        grandTotal: '0.00',
        updatedAt: new Date(),
      });
    }
    return this.sessions.get(id)!;
  }

  static getSession(sessionId: string): VoiceBillSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Deletes a line item by ID from the active session and recalculates totals
   */
  static deleteLineItem(sessionId: string, itemId: string): VoiceBillSession {
    const session = this.getOrCreateSession(sessionId);
    session.lineItems = session.lineItems.filter(item => item.id !== itemId);
    this.recalculateTotals(session);
    this.updateSessionStatus(session);
    session.updatedAt = new Date();
    return session;
  }

  /**
   * Updates a line item's quantity, price, or discount in the active session
   */
  static updateLineItem(
    sessionId: string,
    itemId: string,
    updates: { qty?: number; unitPrice?: number; discountPercent?: number }
  ): VoiceBillSession {
    const session = this.getOrCreateSession(sessionId);
    const item = session.lineItems.find(i => i.id === itemId);
    if (item) {
      if (updates.qty !== undefined) {
        if (updates.qty <= 0) {
          return this.deleteLineItem(sessionId, itemId);
        }
        item.qty = updates.qty;
        item.isQtyAssumed = false;
        item.qtyNeedsReview = false;
      }
      if (updates.unitPrice !== undefined) {
        item.unitPrice = updates.unitPrice;
        item.isPriceAssumed = false;
        item.priceNeedsReview = false;
      }
      if (updates.discountPercent !== undefined) {
        item.discountPercent = updates.discountPercent;
        item.discountNeedsReview = false;
      }
      this.recalculateTotals(session);
      this.updateSessionStatus(session);
      session.updatedAt = new Date();
    }
    return session;
  }

  /**
   * Updates session status (collecting vs ready_for_confirm)
   */
  static updateSessionStatus(session: VoiceBillSession): void {
    if (session.status === 'confirmed') return;

    if (session.lineItems.length === 0) {
      session.status = 'collecting';
      return;
    }

    const allItemsValid = session.lineItems.every(
      item => (item.productId || item.productName) && item.qty > 0 && item.unitPrice > 0
    );

    if (allItemsValid && session.customerName && session.phone) {
      session.status = 'ready_for_confirm';
    } else {
      session.status = 'collecting';
    }
  }

  /**
   * Fuzzy-match product phrase against database Product Master using pg_trgm similarity & ILIKE
   */
  static async matchProduct(productPhrase: string): Promise<{
    matchedProduct: { id: number; name: string; salesPrice: string; taxRate: string } | null;
    score: number;
    candidates: { id: number; name: string; salesPrice: string }[];
  }> {
    if (!productPhrase || !productPhrase.trim()) {
      return { matchedProduct: null, score: 0, candidates: [] };
    }

    let searchPhrase = productPhrase.trim();

    // If searchPhrase is solely an Indian person name, it is not a catalog product
    const nameWords = searchPhrase.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    if (nameWords.length > 0 && nameWords.every(w => isIndianName(w))) {
      return { matchedProduct: null, score: 0, candidates: [] };
    }

    // Check Hindi product keyword mappings
    for (const [hiKey, enVal] of Object.entries(HINDI_PRODUCT_KEYWORD_MAP)) {
      if (searchPhrase.includes(hiKey)) {
        searchPhrase = enVal;
        break;
      }
    }

    try {
      const res = await pool.query(
        `SELECT id, name, sales_price::TEXT as sales_price, tax_rate::TEXT as tax_rate,
          GREATEST(
            CASE WHEN LOWER(TRIM(name)) = LOWER(TRIM($1)) THEN 1.0 ELSE 0 END,
            CASE WHEN LOWER(REGEXP_REPLACE(TRIM(name), '[—–-]', ' ', 'g')) = LOWER(REGEXP_REPLACE(TRIM($1), '[—–-]', ' ', 'g')) THEN 1.0 ELSE 0 END,
            CASE WHEN name ILIKE $1 THEN 0.98 ELSE 0 END,
            CASE WHEN LENGTH($1) >= 2 AND name ILIKE '%' || $1 || '%' THEN 0.88 ELSE 0 END,
            CASE WHEN LENGTH($1) >= 2 AND $1 ILIKE '%' || name || '%' THEN 0.88 ELSE 0 END,
            COALESCE(similarity(name, $1), 0)
          ) as score
         FROM products
         WHERE is_archived = false
         ORDER BY score DESC
         LIMIT 5;`,
        [searchPhrase]
      );

      const rows = res.rows;
      if (rows.length === 0) {
        return { matchedProduct: null, score: 0, candidates: [] };
      }

      const top = rows[0];
      const topScore = parseFloat(top.score || '0');
      const validCandidates = rows
        .filter(r => parseFloat(r.score || '0') >= 0.35)
        .map(r => ({
          id: r.id,
          name: r.name,
          salesPrice: r.sales_price,
        }));

      // If top score >= 0.45, auto-select
      if (topScore >= 0.45) {
        return {
          matchedProduct: {
            id: top.id,
            name: top.name,
            salesPrice: top.sales_price,
            taxRate: top.tax_rate,
          },
          score: topScore,
          candidates: validCandidates,
        };
      }

      // If top score is between 0.35 and 0.45, provide as candidates
      if (validCandidates.length > 0) {
        return {
          matchedProduct: null,
          score: topScore,
          candidates: validCandidates,
        };
      }

      // Score below 0.35: not a valid product match
      return {
        matchedProduct: null,
        score: topScore,
        candidates: [],
      };
    } catch (err) {
      console.warn('SQL error in matchProduct, falling back to in-memory matcher:', err);
      try {
        const fallbackRes = await pool.query(
          `SELECT id, name, sales_price::TEXT as sales_price, tax_rate::TEXT as tax_rate FROM products WHERE is_archived = false;`
        );
        const cleanTarget = searchPhrase.toLowerCase().replace(/[—–-]/g, ' ').replace(/[,.:;!?]/g, ' ').replace(/\s+/g, ' ').trim();
        const scored = fallbackRes.rows.map((r: any) => {
          const cleanName = r.name.toLowerCase().replace(/[—–-]/g, ' ').replace(/[,.:;!?]/g, ' ').replace(/\s+/g, ' ').trim();
          let score = 0;
          if (cleanName === cleanTarget) score = 1.0;
          else if (cleanName.includes(cleanTarget) || cleanTarget.includes(cleanName)) score = 0.88;
          else score = VoiceBillParser.trigramSimilarity(cleanName, cleanTarget);
          return {
            id: r.id,
            name: r.name,
            salesPrice: r.sales_price,
            taxRate: r.tax_rate,
            score,
          };
        });
        scored.sort((a: any, b: any) => b.score - a.score);
        if (scored.length > 0 && scored[0].score >= 0.45) {
          const top = scored[0];
          return {
            matchedProduct: {
              id: top.id,
              name: top.name,
              salesPrice: top.salesPrice,
              taxRate: top.taxRate,
            },
            score: top.score,
            candidates: scored.filter((r: any) => r.score >= 0.35).slice(0, 5),
          };
        } else if (scored.length > 0 && scored[0].score >= 0.35) {
          return {
            matchedProduct: null,
            score: scored[0].score,
            candidates: scored.filter((r: any) => r.score >= 0.35).slice(0, 5),
          };
        }
      } catch (innerErr) {
        console.error('Fatal error in fallback matcher:', innerErr);
      }
      return { matchedProduct: null, score: 0, candidates: [] };
    }
  }

  /**
   * Recalculates line item and grand totals with decimal.js accuracy
   */
  private static recalculateTotals(session: VoiceBillSession): void {
    let grand = new Decimal('0.00');

    for (const item of session.lineItems) {
      const qtyDec = new Decimal(item.qty || 1);
      const priceDec = new Decimal(item.unitPrice || 0);
      let lineSubtotal = qtyDec.times(priceDec);

      if (item.discountPercent && item.discountPercent > 0) {
        const discountFactor = new Decimal(1).minus(new Decimal(item.discountPercent).dividedBy(100));
        lineSubtotal = lineSubtotal.times(discountFactor);
      }

      // Add tax if configured
      const taxRateDec = new Decimal(item.taxRate || 0);
      const taxAmt = lineSubtotal.times(taxRateDec.dividedBy(100));
      const lineTotal = lineSubtotal.plus(taxAmt);

      item.lineTotal = lineTotal.toFixed(2);
      grand = grand.plus(lineTotal);
    }

    session.grandTotal = grand.toFixed(2);
  }

  /**
   * Fetches all active products directly from the PostgreSQL database
   */
  static async getCatalogProducts(): Promise<Array<{
    id: number;
    name: string;
    sku: string | null;
    type: string;
    category: string | null;
    salesPrice: string;
    taxRate: string;
    stockQty: string;
  }>> {
    const res = await pool.query(`
      SELECT id, name, sku, type, category,
             sales_price::TEXT as "salesPrice",
             tax_rate::TEXT as "taxRate",
             COALESCE(stock_qty, 0)::TEXT as "stockQty"
      FROM products
      WHERE is_archived = false
      ORDER BY name ASC;
    `);
    return res.rows;
  }

  /**
   * Fetches customer contacts from PostgreSQL database for autocomplete and direct linking
   */
  static async getCustomers(): Promise<Array<{
    id: number;
    name: string;
    mobile: string | null;
    email: string | null;
    city: string | null;
    state: string | null;
    gstin: string | null;
  }>> {
    const res = await pool.query(`
      SELECT DISTINCT ON (name) id, name, mobile, email, city, state, gstin
      FROM contacts
      WHERE type IN ('customer', 'both') AND is_archived = false
      ORDER BY name ASC, id ASC
      LIMIT 100;
    `);
    return res.rows;
  }

  private static readonly FEW_SHOT_CUSTOMER_PHONE = `Extract customer_name and phone (10 digits) from user input as JSON. Here are examples:

Input: name rahul phone 9876543210 product sofa quantity 2 price 15000 discount 10 percent
Output: {"customer_name": "rahul", "phone": "9876543210"}

Input: rahul 9876543210 oak wood planks
Output: {"customer_name": "rahul", "phone": "9876543210"}

Input: naam suresh, phone number 9123456780, do table chahiye, price 8000
Output: {"customer_name": "suresh", "phone": "9123456780"}

Input: hello there how are you doing
Output: {"customer_name": null, "phone": null}

Input: what products do you sell
Output: {"customer_name": null, "phone": null}

Now extract from this input, following the exact same JSON shape, using null for anything not mentioned — do not guess:
Input: {user_input}
Output:`;

  private static readonly FEW_SHOT_LINE_ITEMS = `Extract line_items (each with product, qty, price, discount_percent) from user input as JSON. Here are examples:

Input: name rahul phone 9876543210 product sofa quantity 2 price 15000 discount 10 percent
Output: {"line_items": [{"product": "sofa", "qty": 2, "price": 15000, "discount_percent": 10}]}

Input: rahul 9876543210 oak wood planks
Output: {"line_items": [{"product": "oak wood planks", "qty": null, "price": null, "discount_percent": null}]}

Input: naam suresh, phone number 9123456780, do table chahiye, price 8000
Output: {"line_items": [{"product": "table", "qty": 2, "price": 8000, "discount_percent": null}]}

Input: add wooden chair
Output: {"line_items": [{"product": "wooden chair", "qty": null, "price": null, "discount_percent": null}]}

Input: chair chahiye
Output: {"line_items": [{"product": "chair", "qty": null, "price": null, "discount_percent": null}]}

Input: teak desk
Output: {"line_items": [{"product": "teak desk", "qty": null, "price": null, "discount_percent": null}]}

Input: hello there how are you
Output: {"line_items": []}

Input: what products do you sell
Output: {"line_items": []}

Rules:
1. Return ONLY valid JSON in shape: {"line_items": [{"product": string or null, "qty": number or null, "price": number or null, "discount_percent": number or null}]}.
2. If a field is not mentioned or unclear, use null — do not guess or invent values.
3. NEVER default qty to 1. If the user mentions a product without an explicit quantity count or number, qty MUST be null.
4. Units of count (e.g. piece, pieces, pcs, pc, units, items, पीस, नग) are NOT product names. If a message contains only a quantity and a unit (e.g. "two pieces", "2 pcs", "दो पीस"), extract the qty and set product to null.
5. If the user does NOT mention any furniture or product in the input (e.g. they only provide customer name, phone number, a number like "0", or conversational replies), return {"line_items": []}. NEVER invent, assume, or hallucinate products.
6. Greetings, conversational pleasantries, questions, catalog inquiries, and polite phrases (e.g. "hello", "hi", "how are you", "namaste", "नमस्ते", "what do you sell", "show products", "thanks", "help") are NOT products to bill. Return {"line_items": []}.
{catalog_grounding}
Now extract from this input, following the exact same JSON shape, using null for anything not mentioned — do not guess:
Input: {user_input}
Output:`;

  /**
   * Warm-up request to Ollama on server boot to load model into memory
   */
  static async warmUpOllama(): Promise<void> {
    const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://ollama:11434';
    const model = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
    console.log(`[Ollama] Sending warm-up request for model "${model}"...`);
    try {
      const res = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: 'hello',
          keep_alive: '30m',
          stream: false,
          options: { num_predict: 5 },
        }),
      });
      if (res.ok) {
        console.log(`[Ollama] Model "${model}" warmed up and active in memory (keep_alive: 30m).`);
      } else {
        console.warn(`[Ollama] Warm-up returned status ${res.status}`);
      }
    } catch (err: any) {
      console.warn(`[Ollama] Warm-up non-blocking ping: ${err.message}`);
    }
  }

  /**
   * Call A: Extract { customer_name, phone }
   */
  static async extractCustomerAndPhone(
    text: string,
    isRetry = false
  ): Promise<{ customer_name: string | null; phone: string | null } | null> {
    const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://ollama:11434';
    const model = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
    const timeoutMs = parseInt(process.env.OLLAMA_TIMEOUT_MS || '30000', 10);
    const isDebug = process.env.DEBUG_OLLAMA === 'true' || Boolean(process.env.DEBUG);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const prompt = this.FEW_SHOT_CUSTOMER_PHONE.replace('{user_input}', text);
    const startTime = Date.now();

    try {
      const res = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          format: 'json',
          stream: false,
          keep_alive: '30m',
          options: {
            temperature: 0.1,
            num_predict: 100,
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const rtt = Date.now() - startTime;

      if (!res.ok) {
        if (isDebug) console.warn(`[Ollama Call A - Customer/Phone] HTTP ${res.status} (${rtt}ms)`);
        return null;
      }

      const body = (await res.json()) as { response?: string };
      const raw = body.response || '';
      if (isDebug) {
        console.log(`[Ollama Call A - Customer/Phone] RTT: ${rtt}ms, Raw: ${raw.replace(/\n/g, ' ')}`);
      }

      try {
        const parsed = JSON.parse(raw);
        return {
          customer_name: typeof parsed.customer_name === 'string' && parsed.customer_name.trim() !== '' ? parsed.customer_name.trim() : null,
          phone: typeof parsed.phone === 'string' && parsed.phone.trim() !== '' ? parsed.phone.trim() : (typeof parsed.phone === 'number' ? String(parsed.phone) : null),
        };
      } catch (parseErr: any) {
        if (isDebug) console.warn(`[Ollama Call A - Customer/Phone] JSON parse error: ${parseErr.message}`);
        if (!isRetry) {
          return await this.extractCustomerAndPhone(text, true);
        }
        return null;
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      const rtt = Date.now() - startTime;
      if (isDebug) console.warn(`[Ollama Call A - Customer/Phone] Error/Timeout (${rtt}ms): ${err.message}`);
      return null;
    }
  }

  /**
   * Call B: Extract { line_items }
   */
  static async extractLineItems(
    text: string,
    isRetry = false,
    catalogProducts: string[] = []
  ): Promise<{ line_items: OllamaLineItem[] } | null> {
    const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://ollama:11434';
    const model = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
    const timeoutMs = parseInt(process.env.OLLAMA_TIMEOUT_MS || '30000', 10);
    const isDebug = process.env.DEBUG_OLLAMA === 'true' || Boolean(process.env.DEBUG);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Only pass catalog hints if the user's input actually contains words matching catalog products
    // This prevents Ollama from hallucinating random catalog items on follow-up turns!
    const userWords = text
      .toLowerCase()
      .split(/[\s,.:;!?]+/)
      .filter(w => w.length >= 3 && !['name', 'phone', 'customer', 'mobile', 'price', 'quantity', 'discount', 'free', 'bill', 'for', 'rupees', 'rs', 'pieces', 'pcs', 'chahiye', 'kardo'].includes(w));

    const relevantCatalog = userWords.length > 0
      ? catalogProducts.filter(p => userWords.some(w => p.toLowerCase().includes(w))).slice(0, 8)
      : [];

    const catalogGrounding = relevantCatalog.length > 0
      ? `\n4. Potential Catalog Matches: [${relevantCatalog.join(', ')}]. If the user mentions any of these, map to the exact name.`
      : '';

    const prompt = this.FEW_SHOT_LINE_ITEMS
      .replace('{catalog_grounding}', catalogGrounding)
      .replace('{user_input}', text);

    const startTime = Date.now();

    try {
      const res = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          format: 'json',
          stream: false,
          keep_alive: '30m',
          options: {
            temperature: 0.1,
            num_predict: 200,
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const rtt = Date.now() - startTime;

      if (!res.ok) {
        if (isDebug) console.warn(`[Ollama Call B - Line Items] HTTP ${res.status} (${rtt}ms)`);
        return null;
      }

      const body = (await res.json()) as { response?: string };
      const raw = body.response || '';
      if (isDebug) {
        console.log(`[Ollama Call B - Line Items] RTT: ${rtt}ms, Raw: ${raw.replace(/\n/g, ' ')}`);
      }

      try {
        const parsed = JSON.parse(raw);
        const items = Array.isArray(parsed.line_items) ? parsed.line_items : [];
        return { line_items: items };
      } catch (parseErr: any) {
        if (isDebug) console.warn(`[Ollama Call B - Line Items] JSON parse error: ${parseErr.message}`);
        if (!isRetry) {
          return await this.extractLineItems(text, true, catalogProducts);
        }
        return null;
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      const rtt = Date.now() - startTime;
      if (isDebug) console.warn(`[Ollama Call B - Line Items] Error/Timeout (${rtt}ms): ${err.message}`);
      return null;
    }
  }

  /**
   * Calls Ollama LLM service for slot extraction.
   * Runs two focused parallel calls:
   *   Call A: { customer_name, phone }
   *   Call B: { line_items }
   * Runs both in parallel via Promise.all for lowest latency.
   * Merges results into OllamaExtractionResult.
   * Falls back gracefully to null on failure or timeout so deterministic parser takes over.
   */
  static async callOllamaExtraction(
    text: string,
    isRetry = false,
    catalogProducts: string[] = []
  ): Promise<OllamaExtractionResult | null> {
    // Fast path: Don't invoke Ollama on greetings, inquiries, help, or thanks
    if (
      VoiceBillParser.isGreeting(text) ||
      VoiceBillParser.isCatalogInquiry(text) ||
      VoiceBillParser.isHelp(text) ||
      VoiceBillParser.isThanks(text)
    ) {
      return {
        customer_name: null,
        phone: null,
        line_items: [],
      };
    }

    const startTime = Date.now();
    const isDebug = process.env.DEBUG_OLLAMA === 'true' || Boolean(process.env.DEBUG);

    try {
      const [customerRes, itemsRes] = await Promise.all([
        this.extractCustomerAndPhone(text, isRetry),
        this.extractLineItems(text, isRetry, catalogProducts),
      ]);

      const totalRtt = Date.now() - startTime;

      // If both calls failed or timed out, return null to trigger deterministic fallback
      if (!customerRes && !itemsRes) {
        if (isDebug) console.warn(`[Ollama Parallel] Both calls returned null (${totalRtt}ms). Falling back to deterministic.`);
        return null;
      }

      const merged: OllamaExtractionResult = {
        customer_name: customerRes?.customer_name ?? null,
        phone: customerRes?.phone ?? null,
        line_items: itemsRes?.line_items ?? [],
      };

      if (isDebug) {
        console.log(`[Ollama Parallel Total RTT: ${totalRtt}ms] Merged: ${JSON.stringify(merged)}`);
      }

      return merged;
    } catch (err: any) {
      if (isDebug) console.warn(`[Ollama Parallel] Error (${Date.now() - startTime}ms): ${err.message}`);
      return null;
    }
  }

  /**
   * Process a conversational incoming message (text or voice-transcribed)
   */
  static async processMessage(text: string, sessionId?: string): Promise<ChatMessageResponse> {
    const session = this.getOrCreateSession(sessionId);
    session.updatedAt = new Date();
    session.lastUpdateNote = undefined;

    // 0. Session Self-Healing & Cleanup:
    // Remove any erroneously added line items where the product name is an Indian person name (e.g. "rahul", "aryan"),
    // or phone-related tokens ("phone", "phone number", "call", digits), or if productName equals customerName,
    // or single non-product word with no productId
    let sessionNeedsRecalc = false;
    session.lineItems = session.lineItems.filter(item => {
      const pName = (item.productName || '').toLowerCase().trim();
      const pWords = pName.split(/\s+/).filter(w => w.length > 0);
      const isPerson =
        pWords.length > 0 &&
        (pWords.every(w => isIndianName(w)) ||
         (session.customerName && pName === session.customerName.toLowerCase().trim()));

      const isPhoneOrGarbage =
        !item.productId &&
        (/(?:phone|mobile|contact|call|telephone|number|फ़ोन|फोन|मोबाइल|नंबर)/i.test(pName) ||
         /\d{4,}/.test(pName) ||
         pWords.every(w => PHONE_RELATED_WORDS.has(w) || /^\d+$/.test(w)) ||
         !/(?:desk|chair|table|sofa|planks|wood|bookshelf|cabinet|bed|furniture|stool|bench|drawer|shelf|board|wardrobe|stand|rack|almirah|almiras|almarah|अलमारी|कुर्सी|मेज़|तख्ता|खाट)/i.test(pName));

      if (isPerson) {
        if (!session.customerName) {
          session.customerName = VoiceBillParser.capitalizeWords(item.productName);
        }
        sessionNeedsRecalc = true;
        return false; // Evict person name from line items!
      }

      if (isPhoneOrGarbage) {
        const extractedPhone = VoiceBillParser.extractPhoneNumber(item.productName);
        if (extractedPhone && !session.phone) {
          session.phone = extractedPhone;
        }
        sessionNeedsRecalc = true;
        return false; // Evict phone or non-furniture garbage from line items!
      }

      if (item.unitPrice >= 10000000) {
        const strPrice = String(item.unitPrice).replace(/\D/g, '');
        if (!session.phone && strPrice.length >= 10) {
          session.phone = strPrice.slice(-10);
        }
        item.unitPrice = 0;
        sessionNeedsRecalc = true;
      }
      return true;
    });

    if (sessionNeedsRecalc) {
      this.recalculateTotals(session);
      VoiceBillService.updateSessionStatus(session);
    }

    // Detect language of incoming message
    const lang = VoiceBillParser.detectLanguage(text);
    session.language = lang;

    // 0a. Check for Greeting (e.g. "hello", "hi", "namaste", "नमस्ते")
    if (VoiceBillParser.isGreeting(text)) {
      const reply =
        lang === 'hi'
          ? 'नमस्ते! मैं आपका अर्बन फ़र्निचर ई-बिल सहायक हूँ। नया बिल बनाने के लिए ग्राहक का नाम, फ़ोन नंबर या उत्पाद बताएं (जैसे: "राहुल के लिए 2 टीक डेस्क कीमत 5000, फ़ोन 9876543210")।'
          : 'Hello! Welcome to Urban Furniture e-Bill Assistant. You can tell me the customer name, phone number, or products to add (e.g. "2 Teak Desks at 5000 for Rahul, phone 9876543210").';

      return {
        reply,
        language: lang,
        session,
        readyForConfirm: session.status === 'ready_for_confirm',
        isConfirmed: session.status === 'confirmed',
      };
    }

    // 0b. Check for Catalog Inquiry (e.g. "what do you sell", "what products do you have", "show products")
    if (VoiceBillParser.isCatalogInquiry(text)) {
      let catalogItems: string[] = [];
      try {
        const prodRes = await pool.query(`
          SELECT name, sales_price::TEXT as "salesPrice"
          FROM products
          WHERE is_archived = false
          ORDER BY id ASC
          LIMIT 5;
        `);
        catalogItems = prodRes.rows.map((r: any) => `${r.name} (₹${r.salesPrice})`);
      } catch (err) {
        catalogItems = [
          'Custom Executive Teak Desk (₹32,000)',
          'Ergonomic Office Chair (₹14,500)',
          'Oak Wood Planks (₹4,200)',
          'Modern Dining Table (₹24,000)',
          'Wooden Bookshelf (₹18,500)',
        ];
      }

      const reply =
        lang === 'hi'
          ? `अर्बन फ़र्निचर में हम प्रीमियम होम और ऑफिस फ़र्निचर बेचते हैं!\n\nहमारे कुछ लोकप्रिय उत्पाद:\n${catalogItems.map(i => `• ${i}`).join('\n')}\n\nबिल बनाने के लिए आप उत्पाद, ग्राहक का नाम या फ़ोन नंबर बता सकते हैं (जैसे: "राहुल के लिए 2 टीक डेस्क कीमत 5000, फ़ोन 9876543210")।`
          : `We offer premium urban home and office furniture!\n\nPopular items in our catalog:\n${catalogItems.map(i => `• ${i}`).join('\n')}\n\nTo generate an e-bill, simply specify what you need (e.g.: "2 Teak Desks at 5000 for Rahul, phone 9876543210").`;

      return {
        reply,
        language: lang,
        session,
        readyForConfirm: session.status === 'ready_for_confirm',
        isConfirmed: session.status === 'confirmed',
        options: ['Teak Desk', 'Ergonomic Office Chair', 'Oak Wood Planks', 'Dining Table'],
      };
    }

    // 0b. Check for Help request
    if (VoiceBillParser.isHelp(text)) {
      const reply =
        lang === 'hi'
          ? 'सहायता: आप सीधे बोलकर या लिखकर बिल बना सकते हैं।\n• उत्पाद जोड़ें: "2 टीक डेस्क कीमत 5000"\n• ग्राहक विवरण: "ग्राहक राहुल फ़ोन 9876543210"\n• मात्रा बदलें: "मात्रा 3 कर दो" या "हटा दो"\n• रीसेट: "नया बिल" या "clear"'
          : 'Help: You can speak or type to generate bills effortlessly.\n• Add Product: "2 Teak Desk price 5000"\n• Customer: "customer Rahul phone 9876543210"\n• Modify: "change qty to 3" or "remove chair"\n• Reset: "new bill" or "clear"';

      return {
        reply,
        language: lang,
        session,
        readyForConfirm: session.status === 'ready_for_confirm',
        isConfirmed: session.status === 'confirmed',
      };
    }

    // 0c. Check for Thanks / Gratitude
    if (VoiceBillParser.isThanks(text)) {
      const reply =
        lang === 'hi'
          ? 'आपका स्वागत है! यदि आपको किसी और चीज़ में सहायता चाहिए तो बताएं।'
          : "You're very welcome! Let me know if you need to add or change anything else.";

      return {
        reply,
        language: lang,
        session,
        readyForConfirm: session.status === 'ready_for_confirm',
        isConfirmed: session.status === 'confirmed',
      };
    }

    // Check for clear / reset command
    const lowerText = text.trim().toLowerCase();
    if (
      lowerText === 'clear' ||
      lowerText === 'reset' ||
      lowerText === 'start over' ||
      lowerText === 'restart' ||
      lowerText === 'नया बिल' ||
      lowerText === 'रीसेट'
    ) {
      session.lineItems = [];
      session.customerName = undefined;
      session.phone = undefined;
      session.customerId = undefined;
      session.status = 'collecting';
      session.grandTotal = '0.00';
      session.ambiguousCandidates = undefined;
      session.slotSources = undefined;

      const reply =
        lang === 'hi'
          ? 'बिल रीसेट कर दिया गया है। नया बिल बनाने के लिए ग्राहक का नाम, फ़ोन या उत्पाद बताएं।'
          : 'Bill reset! To create a new bill, please tell me the customer name, phone, or product to add.';

      return {
        reply,
        language: lang,
        session,
        readyForConfirm: false,
        isConfirmed: false,
      };
    }

    // 0d. Check for Settle / Confirm Command (e.g. "settle the bill", "confirm", "bill settle kardo", "pay now")
    if (VoiceBillParser.isSettleOrConfirm(text)) {
      if (session.status === 'confirmed') {
        const reply = lang === 'hi'
          ? `यह बिल पहले ही इनवॉइस ${session.invoiceNumber} के रूप में सेटल हो चुका है।`
          : `This bill has already been settled and confirmed as Invoice ${session.invoiceNumber}.`;
        return {
          reply,
          language: lang,
          session,
          readyForConfirm: false,
          isConfirmed: true,
        };
      }

      if (session.lineItems.length === 0) {
        const reply = lang === 'hi'
          ? 'बिल सेटल करने से पहले कृपया उत्पाद जोड़ें (जैसे: "2 टीक डेस्क")।'
          : 'Please add products before settling the bill (e.g., "2 Teak Desks").';
        return {
          reply,
          language: lang,
          session,
          readyForConfirm: false,
          isConfirmed: false,
        };
      }

      if (!session.customerName) {
        session.pendingSlot = 'customerName';
        const reply = lang === 'hi'
          ? 'बिल सेटल करने के लिए कृपया ग्राहक का नाम बताएं (जैसे: "राहुल")।'
          : 'Please provide the customer name before settling the bill (e.g., "Rahul").';
        return {
          reply,
          language: lang,
          session,
          readyForConfirm: false,
          isConfirmed: false,
        };
      }

      // Check if quantity is assumed on any line item
      const unconfirmedQtyItem = session.lineItems.find(item => !item.qty || item.qty <= 0 || item.isQtyAssumed);
      if (unconfirmedQtyItem) {
        session.pendingSlot = 'quantity';
        const reply = lang === 'hi'
          ? `कृपया ${unconfirmedQtyItem.productName} की मात्रा बताएं।`
          : `Please specify the quantity for ${unconfirmedQtyItem.productName}.`;
        return {
          reply,
          language: lang,
          session,
          readyForConfirm: false,
          isConfirmed: false,
        };
      }

      // All requirements met -> Immediately settle the bill in the database!
      try {
        const confirmResult = await VoiceBillService.confirmBill(session.sessionId);
        const reply = lang === 'hi'
          ? `🎉 बिल सफलतापूर्वक सेटल हो गया है!\n• इनवॉइस: ${confirmResult.invoiceNumber}\n• भुगतान: ₹${confirmResult.total} (नकद सेटल)\n• लेज़र और इन्वेंटरी डेटाबेस में अपडेट हो गए हैं।`
          : `🎉 Bill settled and recorded in the database successfully!\n• Customer Invoice: ${confirmResult.invoiceNumber}\n• Payment: ₹${confirmResult.total} (Cash Settled)\n• Double-entry ledger and inventory updated.`;

        return {
          reply,
          language: lang,
          session,
          readyForConfirm: false,
          isConfirmed: true,
        };
      } catch (err: any) {
        console.error('Error auto-settling bill via voice/chat:', err);
        const reply = lang === 'hi'
          ? `बिल सेटल करने में त्रुटि: ${err.message || 'त्रुटि'}`
          : `Error settling bill: ${err.message || 'Error'}`;
        return {
          reply,
          language: lang,
          session,
          readyForConfirm: true,
          isConfirmed: false,
        };
      }
    }

    // 1. Fetch catalog product names early for slot matching and elimination pass
    let knownProductNames: string[] = [];
    try {
      const prodRes = await pool.query(`SELECT name FROM products WHERE is_archived = false;`);
      knownProductNames = prodRes.rows.map((r: any) => r.name);
    } catch (err) {
      console.warn('Failed to query products for parser:', err);
    }

    // 0e. Conversational Context-Aware Slot Answering:
    // If the assistant previously asked a targeted question for a missing slot (e.g. "Please provide the customer name"):
    if (session.pendingSlot) {
      const trimmed = text.trim();

      // Case A: Waiting for customerName
      if (session.pendingSlot === 'customerName') {
        const isExplicitProductAdd = /^(?:add|jodo|dalo|खरीदना|चाहिए|जोड़ो|डालो)\b/i.test(trimmed);
        const hasCatalogAnchor = /(?:price|rate|qty|quantity|₹|rupees)/i.test(trimmed);
        if (!isExplicitProductAdd && !hasCatalogAnchor) {
          // Check if user provided phone number along with the name (e.g. "Aryan 9876543210" or "Aryan, phone 9876543210")
          const phoneFound = VoiceBillParser.extractPhoneNumber(trimmed);
          if (phoneFound) {
            session.phone = phoneFound;
          }

          // Strip out phone digits, +91, keywords to isolate the customer name
          let cleanName = trimmed
            .replace(/(?:phone|number|mobile|contact|फ़ोन|फोन|नंबर|मोबाइल|mob)[\s:=]*\+?(?:91[\s-]?)?\d[\d\s-]{8,14}\d/gi, ' ')
            .replace(/(?:\+?91[\s-]?)?\d{10,13}/g, ' ')
            .replace(/\b(?:customer|client|name|naam|नाम|is|hai|he|है)\b/gi, ' ')
            .trim();

          if (cleanName.length >= 2) {
            session.customerName = VoiceBillParser.capitalizeWords(cleanName);
          } else if (!session.customerName && trimmed.length >= 2 && !/^\d+$/.test(trimmed)) {
            session.customerName = VoiceBillParser.capitalizeWords(trimmed);
          }

          session.pendingSlot = undefined;
          this.recalculateTotals(session);
          return this.checkNextStepOrConfirm(session, lang);
        }
      }

      // Case B: Waiting for phone
      if (session.pendingSlot === 'phone') {
        const phone = VoiceBillParser.extractPhoneNumber(trimmed);
        if (phone) {
          session.phone = phone;
          session.pendingSlot = undefined;
          this.recalculateTotals(session);
          return this.checkNextStepOrConfirm(session, lang);
        }
      }

      // Case C: Waiting for quantity
      if (session.pendingSlot === 'quantity' && session.lineItems.length > 0) {
        let num: number | null = null;
        // Check for digit match in input, e.g. "2", "5 pieces", "qty 4"
        const digitMatch = trimmed.match(/\b(\d{1,4})\b/);
        if (digitMatch) {
          num = parseInt(digitMatch[1], 10);
        } else {
          const normalized = VoiceBillParser.normalizeNumberWordsInText(VoiceBillParser.normalizeDigits(trimmed));
          const normDigitMatch = normalized.match(/\b(\d{1,4})\b/);
          if (normDigitMatch) {
            num = parseInt(normDigitMatch[1], 10);
          } else {
            num = VoiceBillParser.parseNumberToken(trimmed);
          }
        }

        if (num !== null && !isNaN(num) && num > 0 && num < 10000) {
          const last = session.lineItems[session.lineItems.length - 1];
          last.qty = num;
          last.isQtyAssumed = false;
          last.qtyNeedsReview = false;
          last.qtySource = 'deterministic';
          session.isQtyAssumed = false;
          session.pendingSlot = undefined;
          this.recalculateTotals(session);
          return this.checkNextStepOrConfirm(session, lang);
        }
      }

      // Case D: Waiting for unitPrice
      if (session.pendingSlot === 'unitPrice' && session.lineItems.length > 0) {
        const num = VoiceBillParser.parseNumberToken(trimmed) ?? parseFloat(trimmed.replace(/[₹rsINR,\s]/gi, ''));
        if (num !== null && !isNaN(num) && num > 0 && num < 10000000) {
          const last = session.lineItems[session.lineItems.length - 1];
          last.unitPrice = num;
          last.isPriceAssumed = false;
          last.priceNeedsReview = false;
          last.priceSource = 'deterministic';
          session.isPriceAssumed = false;
          session.pendingSlot = undefined;
          this.recalculateTotals(session);
          return this.checkNextStepOrConfirm(session, lang);
        }
      }

      // Case E: Waiting for product (answering "Which product would you like to add to the bill?")
      if (session.pendingSlot === 'product') {
        const prodDet = VoiceBillParser.parse(text, knownProductNames, 'product');
        let candidateName = prodDet.productName || trimmed;

        candidateName = candidateName
          .replace(/^(?:add|jo(?:d|r)o|dalo|खरीदना|चाहिए|जोड़ो|डालो|product|item|उत्पाद)[\s:=]+/i, '')
          .trim();

        if (candidateName.length >= 2) {
          const matchRes = await this.matchProduct(candidateName);
          if (matchRes.matchedProduct) {
            session.ambiguousCandidates = undefined;
            session.pendingSlot = undefined;

            const existingSameItem = session.lineItems.find(
              i => i.productId === matchRes.matchedProduct!.id
            );

            if (existingSameItem) {
              if (prodDet.quantity && prodDet.quantity > 0) {
                existingSameItem.qty = prodDet.quantity;
                existingSameItem.isQtyAssumed = false;
              }
              if (prodDet.unitPrice && prodDet.unitPrice > 0) {
                existingSameItem.unitPrice = prodDet.unitPrice;
              }
            } else {
              const currentItem: DraftLineItem = {
                id: `line_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                productName: matchRes.matchedProduct.name,
                matchedName: matchRes.matchedProduct.name,
                productId: matchRes.matchedProduct.id,
                qty: prodDet.quantity || 0,
                unitPrice: prodDet.unitPrice || parseFloat(matchRes.matchedProduct.salesPrice) || 0,
                discountPercent: prodDet.discountPercent || 0,
                taxRate: parseFloat(matchRes.matchedProduct.taxRate) || 0,
                lineTotal: '0.00',
                isQtyAssumed: prodDet.isQtyAssumed,
                isPriceAssumed: prodDet.isPriceAssumed,
                qtyNeedsReview: prodDet.qtyNeedsReview,
                priceNeedsReview: prodDet.priceNeedsReview,
                discountNeedsReview: prodDet.discountNeedsReview,
                qtySource: prodDet.quantity ? 'deterministic' : undefined,
                priceSource: 'deterministic',
              };
              session.lineItems.push(currentItem);
            }

            this.recalculateTotals(session);
            return this.checkNextStepOrConfirm(session, lang);
          } else if (matchRes.candidates && matchRes.candidates.length > 0) {
            session.ambiguousCandidates = matchRes.candidates;
            const candidateNames = matchRes.candidates.map(c => c.name).join(', ');
            const reply =
              lang === 'hi'
                ? `आप कौन सा उत्पाद जोड़ना चाहते हैं — [${candidateNames}]?`
                : `Which product did you mean — [${candidateNames}]?`;

            return {
              reply,
              language: lang,
              session,
              readyForConfirm: false,
              isConfirmed: false,
              options: matchRes.candidates.map(c => c.name),
            };
          } else {
            const reply =
              lang === 'hi'
                ? `माफ़ कीजिए, "${trimmed}" कैटलॉग में नहीं मिला। कृपया हमारे कैटलॉग से उत्पाद का नाम बताएं।`
                : `Could not find "${trimmed}" in the product catalog. Please specify a product from our catalog.`;
            return {
              reply,
              language: lang,
              session,
              readyForConfirm: false,
              isConfirmed: false,
            };
          }
        }
      }
    }

    // 2. Call Ollama LLM Extraction (Model-first with live database catalog context)
    const llmResult = await this.callOllamaExtraction(text, false, knownProductNames);

    // 3. Run Deterministic Parser (Mandatory fallback & verification cross-check)
    const detParsed: ParsedSlots = VoiceBillParser.parse(text, knownProductNames, session.pendingSlot);

    // 4. Hybrid Arbitration: Combine model predictions with deterministic parser
    const parsed: ParsedSlots = { ...detParsed };
    const slotSources: SlotSourceMeta = {};
    const disagreementWarningsEn: string[] = [];
    const disagreementWarningsHi: string[] = [];

    if (!session.slotSources) {
      session.slotSources = {};
    }

    if (llmResult) {
      // 1. CUSTOMER_NAME: Accept LLM's extraction as-is (contextual understanding)
      if (llmResult.customer_name && llmResult.customer_name.trim() !== '') {
        parsed.customerName = VoiceBillParser.capitalizeWords(llmResult.customer_name.trim());
        parsed.isNameInferred = false;
        slotSources.customerName = 'llm';
      } else if (detParsed.customerName) {
        slotSources.customerName = 'deterministic';
      }

      // 2. PRODUCT: Accept LLM's line item product as-is (excluding standalone counter units and phone numbers)
      const countUnits = new Set(['piece', 'pieces', 'pcs', 'pc', 'unit', 'units', 'item', 'items', 'nos', 'no', 'पीस', 'नग', 'टुकड़ा', 'टुकड़े']);
      const llmItem = llmResult.line_items && llmResult.line_items.length > 0 ? llmResult.line_items[0] : null;
      if (llmItem && llmItem.product && llmItem.product.trim() !== '' && !countUnits.has(llmItem.product.trim().toLowerCase())) {
        const candidatePName = llmItem.product.trim();
        const isPhoneCandidate =
          /(?:phone|mobile|contact|call|telephone|number|फ़ोन|फोन|मोबाइल|नंबर)/i.test(candidatePName) ||
          /\d{5,}/.test(candidatePName) ||
          Boolean(VoiceBillParser.extractPhoneNumber(candidatePName));

        if (isPhoneCandidate) {
          const ph = VoiceBillParser.extractPhoneNumber(candidatePName);
          if (ph && !session.phone) {
            session.phone = ph;
            parsed.phone = ph;
            slotSources.phone = 'llm';
          }
        } else {
          parsed.productName = candidatePName;
          slotSources.productName = 'llm';
        }
      } else if (detParsed.productName && !countUnits.has(detParsed.productName.trim().toLowerCase())) {
        slotSources.productName = 'deterministic';
      }

      // Hallucination Guard: Verify that at least one token of the product name actually exists in the raw input text
      if (parsed.productName && !parsed.isUpdate && !parsed.isRemoval) {
        const rawLower = text.toLowerCase();
        const prodTokens = parsed.productName
          .toLowerCase()
          .split(/[\s,.-]+/)
          .filter(t => t.length >= 3 && !CONVERSATIONAL_STOP_WORDS.has(t));
        const hasTokenInInput =
          prodTokens.length > 0 &&
          (prodTokens.some(t => rawLower.includes(t)) ||
            Object.keys(HINDI_PRODUCT_KEYWORD_MAP).some(k => rawLower.includes(k.toLowerCase())));

        if (!hasTokenInInput) {
          delete parsed.productName;
          delete slotSources.productName;
        }
      }

      // Guard: Indian Person Name should never be a product name
      if (parsed.productName) {
        const prodWords = parsed.productName.toLowerCase().split(/\s+/).filter(w => w.length > 0);
        if (prodWords.length > 0 && prodWords.every(w => isIndianName(w))) {
          if (!parsed.customerName) {
            parsed.customerName = VoiceBillParser.capitalizeWords(parsed.productName);
            slotSources.customerName = 'deterministic';
          }
          delete parsed.productName;
          delete slotSources.productName;
        }
      }

      // 3. PHONE: Validate exactly 10 digits; if not, cross-check deterministic parser regex
      if (llmResult.phone) {
        const cleanDigits = llmResult.phone.replace(/\D/g, '');
        const tenDigits = cleanDigits.slice(-10);
        if (tenDigits.length === 10) {
          parsed.phone = tenDigits;
          slotSources.phone = 'llm';
        } else if (detParsed.phone) {
          parsed.phone = detParsed.phone;
          slotSources.phone = 'deterministic';
        }
      } else if (detParsed.phone) {
        slotSources.phone = 'deterministic';
      }

      // 4. QTY: Cross-check against deterministic parser (money-critical field)
      const llmQty = llmItem?.qty;
      if (detParsed.quantity !== undefined && llmQty !== null && llmQty !== undefined) {
        if (detParsed.quantity === llmQty) {
          parsed.quantity = detParsed.quantity;
          slotSources.qty = 'agreement';
        } else {
          // Disagreement: Deterministic parser wins
          parsed.quantity = detParsed.quantity;
          parsed.qtyNeedsReview = true;
          slotSources.qty = 'deterministic';
          disagreementWarningsEn.push(`Quantity ${detParsed.quantity} (please double-check)`);
          disagreementWarningsHi.push(`मात्रा ${detParsed.quantity} (कृपया पुनः जांचें)`);
        }
      } else if (detParsed.quantity !== undefined) {
        parsed.quantity = detParsed.quantity;
        slotSources.qty = 'deterministic';
      } else if (llmQty !== null && llmQty !== undefined && llmQty > 0) {
        // Only accept LLM quantity if the raw input text actually contains an explicit number token!
        const hasQuantityToken = /\b\d+\b/.test(text) || VoiceBillParser.hasNumberWord(text);
        if (hasQuantityToken) {
          parsed.quantity = llmQty;
          slotSources.qty = 'llm';
        }
      }

      // 5. PRICE: Cross-check against deterministic parser (money-critical field)
      const llmPrice = llmItem?.price;
      if (detParsed.unitPrice !== undefined && llmPrice !== null && llmPrice !== undefined) {
        if (detParsed.unitPrice === llmPrice) {
          parsed.unitPrice = detParsed.unitPrice;
          slotSources.unitPrice = 'agreement';
        } else {
          // Disagreement: Deterministic parser wins
          parsed.unitPrice = detParsed.unitPrice;
          parsed.priceNeedsReview = true;
          slotSources.unitPrice = 'deterministic';
          disagreementWarningsEn.push(`Price ₹${detParsed.unitPrice} (please double-check)`);
          disagreementWarningsHi.push(`कीमत ₹${detParsed.unitPrice} (कृपया पुनः जांचें)`);
        }
      } else if (detParsed.unitPrice !== undefined) {
        parsed.unitPrice = detParsed.unitPrice;
        slotSources.unitPrice = 'deterministic';
      } else if (llmPrice !== null && llmPrice !== undefined && llmPrice > 0) {
        parsed.unitPrice = llmPrice;
        slotSources.unitPrice = 'llm';
      }

      // Strictly cap unitPrice < 10,000,000
      if (parsed.unitPrice && parsed.unitPrice >= 10000000) {
        delete parsed.unitPrice;
        delete slotSources.unitPrice;
      }

      // 6. DISCOUNT: Cross-check against deterministic parser (money-critical field)
      const llmDiscount = llmItem?.discount_percent;
      if (detParsed.discountPercent !== undefined && llmDiscount !== null && llmDiscount !== undefined) {
        if (detParsed.discountPercent === llmDiscount) {
          parsed.discountPercent = detParsed.discountPercent;
          slotSources.discountPercent = 'agreement';
        } else {
          // Disagreement: Deterministic parser wins
          parsed.discountPercent = detParsed.discountPercent;
          parsed.discountNeedsReview = true;
          slotSources.discountPercent = 'deterministic';
          disagreementWarningsEn.push(`Discount ${detParsed.discountPercent}% (please double-check)`);
          disagreementWarningsHi.push(`छूट ${detParsed.discountPercent}% (कृपया पुनः जांचें)`);
        }
      } else if (detParsed.discountPercent !== undefined) {
        parsed.discountPercent = detParsed.discountPercent;
        slotSources.discountPercent = 'deterministic';
      } else if (llmDiscount !== null && llmDiscount !== undefined && llmDiscount >= 0 && llmDiscount <= 100) {
        parsed.discountPercent = llmDiscount;
        slotSources.discountPercent = 'llm';
      }
    } else {
      // 100% deterministic fallback
      if (detParsed.customerName) {
        parsed.customerName = detParsed.customerName;
        slotSources.customerName = 'deterministic';
      }
      if (detParsed.phone) {
        parsed.phone = detParsed.phone;
        slotSources.phone = 'deterministic';
      }
      if (detParsed.productName) {
        const prodWords = detParsed.productName.toLowerCase().split(/\s+/).filter(w => w.length > 0);
        if (prodWords.length > 0 && prodWords.every(w => isIndianName(w))) {
          if (!parsed.customerName) {
            parsed.customerName = VoiceBillParser.capitalizeWords(detParsed.productName);
            slotSources.customerName = 'deterministic';
          }
        } else {
          parsed.productName = detParsed.productName;
          slotSources.productName = 'deterministic';
        }
      }
      if (detParsed.quantity !== undefined) {
        parsed.quantity = detParsed.quantity;
        slotSources.qty = 'deterministic';
      }
      if (detParsed.unitPrice !== undefined && detParsed.unitPrice < 10000000) {
        parsed.unitPrice = detParsed.unitPrice;
        slotSources.unitPrice = 'deterministic';
      }
      if (detParsed.discountPercent !== undefined) {
        parsed.discountPercent = detParsed.discountPercent;
        slotSources.discountPercent = 'deterministic';
      }
    }

    // Global phone safety check: If text contains a phone number, ensure session.phone and parsed.phone capture it
    const globalPhone = VoiceBillParser.extractPhoneNumber(text);
    if (globalPhone) {
      parsed.phone = globalPhone;
      session.phone = globalPhone;
      slotSources.phone = slotSources.phone || 'deterministic';
      // Ensure unitPrice is never assigned this phone number or an astronomical number
      if (parsed.unitPrice && (String(parsed.unitPrice).includes(globalPhone) || parsed.unitPrice >= 10000000)) {
        delete parsed.unitPrice;
        delete slotSources.unitPrice;
      }
    }

    if (disagreementWarningsEn.length > 0 || disagreementWarningsHi.length > 0) {
      session.disagreementWarnings = {
        en: disagreementWarningsEn,
        hi: disagreementWarningsHi,
      };
    }

    Object.assign(session.slotSources, slotSources);

    // 4b. Handle removal command or quantity = 0
    if (
      parsed.isRemoval ||
      parsed.quantity === 0 ||
      (parsed.isUpdate && parsed.updateField === 'quantity' && parsed.quantity === 0)
    ) {
      let removedItem: DraftLineItem | undefined;
      const target = (parsed.removalTarget || '').toLowerCase();

      if (target && target.length >= 2 && !['item', 'product', 'it', 'ko', 'hai', 'सामान', 'चीज़'].includes(target)) {
        const idx = session.lineItems.findIndex(i =>
          (i.matchedName && i.matchedName.toLowerCase().includes(target)) ||
          (i.productName && i.productName.toLowerCase().includes(target))
        );
        if (idx !== -1) {
          removedItem = session.lineItems.splice(idx, 1)[0];
        }
      }

      // If no specific target matched or user just entered 0, remove the last item
      if (!removedItem && session.lineItems.length > 0) {
        removedItem = session.lineItems.pop();
      }

      if (removedItem) {
        this.recalculateTotals(session);
        VoiceBillService.updateSessionStatus(session);

        const replyPrefix =
          lang === 'hi'
            ? `${removedItem.matchedName || removedItem.productName} बिल से हटा दिया गया है। `
            : `Removed "${removedItem.matchedName || removedItem.productName}" from the bill. `;

        const nextRes = this.checkNextStepOrConfirm(session, lang);
        nextRes.reply = replyPrefix + nextRes.reply;
        return nextRes;
      } else {
        const reply = lang === 'hi'
          ? 'हटाने के लिए बिल में कोई उत्पाद नहीं मिला।'
          : 'No items in the bill to remove.';
        return {
          reply,
          language: lang,
          session,
          readyForConfirm: session.status === 'ready_for_confirm',
          isConfirmed: false,
        };
      }
    }

    // 5. Handle slot updates (e.g. "change quantity to 4")
    if (parsed.isUpdate && parsed.updateField) {
      if (parsed.updateField === 'quantity' && parsed.quantity) {
        if (session.lineItems.length > 0) {
          session.lineItems[session.lineItems.length - 1].qty = parsed.quantity;
          session.lineItems[session.lineItems.length - 1].isQtyAssumed = false;
          session.lineItems[session.lineItems.length - 1].qtyNeedsReview = false;
          session.lineItems[session.lineItems.length - 1].qtySource = 'deterministic';
          session.isQtyAssumed = false;
          session.lastUpdateNote = lang === 'hi' ? parsed.updateNote?.hi : parsed.updateNote?.en;
        }
      } else if (parsed.updateField === 'unitPrice' && parsed.unitPrice) {
        if (session.lineItems.length > 0) {
          session.lineItems[session.lineItems.length - 1].unitPrice = parsed.unitPrice;
          session.lineItems[session.lineItems.length - 1].isPriceAssumed = false;
          session.lineItems[session.lineItems.length - 1].priceNeedsReview = false;
          session.lineItems[session.lineItems.length - 1].priceSource = 'deterministic';
          session.isPriceAssumed = false;
          session.lastUpdateNote = lang === 'hi' ? parsed.updateNote?.hi : parsed.updateNote?.en;
        }
      } else if (parsed.updateField === 'customerName' && parsed.customerName) {
        session.customerName = parsed.customerName;
        session.isNameInferred = false;
        session.lastUpdateNote = lang === 'hi' ? parsed.updateNote?.hi : parsed.updateNote?.en;
      }
      this.recalculateTotals(session);
    }

    // 3. Merge Customer Name
    if (parsed.customerName) {
      session.customerName = parsed.customerName;
      session.isNameInferred = Boolean(parsed.isNameInferred);
    }

    // 4. Merge Phone Number
    if (parsed.phone) {
      session.phone = parsed.phone;
    }

    // Propagate confidence notes
    if (parsed.confidenceNotes) {
      session.confidenceNotes = parsed.confidenceNotes;
    }
    if (parsed.isQtyAssumed) {
      session.isQtyAssumed = true;
    }
    if (parsed.isPriceAssumed) {
      session.isPriceAssumed = true;
    }

    // 5. Handle Product Selection from candidates or parser
    if (parsed.productName) {
      const pLower = parsed.productName.toLowerCase();
      const isPhoneName =
        /(?:phone|mobile|contact|call|telephone|number|फ़ोन|फोन|मोबाइल|नंबर)/i.test(pLower) ||
        /\d{5,}/.test(pLower) ||
        Boolean(VoiceBillParser.extractPhoneNumber(parsed.productName));

      if (isPhoneName) {
        const ph = VoiceBillParser.extractPhoneNumber(parsed.productName);
        if (ph && !session.phone) {
          session.phone = ph;
          parsed.phone = ph;
        }
        delete parsed.productName;
        delete slotSources.productName;
      }
    }

    if (parsed.productName) {
      const matchRes = await this.matchProduct(parsed.productName);

      if (matchRes.matchedProduct) {
        // High confidence match: add or update line item
        session.ambiguousCandidates = undefined;

        // Check if an item with the SAME productId is already in lineItems
        const existingSameItem = session.lineItems.find(
          i => i.productId === matchRes.matchedProduct!.id
        );

        if (existingSameItem) {
          if (parsed.quantity && parsed.quantity > 0) {
            existingSameItem.qty = parsed.quantity;
            existingSameItem.isQtyAssumed = parsed.isQtyAssumed;
            existingSameItem.qtyNeedsReview = parsed.qtyNeedsReview;
            existingSameItem.qtySource = slotSources.qty;
          }
          if (parsed.unitPrice && parsed.unitPrice > 0) {
            existingSameItem.unitPrice = parsed.unitPrice;
            existingSameItem.isPriceAssumed = parsed.isPriceAssumed;
            existingSameItem.priceNeedsReview = parsed.priceNeedsReview;
            existingSameItem.priceSource = slotSources.unitPrice;
          }
          if (parsed.discountPercent !== undefined) {
            existingSameItem.discountPercent = parsed.discountPercent;
            existingSameItem.discountNeedsReview = parsed.discountNeedsReview;
          }
        } else {
          // Check if existing line item can be populated or if new line
          let currentItem = session.lineItems[session.lineItems.length - 1];
          if (!currentItem || currentItem.productId) {
            // create new line item
            currentItem = {
              id: `line_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              productName: parsed.productName,
              matchedName: matchRes.matchedProduct.name,
              productId: matchRes.matchedProduct.id,
              qty: parsed.quantity || 0,
              unitPrice: parsed.unitPrice || parseFloat(matchRes.matchedProduct.salesPrice) || 0,
              discountPercent: parsed.discountPercent || 0,
              taxRate: parseFloat(matchRes.matchedProduct.taxRate) || 0,
              lineTotal: '0.00',
              isQtyAssumed: parsed.isQtyAssumed,
              isPriceAssumed: parsed.isPriceAssumed,
              qtyNeedsReview: parsed.qtyNeedsReview,
              priceNeedsReview: parsed.priceNeedsReview,
              discountNeedsReview: parsed.discountNeedsReview,
              qtySource: slotSources.qty,
              priceSource: slotSources.unitPrice,
            };
            session.lineItems.push(currentItem);
          } else {
            // populate existing line item
            currentItem.productName = parsed.productName;
            currentItem.matchedName = matchRes.matchedProduct.name;
            currentItem.productId = matchRes.matchedProduct.id;
            if (parsed.quantity) {
              currentItem.qty = parsed.quantity;
              currentItem.isQtyAssumed = parsed.isQtyAssumed;
              currentItem.qtyNeedsReview = parsed.qtyNeedsReview;
              currentItem.qtySource = slotSources.qty;
            }
            if (parsed.unitPrice) {
              currentItem.unitPrice = parsed.unitPrice;
              currentItem.isPriceAssumed = parsed.isPriceAssumed;
              currentItem.priceNeedsReview = parsed.priceNeedsReview;
              currentItem.priceSource = slotSources.unitPrice;
            } else if (!currentItem.unitPrice || currentItem.unitPrice === 0) {
              currentItem.unitPrice = parseFloat(matchRes.matchedProduct.salesPrice) || 0;
            }
            if (parsed.discountPercent !== undefined) {
              currentItem.discountPercent = parsed.discountPercent;
              currentItem.discountNeedsReview = parsed.discountNeedsReview;
            }
            currentItem.taxRate = parseFloat(matchRes.matchedProduct.taxRate) || 0;
          }
        }
      } else if (matchRes.candidates.length > 0) {
        // Ambiguous match: ask user to clarify from candidates
        session.ambiguousCandidates = matchRes.candidates;
        const candidateNames = matchRes.candidates.map(c => c.name).join(', ');
        const reply =
          lang === 'hi'
            ? `आप कौन सा उत्पाद जोड़ना चाहते हैं — [${candidateNames}]?`
            : `Which product did you mean — [${candidateNames}]?`;

        return {
          reply,
          language: lang,
          session,
          readyForConfirm: false,
          isConfirmed: false,
          options: matchRes.candidates.map(c => c.name),
        };
      } else {
        // No match found in catalog: ONLY add as placeholder if it clearly looks like furniture goods!
        const isFurnitureLike = /(?:desk|chair|table|sofa|planks|wood|bookshelf|cabinet|bed|furniture|stool|bench|drawer|shelf|board|wardrobe|stand|rack|almirah|almiras|अलमारी|कुर्सी|मेज़|तख्ता|खाट)/i.test(parsed.productName);
        if (isFurnitureLike) {
          let currentItem = session.lineItems[session.lineItems.length - 1];
          if (!currentItem || currentItem.productId) {
            currentItem = {
              id: `line_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              productName: parsed.productName,
              qty: parsed.quantity || 0,
              unitPrice: parsed.unitPrice || 0,
              discountPercent: parsed.discountPercent || 0,
              taxRate: 0,
              lineTotal: '0.00',
              isQtyAssumed: parsed.isQtyAssumed,
              isPriceAssumed: parsed.isPriceAssumed,
              qtyNeedsReview: parsed.qtyNeedsReview,
              priceNeedsReview: parsed.priceNeedsReview,
              discountNeedsReview: parsed.discountNeedsReview,
              qtySource: slotSources.qty,
              priceSource: slotSources.unitPrice,
            };
            session.lineItems.push(currentItem);
          }
        }
      }
    } else {
      // If no product in this message, update existing line item's qty or price if provided
      if (session.lineItems.length > 0) {
        const lastItem = session.lineItems[session.lineItems.length - 1];
        if (parsed.quantity && !parsed.isUpdate) {
          lastItem.qty = parsed.quantity;
          lastItem.isQtyAssumed = parsed.isQtyAssumed;
          lastItem.qtyNeedsReview = parsed.qtyNeedsReview;
          lastItem.qtySource = slotSources.qty;
        }
        if (parsed.unitPrice && !parsed.isUpdate && parsed.unitPrice < 10000000 && String(parsed.unitPrice) !== session.phone && (!session.phone || !String(parsed.unitPrice).includes(session.phone))) {
          lastItem.unitPrice = parsed.unitPrice;
          lastItem.isPriceAssumed = parsed.isPriceAssumed;
          lastItem.priceNeedsReview = parsed.priceNeedsReview;
          lastItem.priceSource = slotSources.unitPrice;
        }
        if (parsed.discountPercent !== undefined) lastItem.discountPercent = parsed.discountPercent;
      }
    }

    this.recalculateTotals(session);

    // 6. Check for Missing Slots and generate targeted single follow-up question
    return this.checkNextStepOrConfirm(session, lang);
  }

  /**
   * Helper that evaluates the session, updates session.pendingSlot, and either prompts for the next missing slot or transitions to ready_for_confirm.
   */
  static checkNextStepOrConfirm(session: VoiceBillSession, lang: SupportedLanguage): ChatMessageResponse {
    // 1. If no line items exist at all, ask which product to add
    if (session.lineItems.length === 0) {
      session.pendingSlot = 'product';
      session.status = 'collecting';
      const reply =
        lang === 'hi'
          ? 'कृपया वह उत्पाद बताएं जिसे आप बिल में जोड़ना चाहते हैं।'
          : 'Which product would you like to add to the bill?';
      return { reply, language: lang, session, readyForConfirm: false, isConfirmed: false };
    }

    // 2. Prioritize asking for quantity of actual furniture goods/products in the bill
    const goodsNeedingQty = session.lineItems.find(
      item => item.productId && (!item.qty || item.qty <= 0 || item.isQtyAssumed)
    ) || session.lineItems.find(
      item => (!item.qty || item.qty <= 0 || item.isQtyAssumed)
    );

    if (goodsNeedingQty) {
      session.pendingSlot = 'quantity';
      session.status = 'collecting';
      const reply =
        lang === 'hi'
          ? `कृपया ${goodsNeedingQty.matchedName || goodsNeedingQty.productName} की मात्रा बताएं।`
          : `Please specify the quantity for ${goodsNeedingQty.matchedName || goodsNeedingQty.productName}.`;
      return { reply, language: lang, session, readyForConfirm: false, isConfirmed: false };
    }

    // 3. Check if any line item needs price
    const itemNeedingPrice = session.lineItems.find(
      item => !item.unitPrice || item.unitPrice <= 0
    );

    if (itemNeedingPrice) {
      session.pendingSlot = 'unitPrice';
      session.status = 'collecting';
      const reply =
        lang === 'hi'
          ? `कृपया ${itemNeedingPrice.matchedName || itemNeedingPrice.productName} की प्रति यूनिट कीमत (रुपये) बताएं।`
          : `Please specify the unit price for ${itemNeedingPrice.matchedName || itemNeedingPrice.productName}.`;
      return { reply, language: lang, session, readyForConfirm: false, isConfirmed: false };
    }

    if (!session.customerName) {
      session.pendingSlot = 'customerName';
      session.status = 'collecting';
      const reply =
        lang === 'hi'
          ? 'कृपया ग्राहक का नाम बताएं।'
          : 'Please provide the customer name.';
      return { reply, language: lang, session, readyForConfirm: false, isConfirmed: false };
    }

    if (!session.phone) {
      session.pendingSlot = 'phone';
      session.status = 'collecting';
      const reply =
        lang === 'hi'
          ? 'कृपया ग्राहक का 10-अंकीय फ़ोन नंबर बताएं।'
          : 'Please provide the customer phone number.';
      return { reply, language: lang, session, readyForConfirm: false, isConfirmed: false };
    }

    // 7. Everything filled -> Transition to ready_for_confirm
    session.pendingSlot = undefined;
    session.status = 'ready_for_confirm';

    let confirmMsg =
      lang === 'hi'
        ? `सभी विवरण प्राप्त हो गए हैं! कुल राशि ₹${session.grandTotal} है। कृपया नीचे दिए गए सारांश की समीक्षा करें और पुष्टि करें, या कोई बदलाव बताएं।`
        : `All details collected! Total amount is ₹${session.grandTotal}. Please review the summary below and confirm, or tell me any changes.`;

    if (session.lastUpdateNote) {
      confirmMsg = `${session.lastUpdateNote}. ${confirmMsg}`;
    }

    if (session.confidenceNotes && session.confidenceNotes[lang] && session.confidenceNotes[lang].length > 0) {
      const notes = session.confidenceNotes[lang].join('; ');
      confirmMsg = `[${notes}]\n\n${confirmMsg}`;
    }

    return {
      reply: confirmMsg,
      language: lang,
      session,
      readyForConfirm: true,
      isConfirmed: false,
    };
  }

  /**
   * Finalize, confirm, and settle the bill into an official Customer Invoice and Payment
   */
  static async confirmBill(
    sessionId: string,
    options?: { paymentMethod?: 'cash' | 'bank'; settlePayment?: boolean }
  ): Promise<{
    invoiceId: number;
    invoiceNumber: string;
    paymentNumber?: string;
    paymentStatus: string;
    pdfUrl: string;
    customerName: string;
    total: string;
  }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.lineItems.length === 0) {
      throw new Error('Cannot confirm bill with empty line items');
    }
    if (!session.customerName) {
      throw new Error('Customer name is required before generating bill');
    }

    // 1. Find or create contact in contacts table
    let customerId: number;
    if (session.phone) {
      const contactByPhone = await pool.query(
        `SELECT id FROM contacts WHERE mobile = $1 AND is_archived = false LIMIT 1`,
        [session.phone]
      );
      if (contactByPhone.rows.length > 0) {
        customerId = contactByPhone.rows[0].id;
      } else {
        // Create new contact
        const newContact = await pool.query(
          `INSERT INTO contacts (name, mobile, type)
           VALUES ($1, $2, 'customer')
           RETURNING id;`,
          [session.customerName, session.phone]
        );
        customerId = newContact.rows[0].id;
      }
    } else {
      const contactByName = await pool.query(
        `SELECT id FROM contacts WHERE name ILIKE $1 AND is_archived = false LIMIT 1`,
        [session.customerName]
      );
      if (contactByName.rows.length > 0) {
        customerId = contactByName.rows[0].id;
      } else {
        const newContact = await pool.query(
          `INSERT INTO contacts (name, type)
           VALUES ($1, 'customer')
           RETURNING id;`,
          [session.customerName]
        );
        customerId = newContact.rows[0].id;
      }
    }

    // 2. Prepare invoice line items
    const lines = session.lineItems.map(item => {
      // Compute discounted unit price if discount was specified
      let effPrice = new Decimal(item.unitPrice);
      if (item.discountPercent && item.discountPercent > 0) {
        const factor = new Decimal(1).minus(new Decimal(item.discountPercent).dividedBy(100));
        effPrice = effPrice.times(factor);
      }

      return {
        productId: item.productId || 1, // fallback to product 1 if unmatched
        qty: String(item.qty),
        unitPrice: effPrice.toFixed(2),
        taxRate: String(item.taxRate || '0.00'),
      };
    });

    const todayStr = new Date().toISOString().split('T')[0];
    const dueDateStr = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // 3. Create invoice via InvoiceService
    const invoice = await InvoiceService.createInvoice({
      customerId,
      invoiceDate: todayStr,
      dueDate: dueDateStr,
      lines,
    });

    // 4. Confirm invoice via InvoiceService (triggers ledger posting & stock movement in transaction)
    await InvoiceService.confirmInvoice(invoice.id);

    // 5. Register and post payment settlement in database so invoice is fully SETTLED (PAID)
    let paymentNumber: string | undefined;
    const shouldSettle = options?.settlePayment !== false;
    if (shouldSettle) {
      try {
        const method = options?.paymentMethod || 'cash';
        const payment = await PaymentService.createPayment({
          direction: 'inbound',
          partnerId: customerId,
          method,
          paymentDate: todayStr,
          amount: invoice.total,
          allocations: [{
            invoiceId: invoice.id,
            amount: invoice.total,
          }],
        });
        paymentNumber = payment.number;
      } catch (payErr) {
        console.warn('Failed to auto-settle payment for confirmed bill:', payErr);
      }
    }

    // 6. Update session state
    session.status = 'confirmed';
    session.invoiceId = invoice.id;
    session.invoiceNumber = invoice.number;
    session.paymentNumber = paymentNumber;
    session.paymentStatus = paymentNumber ? 'paid' : 'not_paid';
    session.pdfUrl = `/api/invoices/${invoice.id}/pdf`;

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      paymentNumber,
      paymentStatus: paymentNumber ? 'paid' : 'not_paid',
      pdfUrl: `/api/invoices/${invoice.id}/pdf`,
      customerName: session.customerName,
      total: invoice.total,
    };
  }
}
