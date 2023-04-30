pragma circom 2.0.8;
pragma custom_templates;    // TODO : proof of plonk's custom gate

include "../../node_modules/circomlib/circuits/comparators.circom";
include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../nouns/babyjubExtend.circom";

template PoseidonEnc() {
    signal input base[2];
    signal input msg;
    signal input r;

    signal KS[2];
    signal output out;
    signal output kb[2];

    // R = r * G
    component mulG = BabyScaleGenerator();
    mulG.in <== r;
    kb[0] <== mulG.Ax;
    kb[1] <== mulG.Ay;

    // KS = r * C_0
    component mulAny = JubScalarMulAny();
    mulAny.in <== r;
    mulAny.p[0] <== base[0];
    mulAny.p[1] <== base[1];
    KS[0] <== mulAny.out[0];
    KS[1] <== mulAny.out[1];

    // Blinding factor = Poseidon(KS[0])
    component pos = Poseidon(1);
    pos.inputs[0] <== KS[0];
    out <== pos.out + msg;

    // TODO : complete poseidon enc (C.last == S[1]) to protect from "Tampering"

    // TODO(duncan): The simple poseidon may be sufficient.  This proof will
    // guarantee that the sender has encrypted the correct plaintext exactly
    // as described here.
}


/// Use Horner's method for safe polynomial evaluation where x may be an
/// element of a field with a different characteristic.
template EncodedPolynomialEvaluation(t) {

    assert(t > 1); // t < 2 not handled by this circuit.

    signal input x;
    signal input C[t][2];
    signal output out[2];

    // 1. Start with C[t-1].
    // 2. For each entry C[i] for i = t-2,...,0:
    //   1. scalar mul by x
    //   2. add C[i]

    // signal mul_result[t-1][2];
    component scalar_mul[t-1];
    // signal add_result[t-1][2];
    component add[t-1];

    for (var i = t-2 ; i >= 0 ; i--) {
        // ScalarMul(prev_result, x);
        scalar_mul[i] = JubScalarMulAny();
        scalar_mul[i].in <== x;
        if (i == t-2) {
            scalar_mul[i].p <== C[t-1];
        } else {
            scalar_mul[i].p[0] <== add[i+1].xout;
            scalar_mul[i].p[1] <== add[i+1].yout;
        }

        // Add(scalar_mul.out, C[i])
        add[i] = BabyAdd();
        add[i].x1 <== scalar_mul[i].out[0];
        add[i].y1 <== scalar_mul[i].out[1];
        add[i].x2 <== C[i][0];
        add[i].y2 <== C[i][1];
    }

    out[0] <== add[0].xout;
    out[1] <== add[0].yout;
}


template Round2(t) {
    signal input f_l;
    signal input l;
    signal input C[t][2];
    signal input CL0[2];

    signal input r;

    signal output out[2]; // f_i_l_commitment
    signal output enc;
    signal output kb[2];

    // Show that f(l) * G = evaluation of committed poly at l
    component encoded_poly_eval = EncodedPolynomialEvaluation(t);
    encoded_poly_eval.x <== l;
    encoded_poly_eval.C <== C;

    component compute_f_l_times_G = BabyScaleGenerator();
    compute_f_l_times_G.in <== f_l;
    compute_f_l_times_G.Ax === encoded_poly_eval.out[0];
    compute_f_l_times_G.Ay === encoded_poly_eval.out[1];

    // Show that ENC(f(l), C_0) = C(iphertext)
    component E = PoseidonEnc();
    E.base[0] <== CL0[0];
    E.base[1] <== CL0[1];
    E.msg <== f_l;
    E.r <== r;
    enc <== E.out;
    kb[0] <== E.kb[0];
    kb[1] <== E.kb[1];
    log("round 2 circuit out[0] ", out[0]);
}

// TODO: enc, out
component main {public [l, C, CL0]} = Round2(2);
