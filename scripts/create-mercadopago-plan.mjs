import dotenv from 'dotenv';

dotenv.config();

const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
const baseUrl = process.env.APP_BASE_URL?.replace(/\/$/, '');
const price = Number(process.env.PREMIUM_PRICE_CLP || 4990);

if (!accessToken || !baseUrl || !Number.isInteger(price) || price <= 0) {
  console.error('Configura MERCADOPAGO_ACCESS_TOKEN, APP_BASE_URL y PREMIUM_PRICE_CLP en .env.');
  process.exit(1);
}

const response = await fetch('https://api.mercadopago.com/preapproval_plan', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    reason: 'Garage Premium - suscripción mensual',
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: price,
      currency_id: 'CLP'
    },
    back_url: `${baseUrl}/?subscription=return`
  })
});

const result = await response.json();
if (!response.ok) {
  console.error('No se pudo crear el plan:', result.message || result);
  process.exit(1);
}

console.log(`Plan creado. Copia este valor en MERCADOPAGO_PLAN_ID: ${result.id}`);
