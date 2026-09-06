import { pool } from '../db/pool';

export interface ProductMediaRef {
  id?: number;
  name?: string | null;
  category?: string | null;
  image_url?: string | null;
  model_url?: string | null;
}

interface ImageRule {
  match: string[];
  image: string;
  model?: string;
}

const CATEGORY_RULES: Record<string, { rules: ImageRule[]; defaultImage: string; defaultModel: string | null }> = {
  Beds: {
    defaultImage: '/images/products/halcyon-platform-bed.jpg',
    defaultModel: '/Models/Bed Double by Quaternius - BuRay4fVFr.glb',
    rules: [
      {
        match: ['drift', 'storage bed'],
        image: '/images/products/drift-storage-bed.jpg',
        model: '/Models/Bed Single by Quaternius - ianC28eMOF.glb',
      },
      {
        match: ['upholstered', 'wexford', 'grand upholstered'],
        image: '/images/products/upholstered-queen-bed.jpg',
        model: '/Models/Bed Double by Quaternius - BuRay4fVFr.glb',
      },
      {
        match: ['teak', 'single bed', 'urban teak', 'solid wood, single'],
        image: '/images/products/urban-teak-single-bed.jpg',
        model: '/Models/Bed Single by Quaternius - ianC28eMOF.glb',
      },
      {
        match: ['halcyon', 'solstice', 'platform', 'solid wood, queen', 'solid wood, king'],
        image: '/images/products/halcyon-platform-bed.jpg',
        model: '/Models/Bed Double by Kenney - wcmbCZ63mg.glb',
      },
      {
        match: ['cirrus', 'nimbus', 'mattress'],
        image: '/images/products/cirrus-mattress.jpg',
        model: '/Models/Bed Single by Quaternius - ianC28eMOF.glb',
      },
      {
        match: ['bunk'],
        image: '/images/products/halcyon-platform-bed.jpg',
        model: '/Models/Bunk Bed by Zsky - CuUYyXA9ki.glb',
      },
    ],
  },
  Seating: {
    defaultImage: '/images/products/aspen-lounge-sofa.jpg',
    defaultModel: '/Models/Couch Large by Quaternius - 6MoOyPtetL.glb',
    rules: [
      {
        match: ['meridian', 'sectional', 'chesterfield'],
        image: '/images/products/meridian-sectional.jpg',
        model: '/Models/Couch Large by Quaternius - 6MoOyPtetL.glb',
      },
      {
        match: ['atlas', 'office chair', 'executive'],
        image: '/images/products/atlas-office-chair.jpg',
        model: '/Models/Office Chair by Quaternius - UfKvrZBK6C.glb',
      },
      {
        match: ['bramble', 'kestrel', 'tamsin', 'accent chair', 'armchair'],
        image: '/images/products/bramble-accent-chair.jpg',
        model: '/Models/Chair by Quaternius - iMNqRzPwwe.glb',
      },
      {
        match: ['cove', 'loveseat'],
        image: '/images/products/cove-loveseat.jpg',
        model: '/Models/Couch Medium by Quaternius - mWgQ94zhDZ.glb',
      },
      {
        match: ['ellis', 'wingback'],
        image: '/images/products/ellis-wingback.jpg',
        model: '/Models/Chair by Quaternius - iMNqRzPwwe.glb',
      },
      {
        match: ['nordic', 'recliner'],
        image: '/images/products/nordic-recliner.jpg',
        model: '/Models/Chair by Quaternius - iMNqRzPwwe.glb',
      },
      {
        match: ['ridgeway', 'bench'],
        image: '/images/products/ridgeway-bench.jpg',
        model: '/Models/Chair by Quaternius - iMNqRzPwwe.glb',
      },
      {
        match: ['grove', 'ottoman', 'stool'],
        image: '/images/products/grove-ottoman.jpg',
        model: '/Models/Couch Small by Quaternius - X9msj0gtb5.glb',
      },
      {
        match: ['aspen', 'lounge sofa', 'velvet', 'linen'],
        image: '/images/products/aspen-lounge-sofa.jpg',
        model: '/Models/Couch Large by Quaternius - 6MoOyPtetL.glb',
      },
    ],
  },
  Tables: {
    defaultImage: '/images/products/dining-table-oak.jpg',
    defaultModel: '/Models/Desk by CreativeTrio - YJyJam67hJ.glb',
    rules: [
      {
        match: ['dining', 'extending', 'farmhouse', 'harrow', 'fenwick'],
        image: '/images/products/dining-table-oak.jpg',
        model: '/Models/Desk by CreativeTrio - YJyJam67hJ.glb',
      },
      {
        match: ['juniper', 'coffee'],
        image: '/images/products/juniper-coffee-table.jpg',
        model: '/Models/Table Round Small by Quaternius - oEArSZykyi.glb',
      },
      {
        match: ['oakridge', 'writing desk', 'desk'],
        image: '/images/products/oakridge-writing-desk.jpg',
        model: '/Models/Desk by Quaternius - V86Go2rlnq.glb',
      },
      {
        match: ['sable', 'bedside', 'side table', 'wren'],
        image: '/images/products/sable-side-table.jpg',
        model: '/Models/Night Stand by Quaternius - 9LI73c5uFA.glb',
      },
      {
        match: ['linden', 'nesting', 'pell'],
        image: '/images/products/linden-nesting-tables.jpg',
        model: '/Models/Table Round Small by Quaternius - oEArSZykyi.glb',
      },
      {
        match: ['bexley', 'bar table'],
        image: '/images/products/bexley-bar-table.jpg',
        model: '/Models/Table Round Small by Quaternius - oEArSZykyi.glb',
      },
      {
        match: ['marlow', 'console'],
        image: '/images/products/marlow-console.jpg',
        model: '/Models/Desk by Quaternius - V86Go2rlnq.glb',
      },
    ],
  },
  Storage: {
    defaultImage: '/images/products/calder-bookcase.jpg',
    defaultModel: '/Models/Bookshelf by CreativeTrio - 30Iealxb0p.glb',
    rules: [
      {
        match: ['alder', 'tv unit', 'tv'],
        image: '/images/products/alder-tv-unit.jpg',
        model: '/Models/Drawer by Quaternius - G1H0wnCHQf.glb',
      },
      {
        match: ['ashford', 'wardrobe'],
        image: '/images/products/ashford-wardrobe.jpg',
        model: '/Models/Drawer by Quaternius - G1H0wnCHQf.glb',
      },
      {
        match: ['calder', 'bookcase', 'bookshelf', 'thornbury'],
        image: '/images/products/calder-bookcase.jpg',
        model: '/Models/Bookshelf by CreativeTrio - 30Iealxb0p.glb',
      },
      {
        match: ['hollis', 'sideboard', 'merrick'],
        image: '/images/products/hollis-sideboard.jpg',
        model: '/Models/Drawer by Quaternius - G1H0wnCHQf.glb',
      },
      {
        match: ['pike', 'chest of drawers', 'chest', 'drawers'],
        image: '/images/products/pike-chest-drawers.jpg',
        model: '/Models/Drawer by Quaternius - G1H0wnCHQf.glb',
      },
      {
        match: ['quill', 'filing cabinet', 'filing', 'shoe cabinet'],
        image: '/images/products/quill-filing-cabinet.jpg',
        model: '/Models/Drawer by Quaternius - G1H0wnCHQf.glb',
      },
    ],
  },
  Lighting: {
    defaultImage: '/images/products/beacon-pendant-light.jpg',
    defaultModel: '/Models/Standing lamp by jeremy - 7AqWZQIaCQf.glb',
    rules: [
      {
        match: ['beacon', 'pendant'],
        image: '/images/products/beacon-pendant-light.jpg',
        model: '/Models/Ceiling Light by Quaternius - sRNcgQFbLB.glb',
      },
      {
        match: ['corbel', 'sconce', 'wall'],
        image: '/images/products/corbel-wall-sconce.jpg',
        model: '/Models/Ceiling Light by Quaternius - sRNcgQFbLB.glb',
      },
      {
        match: ['ember', 'table lamp'],
        image: '/images/products/ember-table-lamp.jpg',
        model: '/Models/Standing lamp by jeremy - 7AqWZQIaCQf.glb',
      },
      {
        match: ['halo', 'arc lamp', 'floor lamp', 'lumen'],
        image: '/images/products/halo-arc-lamp.jpg',
        model: '/Models/Standing lamp by jeremy - 7AqWZQIaCQf.glb',
      },
    ],
  },
  Decor: {
    defaultImage: '/images/products/loom-area-rug.jpg',
    defaultModel: null,
    rules: [
      {
        match: ['brook', 'throw', 'blanket'],
        image: '/images/products/brook-throw-blanket.jpg',
      },
      {
        match: ['cairn', 'planter'],
        image: '/images/products/cairn-planter.jpg',
      },
      {
        match: ['fen', 'cushion', 'pillow'],
        image: '/images/products/fen-cushion-set.jpg',
      },
      {
        match: ['loom', 'area rug', 'rug'],
        image: '/images/products/loom-area-rug.jpg',
      },
      {
        match: ['tessel', 'mirror'],
        image: '/images/products/tessel-wall-mirror.jpg',
      },
      {
        match: ['vale', 'table runner', 'runner'],
        image: '/images/products/vale-table-runner.jpg',
      },
    ],
  },
};

