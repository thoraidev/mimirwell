/**
 * Deploy MimirWellRevocation to Ethereum mainnet
 * Signer: thorai.eth via SIWA keyring proxy
 *
 * Run: node scripts/deploy-revocation.js
 */

const solc = require('solc');
const fs = require('fs');
const path = require('path');

// ─── Load env (passed via environment) ───────────────────────────────────────
// KEYRING_PROXY_URL and KEYRING_PROXY_SECRET sourced from /root/.openclaw/secrets/keyring.env

// ─── Compile ──────────────────────────────────────────────────────────────────
function compile() {
  const source = fs.readFileSync(
    path.join(__dirname, '../contracts/MimirWellRevocation.sol'),
    'utf8'
  );

  const input = {
    language: 'Solidity',
    sources: { 'MimirWellRevocation.sol': { content: source } },
    settings: {
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } },
      optimizer: { enabled: true, runs: 200 },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    const errors = output.errors.filter(e => e.severity === 'error');
    if (errors.length) {
      console.error('Compilation errors:', errors);
      process.exit(1);
    }
    output.errors.forEach(w => console.warn('[solc warn]', w.formattedMessage));
  }

  const contract = output.contracts['MimirWellRevocation.sol']['MimirWellRevocation'];
  return {
    abi: contract.abi,
    bytecode: '0x' + contract.evm.bytecode.object,
  };
}

// ─── Deploy ───────────────────────────────────────────────────────────────────
async function deploy() {
  // Dynamic imports (ESM modules)
  const { createPublicClient, http } = await import('viem');
  const { mainnet } = await import('viem/chains');
  const { getAddress, signTransaction } = await import('@buildersgarden/siwa/keystore');

  console.log('\n⚒  MimirWell Revocation Contract — Mainnet Deploy');
  console.log('═══════════════════════════════════════════════\n');

  // 1. Compile
  console.log('▸ Compiling MimirWellRevocation.sol...');
  const { abi, bytecode } = compile();
  console.log('  ✓ Compiled. Bytecode size:', (bytecode.length - 2) / 2, 'bytes\n');

  // 2. Setup
  const client = createPublicClient({
    chain: mainnet,
    transport: http('https://ethereum-rpc.publicnode.com'),
  });

  const address = await getAddress();
  console.log('▸ Deploying from:', address);

  const balance = await client.getBalance({ address });
  const balanceEth = Number(balance) / 1e18;
  console.log('  Balance:', balanceEth.toFixed(6), 'ETH\n');

  if (balanceEth < 0.005) {
    console.error('  ✗ Insufficient balance for deployment (need >0.005 ETH)');
    process.exit(1);
  }

  // 3. Estimate gas
  console.log('▸ Estimating gas...');
  const nonce = await client.getTransactionCount({ address });
  const { maxFeePerGas, maxPriorityFeePerGas } = await client.estimateFeesPerGas();
  const gas = await client.estimateGas({ account: address, data: bytecode });
  const gasWithBuffer = (gas * 130n) / 100n;
  const estimatedCost = (gasWithBuffer * maxFeePerGas * 1000000n) / 1000000n;
  console.log('  Gas estimate:', gas.toString(), '(+30% buffer:', gasWithBuffer.toString(), ')');
  console.log('  Max fee per gas:', Number(maxFeePerGas) / 1e9, 'gwei');
  console.log('  Estimated cost: ~', (Number(gasWithBuffer * maxFeePerGas) / 1e18).toFixed(6), 'ETH\n');

  // 4. Sign & broadcast
  console.log('▸ Signing via keyring proxy (thorai.eth)...');
  const tx = {
    data: bytecode,
    nonce,
    chainId: mainnet.id,
    type: 2,
    maxFeePerGas,
    maxPriorityFeePerGas,
    gas: gasWithBuffer,
  };

  const { signedTx } = await signTransaction(tx);
  console.log('  ✓ Signed\n');

  console.log('▸ Broadcasting to Ethereum mainnet...');
  const txHash = await client.sendRawTransaction({ serializedTransaction: signedTx });
  console.log('  TX hash:', txHash);
  console.log('  Etherscan: https://etherscan.io/tx/' + txHash + '\n');

  // 5. Wait for confirmation
  console.log('▸ Waiting for confirmation...');
  const receipt = await client.waitForTransactionReceipt({ hash: txHash });
  const contractAddress = receipt.contractAddress;

  console.log('\n══════════════════════════════════════════════════');
  console.log('✓ CONTRACT DEPLOYED');
  console.log('  Address:   ', contractAddress);
  console.log('  Etherscan:  https://etherscan.io/address/' + contractAddress);
  console.log('  Block:      ', receipt.blockNumber.toString());
  console.log('  Gas used:   ', receipt.gasUsed.toString());
  console.log('  Cost:       ~', (Number(receipt.gasUsed * receipt.effectiveGasPrice) / 1e18).toFixed(6), 'ETH');
  console.log('══════════════════════════════════════════════════\n');

  // 6. Save deployment record
  const deployed = {
    contractAddress,
    txHash,
    blockNumber: receipt.blockNumber.toString(),
    deployedAt: new Date().toISOString(),
    deployedBy: address,
    network: 'mainnet',
    chainId: 1,
    etherscan: 'https://etherscan.io/address/' + contractAddress,
    abi,
  };

  const outPath = path.join(__dirname, '../deployed.json');
  fs.writeFileSync(outPath, JSON.stringify(deployed, null, 2));
  console.log('✓ Saved to deployed.json\n');

  return deployed;
}

deploy().catch(err => {
  console.error('\n✗ Deploy failed:', err.message || err);
  process.exit(1);
});
