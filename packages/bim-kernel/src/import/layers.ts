import type { MaterialLayer, MaterialLayerSet } from "../types";
import type { ImportProduct } from "./types";

/**
 * A linked model's build-up in the kernel's words: its layers in the file's
 * order, each with its material name, its thickness and where its outer face
 * falls from the reference line, plus the set's own numbers. The kernel's
 * `MaterialLayer` is generic (material, thickness, order); what a layer costs
 * is the firm's data (`MATERIAL_LAYER_CODE_POINT`), never decided here.
 */
export function importedLayerSet(product: ImportProduct): MaterialLayerSet | null {
  const set = product.layerSet;
  if (!set || set.layers.length === 0) return null;
  const layers: MaterialLayer[] = [...set.layers]
    .sort((a, b) => a.order - b.order)
    .flatMap((l) => {
      const materialId = l.materialName.trim();
      if (materialId === "" || !(l.thicknessMm > 0)) return [];
      return [{ materialId, thicknessMm: l.thicknessMm, offsetFromReferenceLineMm: l.offsetFromReferenceLineMm, ...(l.ventilated === true ? { ventilated: true as const } : {}) }];
    });
  if (layers.length === 0) return null;
  return {
    id: `ifc:${product.typeId?.trim() || product.sourceId}`,
    ...(set.name?.trim() ? { name: set.name.trim() } : {}),
    totalThicknessMm: set.totalThicknessMm,
    referenceLineOffsetMm: set.referenceLineOffsetMm,
    layers,
  };
}
