pragma circom 2.0.0;

include "../common/babyjubExtend.circom";

// vote
template Vote() {
    signal input PK[2];
    signal input votePower;
    signal input R[3][2];
    signal input M[3][2];

    // Private
    signal input o;
    signal input r[3];

    component o2bits = Num2Bits(3);
    o2bits.in <== o;

    // Ensure exactly one bit is set.
    1 === o2bits.out[0] + o2bits.out[1] + o2bits.out[2];

    component comp_ov_G[3];
    component comp_r_PK[3];
    component comp_M[3];
    component comp_R[3];

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
    }
}

component main {public [PK, votePower, R, M]} = Vote();
