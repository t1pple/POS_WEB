'use client';

import { useState, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { formatNumber } from '@/lib/utils/format';
import { ClipboardList, Calendar, Box, Package } from 'lucide-react';
import Link from 'next/link';

export default function ProductionPlanPage() {
  const { 
    orders, orderItems, products, recipes, ingredients, 
    recipeIngredients, recipeSubRecipes, packaging, 
    productRecipes, productPackaging 
  } = useStore() as any;

  // Aggregate production requirements
  const plan = useMemo(() => {
    const targetOrders = orders.filter((o: any) => {
      if (o.status === 'cancelled') return false;
      return o.status === 'pending';
    });

    const targetOrderIds = new Set(targetOrders.map((o: any) => o.id));

    // 2. Aggregate Products
    const productMap = new Map<string, number>();
    for (const item of orderItems) {
      if (targetOrderIds.has(item.order_id)) {
        const qty = productMap.get(item.product_id) || 0;
        productMap.set(item.product_id, qty + item.quantity);
      }
    }

    const productsToMake = Array.from(productMap.entries()).map(([id, qty]) => {
      const p = products.find((x: any) => x.id === id);
      return { id, name: p?.name || 'Unknown', qty };
    }).sort((a, b) => b.qty - a.qty);

    // 3. Aggregate Ingredients and Packaging (Recursive)
    const requiredIngredients = new Map<string, { name: string; requiredPacks: number; exactAmount: number; packUnit: string; rawUnit: string }>();
    const requiredPackaging = new Map<string, { name: string; requiredPacks: number; exactAmount: number; packUnit: string; rawUnit: string }>();

    const resolveRecipeIngredients = (recipeId: string, neededYield: number) => {
      const recipe = recipes.find((r: any) => r.id === recipeId);
      if (!recipe) return;
      const recipeYield = recipe.yield_quantity || 1;
      const multiplier = neededYield / recipeYield;

      const rIngs = recipeIngredients.filter((ri: any) => ri.recipe_id === recipeId);
      for (const ri of rIngs) {
        const ing = ingredients.find((i: any) => i.id === ri.ingredient_id);
        if (!ing) continue;
        
        let exactAmount = 0;
        let packsNeeded = 0;

        if (ri.unit === 'แพ็ค' || ri.unit === 'ถุง') {
          packsNeeded = ri.quantity_used * multiplier;
          exactAmount = packsNeeded * ing.quantity;
        } else {
          exactAmount = ri.quantity_used * multiplier;
          packsNeeded = exactAmount / ing.quantity;
        }

        const existing = requiredIngredients.get(ri.ingredient_id);
        if (existing) {
          existing.requiredPacks += packsNeeded;
          existing.exactAmount += exactAmount;
        } else {
          requiredIngredients.set(ri.ingredient_id, {
            name: ing.name,
            requiredPacks: packsNeeded,
            exactAmount: exactAmount,
            packUnit: 'แพ็ค',
            rawUnit: ing.unit,
          });
        }
      }

      const rSubs = recipeSubRecipes.filter((rsr: any) => rsr.recipe_id === recipeId);
      for (const rsr of rSubs) {
        resolveRecipeIngredients(rsr.sub_recipe_id, rsr.quantity_used * multiplier);
      }
    };

    for (const [productId, qty] of productMap.entries()) {
      const pRecs = productRecipes.filter((pr: any) => pr.product_id === productId);
      for (const pr of pRecs) {
        resolveRecipeIngredients(pr.recipe_id, pr.quantity_used * qty);
      }

      const pPkgs = productPackaging.filter((pp: any) => pp.product_id === productId);
      for (const pp of pPkgs) {
        const pkg = packaging.find((p: any) => p.id === pp.packaging_id);
        if (!pkg) continue;
        
        const exactAmount = pp.quantity_used * qty;
        const packsNeeded = exactAmount / pkg.quantity;
        
        const existing = requiredPackaging.get(pp.packaging_id);
        if (existing) {
          existing.requiredPacks += packsNeeded;
          existing.exactAmount += exactAmount;
        } else {
          requiredPackaging.set(pp.packaging_id, {
            name: pkg.name,
            requiredPacks: packsNeeded,
            exactAmount: exactAmount,
            packUnit: 'แพ็ค',
            rawUnit: 'ชิ้น',
          });
        }
      }
    }

    const ingsToPrep = Array.from(requiredIngredients.entries()).map(([id, data]) => ({ id, ...data })).sort((a, b) => b.requiredPacks - a.requiredPacks);
    const pkgsToPrep = Array.from(requiredPackaging.entries()).map(([id, data]) => ({ id, ...data })).sort((a, b) => b.requiredPacks - a.requiredPacks);

    return {
      orderCount: targetOrders.length,
      productsToMake,
      ingsToPrep,
      pkgsToPrep,
    };
  }, [orders, orderItems, products, recipes, ingredients, recipeIngredients, recipeSubRecipes, packaging, productRecipes, productPackaging]);


  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>แผนการผลิต (Production Plan)</h1>
          <p>สรุปยอดสินค้าและวัตถุดิบที่ต้องใช้สำหรับออเดอร์ทั้งหมดที่กำลังรอดำเนินการ</p>
        </div>
      </div>

      {plan.orderCount === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><ClipboardList size={36} /></div>
          <h3>ไม่มีออเดอร์ที่รอดำเนินการ</h3>
          <p>คุณทำออเดอร์ทั้งหมดเสร็จสิ้นแล้ว หรือยังไม่มีออเดอร์ใหม่</p>
          <Link href="/orders/create" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }}>สร้างออเดอร์</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          
          {/* Top: Products */}
          <div className="glass-card-static" style={{ padding: 'var(--space-6)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <Package size={20} style={{ color: 'var(--primary-400)' }} /> สินค้าที่ต้องผลิต
            </h3>
            
            {plan.productsToMake.length === 0 ? (
              <div style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem', textAlign: 'center', padding: 'var(--space-4)' }}>
                ไม่มีสินค้าที่ต้องผลิต
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {plan.productsToMake.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: 'var(--surface-2)', borderRadius: 12 }}>
                    <span style={{ fontWeight: 600, fontSize: '1rem' }}>{p.name}</span>
                    <span style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--primary-400)' }}>
                      {formatNumber(p.qty)} <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>ชิ้น</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom: Ingredients & Packaging to Prep */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            
              <div className="glass-card-static" style={{ padding: 'var(--space-6)' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <ClipboardList size={20} style={{ color: 'var(--accent-amber)' }} /> วัตถุดิบที่ต้องเตรียม
                </h3>
                {plan.ingsToPrep.length === 0 ? (
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem', textAlign: 'center', padding: 'var(--space-4)' }}>
                    ไม่มีรายการวัตถุดิบ (สินค้าอาจยังไม่ได้ผูกกับสูตรอาหาร)
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {plan.ingsToPrep.map(ing => (
                      <div key={ing.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: 'var(--surface-2)', borderRadius: 12 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '1rem' }}>{ing.name}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--accent-amber)' }}>
                            {formatNumber(ing.exactAmount, 2)} <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>{ing.rawUnit}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="glass-card-static" style={{ padding: 'var(--space-6)' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <Package size={20} style={{ color: 'var(--accent-emerald)' }} /> บรรจุภัณฑ์ที่ต้องเตรียม
                </h3>
                {plan.pkgsToPrep.length === 0 ? (
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem', textAlign: 'center', padding: 'var(--space-4)' }}>
                    ไม่มีรายการบรรจุภัณฑ์
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {plan.pkgsToPrep.map(pkg => (
                      <div key={pkg.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: 'var(--surface-2)', borderRadius: 12 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '1rem' }}>{pkg.name}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--accent-emerald)' }}>
                            {formatNumber(pkg.exactAmount)} <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>{pkg.rawUnit}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

          </div>

        </div>
      )}
    </div>
  );
}
