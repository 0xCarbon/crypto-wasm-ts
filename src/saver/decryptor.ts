import {
  saverDecompressEncryptionGenerators,
  saverDecompressEncryptionKey,
  saverDecompressDecryptionKey,
  saverDecompressSnarkPk,
  saverDecompressSnarkVk,
  saverDecryptorSetup,
  saverGenerateEncryptionGenerators,
  saverGetSnarkVkFromPk,
  saverDecryptCiphertextUsingSnarkVk
} from '@docknetwork/crypto-wasm';

import { getChunkBitSize } from './util';
import { ICompressed, IUncompressed } from '../ICompressed';
import { BytearrayWrapper } from '../bytearray-wrapper';
import { SaverCiphertext } from './ciphertext';

/**
 * Secret key for the decryptor
 */
export class SaverSecretKey extends BytearrayWrapper {}

/**
 * Same as `SaverEncryptionGens` but uncompressed
 */
export class SaverEncryptionGensUncompressed extends BytearrayWrapper implements IUncompressed {}

/**
 * Generators for creating secret, encryption and decryption keys and the SNARK setup.
 */
export class SaverEncryptionGens extends BytearrayWrapper implements ICompressed<SaverEncryptionGensUncompressed> {
  static generate(label?: Uint8Array): SaverEncryptionGens {
    const gens = saverGenerateEncryptionGenerators(label);
    return new SaverEncryptionGens(gens);
  }

  decompress(): SaverEncryptionGensUncompressed {
    return new SaverEncryptionGensUncompressed(saverDecompressEncryptionGenerators(this.value));
  }
}

export class SaverEncryptionKeyUncompressed extends BytearrayWrapper implements IUncompressed {}

export class SaverEncryptionKey extends BytearrayWrapper implements ICompressed<SaverEncryptionKeyUncompressed> {
  decompress(): SaverEncryptionKeyUncompressed {
    return new SaverEncryptionKeyUncompressed(saverDecompressEncryptionKey(this.value));
  }
}

export class SaverDecryptionKeyUncompressed extends BytearrayWrapper implements IUncompressed {}

export class SaverDecryptionKey extends BytearrayWrapper implements ICompressed<SaverDecryptionKeyUncompressed> {
  decompress(): SaverDecryptionKeyUncompressed {
    return new SaverDecryptionKeyUncompressed(saverDecompressDecryptionKey(this.value));
  }
}

export class SaverProvingKeyUncompressed extends BytearrayWrapper implements IUncompressed {}

export class SaverProvingKey extends BytearrayWrapper implements ICompressed<SaverProvingKeyUncompressed> {
  decompress(): SaverProvingKeyUncompressed {
    return new SaverProvingKeyUncompressed(saverDecompressSnarkPk(this.value));
  }

  getVerifyingKey(): SaverVerifyingKey {
    return new SaverVerifyingKey(saverGetSnarkVkFromPk(this.value, false));
  }

  getVerifyingKeyUncompressed(): SaverVerifyingKeyUncompressed {
    return new SaverVerifyingKeyUncompressed(saverGetSnarkVkFromPk(this.value, true));
  }
}

export class SaverVerifyingKeyUncompressed extends BytearrayWrapper implements IUncompressed {}

export class SaverVerifyingKey extends BytearrayWrapper implements ICompressed<SaverVerifyingKeyUncompressed> {
  decompress(): SaverVerifyingKeyUncompressed {
    return new SaverVerifyingKeyUncompressed(saverDecompressSnarkVk(this.value));
  }
}

/**
 * The decrypted message and the commitment to the randomness in the ciphertext.
 */
export class Decrypted {
  // The decrypted message
  message: Uint8Array;
  // The commitment to the randomness
  nu: Uint8Array;

  constructor(message: Uint8Array, nu: Uint8Array) {
    this.message = message;
    this.nu = nu;
  }
}

// TODO: The following exposes too many details like proving key, encryption key, decryption key. Consider abstracting
// them in a small number of objects such that the caller does not have to be aware of these details.

/**
 * Actions done by the decryptor
 */
export class SaverDecryptor {
  /**
   * Create the secret key, encryption and decryption keys and the setup the SNARK.
   * @param encGens
   * @param chunkBitSize - A number that is either 4 or 8 or 16. The higher numbers make for faster encryption
   * and proving but slower decryption. Since decryption is less common and usually done by less resource constrained
   * devices, 16 is the default choice and should be good for most applications
   */
  static setup(
    encGens: SaverEncryptionGens,
    chunkBitSize?: number
  ): [SaverProvingKey, SaverSecretKey, SaverEncryptionKey, SaverDecryptionKey] {
    const c = getChunkBitSize(chunkBitSize);
    const [snarkPk, sk, ek, dk] = saverDecryptorSetup(c, encGens.value, false);
    return [
      new SaverProvingKey(snarkPk),
      new SaverSecretKey(sk),
      new SaverEncryptionKey(ek),
      new SaverDecryptionKey(dk)
    ];
  }

  /**
   * Decrypt the ciphertext using uncompressed public parameters.
   * @param ciphertext - Must be same as the one used during setup to create the parameters.
   * @param secretKey
   * @param decryptionKey
   * @param snarkVk
   * @param chunkBitSize
   */
  static decryptCiphertext(
    ciphertext: SaverCiphertext,
    secretKey: SaverSecretKey,
    decryptionKey: SaverDecryptionKeyUncompressed,
    snarkVk: SaverVerifyingKeyUncompressed,
    chunkBitSize: number
  ): Decrypted {
    return new Decrypted(
      ...saverDecryptCiphertextUsingSnarkVk(
        ciphertext.value,
        secretKey.value,
        decryptionKey.value,
        snarkVk.value,
        chunkBitSize,
        true
      )
    );
  }

  /**
   * Same as `decryptCiphertext` but uses compressed parameters.
   * @param ciphertext - Must be same as the one used during setup to create the parameters.
   * @param secretKey
   * @param decryptionKey
   * @param snarkVk
   * @param chunkBitSize
   */
  static decryptCiphertextUsingCompressedParams(
    ciphertext: SaverCiphertext,
    secretKey: Uint8Array,
    decryptionKey: SaverDecryptionKey,
    snarkVk: SaverVerifyingKey,
    chunkBitSize: number
  ): Decrypted {
    return new Decrypted(
      ...saverDecryptCiphertextUsingSnarkVk(
        ciphertext.value,
        secretKey,
        decryptionKey.value,
        snarkVk.value,
        chunkBitSize,
        false
      )
    );
  }
}
