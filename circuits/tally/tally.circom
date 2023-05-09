pragma circom 2.0.0;

include "../common/babyjubExtend.circom";

// vote
template Tally() {
    signal input PK_i[2];
    signal input R[3][2];
    signal input D_i[3][2];
    signal input sk_i;

    // PK == sk * G
    component comp_PK = BabyScaleGenerator();
    comp_PK.in <== sk_i;
    comp_PK.Ax === PK_i[0];
    comp_PK.Ay === PK_i[1];

    // for k = 1,2,3:
    //   D_i[k] = sk * R_i[k]
    component comp_D_i[3];
    for (var k = 0; k < 3; k++) {
        comp_D_i[k] = JubScalarMulAny();
        comp_D_i[k].in <== sk_i;
        comp_D_i[k].p <== R[k];
        comp_D_i[k].out === D_i[k];
    }
}

component main {public [PK_i, R, D_i]} = Tally();
