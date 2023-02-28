pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/comparators.circom";
include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../nouns/babyjubExtend.circom";

// TODO : Did we need Encrypt (Poseidon enc) ? 
// see https://github.com/Poseidon-ZKP/poseidon-zk-contracts/blob/nouns/docs/nouns.md#refine-tips
// encrypt :
//      KS = r * C[l][0], K = r * G
//      M = {f[i][l]}
//  1. S = [0, KS[0], KS[1], N]
//  2. S = [P(0), P(KS[0]), P(KS[1]), P(N)]
//  3. S = [P(0), P(KS[0]) + M[0], P(KS[1]), P(N)]
//  4. C = [P(KS[0]) + M[0], P(KS[1]), P(N)]
//  5. S = [P(P(0)), P(P(KS[0]) + M[0]), P(P(KS[1])), P(P(N))]
//  6. C = [P(KS[0]) + M[0], P(KS[1]), P(N), P(P(KS[0]) + M[0])]

// decrypt : C[l][0] = A[l][0] * G
//      KS = A[l][0] * G
//  1. S = [0, KS[0], KS[1], N]
//  2. S = [P(0), P(KS[0]), P(KS[1]), P(N)]
//  2. M = [P(KS[0]) + P(P(KS[0] + M[0]) ]

template PoseidonEnc() {
    signal input base[2];
    signal input msg;
    signal input r;

    signal KS[2];
    signal output out;
    signal output kb[2];

    component mulG = BabyScaleGenerator();
    mulG.in <== r;
    kb[0] <== mulG.Ax;
    kb[1] <== mulG.Ay;

    component mulAny = JubScalarMulAny();
    mulAny.in <== r;
    mulAny.p[0] <== base[0];
    mulAny.p[1] <== base[1];
    KS[0] <== mulAny.out[0];
    KS[1] <== mulAny.out[1];

    component pos = Poseidon(1);
    pos.inputs[0] <== KS[0];
    out <== pos.out + msg;
}

// Round2 : f(l)*G == sum(l^k * C[k])
template SumScaleMul(t) {
    signal input f_l;    // f(l)
    signal input l;
    signal input C[t][2];

    signal res[t][2];
    signal output out[2];
    // signal output cmp[2];

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
    scaleMulG.Ax === out[0];
    scaleMulG.Ay === out[1];
}

template Round2(t) {
    signal input f_l;
    signal input l;
    signal input C[t][2];
    signal input CL0[2];

    signal input r;

    signal output out[2];
    signal output enc;
    signal output kb[2];

    component S = SumScaleMul(2);
    S.f_l <== f_l;
    S.l <== l;
    for (var i = 0; i < t; i++) {
        S.C[i][0] <== C[i][0];
        S.C[i][1] <== C[i][1];
    }
    out[0] <== S.out[0];
    out[1] <== S.out[1];

    component E = PoseidonEnc();
    E.base[0] <== CL0[0];
    E.base[1] <== CL0[1];
    E.msg <== f_l;
    E.r <== r;
    enc <== E.out;
    kb[0] <== E.kb[0];
    kb[1] <== E.kb[1];
}

component main {public [l, C, CL0]} = Round2(2);
