#!/usr/bin/env tsx

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import Stripe from "stripe";
import envVars from "../app/lib/envVars";

const stripe = new Stripe(envVars.STRIPE_SECRET_KEY);

const [monthly, annual] = await Promise.all([
  stripe.prices.retrieve(envVars.STRIPE_PRICE_MONTHLY_ID),
  stripe.prices.retrieve(envVars.STRIPE_PRICE_ANNUAL_ID),
]);

const monthlyAmount = (monthly.unit_amount ?? 0) / 100;
const annualAmount = (annual.unit_amount ?? 0) / 100;
const annualSavings = Math.round(monthlyAmount * 12 - annualAmount);

const prices = { monthlyAmount, annualAmount, annualSavings };

writeFileSync(
  resolve(import.meta.dirname, "../app/data/stripe-prices.json"),
  JSON.stringify(prices, null, 2),
);

console.log("Fetched Stripe prices:", prices);
