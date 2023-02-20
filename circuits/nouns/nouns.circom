pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/escalarmulany.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";
include "./babyjubExtend.circom";

// C[t] = a[t] * G
template JubCommitments(t) {
    signal input a[t];
    signal output C[t][2];

    component pk[t];
    for (var i = 0; i < t; i++) {
        pk[i] = BabyScaleGenerator();
        pk[i].in <== a[i];
        C[i][0] <== pk[i].Ax;
        C[i][1] <== pk[i].Ay;
    }
}

// Round2 : f(l)*G == sum(l^k * C[k])
template SumScaleMul(t) {
    signal input f_l;    // f(l)
    signal input l;
    signal input C[t][2];

    signal output out[2];

    var lk = 1;
    component mulAny[t];
    component pvkBits[t];
    component babyAdd[t];
    for (var k = 0; k < t; k++) {
        lk = lk * l;
        mulAny[k] = EscalarMulAny(253);

        pvkBits[k] = Num2Bits(253);
        pvkBits.in <== lk;
        var i;
        for (i=0; i<253; i++) {
            mulAny.e[i] <== pvkBits.out[i];
        }

        mulAny.p[0] <== C[k][0];
        mulAny.p[1] <== C[k][1];

        babyAdd[k] = BabyAdd();
        babyAdd[k].x1 <== mulAny.out[0];
        babyAdd[k].y1 <== mulAny.out[1];
        babyAdd[k].x2 <== out[0];
        babyAdd[k].y2 <== out[1];
        out[0] <== babyAdd[k].xout;
        out[1] <== babyAdd[k].yout;
    }

    component scaleMulG = BabyScaleGenerator();
    scaleMulG.in <== f_l;

    component equal = IsEqual();
    equal.in[0] <== scaleMulG.Ax;
    equal.in[1] <== scaleMulG.Ay;
}

// TODO : Did we need Encrypt (Poseidon enc) ? 
// see https://github.com/Poseidon-ZKP/poseidon-zk-contracts/blob/nouns/docs/nouns.md#refine-tips

// component main {public [C]} = JubCommitments(1);
component main = JubCommitments(2);
