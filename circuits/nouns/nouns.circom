pragma circom 2.0.0;

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

//component main = JubCommitments(2);
component main {public [in, p]} = JubScalarMulAny();
