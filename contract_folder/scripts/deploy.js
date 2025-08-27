const hre = require("hardhat");

async function main() {
  console.log("Starting deployment...");

  // 1. Deploy NexusTokenA (NEXA)
  const NexusTokenA = await hre.ethers.getContractFactory("NexusTokenA");
  const nexusTokenA = await NexusTokenA.deploy();
  await nexusTokenA.waitForDeployment();
  console.log(`✅ NexusTokenA (NEXA) deployed to: ${nexusTokenA.target}`);

  // 2. Deploy NexusTokenB (NEXB)
  const NexusTokenB = await hre.ethers.getContractFactory("NexusTokenB");
  const nexusTokenB = await NexusTokenB.deploy();
  await nexusTokenB.waitForDeployment();
  console.log(`✅ NexusTokenB (NEXB) deployed to: ${nexusTokenB.target}`);

  // 3. Deploy the Exchange contract
  const Exchange = await hre.ethers.getContractFactory("Exchange");
  const exchange = await Exchange.deploy(nexusTokenA.target, nexusTokenB.target, "0x0000000000000000000000000000000000000000");
  await exchange.waitForDeployment();
  console.log(`✅ Exchange deployed to: ${exchange.target}`);

  // 4. Add initial liquidity to the exchange
  console.log("\nAdding initial liquidity...");
  const [deployer] = await hre.ethers.getSigners();
  const initialLiquidityA = hre.ethers.parseEther("1000");
  const initialLiquidityB = hre.ethers.parseEther("500");

  // =================================================================
  // THE FIX IS HERE: Add .wait() to each approval
  // =================================================================
  console.log("Approving NEXA spend...");
  const approveATx = await nexusTokenA.connect(deployer).approve(exchange.target, initialLiquidityA);
  await approveATx.wait(); // <-- WAIT FOR CONFIRMATION
  console.log("✅ NEXA approval confirmed.");

  console.log("Approving NEXB spend...");
  const approveBTx = await nexusTokenB.connect(deployer).approve(exchange.target, initialLiquidityB);
  await approveBTx.wait(); // <-- WAIT FOR CONFIRMATION
  console.log("✅ NEXB approval confirmed.");
  // =================================================================

  // Call the addLiquidity function
  console.log("Calling addLiquidity...");
  const tx = await exchange.connect(deployer).addLiquidity(initialLiquidityA, initialLiquidityB);
  await tx.wait(); // Wait for the liquidity transaction itself to be mined

  console.log(`🎉 Liquidity added successfully! Initial price: 1 NEXA = 0.5 NEXB`);
  console.log("\nDeployment complete!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});