pragma circom 2.0.0;

include "../nouns/babyjubExtend.circom";

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
        babyAdd[i].x1 <== mulG[i].Ax;
        babyAdd[i].y1 <== mulG[i].Ay;
        babyAdd[i].x2 <== rpk[0];
        babyAdd[i].y2 <== rpk[1];
        M[i][0] <== babyAdd[i].xout;
        M[i][1] <== babyAdd[i].yout;
    }
}

component main {public [pk, votePower]} = Vote();