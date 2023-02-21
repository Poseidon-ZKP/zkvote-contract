pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/bitify.circom";
include "../../node_modules/circomlib/circuits/escalarmulfix.circom";
include "../../node_modules/circomlib/circuits/escalarmulany.circom";

template BabyScaleGenerator() {
    signal input  in;
    signal output Ax;
    signal output Ay;

    var BASE8[2] = [
        995203441582195749578291179787384436505546430278305826713579947235728471134,
        5472060717959818805561601436314318772137091100104008585924551046643952123905
    ];

    component pvkBits = Num2Bits(253);
    pvkBits.in <== in;

    component mulFix = EscalarMulFix(253, BASE8);

    var i;
    for (i=0; i<253; i++) {
        mulFix.e[i] <== pvkBits.out[i];
    }
    Ax  <== mulFix.out[0];
    Ay  <== mulFix.out[1];
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
    out[1] <== mulAny.out[1];
}