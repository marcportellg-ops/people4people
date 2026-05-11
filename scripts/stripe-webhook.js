/**
 * Stripe webhook server for People4People
 *
 * Setup:
 *   cd scripts && npm install
 *   Set env vars (see below) then: node stripe-webhook.js
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY          — Stripe secret key (sk_live_... or sk_test_...)
 *   STRIPE_WEBHOOK_SECRET      — from Stripe Dashboard → Webhooks → signing secret
 *   GOOGLE_APPLICATION_CREDENTIALS — path to Firebase service account JSON
 *   PORT                       — optional, defaults to 4242
 *
 * Stripe Dashboard setup:
 *   1. Create two Payment Links (Products → Payment Links):
 *      - Helper Premium  €4/mo  → success URL: https://yourapp.com/subscribe?success=1&plan=helper
 *      - Creator Premium €8/mo  → success URL: https://yourapp.com/subscribe?success=1&plan=creator
 *   2. Add the Payment Link URLs to your .env as VITE_STRIPE_HELPER_LINK / VITE_STRIPE_CREATOR_LINK
 *   3. Register this server as a webhook endpoint in Stripe Dashboard
 *      - Events: checkout.session.completed, customer.subscription.deleted
 *
 * The payment link price IDs must match HELPER_PRICE_ID / CREATOR_PRICE_ID below.
 */

import express from "express";
import Stripe from "stripe";
import admin from "firebase-admin";

const PORT              = process.env.PORT ?? 4242;
const STRIPE_SECRET     = process.env.STRIPE_SECRET_KEY;
const WEBHOOK_SECRET    = process.env.STRIPE_WEBHOOK_SECRET;

// Map Stripe price IDs → plan names. Update these after creating your products in Stripe.
const PRICE_TO_PLAN = {
  [process.env.STRIPE_HELPER_PRICE_ID]:  "helper",
  [process.env.STRIPE_CREATOR_PRICE_ID]: "creator",
};

if (!STRIPE_SECRET) {
  console.error("Missing STRIPE_SECRET_KEY");
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET, { apiVersion: "2024-04-10" });
admin.initializeApp();
const db = admin.firestore();

const app = express();

// Raw body needed for Stripe signature verification
app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const uid = session.client_reference_id;
    if (!uid) return res.json({ received: true });

    // Determine plan from the line items
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
    let plan = null;
    for (const item of lineItems.data) {
      plan = PRICE_TO_PLAN[item.price?.id];
      if (plan) break;
    }
    if (!plan) return res.json({ received: true });

    await db.doc(`users/${uid}`).set({
      plan,
      stripeCustomerId: session.customer ?? null,
      stripeSubscriptionId: session.subscription ?? null,
      planUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`[webhook] Set plan=${plan} for uid=${uid}`);
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object;
    // Find user by stripeSubscriptionId and downgrade to free
    const snap = await db.collection("users").where("stripeSubscriptionId", "==", sub.id).limit(1).get();
    if (!snap.empty) {
      await snap.docs[0].ref.set({ plan: "free", stripeSubscriptionId: null, planUpdatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      console.log(`[webhook] Downgraded uid=${snap.docs[0].id} to free (subscription cancelled)`);
    }
  }

  res.json({ received: true });
});

app.listen(PORT, () => console.log(`Stripe webhook server listening on port ${PORT}`));
