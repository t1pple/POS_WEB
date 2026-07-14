import { Ingredient, RecipeIngredient, RecipePackaging, Packaging, StockCheckResult, OrderItem } from '@/lib/types';

/**
 * คำนวณราคาต่อหน่วย
 */
export function calculatePricePerUnit(price: number, quantity: number): number {
  if (quantity <= 0) return 0;
  return price / quantity;
}

/**
 * คำนวณต้นทุนวัตถุดิบในสูตร
 */
export function calculateIngredientCost(
  ingredient: Ingredient,
  quantityUsed: number
): number {
  return ingredient.price_per_unit * quantityUsed;
}

/**
 * คำนวณต้นทุนรวมของสูตร
 */
export function calculateRecipeTotalCost(
  recipeIngredients: (RecipeIngredient & { ingredient: Ingredient })[],
  recipePackaging: (RecipePackaging & { packaging: Packaging })[]
): number {
  const ingredientsCost = recipeIngredients.reduce((sum, ri) => {
    return sum + (ri.ingredient.price_per_unit * ri.quantity_used);
  }, 0);

  const packagingCost = recipePackaging.reduce((sum, rp) => {
    return sum + (rp.packaging.price * rp.quantity_used);
  }, 0);

  return ingredientsCost + packagingCost;
}

/**
 * คำนวณกำไร
 */
export function calculateProfit(sellingPrice: number, totalCost: number): number {
  return sellingPrice - totalCost;
}

/**
 * คำนวณ margin เป็นเปอร์เซ็นต์
 */
export function calculateMargin(sellingPrice: number, totalCost: number): number {
  if (sellingPrice <= 0) return 0;
  return ((sellingPrice - totalCost) / sellingPrice) * 100;
}

/**
 * ตรวจสอบ stock ว่าพอสำหรับออเดอร์หรือไม่
 */
export function checkStock(
  orderItems: { recipe: { ingredients: (RecipeIngredient & { ingredient: Ingredient })[] }; quantity: number }[]
): StockCheckResult[] {
  // รวมวัตถุดิบที่ต้องใช้ทั้งหมด
  const requiredMap = new Map<string, { name: string; required: number; available: number; unit: string }>();

  for (const item of orderItems) {
    for (const ri of item.recipe.ingredients) {
      const totalNeeded = ri.quantity_used * item.quantity;
      const existing = requiredMap.get(ri.ingredient_id);

      if (existing) {
        existing.required += totalNeeded;
      } else {
        requiredMap.set(ri.ingredient_id, {
          name: ri.ingredient.name,
          required: totalNeeded,
          available: ri.ingredient.stock_quantity,
          unit: ri.unit,
        });
      }
    }
  }

  return Array.from(requiredMap.entries()).map(([id, data]) => ({
    ingredient_id: id,
    ingredient_name: data.name,
    required: data.required,
    available: data.available,
    unit: data.unit,
    sufficient: data.available >= data.required,
    shortage: Math.max(0, data.required - data.available),
  }));
}

/**
 * คำนวณสรุปออเดอร์
 */
export function calculateOrderSummary(
  items: { recipe_selling_price: number; recipe_cost: number; quantity: number }[]
): { totalCost: number; totalRevenue: number; totalProfit: number } {
  let totalCost = 0;
  let totalRevenue = 0;

  for (const item of items) {
    totalCost += item.recipe_cost * item.quantity;
    totalRevenue += item.recipe_selling_price * item.quantity;
  }

  return {
    totalCost,
    totalRevenue,
    totalProfit: totalRevenue - totalCost,
  };
}
