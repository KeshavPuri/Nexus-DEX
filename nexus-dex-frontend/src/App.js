import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';

// Import our contract details
import { exchangeAddress, exchangeABI, nexusTokenAAddress, nexusTokenBAddress, tokenABI } from './contractInfo';

function App() {
  // General State
  const [account, setAccount] = useState(null);
  const [signer, setSigner] = useState(null);
  const [exchangeContract, setExchangeContract] = useState(null);
  const [tokenAContract, setTokenAContract] = useState(null);
  const [tokenBContract, setTokenBContract] = useState(null);
  const [message, setMessage] = useState('');
  const [view, setView] = useState('swap'); // 'swap' or 'pool'

  // Pool Information State
  const [poolReserves, setPoolReserves] = useState({ reserveA: '0', reserveB: '0' });

  // Swap State
  const [tokenIn, setTokenIn] = useState({ address: nexusTokenAAddress, symbol: 'NEXA' });
  const [tokenOut, setTokenOut] = useState({ address: nexusTokenBAddress, symbol: 'NEXB' });
  const [amountIn, setAmountIn] = useState('');
  const [amountOut, setAmountOut] = useState('');
  
  // Liquidity State
  const [amountA_liq, setAmountA_liq] = useState('');
  const [amountB_liq, setAmountB_liq] = useState('');

  // General Loading State
  const [isLoading, setIsLoading] = useState(false);

  // --- Core Functions ---

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        const signer = await provider.getSigner();
        setSigner(signer);
        setAccount(accounts[0]);
        setMessage('');
      } catch (error) {
        console.error("Error connecting wallet", error);
        setMessage('Failed to connect wallet.');
      }
    } else {
      alert("Please install MetaMask!");
    }
  };

  // --- useEffect Hooks for Initialization and Data Fetching ---

  useEffect(() => {
    if (signer) {
      setExchangeContract(new ethers.Contract(exchangeAddress, exchangeABI, signer));
      setTokenAContract(new ethers.Contract(nexusTokenAAddress, tokenABI, signer));
      setTokenBContract(new ethers.Contract(nexusTokenBAddress, tokenABI, signer));
    }
  }, [signer]);

  useEffect(() => {
    if (!exchangeContract) return;
    const fetchPoolData = async () => {
      try {
        const reserveA_wei = await exchangeContract.reserveA();
        const reserveB_wei = await exchangeContract.reserveB();
        setPoolReserves({
          reserveA: ethers.formatEther(reserveA_wei),
          reserveB: ethers.formatEther(reserveB_wei)
        });
      } catch (error) {
        console.error("Failed to fetch pool data:", error);
      }
    };
    fetchPoolData();
    const interval = setInterval(fetchPoolData, 10000);
    return () => clearInterval(interval);
  }, [exchangeContract]);

  // --- SWAP LOGIC ---

  const handleAmountInChange = async (value) => {
    setAmountIn(value);
    if (value === '' || !exchangeContract || parseFloat(value) <= 0) {
      setAmountOut('');
      return;
    }
    try {
      const amountInWei = ethers.parseEther(value);
      const amountOutWei = await exchangeContract.getAmountOut(amountInWei, tokenIn.address);
      setAmountOut(ethers.formatEther(amountOutWei));
    } catch (error) {
      console.error("Error getting amount out:", error);
      setAmountOut('Error');
    }
  };

  const flipSwapDirection = () => {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    // Reset amounts
    setAmountIn('');
    setAmountOut('');
  };

  const handleSwap = async () => {
    if (!amountIn || parseFloat(amountIn) <= 0) return alert("Please enter a valid amount.");
    setIsLoading(true);
    setMessage('Processing swap...');
    try {
      const amountInWei = ethers.parseEther(amountIn);
      const inputTokenContract = tokenIn.address === nexusTokenAAddress ? tokenAContract : tokenBContract;

      setMessage('Waiting for approval...');
      const approveTx = await inputTokenContract.approve(exchangeAddress, amountInWei);
      await approveTx.wait();
      setMessage('Approval successful! Swapping...');

      const swapTx = await exchangeContract.swap(amountInWei, tokenIn.address);
      await swapTx.wait();
      setMessage(`Successfully swapped ${amountIn} ${tokenIn.symbol} for ${amountOut} ${tokenOut.symbol}!`);
      setAmountIn('');
      setAmountOut('');
    } catch (error) {
      console.error("Swap failed:", error);
      setMessage("Swap failed. See console for details.");
    } finally {
      setIsLoading(false);
    }
  };
  
  // --- LIQUIDITY LOGIC ---
  const handleLiquidityAmountAChange = (value) => {
    setAmountA_liq(value);
    if(parseFloat(poolReserves.reserveA) > 0){
        const correspondingB = (parseFloat(value) * parseFloat(poolReserves.reserveB)) / parseFloat(poolReserves.reserveA);
        setAmountB_liq(correspondingB.toFixed(5));
    }
  }

  const handleAddLiquidity = async () => {
    if (!amountA_liq || !amountB_liq || parseFloat(amountA_liq) <= 0 || parseFloat(amountB_liq) <= 0) {
        return alert("Please enter valid amounts for both tokens.");
    }
    setIsLoading(true);
    setMessage('Processing...');
    try {
        const amountA_wei = ethers.parseEther(amountA_liq);
        const amountB_wei = ethers.parseEther(amountB_liq);

        setMessage('Approving NEXA...');
        const approveATx = await tokenAContract.approve(exchangeAddress, amountA_wei);
        await approveATx.wait();
        setMessage('Approving NEXB...');
        const approveBTx = await tokenBContract.approve(exchangeAddress, amountB_wei);
        await approveBTx.wait();

        setMessage('Adding liquidity...');
        const addLiqTx = await exchangeContract.addLiquidity(amountA_wei, amountB_wei);
        await addLiqTx.wait();

        setMessage('Successfully added liquidity!');
        setAmountA_liq('');
        setAmountB_liq('');
    } catch(error){
        console.error("Failed to add liquidity:", error);
        setMessage("Failed to add liquidity. See console.");
    } finally {
        setIsLoading(false);
    }
  }

  // --- RENDER LOGIC ---

  const renderSwapView = () => (
    <div className="swap-container">
      <h2>Swap Tokens</h2>
      <div className='input-group'>
        <label>You Pay ({tokenIn.symbol})</label>
        <input type="number" placeholder="0.0" value={amountIn} onChange={(e) => handleAmountInChange(e.target.value)} disabled={!account || isLoading} />
      </div>
      <div className="swap-arrow" onClick={flipSwapDirection}>⇅</div>
      <div className='input-group'>
        <label>You Receive (approx. {tokenOut.symbol})</label>
        <input type="number" placeholder="0.0" value={amountOut} disabled />
      </div>
      <button onClick={handleSwap} disabled={!account || isLoading || !amountIn}>
        {isLoading ? 'Processing...' : 'Swap'}
      </button>
    </div>
  );

  const renderPoolView = () => (
    <div className="swap-container">
        <h2>Add Liquidity</h2>
        <p className="pool-note">Provide equal value of both tokens to the pool.</p>
        <div className='input-group'>
            <label>Amount of NEXA</label>
            <input type="number" placeholder="0.0" value={amountA_liq} onChange={(e) => handleLiquidityAmountAChange(e.target.value)} disabled={!account || isLoading}/>
        </div>
        <div className="plus-symbol">+</div>
        <div className='input-group'>
            <label>Amount of NEXB</label>
            <input type="number" placeholder="0.0" value={amountB_liq} disabled/>
        </div>
        <button onClick={handleAddLiquidity} disabled={!account || isLoading || !amountA_liq}>
            {isLoading ? 'Processing...' : 'Add Liquidity'}
        </button>
    </div>
  );

  return (
    <div className="App">
      <header className="App-header">
        <h1><span role="img" aria-label="galaxy">🌌</span> Nexus DEX</h1>
        {!account ? (
          <button className="connect-btn" onClick={connectWallet}>Connect Wallet</button>
        ) : (
          <p className="account-info">Connected: {account.substring(0, 6)}...{account.substring(account.length - 4)}</p>
        )}
      </header>

      <div className="view-selector">
          <button onClick={() => setView('swap')} className={view === 'swap' ? 'active' : ''}>Swap</button>
          <button onClick={() => setView('pool')} className={view === 'pool' ? 'active' : ''}>Pool</button>
      </div>

      {view === 'swap' ? renderSwapView() : renderPoolView()}
      
      {message && <p className="message-box">{message}</p>}
      
      <div className="pool-info-container">
        <h2>📊 Pool Information</h2>
        <div className="info-row">
          <span>NEXA Reserves:</span>
          <span>{parseFloat(poolReserves.reserveA).toFixed(2)}</span>
        </div>
        <div className="info-row">
          <span>NEXB Reserves:</span>
          <span>{parseFloat(poolReserves.reserveB).toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

export default App;