const bits = new DataView(new ArrayBuffer(8))
const HIDDEN_BIT = 1n << 52n

/** Exact coefficient of the smallest binary64 unit, 2^-1074. */
export const dyadic = (value: number): bigint | null => {
  if (!Number.isFinite(value)) return null
  bits.setFloat64(0, value)
  const high = bits.getUint32(0)
  const exponent = (high >>> 20) & 0x7ff
  const fraction = (BigInt(high & 0xfffff) << 32n) | BigInt(bits.getUint32(4))
  const magnitude =
    exponent === 0 ? fraction : (fraction | HIDDEN_BIT) << BigInt(exponent - 1)
  return high >>> 31 ? -magnitude : magnitude
}

const roundedMagnitude = (magnitude: bigint): number => {
  const shift = Math.max(0, magnitude.toString(2).length - 53)
  let significand = magnitude >> BigInt(shift)
  if (shift > 0) {
    const remainder = magnitude - (significand << BigInt(shift))
    const half = 1n << BigInt(shift - 1)
    if (remainder > half || (remainder === half && (significand & 1n) !== 0n))
      significand += 1n
  }
  return Number(significand) * 2 ** (shift - 1074)
}

/** One round-to-nearest, ties-to-even conversion of an exact dyadic sum. */
export const roundedDyadic = (value: bigint): number =>
  value < 0n ? -roundedMagnitude(-value) : roundedMagnitude(value)

export const exactSum = (values: readonly number[], initial = 0n): number => {
  let total = initial
  for (const value of values) {
    const term = dyadic(value)
    if (term === null) return Number.NaN
    total += term
  }
  return roundedDyadic(total)
}
