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

template JubScalarMulAny() {
    signal input in;
    signal input p[2];
    signal output out[2];

    component mulAny = EscalarMulAny(253);

    component n2b = Num2Bits(253);
    n2b.in <== in;

    var i;
    for (i=0; i<253; i++) {
        mulAny.e[i] <== n2b.out[i];
    }

    mulAny.p[0] <== p[0];
    mulAny.p[1] <== p[1];

    out[0] <== mulAny.out[0];
    out[1] <== mulAny.out[0];
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

        mulAny[k] = JubScalarMulAny();
        mulAny.in <== lk;
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


// vote
template Vote() {
    signal input pk[2];
    signal input votePower;
    signal input r;
    signal input o;

    signal rpk[2];

    signal output R[2];
    signal output M[3][2];

    component scaleMulG = BabyScaleGenerator();
    scaleMulG.in <== r;
    R[0] <== scaleMulG.Ax;
    R[1] <== scaleMulG.Ay;

    component mulAny = JubScalarMulAny();
    mulAny.in <== r;
    mulAny.p[0] <== pk[0];
    mulAny.p[1] <== pk[1];
    rpk[0] <== mulAny.out[0];
    rpk[1] <== mulAny.out[1];

    component o2bits = Num2Bits(3);
    o2bits.in <== o;
    component mulG[3];
    component babyAdd[3];
    var i;
    for (i=0; i<3; i++) {
        var ov = votePower * o2bits.out[i];
        mulG[i] = BabyScaleGenerator();
        mulG[i].in <== ov;

        babyAdd[i] = BabyAdd();
        babyAdd[i].x1 <== mulG.out[0];
        babyAdd[i].y1 <== mulG.out[1];
        babyAdd[i].x2 <== rpk[0];
        babyAdd[i].y2 <== rpk[1];
        M[i][0] <== babyAdd[i].xout;
        M[i][1] <== babyAdd[i].yout;
    }
}


//component main {public [f_l, l, C]} = SumScaleMul(2);
//component main {public [pk, votePower, R, M]} = Vote();

component main = JubCommitments(2);
