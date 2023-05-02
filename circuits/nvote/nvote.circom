pragma circom 2.0.0;

include "../nouns/babyjubExtend.circom";

// vote
template Vote() {
    signal input PK[2];
    signal input votePower;
    signal input R[3][2];
    signal input M[3][2];

    // Private
    signal input o;
    signal input r[3];
    // signal output R[2];
    // signal output M[3][2];

    // component scaleMulG = BabyScaleGenerator();
    // scaleMulG.in <== r;
    // R[0] <== scaleMulG.Ax;
    // R[1] <== scaleMulG.Ay;

    // component mulAny = JubScalarMulAny();
    // mulAny.in <== r;
    // mulAny.p[0] <== pk[0];
    // mulAny.p[1] <== pk[1];
    // rpk[0] <== mulAny.out[0];
    // rpk[1] <== mulAny.out[1];

    component o2bits = Num2Bits(3);
    o2bits.in <== o;

    // Ensure exactly one bit is set.
    1 === o2bits.out[0] + o2bits.out[1] + o2bits.out[2];

    component comp_ov_G[3];
    component comp_r_PK[3];
    component comp_M[3];
    component comp_R[3];
    // component mulG[3];
    // component babyAdd[3];
    // var i;
    for (var i = 0; i < 3; i++) {
        var ov = votePower * o2bits.out[i];

        comp_ov_G[i] = BabyScaleGenerator();
        comp_ov_G[i].in <== ov;

        comp_r_PK[i] = JubScalarMulAny();
        comp_r_PK[i].in <== r[i];
        comp_r_PK[i].p <== PK;

        // M_i = ov_i*G + r_i*PK
        comp_M[i] = BabyAdd();
        comp_M[i].x1 <== comp_r_PK[i].out[0];
        comp_M[i].y1 <== comp_r_PK[i].out[1];
        comp_M[i].x2 <== comp_ov_G[i].Ax;
        comp_M[i].y2 <== comp_ov_G[i].Ay;

        comp_M[i].xout === M[i][0];
        comp_M[i].yout === M[i][1];

        // R_i = r_i*G
        comp_R[i] = BabyScaleGenerator();
        comp_R[i].in <== r[i];

        comp_R[i].Ax === R[i][0];
        comp_R[i].Ay === R[i][1];

        // babyAdd[i] = BabyAdd();
        // babyAdd[i].x1 <== mulG[i].Ax;
        // babyAdd[i].y1 <== mulG[i].Ay;
        // babyAdd[i].x2 <== rpk[0];
        // babyAdd[i].y2 <== rpk[1];
        // M[i][0] <== babyAdd[i].xout;
        // M[i][1] <== babyAdd[i].yout;
    }
}

component main {public [PK, votePower, R, M]} = Vote();
