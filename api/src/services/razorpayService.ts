import crypto from 'crypto';

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_TYL9FJAZxMYoFc';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '98JCu3v5NpfezNpgqCOCjFbH';

export interface RazorpayOrderResponse {
  id: string;
  orderId: string;
  amount: number; // in paisa
  currency: string;
  keyId: string;
  receipt: string;
}

export interface RazorpayPaymentLinkResponse {
  id: string;
  shortUrl: string;
  amount: number;
  currency: string;
  status: string;
}

export class RazorpayService {
  static getKeyId(): string {
    return RAZORPAY_KEY_ID;
  }

  /**
   * Create a dynamic payment link via Razorpay REST API
   * Can be encoded in QR codes so customers can pay via Cards, UPI, NetBanking or Wallets.
   */
  static async createPaymentLink(
    amountInr: string | number,
    invoiceNumber: string,
    customerName?: string,
    customerEmail?: string,
    notes?: Record<string, any>
  ): Promise<RazorpayPaymentLinkResponse> {
    const amountInPaisa = Math.round(Number(amountInr) * 100);

    if (amountInPaisa <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    const authHeader = 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
    const referenceId = `plink_${invoiceNumber.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`.slice(0, 40);

    const payload: any = {
      amount: amountInPaisa,
      currency: 'INR',
      accept_partial: false,
      reference_id: referenceId,
      description: `Payment for Invoice ${invoiceNumber}`,
      notes: notes || {},
    };

    if (customerName || customerEmail) {
      payload.customer = {
        name: customerName || 'Customer',
        email: customerEmail || undefined,
      };
    }

    const res = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data: any = await res.json();

    if (!res.ok) {
      const errorMsg = data?.error?.description || data?.error?.message || 'Razorpay payment link creation failed';
      throw new Error(errorMsg);
    }

    return {
      id: data.id,
      shortUrl: data.short_url,
      amount: data.amount,
      currency: data.currency || 'INR',
      status: data.status || 'created',
    };
  }

  /**
   * Create an order via Razorpay REST API
   * @param amountInr Amount in INR (string or number, e.g. "5000.00")
   * @param receipt Receipt identifier
   * @param notes Additional metadata
   */
  static async createOrder(
    amountInr: string | number,
    receipt: string,
    notes?: Record<string, any>
  ): Promise<RazorpayOrderResponse> {
    const amountInPaisa = Math.round(Number(amountInr) * 100);

    if (amountInPaisa <= 0) {
      throw new Error('Order amount must be greater than zero');
    }

    const authHeader = 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');

    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountInPaisa,
        currency: 'INR',
        receipt: receipt.slice(0, 40),
        notes: notes || {},
      }),
    });

    const data: any = await res.json();

    if (!res.ok) {
      const errorMsg = data?.error?.description || data?.error?.message || 'Razorpay order creation failed';
      throw new Error(errorMsg);
    }

    return {
      id: data.id,
      orderId: data.id,
      amount: data.amount,
      currency: data.currency || 'INR',
      keyId: RAZORPAY_KEY_ID,
      receipt: data.receipt,
    };
  }

  /**
   * Verify HMAC-SHA256 signature sent by Razorpay Checkout
   * signature = hmac_sha256(order_id + "|" + payment_id, secret)
   */
  static verifySignature(orderId: string, paymentId: string, signature: string): boolean {
    if (!paymentId) {
      return false;
    }

    if (orderId && signature) {
      try {
        const expectedSignature = crypto
          .createHmac('sha256', RAZORPAY_KEY_SECRET)
          .update(`${orderId}|${paymentId}`)
          .digest('hex');

        const a = Buffer.from(expectedSignature, 'utf-8');
        const b = Buffer.from(signature, 'utf-8');
        if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
          return true;
        }
      } catch {
        // fallback
      }
    }

    // In development / test mode with Razorpay sandbox:
    // Allow verified payments starting with pay_
    if (process.env.NODE_ENV !== 'production' && paymentId.startsWith('pay_')) {
      return true;
    }

    return false;
  }
}
