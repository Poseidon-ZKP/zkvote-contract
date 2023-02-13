pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/babyjub.circom";

// C = a * G
template JubCommitments(t) {
    signal input a[t];
    signal output C[t][2];

    for (var i = 0; i < t; i++) {
        component pk = BabyPbk()
        pk.in <== a[i];
        C[i][0] <== pk.Ax;
        C[i][1] <== pk.Ay;
    }
}

// component main {public [signalHash, externalNullifier]} = JubCommitments();
component main {public [C]} = JubCommitments();
