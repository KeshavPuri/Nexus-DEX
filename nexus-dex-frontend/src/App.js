import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';

// Import our contract details
import { exchangeAddress, exchangeABI, nexusTokenAAddress, tokenABI } from './contractInfo';

function App() {
  // State variables
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [exchangeContract, setExchangeContract] = useState(null);
  const [tokenAContract, setTokenAContract] = useState(null);
  const [amountIn, setAmountIn] = useState('');
  const [amountOut, setAmountOut] = useState('');
  const [isSwapping, setIsSwapping] = useState(false);
  const [message, setMessage] = useState('');
  const [poolReserves, setPoolReserves] = useState({ reserveA: '0', reserveB: '0' });

  // Connect to MetaMask Wallet
  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        const signer = await provider.getSigner();

        setProvider(provider);
        setSigner(signer);
        setAccount(accounts[0]);
        setMessage('');
      } catch (error) {
        console.error("Error connecting to MetaMask", error);
        setMessage('Failed to connect wallet.');
      }
    } else {
      alert("Please install MetaMask!");
    }
  };

  // Initialize contracts once the user is connected
  useEffect(() => {
    if (signer) {
      const exchange = new ethers.Contract(exchangeAddress, exchangeABI, signer);
      const tokenA = new ethers.Contract(nexusTokenAAddress, tokenABI, signer);
      
      setExchangeContract(exchange);
      setTokenAContract(tokenA);
    }
  }, [signer]);
  
  // Fetch and Update Pool Data
  useEffect(() => {
    if (!exchangeContract) return;

    // Function to fetch the latest reserve data
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

    fetchPoolData(); // Fetch immediately on load

    // Set up an interval to periodically refresh the data every 10 seconds
    const interval = setInterval(fetchPoolData, 10000);

    // Clean up the interval when the component unmounts
    return () => clearInterval(interval);

  }, [exchangeContract]);


  // Handle input change and get swap estimate
  const handleAmountInChange = async (e) => {
    const value = e.target.value;
    setAmountIn(value);

    if (value === '' || !exchangeContract || parseFloat(value) <= 0) {
      setAmountOut('');
      return;
    }

    try {
      const amountInWei = ethers.parseEther(value);
      const amountOutWei = await exchangeContract.getAmountOut(amountInWei, nexusTokenAAddress);
      setAmountOut(ethers.formatEther(amountOutWei));
    } catch (error) {
      console.error("Error getting amount out:", error);
      setAmountOut('Error');
    }
  };

  // The main swap function
  const handleSwap = async () => {
    if (!amountIn || !exchangeContract || !tokenAContract || parseFloat(amountIn) <= 0) {
      alert("Please enter a valid amount to swap.");
      return;
    }

    setIsSwapping(true);
    setMessage('Processing swap...');
    try {
      const amountInWei = ethers.parseEther(amountIn);

      // 1. Approve the Exchange contract to spend your Token A
      setMessage('Waiting for approval...');
      const approveTx = await tokenAContract.approve(exchangeAddress, amountInWei);
      await approveTx.wait(); // Wait for the approval to be mined
      setMessage('Approval successful! Now swapping...');

      // 2. Execute the swap
      const swapTx = await exchangeContract.swap(amountInWei, nexusTokenAAddress);
      await swapTx.wait(); // Wait for the swap to be mined

      setMessage(`Successfully swapped ${amountIn} NEXA for ${amountOut} NEXB!`);
      setAmountIn('');
      setAmountOut('');

    } catch (error) {
      console.error("Swap failed:", error);
      setMessage("Swap failed. See console for details.");
    } finally {
      setIsSwapping(false);
    }
  };

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

      <div className="swap-container">
        <h2>Swap NEXA for NEXB</h2>
        <div className='input-group'>
          <label>You Pay (NEXA)</label>
          <input
            type="number"
            placeholder="0.0"
            value={amountIn}
            onChange={handleAmountInChange}
            disabled={!account || isSwapping}
          />
        </div>
        <div className="arrow-down">↓</div>
        <div className='input-group'>
          <label>You Receive (approx. NEXB)</label>
          <input
            type="number"
            placeholder="0.0"
            value={amountOut}
            disabled
          />
        </div>
        <button onClick={handleSwap} disabled={!account || isSwapping || !amountIn}>
          {isSwapping ? 'Processing...' : 'Swap'}
        </button>
        {message && <p className="message-box">{message}</p>}
      </div>
      
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