import Stripe from "stripe";
const stripe = new Stripe("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", { apiVersion: "2024-04-10" }); // Thay bằng API key production

// 1. Tạo Product (nếu chưa có)
const product = await stripe.products.create({
  name: "Premium",
  description: "Premium plan ideal for individuals and teams working on advanced projects. Includes access to AI-powered tools, team collaboration features, extended usage limits, and priority support.",
  active: true,
});

// 2. Tạo Price cho product đó, quantity-based, $20/tháng/slot
const price = await stripe.prices.create({
  unit_amount: 2000, // 20 đô la, đơn vị là cent
  currency: "usd",
  recurring: { interval: "month" },
  product: product.id, // Gắn price vào product
  nickname: "Premium Slot",
  billing_scheme: "per_unit", // quantity-based
});

console.log("Product ID:", product.id);
console.log("Price ID:", price.id);
