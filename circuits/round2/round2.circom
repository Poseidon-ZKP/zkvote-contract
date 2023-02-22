pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/comparators.circom";
include "../nouns/babyjubExtend.circom";

// Round2 : f(l)*G == sum(l^k * C[k])
template SumScaleMul(t) {
    signal input f_l;    // f(l)
    signal input l;
    signal input C[t][2];

    signal res[t][2];
    signal output out[2];
    signal output cmp[2];

    var lk = 1; // 0^0 = 1
    component mulAny[t];
    component pvkBits[t];
    component babyAdd[t];
    for (var k = 0; k < t; k++) {
        mulAny[k] = JubScalarMulAny();
        mulAny[k].in <== lk;
        mulAny[k].p[0] <== C[k][0];
        mulAny[k].p[1] <== C[k][1];

        if (k == 0) {
            res[k][0] <== mulAny[k].out[0];
            res[k][1] <== mulAny[k].out[1];
        } else {
            babyAdd[k] = BabyAdd();
            babyAdd[k].x1 <== mulAny[k].out[0];
            babyAdd[k].y1 <== mulAny[k].out[1];
            babyAdd[k].x2 <== res[k-1][0];
            babyAdd[k].y2 <== res[k-1][1];
            res[k][0] <== babyAdd[k].xout;
            res[k][1] <== babyAdd[k].yout;
        }

        lk = lk * l;
    }

    out[0] <== res[t-1][0];
    out[1] <== res[t-1][1];

    component scaleMulG = BabyScaleGenerator();
    scaleMulG.in <== f_l;

    cmp[0] <== scaleMulG.Ax;
    cmp[1] <== scaleMulG.Ax;

    // scaleMulG.Ax === out[0];
    // scaleMulG.Ay === out[1];
}

// TODO : Did we need Encrypt (Poseidon enc) ? 
// see https://github.com/Poseidon-ZKP/poseidon-zk-contracts/blob/nouns/docs/nouns.md#refine-tips


component main {public [f_l, l, C]} = SumScaleMul(2);
