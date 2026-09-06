import { z } from 'zod';

export const SalesOrderLineInputSchema = z.object({
  productId: z.number().int().positive('Product is required'),
  analyticAccountId: z.number().int().positive().nullable().optional(),
  qty: z.string().or(z.number()).transform((val: string | number) => String(val)),
  unitPrice: z.string().or(z.number()).transform((val: string | number) => String(val)),
  taxRate: z.string().or(z.number()).default('18.00').transform((val: string | number) => String(val)),
});

export const CreateSalesOrderSchema = z.object({
  customerId: z.number().int().positive('Customer is required'),
  orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').default(() => new Date().toISOString().split('T')[0]),
  lines: z.array(SalesOrderLineInputSchema).min(1, 'At least one line item is required'),
});

export type SalesOrderLineInput = z.infer<typeof SalesOrderLineInputSchema>;
export type CreateSalesOrderInput = z.infer<typeof CreateSalesOrderSchema>;

export interface SalesOrderLineDTO {
  id: number;
  soId: number;
  productId: number;
  productName?: string;
  productSku?: string;
  analyticAccountId?: number | null;
  analyticAccountName?: string | null;
  qty: string;
  unitPrice: string;
  taxRate: string;
  taxAmount: string;
  subtotal: string;
  total: string;
}

export interface SalesOrderDTO {
  id: number;
  number: string;
  customerId: number;
  customerName?: string;
  orderDate: string;
  status: 'draft' | 'confirmed' | 'cancelled';
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  lines: SalesOrderLineDTO[];
  invoiceId?: number | null;
  invoiceNumber?: string | null;
  invoiceStatus?: string | null;
  isInvoiced?: boolean;
  createdAt: string;
  updatedAt: string;
}
