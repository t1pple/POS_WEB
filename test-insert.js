const { createClient } = require('@supabase/supabase-js');


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const { data, error } = await supabase.from('order_items').insert([
    {
      order_id: '00000000-0000-0000-0000-000000000000',
      product_id: '00000000-0000-0000-0000-000000000000',
      quantity: 1,
      unit_cost: 10,
      unit_price: 20,
      subtotal_cost: 10,
      subtotal_revenue: 20
    }
  ]).select();

  if (error) {
    console.error("Supabase Error Details:", error);
    console.error("Code:", error.code);
    console.error("Details:", error.details);
    console.error("Hint:", error.hint);
    console.error("Message:", error.message);
  } else {
    console.log("Insert success!");
  }
}

check();
