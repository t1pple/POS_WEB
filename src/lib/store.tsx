'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Profile, Shop, Ingredient, Packaging, Recipe, RecipeIngredient, RecipePackaging,
  RecipeSubRecipe, Product, ProductRecipe, ProductPackaging,
  Order, OrderItem, Toast, ToastType
} from '@/lib/types';
import { calculatePricePerUnit } from '@/lib/utils/calculations';
import { generateOrderNumber } from '@/lib/utils/format';
import { v4 as uuidv4 } from 'uuid';

interface StoreState {
  isAuthenticated: boolean;
  profile: Profile | null;
  shop: Shop | null;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (data: { email: string; password: string; first_name: string; last_name: string; shop_name?: string; invite_code?: string }) => Promise<boolean>;
  logout: () => Promise<void>;
  updateShop: (name: string) => Promise<void>;

  ingredients: Ingredient[];
  addIngredient: (data: Omit<Ingredient, 'id' | 'shop_id' | 'price_per_unit' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateIngredient: (id: string, data: Partial<Ingredient>) => Promise<void>;
  deleteIngredient: (id: string) => Promise<void>;

  packaging: Packaging[];
  addPackaging: (data: Omit<Packaging, 'id' | 'shop_id' | 'price_per_unit' | 'created_at' | 'updated_at'>) => Promise<void>;
  updatePackaging: (id: string, data: Partial<Packaging>) => Promise<void>;
  deletePackaging: (id: string) => Promise<void>;

  recipes: Recipe[];
  recipeIngredients: RecipeIngredient[];
  recipePackaging: RecipePackaging[];
  recipeSubRecipes: RecipeSubRecipe[];
  addRecipe: (
    recipe: Omit<Recipe, 'id' | 'shop_id' | 'created_at' | 'updated_at'>,
    ingredientsList: { ingredient_id: string; quantity_used: number; unit: string; input_mode: 'per_piece' | 'total_batch' }[],
    packagingList: { packaging_id: string; quantity_used: number }[],
    subRecipeList: { sub_recipe_id: string; quantity_used: number; unit: string }[]
  ) => Promise<string>;
  deleteRecipe: (id: string) => Promise<void>;
  getRecipeCost: (recipeId: string, visited?: Set<string>) => number;
  getRecipeWithDetails: (recipeId: string) => Recipe | null;

  products: Product[];
  productRecipes: ProductRecipe[];
  productPackaging: ProductPackaging[];
  addProduct: (
    product: Omit<Product, 'id' | 'shop_id' | 'created_at' | 'updated_at'>,
    recipeList: { recipe_id: string; quantity_used: number }[],
    packagingList: { packaging_id: string; quantity_used: number }[]
  ) => Promise<string>;
  updateProductFull: (
    id: string,
    product: Partial<Omit<Product, 'id' | 'shop_id' | 'created_at' | 'updated_at'>>,
    recipeList: { recipe_id: string; quantity_used: number }[],
    packagingList: { packaging_id: string; quantity_used: number }[]
  ) => Promise<void>;
  updateProduct: (id: string, data: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  getProductCost: (productId: string) => number;
  getProductWithDetails: (productId: string) => Product | null;

  orders: Order[];
  orderItems: OrderItem[];
  createOrder: (
    items: { product_id: string; quantity: number }[],
    options?: {
      notes?: string;
      customer_name?: string;
      customer_phone?: string;
      order_date?: string;
      delivery_date?: string;
    }
  ) => Promise<string>;
  completeOrder: (id: string) => Promise<void>;
  cancelOrder: (id: string) => Promise<void>;
  updateOrderStatus: (id: string, status: string) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  updateOrderFull: (
    id: string,
    items: { product_id: string; quantity: number }[],
    options?: {
      notes?: string;
      customer_name?: string;
      customer_phone?: string;
      order_date?: string;
      delivery_date?: string;
      status?: 'pending' | 'completed' | 'cancelled';
    }
  ) => Promise<string>;

  toasts: Toast[];
  addToast: (type: ToastType, message: string) => void;
  removeToast: (id: string) => void;
}

const StoreContext = createContext<StoreState | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [packaging, setPackaging] = useState<Packaging[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([]);
  const [recipePackaging, setRecipePackaging] = useState<RecipePackaging[]>([]);
  const [recipeSubRecipes, setRecipeSubRecipes] = useState<RecipeSubRecipe[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productRecipes, setProductRecipes] = useState<ProductRecipe[]>([]);
  const [productPackaging, setProductPackaging] = useState<ProductPackaging[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Fetch Data (2-stage: profile/shop first, then filter all data by shop_id)
  const fetchAllData = useCallback(async (userId: string) => {
    // Stage 1: fetch profile to get shop_id
    const { data: pData } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (!pData) return;
    setProfile(pData);

    const shopId = pData.shop_id;
    if (!shopId) return;

    // Stage 2: fetch everything filtered by shop_id
    const { data: sData } = await supabase.from('shops').select('*').eq('id', shopId).single();
    if (sData) setShop(sData);

    const [
      { data: iData },
      { data: pkgData },
      { data: rData },
      { data: riData },
      { data: rsrData },
      { data: prodData },
      { data: prData },
      { data: ppData },
      { data: oData },
      { data: oiData },
    ] = await Promise.all([
      supabase.from('ingredients').select('*').eq('shop_id', shopId).order('created_at', { ascending: false }),
      supabase.from('packaging').select('*').eq('shop_id', shopId).order('created_at', { ascending: false }),
      supabase.from('recipes').select('*').eq('shop_id', shopId).order('created_at', { ascending: false }),
      supabase.from('recipe_ingredients').select('*'),
      supabase.from('recipe_sub_recipes').select('*'),
      supabase.from('products').select('*').eq('shop_id', shopId).order('created_at', { ascending: false }),
      supabase.from('product_recipes').select('*'),
      supabase.from('product_packaging').select('*'),
      supabase.from('orders').select('*').eq('shop_id', shopId).order('created_at', { ascending: false }),
      supabase.from('order_items').select('*'),
    ]);

    if (iData) setIngredients(iData);
    if (pkgData) setPackaging(pkgData);
    if (rData) setRecipes(rData);
    if (riData) setRecipeIngredients(riData);
    if (rsrData) setRecipeSubRecipes(rsrData);
    if (prodData) setProducts(prodData);
    if (prData) setProductRecipes(prData);
    if (ppData) setProductPackaging(ppData);
    if (oData) setOrders(oData);
    if (oiData) setOrderItems(oiData);
  }, [supabase]);

  useEffect(() => {
    let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

    const setupRealtime = (shopId: string, userId: string) => {
      // Remove old channel if exists
      if (realtimeChannel) supabase.removeChannel(realtimeChannel);

      realtimeChannel = supabase
        .channel(`shop-${shopId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ingredients', filter: `shop_id=eq.${shopId}` }, () => {
          supabase.from('ingredients').select('*').eq('shop_id', shopId).order('created_at', { ascending: false }).then(({ data }) => { if (data) setIngredients(data); });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'packaging', filter: `shop_id=eq.${shopId}` }, () => {
          supabase.from('packaging').select('*').eq('shop_id', shopId).order('created_at', { ascending: false }).then(({ data }) => { if (data) setPackaging(data); });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'recipes', filter: `shop_id=eq.${shopId}` }, () => {
          supabase.from('recipes').select('*').eq('shop_id', shopId).order('created_at', { ascending: false }).then(({ data }) => { if (data) setRecipes(data); });
          supabase.from('recipe_ingredients').select('*').then(({ data }) => { if (data) setRecipeIngredients(data); });
          supabase.from('recipe_sub_recipes').select('*').then(({ data }) => { if (data) setRecipeSubRecipes(data); });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'recipe_ingredients' }, () => {
          supabase.from('recipe_ingredients').select('*').then(({ data }) => { if (data) setRecipeIngredients(data); });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `shop_id=eq.${shopId}` }, () => {
          supabase.from('products').select('*').eq('shop_id', shopId).order('created_at', { ascending: false }).then(({ data }) => { if (data) setProducts(data); });
          supabase.from('product_recipes').select('*').then(({ data }) => { if (data) setProductRecipes(data); });
          supabase.from('product_packaging').select('*').then(({ data }) => { if (data) setProductPackaging(data); });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `shop_id=eq.${shopId}` }, () => {
          supabase.from('orders').select('*').eq('shop_id', shopId).order('created_at', { ascending: false }).then(({ data }) => { if (data) setOrders(data); });
          supabase.from('order_items').select('*').then(({ data }) => { if (data) setOrderItems(data); });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'shops', filter: `id=eq.${shopId}` }, () => {
          supabase.from('shops').select('*').eq('id', shopId).single().then(({ data }) => { if (data) setShop(data); });
        })
        .subscribe();
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setIsAuthenticated(true);
        fetchAllData(session.user.id).then(() => {
          // After data is loaded, get shop_id from profile and setup realtime
          supabase.from('profiles').select('shop_id').eq('id', session.user.id).single().then(({ data }) => {
            if (data?.shop_id) setupRealtime(data.shop_id, session.user.id);
          });
        });
      } else {
        setIsAuthenticated(false);
        setProfile(null);
        setIngredients([]);
        setPackaging([]);
        setRecipes([]);
        setRecipeIngredients([]);
        setRecipePackaging([]);
        setRecipeSubRecipes([]);
        setProducts([]);
        setProductRecipes([]);
        setProductPackaging([]);
        setOrders([]);
        setOrderItems([]);
        if (realtimeChannel) { supabase.removeChannel(realtimeChannel); realtimeChannel = null; }
      }
    });

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setIsAuthenticated(true);
        fetchAllData(user.id).then(() => {
          supabase.from('profiles').select('shop_id').eq('id', user.id).single().then(({ data }) => {
            if (data?.shop_id) setupRealtime(data.shop_id, user.id);
          });
        });
      }
    });

    return () => {
      subscription.unsubscribe();
      if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    };
  }, [supabase, fetchAllData]);

  // Auth
  const login = async (email: string, password: string): Promise<boolean> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return false;
    return true;
  };

  const signup = async (data: { email: string; password: string; first_name: string; last_name: string; shop_name?: string; invite_code?: string }): Promise<boolean> => {
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          first_name: data.first_name,
          last_name: data.last_name,
          shop_name: data.shop_name,
          invite_code: data.invite_code,
        }
      }
    });
    if (error) {
      console.error('Signup error:', error);
      return false;
    }
    return true;
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const updateShop = async (name: string) => {
    if (!shop) return;
    const { data: updatedShop, error } = await supabase.from('shops').update({ name }).eq('id', shop.id).select().single();
    if (updatedShop && !error) {
      setShop(updatedShop);
      addToast('success', 'เปลี่ยนชื่อร้านสำเร็จ');
    } else {
      addToast('error', 'เปลี่ยนชื่อร้านไม่สำเร็จ');
    }
  };

  // Ingredients
  const addIngredient = async (data: Omit<Ingredient, 'id' | 'shop_id' | 'price_per_unit' | 'created_at' | 'updated_at'>) => {
    if (!profile) return;
    const price_per_unit = calculatePricePerUnit(data.price, data.quantity);
    const { data: newIng } = await supabase.from('ingredients').insert({
      shop_id: profile.shop_id,
      user_id: profile.id,
      name: data.name,
      quantity: data.quantity,
      unit: data.unit,
      price: data.price,
      price_per_unit,
      stock_quantity: data.stock_quantity,
      barcode: data.barcode,
    }).select().single();
    if (newIng) setIngredients(prev => [newIng, ...prev]);
  };

  const updateIngredient = async (id: string, data: Partial<Ingredient>) => {
    let updateData = { ...data };
    if (data.price !== undefined || data.quantity !== undefined) {
      const ing = ingredients.find(i => i.id === id);
      const newPrice = data.price ?? ing?.price ?? 0;
      const newQty = data.quantity ?? ing?.quantity ?? 1;
      updateData.price_per_unit = calculatePricePerUnit(newPrice, newQty);
    }
    const { data: updatedIng } = await supabase.from('ingredients').update(updateData).eq('id', id).select().single();
    if (updatedIng) {
      setIngredients(prev => prev.map(ing => ing.id === id ? updatedIng : ing));
    }
  };

  const deleteIngredient = async (id: string) => {
    await supabase.from('ingredients').delete().eq('id', id);
    setIngredients(prev => prev.filter(ing => ing.id !== id));
  };

  // Packaging
  const addPackaging = async (data: Omit<Packaging, 'id' | 'shop_id' | 'price_per_unit' | 'created_at' | 'updated_at'>) => {
    if (!profile) return;
    const price_per_unit = calculatePricePerUnit(data.price, data.quantity);
    const { data: newPkg } = await supabase.from('packaging').insert({
      shop_id: profile.shop_id,
      user_id: profile.id,
      name: data.name,
      quantity: data.quantity,
      unit: data.unit,
      price: data.price,
      price_per_unit,
      stock_quantity: data.stock_quantity,
    }).select().single();
    if (newPkg) setPackaging(prev => [newPkg, ...prev]);
  };

  const updatePackaging = async (id: string, data: Partial<Packaging>) => {
    let updateData = { ...data };
    if (data.price !== undefined || data.quantity !== undefined) {
      const pkg = packaging.find(p => p.id === id);
      const newPrice = data.price ?? pkg?.price ?? 0;
      const newQty = data.quantity ?? pkg?.quantity ?? 1;
      updateData.price_per_unit = calculatePricePerUnit(newPrice, newQty);
    }
    const { data: updatedPkg } = await supabase.from('packaging').update(updateData).eq('id', id).select().single();
    if (updatedPkg) {
      setPackaging(prev => prev.map(pkg => pkg.id === id ? updatedPkg : pkg));
    }
  };

  const deletePackaging = async (id: string) => {
    await supabase.from('packaging').delete().eq('id', id);
    setPackaging(prev => prev.filter(pkg => pkg.id !== id));
  };

  // ============================================================
  // Recipes
  // ============================================================

  /**
   * คำนวณต้นทุนสูตร (รองรับ nested / sub-recipe แบบ recursive)
   * visited ใช้ป้องกัน circular dependency
   */
  const getRecipeCost = useCallback((recipeId: string, visited: Set<string> = new Set()): number => {
    // ป้องกัน circular
    if (visited.has(recipeId)) return 0;
    visited.add(recipeId);

    // --- Ingredients (วัตถุดิบปกติ) ---
    const rIngredients = recipeIngredients.filter(ri => ri.recipe_id === recipeId);
    let cost = 0;
    for (const ri of rIngredients) {
      const ing = ingredients.find(i => i.id === ri.ingredient_id);
      if (ing) {
        if (ri.unit === 'แพ็ค' || ri.unit === 'ถุง') {
          cost += ing.price * ri.quantity_used;
        } else {
          cost += ing.price_per_unit * ri.quantity_used;
        }
      }
    }

    // --- Packaging (บรรจุภัณฑ์) ---
    const rPackaging = recipePackaging.filter(rp => rp.recipe_id === recipeId);
    for (const rp of rPackaging) {
      const pkg = packaging.find(p => p.id === rp.packaging_id);
      if (pkg) cost += pkg.price_per_unit * rp.quantity_used;
    }

    // --- Sub-Recipes (สูตรซ้อนสูตร) ---
    const rSubRecipes = recipeSubRecipes.filter(rsr => rsr.recipe_id === recipeId);
    for (const rsr of rSubRecipes) {
      const subRecipe = recipes.find(r => r.id === rsr.sub_recipe_id);
      if (subRecipe) {
        // ต้นทุนต่อหน่วย (per unit) ของสูตรย่อย
        const subCostTotal = getRecipeCost(rsr.sub_recipe_id, new Set(visited));
        const subYield = subRecipe.yield_quantity || 1;
        const costPerUnit = subCostTotal / subYield;
        cost += costPerUnit * rsr.quantity_used;
      }
    }

    return cost;
  }, [ingredients, packaging, recipes, recipeIngredients, recipePackaging, recipeSubRecipes]);

  const getRecipeWithDetails = useCallback((recipeId: string): Recipe | null => {
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return null;

    const rIngs = recipeIngredients
      .filter(ri => ri.recipe_id === recipeId)
      .map(ri => {
        const ing = ingredients.find(i => i.id === ri.ingredient_id);
        const cost = ing ? (ri.unit === 'แพ็ค' || ri.unit === 'ถุง' ? ing.price * ri.quantity_used : ing.price_per_unit * ri.quantity_used) : 0;
        return { ...ri, ingredient: ing, cost };
      });

    const rPkgs = recipePackaging
      .filter(rp => rp.recipe_id === recipeId)
      .map(rp => ({
        ...rp,
        packaging: packaging.find(p => p.id === rp.packaging_id),
        cost: (packaging.find(p => p.id === rp.packaging_id)?.price_per_unit || 0) * rp.quantity_used,
      }));

    // Sub-recipes with cost breakdown
    const rSubRecipes = recipeSubRecipes
      .filter(rsr => rsr.recipe_id === recipeId)
      .map(rsr => {
        const subRecipe = recipes.find(r => r.id === rsr.sub_recipe_id);
        const subCostTotal = getRecipeCost(rsr.sub_recipe_id);
        const subYield = subRecipe?.yield_quantity || 1;
        const costPerUnit = subCostTotal / subYield;
        const cost = costPerUnit * rsr.quantity_used;
        return { ...rsr, sub_recipe: subRecipe, cost };
      });

    const totalCost =
      rIngs.reduce((sum, ri) => sum + (ri.cost || 0), 0) +
      rPkgs.reduce((sum, rp) => sum + (rp.cost || 0), 0) +
      rSubRecipes.reduce((sum, rsr) => sum + (rsr.cost || 0), 0);

    return {
      ...recipe,
      ingredients: rIngs as RecipeIngredient[],
      packaging: rPkgs as RecipePackaging[],
      sub_recipes: rSubRecipes as RecipeSubRecipe[],
      total_cost: totalCost,
      profit: recipe.selling_price - totalCost,
      margin: recipe.selling_price > 0 ? ((recipe.selling_price - totalCost) / recipe.selling_price) * 100 : 0,
    };
  }, [recipes, ingredients, packaging, recipeIngredients, recipePackaging, recipeSubRecipes, getRecipeCost]);

  const addRecipe = async (
    recipe: Omit<Recipe, 'id' | 'shop_id' | 'created_at' | 'updated_at'>,
    ingredientsList: { ingredient_id: string; quantity_used: number; unit: string; input_mode: 'per_piece' | 'total_batch' }[],
    packagingList: { packaging_id: string; quantity_used: number }[],
    subRecipeList: { sub_recipe_id: string; quantity_used: number; unit: string }[]
  ): Promise<string> => {
    if (!profile) return '';
    const { data: newRecipe } = await supabase.from('recipes').insert({
      shop_id: profile.shop_id,
      user_id: profile.id,
      name: recipe.name,
      description: recipe.description,
      selling_price: recipe.selling_price,
      yield_quantity: recipe.yield_quantity,
      category: recipe.category,
    }).select().single();

    if (!newRecipe) return '';

    const newRIs = ingredientsList.map(ri => ({
      recipe_id: newRecipe.id,
      ingredient_id: ri.ingredient_id,
      quantity_used: ri.quantity_used,
      unit: ri.unit,
      input_mode: ri.input_mode,
    }));
    const newRPs = packagingList.map(rp => ({ recipe_id: newRecipe.id, ...rp }));
    const newRSRs = subRecipeList.map(rsr => ({ recipe_id: newRecipe.id, ...rsr }));

    if (newRIs.length > 0) {
      const { data: insertedRIs } = await supabase.from('recipe_ingredients').insert(newRIs).select();
      if (insertedRIs) setRecipeIngredients(prev => [...prev, ...insertedRIs]);
    }
    if (newRPs.length > 0) {
      const { data: insertedRPs } = await supabase.from('recipe_packaging').insert(newRPs).select();
      if (insertedRPs) setRecipePackaging(prev => [...prev, ...insertedRPs]);
    }
    if (newRSRs.length > 0) {
      const { data: insertedRSRs } = await supabase.from('recipe_sub_recipes').insert(newRSRs).select();
      if (insertedRSRs) setRecipeSubRecipes(prev => [...prev, ...insertedRSRs]);
    }

    setRecipes(prev => [newRecipe, ...prev]);
    return newRecipe.id;
  };

  const deleteRecipe = async (id: string) => {
    await supabase.from('recipes').delete().eq('id', id);
    setRecipes(prev => prev.filter(r => r.id !== id));
    setRecipeIngredients(prev => prev.filter(ri => ri.recipe_id !== id));
    setRecipePackaging(prev => prev.filter(rp => rp.recipe_id !== id));
    setRecipeSubRecipes(prev => prev.filter(rsr => rsr.recipe_id !== id || rsr.sub_recipe_id !== id));
  };

  // ============================================================
  // Products (สินค้า)
  // ============================================================

  const getProductCost = useCallback((productId: string): number => {
    const pRecipes = productRecipes.filter(pr => pr.product_id === productId);
    let cost = 0;
    for (const pr of pRecipes) {
      const recipe = recipes.find(r => r.id === pr.recipe_id);
      if (recipe) {
        const recipeCostTotal = getRecipeCost(pr.recipe_id);
        const recipeYield = recipe.yield_quantity || 1;
        const costPerUnit = recipeCostTotal / recipeYield;
        cost += costPerUnit * pr.quantity_used;
      }
    }
    // Add packaging cost
    const pPkgs = productPackaging.filter(pp => pp.product_id === productId);
    for (const pp of pPkgs) {
      const pkg = packaging.find(p => p.id === pp.packaging_id);
      if (pkg) cost += pkg.price_per_unit * pp.quantity_used;
    }
    return cost;
  }, [productRecipes, productPackaging, recipes, packaging, getRecipeCost]);

  const getProductWithDetails = useCallback((productId: string): Product | null => {
    const product = products.find(p => p.id === productId);
    if (!product) return null;

    const pRecs = productRecipes
      .filter(pr => pr.product_id === productId)
      .map(pr => {
        const recipe = recipes.find(r => r.id === pr.recipe_id);
        const recipeCostTotal = getRecipeCost(pr.recipe_id);
        const recipeYield = recipe?.yield_quantity || 1;
        const costPerUnit = recipeCostTotal / recipeYield;
        const cost = costPerUnit * pr.quantity_used;
        return { ...pr, recipe, cost };
      });

    const pPkgs = productPackaging
      .filter(pp => pp.product_id === productId)
      .map(pp => ({
        ...pp,
        packaging: packaging.find(p => p.id === pp.packaging_id),
        cost: (packaging.find(p => p.id === pp.packaging_id)?.price_per_unit || 0) * pp.quantity_used,
      }));

    const totalCost =
      pRecs.reduce((sum, pr) => sum + (pr.cost || 0), 0) +
      pPkgs.reduce((sum, pp) => sum + (pp.cost || 0), 0);

    return {
      ...product,
      product_recipes: pRecs as ProductRecipe[],
      product_packaging: pPkgs as ProductPackaging[],
      total_cost: totalCost,
      profit: product.selling_price - totalCost,
      margin: product.selling_price > 0 ? ((product.selling_price - totalCost) / product.selling_price) * 100 : 0,
    };
  }, [products, productRecipes, productPackaging, recipes, packaging, getRecipeCost]);

  const addProduct = async (
    product: Omit<Product, 'id' | 'shop_id' | 'created_at' | 'updated_at'>,
    recipeList: { recipe_id: string; quantity_used: number }[],
    packagingList: { packaging_id: string; quantity_used: number }[]
  ): Promise<string> => {
    if (!profile) return '';
    const { data: newProduct } = await supabase.from('products').insert({
      shop_id: profile.shop_id,
      user_id: profile.id,
      name: product.name,
      description: product.description,
      flavor: product.flavor,
      pieces_per_pack: product.pieces_per_pack,
      selling_price: product.selling_price,
      category: product.category,
    }).select().single();

    if (!newProduct) return '';

    const newPRs = recipeList.map(pr => ({ product_id: newProduct.id, ...pr }));
    if (newPRs.length > 0) {
      const { data: insertedPRs } = await supabase.from('product_recipes').insert(newPRs).select();
      if (insertedPRs) setProductRecipes(prev => [...prev, ...insertedPRs]);
    }

    const newPPs = packagingList.map(pp => ({ product_id: newProduct.id, ...pp }));
    if (newPPs.length > 0) {
      const { data: insertedPPs } = await supabase.from('product_packaging').insert(newPPs).select();
      if (insertedPPs) setProductPackaging(prev => [...prev, ...insertedPPs]);
    }

    setProducts(prev => [newProduct, ...prev]);
    return newProduct.id;
  };

  const updateProductFull = async (
    id: string,
    data: Partial<Omit<Product, 'id' | 'shop_id' | 'created_at' | 'updated_at'>>,
    recipeList: { recipe_id: string; quantity_used: number }[],
    packagingList: { packaging_id: string; quantity_used: number }[]
  ) => {
    const { data: updatedProduct } = await supabase.from('products').update(data).eq('id', id).select().single();
    if (updatedProduct) setProducts(prev => prev.map(p => p.id === id ? updatedProduct : p));

    // Replace relations
    await supabase.from('product_recipes').delete().eq('product_id', id);
    setProductRecipes(prev => prev.filter(pr => pr.product_id !== id));
    if (recipeList.length > 0) {
      const { data: ins } = await supabase.from('product_recipes').insert(recipeList.map(r => ({ product_id: id, ...r }))).select();
      if (ins) setProductRecipes(prev => [...prev, ...ins]);
    }

    await supabase.from('product_packaging').delete().eq('product_id', id);
    setProductPackaging(prev => prev.filter(pp => pp.product_id !== id));
    if (packagingList.length > 0) {
      const { data: ins } = await supabase.from('product_packaging').insert(packagingList.map(p => ({ product_id: id, ...p }))).select();
      if (ins) setProductPackaging(prev => [...prev, ...ins]);
    }
  };

  const updateProduct = async (id: string, data: Partial<Product>) => {
    const { data: updatedProduct } = await supabase.from('products').update(data).eq('id', id).select().single();
    if (updatedProduct) {
      setProducts(prev => prev.map(p => p.id === id ? updatedProduct : p));
    }
  };

  const deleteProduct = async (id: string) => {
    await supabase.from('products').delete().eq('id', id);
    setProducts(prev => prev.filter(p => p.id !== id));
    setProductRecipes(prev => prev.filter(pr => pr.product_id !== id));
    setProductPackaging(prev => prev.filter(pp => pp.product_id !== id));
  };

  // ============================================================
  // Orders
  // ============================================================
  const createOrder = async (
    items: { product_id: string; quantity: number }[],
    options?: {
      notes?: string;
      customer_name?: string;
      customer_phone?: string;
      order_date?: string;
      delivery_date?: string;
    }
  ): Promise<string> => {
    if (!profile) return '';
    let totalCost = 0;
    let totalRevenue = 0;

    const newItems = items.map(item => {
      const product = products.find(p => p.id === item.product_id);
      const cost = getProductCost(item.product_id);
      const price = product?.selling_price || 0;

      totalCost += cost * item.quantity;
      totalRevenue += price * item.quantity;

      return {
        product_id: item.product_id,
        quantity: item.quantity,
        unit_cost: cost,
        unit_price: price,
        subtotal_cost: cost * item.quantity,
        subtotal_revenue: price * item.quantity,
      };
    });

    const { data: newOrder, error: orderError } = await supabase.from('orders').insert({
      shop_id: profile.shop_id,
      user_id: profile.id,
      order_number: generateOrderNumber(),
      status: 'pending',
      total_cost: totalCost,
      total_revenue: totalRevenue,
      total_profit: totalRevenue - totalCost,
      notes: options?.notes,
      customer_name: options?.customer_name,
      customer_phone: options?.customer_phone,
      order_date: options?.order_date,
      delivery_date: options?.delivery_date,
    }).select().single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      return '';
    }
    if (!newOrder) return '';

    const itemsToInsert = newItems.map(item => ({ order_id: newOrder.id, ...item }));
    const { data: insertedItems, error: itemsError } = await supabase.from('order_items').insert(itemsToInsert).select();
    
    if (itemsError) {
      console.error('Error inserting order items:', itemsError);
    }

    // Deduct stock for direct ingredients
    // To do this correctly, we need a recursive function similar to order analysis
    const resolveAndDeduct = async (recipeId: string, neededYield: number) => {
      const recipe = recipes.find(r => r.id === recipeId);
      if (!recipe) return;
      const recipeYield = recipe.yield_quantity || 1;
      const multiplier = neededYield / recipeYield;

      const rIngs = recipeIngredients.filter(ri => ri.recipe_id === recipeId);
      for (const ri of rIngs) {
        const ing = ingredients.find(i => i.id === ri.ingredient_id);
        if (ing) {
          let deductedPacks = 0;
          if (ri.unit === 'แพ็ค' || ri.unit === 'ถุง') {
            deductedPacks = ri.quantity_used * multiplier;
          } else {
            deductedPacks = (ri.quantity_used * multiplier) / ing.quantity;
          }
          const newStock = Math.max(0, ing.stock_quantity - deductedPacks);
          await supabase.from('ingredients').update({ stock_quantity: newStock }).eq('id', ing.id);
          setIngredients(prev => prev.map(i => i.id === ing.id ? { ...i, stock_quantity: newStock } : i));
        }
      }

      const rSubs = recipeSubRecipes.filter(rsr => rsr.recipe_id === recipeId);
      for (const rsr of rSubs) {
        await resolveAndDeduct(rsr.sub_recipe_id, rsr.quantity_used * multiplier);
      }
    };

    for (const item of items) {
      const pRecs = productRecipes.filter(pr => pr.product_id === item.product_id);
      for (const pr of pRecs) {
        await resolveAndDeduct(pr.recipe_id, pr.quantity_used * item.quantity);
      }

      const pPkgs = productPackaging.filter(pp => pp.product_id === item.product_id);
      for (const pp of pPkgs) {
        const pkg = packaging.find(p => p.id === pp.packaging_id);
        if (pkg) {
          const deductedPieces = pp.quantity_used * item.quantity;
          const newStock = Math.max(0, pkg.stock_quantity - (deductedPieces / pkg.quantity));
          await supabase.from('packaging').update({ stock_quantity: newStock }).eq('id', pkg.id);
          setPackaging(prev => prev.map(p => p.id === pkg.id ? { ...p, stock_quantity: newStock } : p));
        }
      }
    }

    setOrders(prev => [newOrder, ...prev]);
    if (insertedItems) setOrderItems(prev => [...insertedItems, ...prev]);
    
    return newOrder.id;
  };

  const completeOrder = async (id: string) => {
    const { data: updatedOrder } = await supabase.from('orders').update({ status: 'completed' }).eq('id', id).select().single();
    if (updatedOrder) {
      setOrders(prev => prev.map(o => o.id === id ? updatedOrder : o));
    }
  };

  const cancelOrder = async (id: string) => {
    const { data: updatedOrder } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', id).select().single();
    if (updatedOrder) {
      setOrders(prev => prev.map(o => o.id === id ? updatedOrder : o));
    }
  };

  const updateOrderStatus = async (id: string, status: string) => {
    const { data: updatedOrder } = await supabase.from('orders').update({ status }).eq('id', id).select().single();
    if (updatedOrder) {
      setOrders(prev => prev.map(o => o.id === id ? updatedOrder : o));
    }
  };

  const deleteOrder = async (id: string) => {
    const oldItems = orderItems.filter(oi => oi.order_id === id);
    if (oldItems.length > 0) {
      // Restore stock for old items
      const resolveAndRestore = async (recipeId: string, neededYield: number) => {
        const recipe = recipes.find(r => r.id === recipeId);
        if (!recipe) return;
        const recipeYield = recipe.yield_quantity || 1;
        const multiplier = neededYield / recipeYield;

        const rIngs = recipeIngredients.filter(ri => ri.recipe_id === recipeId);
        for (const ri of rIngs) {
          const ing = ingredients.find(i => i.id === ri.ingredient_id);
          if (ing) {
            let restoredPacks = 0;
            if (ri.unit === 'แพ็ค' || ri.unit === 'ถุง') {
              restoredPacks = ri.quantity_used * multiplier;
            } else {
              restoredPacks = (ri.quantity_used * multiplier) / ing.quantity;
            }
            const newStock = ing.stock_quantity + restoredPacks;
            await supabase.from('ingredients').update({ stock_quantity: newStock }).eq('id', ing.id);
            setIngredients(prev => prev.map(i => i.id === ing.id ? { ...i, stock_quantity: newStock } : i));
          }
        }

        const rSubs = recipeSubRecipes.filter(rsr => rsr.recipe_id === recipeId);
        for (const rsr of rSubs) {
          await resolveAndRestore(rsr.sub_recipe_id, rsr.quantity_used * multiplier);
        }
      };

      for (const item of oldItems) {
        const pRecs = productRecipes.filter(pr => pr.product_id === item.product_id);
        for (const pr of pRecs) {
          await resolveAndRestore(pr.recipe_id, pr.quantity_used * item.quantity);
        }

        const pPkgs = productPackaging.filter(pp => pp.product_id === item.product_id);
        for (const pp of pPkgs) {
          const pkg = packaging.find(p => p.id === pp.packaging_id);
          if (pkg) {
            const restoredPieces = pp.quantity_used * item.quantity;
            const newStock = pkg.stock_quantity + (restoredPieces / pkg.quantity);
            await supabase.from('packaging').update({ stock_quantity: newStock }).eq('id', pkg.id);
            setPackaging(prev => prev.map(p => p.id === pkg.id ? { ...p, stock_quantity: newStock } : p));
          }
        }
      }
    }

    await supabase.from('orders').delete().eq('id', id);
    setOrders(prev => prev.filter(o => o.id !== id));
    setOrderItems(prev => prev.filter(oi => oi.order_id !== id));
  };

  const updateOrderFull = async (
    id: string,
    items: { product_id: string; quantity: number }[],
    options?: {
      notes?: string;
      customer_name?: string;
      customer_phone?: string;
      order_date?: string;
      delivery_date?: string;
      status?: 'pending' | 'completed' | 'cancelled';
    }
  ): Promise<string> => {
    // 1. Restore old stock
    const oldItems = orderItems.filter(oi => oi.order_id === id);
    if (oldItems.length > 0) {
      const resolveAndRestore = async (recipeId: string, neededYield: number) => {
        const recipe = recipes.find(r => r.id === recipeId);
        if (!recipe) return;
        const recipeYield = recipe.yield_quantity || 1;
        const multiplier = neededYield / recipeYield;

        const rIngs = recipeIngredients.filter(ri => ri.recipe_id === recipeId);
        for (const ri of rIngs) {
          const ing = ingredients.find(i => i.id === ri.ingredient_id);
          if (ing) {
            let restoredPacks = 0;
            if (ri.unit === 'แพ็ค' || ri.unit === 'ถุง') {
              restoredPacks = ri.quantity_used * multiplier;
            } else {
              restoredPacks = (ri.quantity_used * multiplier) / ing.quantity;
            }
            const newStock = ing.stock_quantity + restoredPacks;
            await supabase.from('ingredients').update({ stock_quantity: newStock }).eq('id', ing.id);
            setIngredients(prev => prev.map(i => i.id === ing.id ? { ...i, stock_quantity: newStock } : i));
          }
        }

        const rSubs = recipeSubRecipes.filter(rsr => rsr.recipe_id === recipeId);
        for (const rsr of rSubs) {
          await resolveAndRestore(rsr.sub_recipe_id, rsr.quantity_used * multiplier);
        }
      };

      for (const item of oldItems) {
        const pRecs = productRecipes.filter(pr => pr.product_id === item.product_id);
        for (const pr of pRecs) {
          await resolveAndRestore(pr.recipe_id, pr.quantity_used * item.quantity);
        }

        const pPkgs = productPackaging.filter(pp => pp.product_id === item.product_id);
        for (const pp of pPkgs) {
          const pkg = packaging.find(p => p.id === pp.packaging_id);
          if (pkg) {
            const restoredPieces = pp.quantity_used * item.quantity;
            const newStock = pkg.stock_quantity + (restoredPieces / pkg.quantity);
            await supabase.from('packaging').update({ stock_quantity: newStock }).eq('id', pkg.id);
            setPackaging(prev => prev.map(p => p.id === pkg.id ? { ...p, stock_quantity: newStock } : p));
          }
        }
      }
    }

    // 2. Clear old items from DB
    await supabase.from('order_items').delete().eq('order_id', id);
    setOrderItems(prev => prev.filter(oi => oi.order_id !== id));

    // 3. Deduct new stock
    const resolveAndDeduct = async (recipeId: string, neededYield: number) => {
      const recipe = recipes.find(r => r.id === recipeId);
      if (!recipe) return;
      const recipeYield = recipe.yield_quantity || 1;
      const multiplier = neededYield / recipeYield;

      const rIngs = recipeIngredients.filter(ri => ri.recipe_id === recipeId);
      for (const ri of rIngs) {
        const ing = ingredients.find(i => i.id === ri.ingredient_id);
        if (ing) {
          let deductedPacks = 0;
          if (ri.unit === 'แพ็ค' || ri.unit === 'ถุง') {
            deductedPacks = ri.quantity_used * multiplier;
          } else {
            deductedPacks = (ri.quantity_used * multiplier) / ing.quantity;
          }
          const newStock = Math.max(0, ing.stock_quantity - deductedPacks);
          await supabase.from('ingredients').update({ stock_quantity: newStock }).eq('id', ing.id);
          setIngredients(prev => prev.map(i => i.id === ing.id ? { ...i, stock_quantity: newStock } : i));
        }
      }

      const rSubs = recipeSubRecipes.filter(rsr => rsr.recipe_id === recipeId);
      for (const rsr of rSubs) {
        await resolveAndDeduct(rsr.sub_recipe_id, rsr.quantity_used * multiplier);
      }
    };

    for (const item of items) {
      const pRecs = productRecipes.filter(pr => pr.product_id === item.product_id);
      for (const pr of pRecs) {
        await resolveAndDeduct(pr.recipe_id, pr.quantity_used * item.quantity);
      }

      const pPkgs = productPackaging.filter(pp => pp.product_id === item.product_id);
      for (const pp of pPkgs) {
        const pkg = packaging.find(p => p.id === pp.packaging_id);
        if (pkg) {
          const deductedPieces = pp.quantity_used * item.quantity;
          const newStock = Math.max(0, pkg.stock_quantity - (deductedPieces / pkg.quantity));
          await supabase.from('packaging').update({ stock_quantity: newStock }).eq('id', pkg.id);
          setPackaging(prev => prev.map(p => p.id === pkg.id ? { ...p, stock_quantity: newStock } : p));
        }
      }
    }

    // 4. Calculate new order cost and revenue
    let totalCost = 0;
    let totalRevenue = 0;

    const newItems = items.map(item => {
      const product = products.find(p => p.id === item.product_id);
      const cost = getProductCost(item.product_id);
      const price = product?.selling_price || 0;

      totalCost += cost * item.quantity;
      totalRevenue += price * item.quantity;

      return {
        product_id: item.product_id,
        quantity: item.quantity,
        unit_cost: cost,
        unit_price: price,
        subtotal_cost: cost * item.quantity,
        subtotal_revenue: price * item.quantity,
      };
    });

    // 5. Update Order record
    const { data: updatedOrder, error: updateError } = await supabase.from('orders').update({
      total_cost: totalCost,
      total_revenue: totalRevenue,
      total_profit: totalRevenue - totalCost,
      notes: options?.notes,
      customer_name: options?.customer_name,
      customer_phone: options?.customer_phone,
      order_date: options?.order_date,
      delivery_date: options?.delivery_date,
      status: options?.status || 'completed',
    }).eq('id', id).select().single();

    if (updateError) {
      console.error('Error updating order:', updateError);
    }
    if (updatedOrder) {
      setOrders(prev => prev.map(o => o.id === id ? updatedOrder : o));
    }

    // 6. Insert new items
    if (newItems.length > 0) {
      const itemsToInsert = newItems.map(item => ({ order_id: id, ...item }));
      const { data: insertedItems, error: itemsError } = await supabase.from('order_items').insert(itemsToInsert).select();
      
      if (itemsError) {
        console.error('Error inserting new order items:', itemsError);
      }
      if (insertedItems) {
        setOrderItems(prev => [...prev, ...insertedItems]);
      }
    }

    return id;
  };
  // Toasts
  const addToast = useCallback((type: ToastType, message: string) => {
    const id = uuidv4();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const value: StoreState = {
    isAuthenticated, profile, shop, login, signup, logout, updateShop,
    ingredients, addIngredient, updateIngredient, deleteIngredient,
    packaging, addPackaging, updatePackaging, deletePackaging,
    recipes, recipeIngredients, recipePackaging, recipeSubRecipes,
    addRecipe, deleteRecipe, getRecipeCost, getRecipeWithDetails,
    products, productRecipes, productPackaging,
    addProduct, updateProductFull, updateProduct, deleteProduct, getProductCost, getProductWithDetails,
    orders, orderItems, createOrder, completeOrder, cancelOrder, updateOrderStatus, deleteOrder, updateOrderFull,
    toasts, addToast, removeToast,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreState {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within StoreProvider');
  return context;
}
