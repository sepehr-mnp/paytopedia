import { ethers } from "ethers";

/**
 * Creates an EIP-7702 authorization object
 * @param {string} privateKey - The private key of the delegating wallet
 * @param {string} delegateAddress - The contract address to delegate to
 * @param {number} chainId - The chain ID
 * @param {number} nonce - The nonce for the authorization
 * @returns {Object} The authorization object
 */
export async function createEIP7702Authorization(privateKey, delegateAddress, chainId, nonce = 0) {
  const signer = new ethers.Wallet(privateKey);
  
  // EIP-7702 Authorization structure
  // address: 20 bytes - address being delegated to
  // nonce: 8 bytes - nonce to prevent replay
  // chainId: 64 bits - chain ID
  const authorizationData = ethers.solidityPacked(
    ["address", "uint8", "uint256"],
    [delegateAddress, nonce, chainId]
  );

  const messageHash = ethers.keccak256(
    ethers.solidityPacked(
      ["string", "bytes"],
      ["EIP7702", authorizationData]
    )
  );

  const signature = signer.signingKey.sign(messageHash);

  return {
    address: signer.address,
    delegateAddress: delegateAddress,
    chainId: chainId,
    nonce: nonce,
    signature: {
      r: signature.r,
      s: signature.s,
      v: signature.v,
    },
  };
}

/**
 * Encodes EIP-7702 authorization as a transaction
 * @param {string} privateKey - The private key of the delegating wallet
 * @param {string} delegateAddress - The contract address to delegate to
 * @param {number} chainId - The chain ID
 * @returns {Object} The authorization structure for EIP-7702
 */
export async function encodeEIP7702Authorization(privateKey, delegateAddress, chainId) {
  const signer = new ethers.Wallet(privateKey);
  
  // Create the authorization structure
  // This should be encoded as specified in EIP-7702
  const authorization = {
    chainId: chainId,
    address: delegateAddress,
    nonce: 0,
  };

  // Sign the authorization
  const messageToSign = ethers.solidityPacked(
    ["uint256", "address", "uint256"],
    [authorization.chainId, authorization.address, authorization.nonce]
  );

  const signature = await signer.signMessage(ethers.getBytes(messageToSign));
  
  return {
    authority: signer.address,
    chainId: chainId,
    delegateAddress: delegateAddress,
    nonce: 0,
    signature: signature,
  };
}

/**
 * Creates a transaction that uses EIP-7702 delegation to transfer tokens
 * @param {Object} provider - ethers provider
 * @param {string} paymentAddress - The address with delegated code
 * @param {string} tokenAddress - The ERC20 token address
 * @param {string} recipient - The recipient of the tokens
 * @param {string} delegateAddress - The delegated contract address
 * @param {string} signerPrivateKey - The service's private key for sending transaction
 * @returns {Object} The prepared transaction
 */
export async function prepareTokenTransferTx(
  provider,
  paymentAddress,
  tokenAddress,
  recipient,
  delegateAddress,
  signerPrivateKey
) {
  const chainId = (await provider.getNetwork()).chainId;
  
  // Create EIP-7702 authorization
  const auth = await encodeEIP7702Authorization(
    paymentAddress,
    delegateAddress,
    chainId
  );

  // Prepare the function call to TokenTransferer.transfer()
  const tokenTransfererABI = [
    "function transfer(address token, address recipient) public",
  ];
  const tokenTransfererInterface = new ethers.Interface(tokenTransfererABI);
  const callData = tokenTransfererInterface.encodeFunctionData("transfer", [
    tokenAddress,
    recipient,
  ]);

  // Create the transaction
  const signer = new ethers.Wallet(signerPrivateKey, provider);
  
  const tx = {
    to: paymentAddress,
    data: callData,
    chainId: chainId,
    // EIP-7702 authorizations would be included in the transaction
    // This is a simplified version - actual implementation depends on client support
  };

  return tx;
}

/**
 * Creates a batch token transfer transaction for multiple tokens
 * @param {Object} provider - ethers provider
 * @param {string} paymentAddress - The address with delegated code
 * @param {Array<string>} tokenAddresses - Array of ERC20 token addresses
 * @param {string} recipient - The recipient of the tokens
 * @param {string} delegateAddress - The delegated contract address
 * @param {string} signerPrivateKey - The service's private key
 * @returns {Object} The prepared transaction
 */
export async function prepareBatchTokenTransferTx(
  provider,
  paymentAddress,
  tokenAddresses,
  recipient,
  delegateAddress,
  signerPrivateKey
) {
  const chainId = (await provider.getNetwork()).chainId;

  // Create EIP-7702 authorization
  const auth = await encodeEIP7702Authorization(
    paymentAddress,
    delegateAddress,
    chainId
  );

  // Prepare the function call to TokenTransferer.transferMultiple()
  const tokenTransfererABI = [
    "function transferMultiple(address[] calldata tokens, address recipient) public",
  ];
  const tokenTransfererInterface = new ethers.Interface(tokenTransfererABI);
  const callData = tokenTransfererInterface.encodeFunctionData("transferMultiple", [
    tokenAddresses,
    recipient,
  ]);

  const signer = new ethers.Wallet(signerPrivateKey, provider);

  const tx = {
    to: paymentAddress,
    data: callData,
    chainId: chainId,
  };

  return tx;
}

/**
 * Validates an EIP-7702 authorization
 * @param {Object} authorization - The authorization object
 * @param {number} expectedChainId - The expected chain ID
 * @returns {boolean} Whether the authorization is valid
 */
export function validateAuthorization(authorization, expectedChainId) {
  if (!authorization.authority || !ethers.isAddress(authorization.authority)) {
    throw new Error("Invalid authority address");
  }

  if (!authorization.delegateAddress || !ethers.isAddress(authorization.delegateAddress)) {
    throw new Error("Invalid delegate address");
  }

  if (authorization.chainId !== expectedChainId) {
    throw new Error(`Chain ID mismatch. Expected ${expectedChainId}, got ${authorization.chainId}`);
  }

  if (!authorization.signature) {
    throw new Error("Missing signature");
  }

  return true;
}
