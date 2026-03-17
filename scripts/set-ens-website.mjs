/**
 * Set mimirwell.eth website text record via keyring proxy
 */
import { createPublicClient, fallback, http, encodeFunctionData } from "viem";
import { mainnet } from "viem/chains";
import { normalize, namehash } from "viem/ens";
import { createHmac } from "crypto";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load keyring secret
let KEYRING_PROXY_SECRET = process.env.KEYRING_PROXY_SECRET ?? "";
if (!KEYRING_PROXY_SECRET) {
  const p = resolve(process.env.HOME ?? "/root", ".openclaw/secrets/keyring.env");
  const match = readFileSync(p, "utf8").match(/KEYRING_PROXY_SECRET=(.+)/);
  if (match) KEYRING_PROXY_SECRET = match[1].trim();
}
const KEYRING_PROXY_URL = "https://keyringproxy-production-1bbe.up.railway.app";

async function keyringPost(path, body) {
  const ts = Date.now().toString();
  const bodyStr = JSON.stringify(body);
  const payload = `POST\n${path}\n${ts}\n${bodyStr}`;
  const sig = createHmac("sha256", KEYRING_PROXY_SECRET).update(payload).digest("hex");
  const res = await fetch(KEYRING_PROXY_URL + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Keyring-Timestamp": ts,
      "X-Keyring-Signature": sig,
    },
    body: bodyStr,
  });
  return res.json();
}

const client = createPublicClient({
  chain: mainnet,
  transport: fallback([
    http("https://ethereum-rpc.publicnode.com"),
    http("https://cloudflare-eth.com"),
    http("https://eth.llamarpc.com"),
  ]),
});

const ENS_NAME = "mimirwell.eth";
const TEXT_KEY = "url";
const TEXT_VALUE = "https://mimirwell.net";

// Public resolver ABI (setText)
const RESOLVER_ABI = [
  {
    name: "setText",
    type: "function",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
      { name: "value", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
];

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  ENS setText — mimirwell.eth → url");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

// 1. Get resolver for mimirwell.eth
console.log("── [1] Resolving ENS resolver for", ENS_NAME);
const resolverAddress = await client.getEnsResolver({ name: normalize(ENS_NAME) });
console.log("   Resolver:", resolverAddress, "\n");

// 2. Encode setText calldata
const node = namehash(normalize(ENS_NAME));
const data = encodeFunctionData({
  abi: RESOLVER_ABI,
  functionName: "setText",
  args: [node, TEXT_KEY, TEXT_VALUE],
});

// 3. Get signer address from keyring
console.log("── [2] Getting keyring wallet address");
const { address: signerAddress } = await keyringPost("/sign-message", { message: "mimirwell ens update" });
console.log("   Signer:", signerAddress, "\n");

// 4. Build tx
const nonce = await client.getTransactionCount({ address: signerAddress });
const { maxFeePerGas, maxPriorityFeePerGas } = await client.estimateFeesPerGas();
const gas = await client.estimateGas({
  account: signerAddress,
  to: resolverAddress,
  data,
});
const gasWithBuffer = (gas * 130n) / 100n;

console.log("── [3] Transaction details");
console.log("   To (resolver):", resolverAddress);
console.log("   Function: setText(node, 'url', 'https://mimirwell.net')");
console.log("   Gas estimate:", gas.toString(), "(+30%:", gasWithBuffer.toString(), ")");
console.log("   Max fee:", Number(maxFeePerGas) / 1e9, "gwei");
console.log("   Est. cost: ~", (Number(gasWithBuffer * maxFeePerGas) / 1e18).toFixed(6), "ETH\n");

// 5. Sign via keyring
console.log("── [4] Signing via keyring proxy");
const signResult = await keyringPost("/sign-transaction", {
  tx: {
    to: resolverAddress,
    data,
    nonce,
    chainId: mainnet.id,
    type: 2,
    maxFeePerGas: maxFeePerGas.toString(),
    maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
    gas: gasWithBuffer.toString(),
  },
});

if (!signResult.signedTx) {
  console.error("✗ Sign failed:", signResult);
  process.exit(1);
}
console.log("   ✓ Signed\n");

// 6. Broadcast
console.log("── [5] Broadcasting to mainnet");
const txHash = await client.sendRawTransaction({ serializedTransaction: signResult.signedTx });
console.log("   TX:", txHash);
console.log("   Etherscan: https://etherscan.io/tx/" + txHash, "\n");

// 7. Wait for confirmation
console.log("── [6] Waiting for confirmation...");
const receipt = await client.waitForTransactionReceipt({ hash: txHash });
console.log("   ✓ Confirmed in block", receipt.blockNumber.toString());
console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  ✅ mimirwell.eth → url → https://mimirwell.net");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
