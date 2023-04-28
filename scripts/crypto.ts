

export type PublicKey = string[];


export function groupOrder(babyjub: any): bigint {
  return babyjub.subOrder;
  // return babyjub.order;
}

export function pointFromNative(babyjub: any, native: any[]): PublicKey {
  return native.map(x => babyjub.F.toString(x));
}


export function pointToNative(babyjub: any, point: PublicKey): any[] {
  return point.map(x => babyjub.F.e(x));
}


export function pointFromScalar(babyjub: any, sk: bigint): PublicKey {
  return pointFromNative(babyjub, babyjub.mulPointEscalar(babyjub.Base8, sk));
  // return pointFromNative(babyjub, babyjub.mulPointEscalar(babyjub.Generator, sk));
}


export function pointAdd(babyjub: any, P1: PublicKey, P2: PublicKey): PublicKey {
  const P1_n = pointToNative(babyjub, P1);
  const P2_n = pointToNative(babyjub, P2);
  const sum = babyjub.addPoint(P1_n, P2_n);
  return pointFromNative(babyjub, sum);
}


export function pointMul(babyjub: any, P: PublicKey, scalar: bigint): PublicKey {
  const P_n = pointToNative(babyjub, P);
  const prod = babyjub.mulPointEscalar(P_n, scalar);
  return pointFromNative(babyjub, prod);
}

export function polynomial_evaluate(coefficients: bigint[], x: bigint, mod: bigint): bigint {
  // Horners method.
  let val = coefficients[coefficients.length-1];
  for (let i = coefficients.length - 2; i >= 0 ; --i) {
    val = (val * x + coefficients[i]) % mod;
  }
  return val;
}


export function polynomial_evaluate_group(
  babyjub: any, coefficients: PublicKey[], x: bigint
): PublicKey {
  // Horners method.
  let val = pointToNative(babyjub, coefficients[coefficients.length-1]);
  for (let i = coefficients.length - 2; i >= 0 ; --i) {
    const c_native = pointToNative(babyjub, coefficients[i]);
    val = babyjub.mulPointEscalar(val, x);
    val = babyjub.addPoint(val, c_native);
  }

  return pointFromNative(babyjub, val);;
}
