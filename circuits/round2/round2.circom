pragma circom 2.0.8;
pragma custom_templates;    // TODO : proof of plonk's custom gate

include "../../node_modules/circomlib/circuits/comparators.circom";
include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../nouns/babyjubExtend.circom";

template PoseidonEnc() {
    signal input recip_PK[2];
    signal input msg;
    signal input eph_sk;

    signal KS[2];
    signal output out;
    signal output eph_pk[2];

    // TODO(duncan): check eph_sk \in F_B?

    // R = r * G
    component comp_eph_PK = BabyScaleGenerator();
    comp_eph_PK.in <== eph_sk;
    eph_pk[0] <== comp_eph_PK.Ax;
    eph_pk[1] <== comp_eph_PK.Ay;

    // KS = r * C_0
    component comp_KS = JubScalarMulAny();
    comp_KS.in <== eph_sk;
    comp_KS.p <== recip_PK;

    // Blinding factor = Poseidon(KS[0])
    component hash_KS = Poseidon(1);
    hash_KS.inputs[0] <== comp_KS.out[0];

    // out holds the original plaintext, "blinded" by the hash of the shared
    // secret.
    out <== hash_KS.out + msg;

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
    signal input recip_id;  // recipient's ID (l in the protocol spec)
    signal input recip_PK[2]; // recipient's public key (C_{l,0} in the spec)
    signal input PK_i_l[2]; // Encoded secret share for l (PK_{i,l} = f_l * G in spec)
    signal input enc;  // encrypted f_l
    signal input eph_pk[2];  // eph_pk to accompany the encrypted f_l
    signal input C[t][2]; // The encoded coefficients (C_{i,.})

    // Secrets
    signal input f_l; // the encrypted value f_l
    signal input eph_sk; // the ephemeral secret key for encryption

    // f(l) * G = evaluation of committed poly at l
    component encoded_poly_eval = EncodedPolynomialEvaluation(t);
    encoded_poly_eval.x <== recip_id;
    encoded_poly_eval.C <== C;

    component compute_f_l_times_G = BabyScaleGenerator();
    compute_f_l_times_G.in <== f_l;
    compute_f_l_times_G.Ax === encoded_poly_eval.out[0];
    compute_f_l_times_G.Ay === encoded_poly_eval.out[1];

    // Show that ENC(f(l), C_0) = (enc, eph_pk)
    component compute_enc = PoseidonEnc();
    compute_enc.recip_PK <== recip_PK;
    compute_enc.msg <== f_l;
    compute_enc.eph_sk <== eph_sk;

    compute_enc.out === enc;
    compute_enc.eph_pk === eph_pk;
}

// TODO: enc, out
component main {public [recip_id, recip_PK, PK_i_l, enc, eph_pk, C]} = Round2(2);
