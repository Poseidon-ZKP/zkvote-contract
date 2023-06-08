import { utils, Signer } from "ethers";
import { arrayify } from "@ethersproject/bytes";


/// Derive a secret from some other key in a deterministic way by signing a
/// fixed message and using the resulting bytes.  The modulus is used to
/// determine how many bytes to extract from the signature, as well as to
/// reduce the secret into the appropriate field.
export async function deriveSecret(
  message: string,
  signer: Signer,
  modulus: bigint): Promise<{ secret: bigint, eth_pk: string }> {

  // Compute required byte-length, rounded up to the nearest byte.
  const max_value = modulus - BigInt(1);
  const byte_length = ((max_value.toString(16).length + 1) / 2) | 0;

  // Generate the signature, and extract enough (hex) bytes for the secret
  // (i.e. leading '0x' + 2 chars per byte).
  const char_length = 2 * (byte_length + 1);
  let sig = await signer.signMessage(message);
  if (!sig.startsWith("0x")) {
    sig = "0x" + sig;
  }

  // Ensure sufficient data.
  if (sig.length < char_length) {
    throw "insufficient bytes in signature";
  }

  // Extract the public key
  const msg_hash = utils.hashMessage(message);
  const eth_pk = utils.recoverPublicKey(msg_hash, sig);

  return { secret: BigInt(sig.slice(0, char_length)) % modulus, eth_pk };
}