export function resolveProductImage(product?: ProductMediaRef | null): string {
  if (!product) return '/images/products/aspen-lounge-sofa.jpg';

  const nameLower = (product.name || '').toLowerCase();
  const category = (product.category || '').trim();

  // If image_url is already valid and not a mismatched placeholder
  if (product.image_url && typeof product.image_url === 'string' && product.image_url.trim() !== '') {
    const isSofaImage = product.image_url.includes('aspen-lounge-sofa.jpg');
    const isActuallySofa = category.toLowerCase() === 'seating' || nameLower.includes('sofa');
    if (!isSofaImage || isActuallySofa) {
      return product.image_url;
    }
  }

  const catConfig = CATEGORY_RULES[category] || Object.values(CATEGORY_RULES).find((c) =>
    c.rules.some((r) => r.match.some((kw) => nameLower.includes(kw)))
  );

  if (catConfig) {
    for (const rule of catConfig.rules) {
      if (rule.match.some((kw) => nameLower.includes(kw))) {
        return rule.image;
      }
    }
    return catConfig.defaultImage;
  }

  for (const cat of Object.values(CATEGORY_RULES)) {
    for (const rule of cat.rules) {
      if (rule.match.some((kw) => nameLower.includes(kw))) {
        return rule.image;
      }
    }
  }

  return '/images/products/aspen-lounge-sofa.jpg';
}

