import { z } from "zod";

export const bazikTopupSchema = z.object({
  walletId: z.string().uuid(),
  amount: z.number().positive().max(1_000_000),
  currency: z.enum(["MXN", "USD", "HTG", "DOP", "EUR"]),
});

export const bazikPayoutSchema = z.object({
  provider: z.enum(["moncash", "natcash"]),
  phone: z.string().min(6).max(20),
  amount: z.number().positive().max(1_000_000),
  currency: z.enum(["HTG", "USD"]),
});

export type BazikTopupRequest = z.infer<typeof bazikTopupSchema>;
export type BazikPayoutRequest = z.infer<typeof bazikPayoutSchema>;

export const parseBazikTopupInput = (input: unknown) => bazikTopupSchema.parse(input);
export const parseBazikPayoutInput = (input: unknown) => bazikPayoutSchema.parse(input);
