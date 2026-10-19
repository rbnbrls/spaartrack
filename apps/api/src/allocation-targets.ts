export const allocationTargetDimensions = ["ASSET_CLASS", "SECTOR", "REGION", "CURRENCY", "HOLDING"] as const;
export type AllocationTargetDimension = typeof allocationTargetDimensions[number];

type AllocationTargetInput = {
  dimension: string;
  targets: Array<{ key: string; label: string; targetPercentage: number }>;
};

export function validateAllocationTargets(input: AllocationTargetInput): {
  dimension: AllocationTargetDimension;
  targets: Array<{ key: string; label: string; target_percentage: number }>;
  total_percentage: number;
  calculation_version: string;
} {
  const dimension = String(input?.dimension || "").trim().toUpperCase();
  if (!allocationTargetDimensions.includes(dimension as AllocationTargetDimension)) throw new Error("INVALID_ALLOCATION_DIMENSION");
  if (!Array.isArray(input?.targets) || input.targets.length === 0) throw new Error("ALLOCATION_TARGETS_REQUIRED");
  const seen = new Set<string>();
  const targets = input.targets.map((target) => {
    const key = String(target?.key || "").trim();
    const label = String(target?.label || "").trim();
    const targetPercentage = Number(target?.targetPercentage);
    if (!key || !label || seen.has(key)) throw new Error("DUPLICATE_ALLOCATION_TARGET");
    if (!Number.isFinite(targetPercentage) || targetPercentage < 0 || targetPercentage > 100) throw new Error("INVALID_ALLOCATION_TARGET_PERCENTAGE");
    seen.add(key);
    return { key, label, target_percentage: Math.round((targetPercentage + Number.EPSILON) * 10000) / 10000 };
  });
  const total = Math.round((targets.reduce((sum, target) => sum + target.target_percentage, 0) + Number.EPSILON) * 10000) / 10000;
  if (Math.abs(total - 100) > 0.0001) throw new Error("ALLOCATION_TARGET_TOTAL_MUST_EQUAL_100");
  return { dimension: dimension as AllocationTargetDimension, targets, total_percentage: total, calculation_version: "allocation-targets-v1" };
}
