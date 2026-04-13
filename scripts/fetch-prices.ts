#!/usr/bin/env infisical --env prod run -- tsx

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import Stripe from "stripe";
import envVars from "../app/lib/envVars.server";

const stripe = new Stripe(envVars.STRIPE_SECRET_KEY);

const monthly = await stripe.prices.retrieve(envVars.STRIPE_PRICE_MONTHLY_ID);
console.info("Monthly price:", monthly);
const annual = await stripe.prices.retrieve(envVars.STRIPE_PRICE_ANNUAL_ID);
console.info("Annual price:", annual);

const monthlyAmount = (monthly.unit_amount ?? 0) / 100;
const annualAmount = (annual.unit_amount ?? 0) / 100;
const annualSavings = Math.round(monthlyAmount * 12 - annualAmount);

const prices = { monthlyAmount, annualAmount, annualSavings, sites: 5 };
const json = JSON.stringify(prices, null, 2);
console.info("JSON:", json);

writeFileSync(
  resolve(import.meta.dirname, "../app/data/stripe-prices.json"),
  json,
);

console.info("Fetched Stripe prices:", prices);
