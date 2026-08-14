import { z } from "zod";

const credField = z.string().trim().max(500).optional();

export const dingCredentialsSchema = z.object({
  DINGCONNECT_BASE_URL: credField,
  DINGCONNECT_API_KEY: credField,
  DINGCONNECT_WEBHOOK_SECRET: credField,
});

export type DingCredentialsInput = z.infer<typeof dingCredentialsSchema>;
export const parseDingCredentialsInput = (input: unknown) => dingCredentialsSchema.parse(input);

export const dingTopupSchema = z.object({
  walletId: z.string().uuid(),
  skuCode: z.string().trim().min(1).max(120),
  operator: z.string().trim().max(120).default(""),
  countryCode: z.string().trim().max(4).default(""),
  phone: z.string().trim().min(6).max(24),
  amount: z.number().positive().max(100000),
});

export type DingTopupInput = z.input<typeof dingTopupSchema>;
export const parseDingTopupInput = (input: unknown) => dingTopupSchema.parse(input);

export const dingProductsSchema = z.object({
  countryCode: z.string().trim().min(2).max(4),
});

export type DingProductsInput = z.infer<typeof dingProductsSchema>;
export const parseDingProductsInput = (input: unknown) => dingProductsSchema.parse(input);
