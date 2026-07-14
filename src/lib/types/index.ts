// ===== Database Types =====

export interface Shop {
  id: string;
  name: string;
  invite_code?: string;
  owner_id: string;
  created_at: string;
}

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  shop_id: string;
  email?: string;
  created_at: string;
}

export interface Ingredient {
  id: string;
  user_id?: string; // Legacy
  shop_id: string;
  name: string;
  quantity: number;       // ปริมาณที่ซื้อมา
  unit: string;           // หน่วย (กรัม, มล., ชิ้น)
  price: number;          // ราคาที่ซื้อมา
  price_per_unit: number; // ราคา/หน่วย
  stock_quantity: number; // จำนวนคงเหลือในคลัง
  barcode?: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Packaging {
  id: string;
  user_id?: string; // Legacy
  shop_id: string;
  name: string;
  quantity: number;
  price: number;
  price_per_unit: number;
  stock_quantity: number;
  unit: string;
  created_at: string;
  updated_at: string;
}

export interface Recipe {
  id: string;
  user_id?: string; // Legacy
  shop_id: string;
  name: string;
  description?: string;
  selling_price: number;
  yield_quantity: number;
  image_url?: string;
  category: string;
  created_at: string;
  updated_at: string;
  // Computed / joined
  ingredients?: RecipeIngredient[];
  packaging?: RecipePackaging[];
  sub_recipes?: RecipeSubRecipe[];
  total_cost?: number;
  profit?: number;
  margin?: number;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  ingredient_id: string;
  quantity_used: number;
  unit: string;
  input_mode?: 'per_piece' | 'total_batch';
  // Joined
  ingredient?: Ingredient;
  cost?: number;
}

export interface RecipePackaging {
  id: string;
  recipe_id: string;
  packaging_id: string;
  quantity_used: number;
  // Joined
  packaging?: Packaging;
  cost?: number;
}

// สูตรซ้อนสูตร: ใช้ Recipe เป็นวัตถุดิบใน Recipe อื่น
export interface RecipeSubRecipe {
  id: string;
  recipe_id: string;       // สูตรหลัก
  sub_recipe_id: string;   // สูตรย่อยที่นำมาใช้
  quantity_used: number;   // จำนวนชิ้น/หน่วยที่ใช้จาก yield ของสูตรย่อย
  unit: string;            // หน่วย
  created_at?: string;
  // Joined
  sub_recipe?: Recipe;
  cost?: number;
}

// สินค้าที่ขายให้ลูกค้า
export interface Product {
  id: string;
  user_id?: string; // Legacy
  shop_id: string;
  name: string;            // ชื่อสินค้า เช่น ทองม้วนช็อคโกแลต (ถุงเล็ก)
  description?: string;
  flavor?: string;         // รสชาติ
  pieces_per_pack: number; // จำนวนชิ้นต่อแพ็ค/ถุง
  selling_price: number;   // ราคาขาย
  category: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
  // Computed / joined
  product_recipes?: ProductRecipe[];
  product_packaging?: ProductPackaging[];
  total_cost?: number;
  profit?: number;
  margin?: number;
}

// ความสัมพันธ์ Product → Recipe
export interface ProductRecipe {
  id: string;
  product_id: string;
  recipe_id: string;
  quantity_used: number; // ใช้กี่ชิ้นจากสูตรนั้น
  // Joined
  recipe?: Recipe;
  cost?: number;
}

// บรรจุภัณฑ์ที่ใช้กับสินค้า
export interface ProductPackaging {
  id: string;
  product_id: string;
  packaging_id: string;
  quantity_used: number;
  // Joined
  packaging?: Packaging;
  cost?: number;
}

export interface Order {
  id: string;
  user_id?: string; // Legacy
  shop_id: string;
  order_number: string;
  status: 'pending' | 'completed' | 'cancelled';
  total_cost: number;
  total_revenue: number;
  total_profit: number;
  customer_name?: string;
  customer_phone?: string;
  order_date?: string;
  delivery_date?: string;
  notes?: string;
  created_at: string;
  completed_at?: string;
  // Joined
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_cost: number;
  unit_price: number;
  subtotal_cost: number;
  subtotal_revenue: number;
  // Joined
  product?: Product;
}

export interface PurchaseBill {
  id: string;
  user_id?: string; // Legacy
  shop_id: string;
  bill_image_url?: string;
  total_amount: number;
  vendor_name?: string;
  purchase_date: string;
  ocr_raw_text?: string;
  created_at: string;
}

export interface PurchaseBillItem {
  id: string;
  bill_id: string;
  ingredient_id?: string;
  item_name: string;
  quantity: number;
  unit: string;
  price: number;
}

// ===== UI Types =====

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

export interface StockCheckResult {
  ingredient_id: string;
  ingredient_name: string;
  required: number;
  available: number;
  unit: string;
  sufficient: boolean;
  shortage: number;
}

export interface DashboardStats {
  todayRevenue: number;
  todayCost: number;
  todayProfit: number;
  todayOrders: number;
  revenueChange: number;
  costChange: number;
  profitChange: number;
  ordersChange: number;
}

export interface TopProduct {
  recipe_id: string;
  recipe_name: string;
  total_sold: number;
  total_revenue: number;
  total_profit: number;
  margin: number;
}

export interface TimeAnalysis {
  period: string;
  orders: number;
  revenue: number;
}

export type UnitType = 'กรัม' | 'กิโลกรัม' | 'มิลลิลิตร' | 'ลิตร' | 'ชิ้น' | 'ถุง' | 'ขวด' | 'กล่อง' | 'แพ็ค' | 'ใบ' | 'อัน';

export const UNIT_OPTIONS: UnitType[] = [
  'กรัม', 'กิโลกรัม', 'มิลลิลิตร', 'ลิตร', 'ชิ้น', 'ถุง', 'ขวด', 'กล่อง', 'แพ็ค', 'ใบ', 'อัน'
];

export const CATEGORY_OPTIONS = [
  'อาหาร', 'เครื่องดื่ม', 'ขนม', 'เบเกอรี่', 'ของทานเล่น', 'อื่นๆ'
];