export function resolveProductModel(product?: ProductMediaRef | null): string | null {
  if (!product) return null;

  if (product.model_url && typeof product.model_url === 'string' && product.model_url.trim() !== '') {
    return product.model_url;
  }

  const nameLower = (product.name || '').toLowerCase();
  const category = (product.category || '').trim();

  const catConfig = CATEGORY_RULES[category] || Object.values(CATEGORY_RULES).find((c) =>
    c.rules.some((r) => r.match.some((kw) => nameLower.includes(kw)))
  );

  if (catConfig) {
    for (const rule of catConfig.rules) {
      if (rule.match.some((kw) => nameLower.includes(kw)) && rule.model) {
        return rule.model;
      }
    }
    return catConfig.defaultModel;
  }

  for (const cat of Object.values(CATEGORY_RULES)) {
    for (const rule of cat.rules) {
      if (rule.match.some((kw) => nameLower.includes(kw)) && rule.model) {
        return rule.model;
      }
    }
  }

  return null;
}

/**
 * Self-healing database check:
 * Automatically enriches products in PostgreSQL that have NULL or placeholder images/models.
 */
export async function autoEnrichDatabaseProducts(): Promise<number> {
  try {
    const res = await pool.query(`
      SELECT id, name, category, image_url, model_url 
      FROM products 
      WHERE image_url IS NULL 
         OR image_url = '' 
         OR model_url IS NULL 
         OR (image_url LIKE '%aspen-lounge-sofa%' AND category != 'Seating')
    `);

    if (res.rows.length === 0) return 0;

    let updated = 0;
    for (const row of res.rows) {
      const correctImage = resolveProductImage(row);
      const correctModel = resolveProductModel(row);

      await pool.query(
        `UPDATE products 
         SET image_url = $1, 
             model_url = COALESCE(model_url, $2)
         WHERE id = $3`,
        [correctImage, correctModel, row.id]
      );
      updated++;
    }

    if (updated > 0) {
      console.log(`[ProductMediaService] Auto-enriched ${updated} products with authentic images & 3D models.`);
    }
    return updated;
  } catch (err: any) {
    console.warn('[ProductMediaService] Auto-enrichment non-blocking notice:', err.message);
    return 0;
  }
}
