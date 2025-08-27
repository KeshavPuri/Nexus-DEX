const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Exchange Contract", function () {
    let owner, user1;
    let nexusTokenA, nexusTokenB, exchange;

    beforeEach(async function () {
        [owner, user1] = await ethers.getSigners();
        const NexusTokenA = await ethers.getContractFactory("NexusTokenA");
        nexusTokenA = await NexusTokenA.deploy();
        const NexusTokenB = await ethers.getContractFactory("NexusTokenB");
        nexusTokenB = await NexusTokenB.deploy();
        const Exchange = await ethers.getContractFactory("Exchange");
        exchange = await Exchange.deploy(nexusTokenA.target, nexusTokenB.target, "0x0000000000000000000000000000000000000000");
    });

    // === HAPPY PATH TESTS ===

    it("Should deploy all contracts correctly", async function () {
        expect(await exchange.tokenA()).to.equal(nexusTokenA.target);
        expect(await exchange.tokenB()).to.equal(nexusTokenB.target);
    });

    it("Should allow adding liquidity", async function () {
        const amountA = ethers.parseEther("100");
        const amountB = ethers.parseEther("200");
        await nexusTokenA.connect(owner).approve(exchange.target, amountA);
        await nexusTokenB.connect(owner).approve(exchange.target, amountB);
        await exchange.connect(owner).addLiquidity(amountA, amountB);
        expect(await exchange.reserveA()).to.equal(amountA);
        expect(await exchange.reserveB()).to.equal(amountB);
    });

    it("Should correctly calculate the output amount for a swap", async function () {
        const liquidityA = ethers.parseEther("1000");
        const liquidityB = ethers.parseEther("500");
        await nexusTokenA.approve(exchange.target, liquidityA);
        await nexusTokenB.approve(exchange.target, liquidityB);
        await exchange.addLiquidity(liquidityA, liquidityB);
        const amountInA = ethers.parseEther("100");
        const reserveA = await exchange.reserveA();
        const reserveB = await exchange.reserveB();
        const amountInWithFee = amountInA * 997n;
        const numerator = amountInWithFee * reserveB;
        const denominator = (reserveA * 1000n) + amountInWithFee;
        const expectedAmountOut = numerator / denominator;
        const actualAmountOut = await exchange.getAmountOut(amountInA, nexusTokenA.target);
        expect(actualAmountOut).to.equal(expectedAmountOut);
    });

    it("Should perform a token swap correctly (Token A for Token B)", async function () {
        const liquidityA = ethers.parseEther("1000");
        const liquidityB = ethers.parseEther("500");
        await nexusTokenA.approve(exchange.target, liquidityA);
        await nexusTokenB.approve(exchange.target, liquidityB);
        await exchange.addLiquidity(liquidityA, liquidityB);
        const amountInA = ethers.parseEther("100");
        const expectedAmountOut = await exchange.getAmountOut(amountInA, nexusTokenA.target);
        await nexusTokenA.connect(owner).transfer(user1.address, amountInA);
        await nexusTokenA.connect(user1).approve(exchange.target, amountInA);
        const balanceBefore = await nexusTokenB.balanceOf(user1.address);
        await exchange.connect(user1).swap(amountInA, nexusTokenA.target);
        const balanceAfter = await nexusTokenB.balanceOf(user1.address);
        expect(balanceAfter - balanceBefore).to.equal(expectedAmountOut);
        const finalReserveA = liquidityA + amountInA;
        const finalReserveB = liquidityB - expectedAmountOut;
        expect(await exchange.reserveA()).to.equal(finalReserveA);
        expect(await exchange.reserveB()).to.equal(finalReserveB);
    });

    // === EDGE CASE TESTS ===

    it("Should revert if swapping zero tokens", async function () {
        await expect(
            exchange.connect(user1).swap(0, nexusTokenA.target)
        ).to.be.revertedWith("Amount in cannot be zero");
    });

    it("Should fail if there is no liquidity in the pool", async function () {
        const amountInA = ethers.parseEther("100");
        await nexusTokenA.connect(owner).transfer(user1.address, amountInA);
        await nexusTokenA.connect(user1).approve(exchange.target, amountInA);
        await expect(
            exchange.connect(user1).swap(amountInA, nexusTokenA.target)
        ).to.be.reverted;
    });

    it("Should fail if user has not approved enough tokens", async function () {
        const liquidityA = ethers.parseEther("1000");
        const liquidityB = ethers.parseEther("500");
        await nexusTokenA.approve(exchange.target, liquidityA);
        await nexusTokenB.approve(exchange.target, liquidityB);
        await exchange.addLiquidity(liquidityA, liquidityB);
        const amountToSwap = ethers.parseEther("100");
        await nexusTokenA.transfer(user1.address, amountToSwap);
        const amountToApprove = ethers.parseEther("50");
        await nexusTokenA.connect(user1).approve(exchange.target, amountToApprove);
        await expect(
    exchange.connect(user1).swap(amountToSwap, nexusTokenA.target)
).to.be.reverted;
    });
});