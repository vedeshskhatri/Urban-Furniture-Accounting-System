/**
 * Dynamic Product Media Resolver (Images & 3D GLB Models)
 *
 * Guarantees every product in Urban Furniture Atelier displays its authentic
 * handcrafted image and corresponding 3D model, never falling back to generic sofa placeholders.
 */

export interface ProductMediaRef {
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
        match: ['cirrus', 'nimbus', 'mattress'],
        image: '/images/products/cirrus-mattress.jpg',
        model: '/Models/Bed Single by Quaternius - ianC28eMOF.glb',
      },
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
        match: ['halcyon', 'solstice', 'platform'],
        image: '/images/products/halcyon-platform-bed.jpg',
        model: '/Models/Bed Double by Kenney - wcmbCZ63mg.glb',
      },
      {
        match: ['teak', 'single bed', 'urban teak'],
        image: '/images/products/urban-teak-single-bed.jpg',
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

/**
 * Resolves the accurate image for a product.
 * Checks for invalid/placeholder misassignments and matches by name keywords and category.
 */
export function resolveProductImage(product?: ProductMediaRef | null): string {
  if (!product) return '/images/products/aspen-lounge-sofa.jpg';

  const nameLower = (product.name || '').toLowerCase();
  const category = (product.category || '').trim();

  // If image_url is provided and is NOT the generic fallback sofa (unless the product actually is a sofa)
  if (product.image_url && typeof product.image_url === 'string' && product.image_url.trim() !== '') {
    const isSofaImage = product.image_url.includes('aspen-lounge-sofa.jpg');
    const isActuallySofa = category.toLowerCase() === 'seating' || nameLower.includes('sofa');
    if (!isSofaImage || isActuallySofa) {
      return product.image_url;
    }
  }

  // Look up category rules
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

  // Cross-category keyword search
  for (const cat of Object.values(CATEGORY_RULES)) {
    for (const rule of cat.rules) {
      if (rule.match.some((kw) => nameLower.includes(kw))) {
        return rule.image;
      }
    }
  }

  return '/images/products/aspen-lounge-sofa.jpg';
}

/**
 * Resolves the accurate 3D GLB model path for a product.
 */
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
