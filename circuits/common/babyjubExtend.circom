pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/bitify.circom";
include "../../node_modules/circomlib/circuits/escalarmulfix.circom";
include "../../node_modules/circomlib/circuits/escalarmulany.circom";

template BabyScaleGenerator() {
    signal input  in;
    signal output Ax;
    signal output Ay;

    // TODO(duncan): This uses the full generator, even though it is named
    // BASE8.  Is this safe?  This point has order greater than BN128 scalar
    // field.
    //
    // - Some BabyJubjub secret keys can't be represented in the native scalar
    // - field For large t, l the elements terms l^k may wrap in the native
    //   field before they would in the BabyJubjub scalar field.

    var BASE8[2] = [
        // 995203441582195749578291179787384436505546430278305826713579947235728471134,
        // 5472060717959818805561601436314318772137091100104008585924551046643952123905
        5299619240641551281634865583518297030282874472190772894086521144482721001553,
        16950150798460657717958625567821834550301663161624707787222815936182638968203
    ];
    // var numBits = 254;
    var numBits = 251;


    component pvkBits = Num2Bits(numBits);
    pvkBits.in <== in;

    component mulFix = EscalarMulFix(numBits, BASE8);

    var i;
    for (i=0; i < numBits; i++) {
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
