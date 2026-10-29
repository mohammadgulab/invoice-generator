const { z } = require('zod');

const STATUSES = ['Draft', 'Sent', 'Paid'];

const optionalText = (max) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().trim().max(max).nullable().optional());

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s), 'Not a real date');

const clientSchema = z.object({
  name: z.string({ required_error: 'Name is required' }).trim().min(1, 'Name is required').max(120),
  company: optionalText(160),
  email: z.preprocess((v) => (v === '' ? null : v), z.string().trim().email('Enter a valid email').max(200).nullable().optional()),
  address: optionalText(500),
  vat_number: optionalText(40),
});

const moneyString = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === 'number' ? v.toString() : v.trim()))
  .refine((s) => /^\d+(\.\d{1,2})?$/.test(s), 'Must be a positive amount with up to 2 decimals')
  .refine((s) => Number(s) <= 100000000, 'Amount is too large');

const itemSchema = z.object({
  description: z.string({ required_error: 'Description is required' }).trim().min(1, 'Description is required').max(300),
  quantity: z.coerce
    .number({ invalid_type_error: 'Quantity must be a number' })
    .positive('Quantity must be more than 0')
    .max(1000000)
    .refine((n) => Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-6, 'Quantity can have up to 3 decimals'),
  unit_price: moneyString,
});

const invoiceSchema = z
  .object({
    client_id: z.coerce.number({ invalid_type_error: 'Pick a client' }).int().positive('Pick a client'),
    issue_date: isoDate,
    due_date: isoDate,
    status: z.enum(STATUSES).default('Draft'),
    notes: optionalText(2000),
    items: z.array(itemSchema).min(1, 'Add at least one line item').max(100),
  })
  .refine((d) => d.due_date >= d.issue_date, { message: 'Due date cannot be before the issue date', path: ['due_date'] });

const statusSchema = z.object({ status: z.enum(STATUSES) });

const idParam = z.coerce.number().int().positive();

module.exports = { clientSchema, invoiceSchema, statusSchema, idParam, STATUSES };
