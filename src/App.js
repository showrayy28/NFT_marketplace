import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import axios from 'axios';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from './contract';
import './App.css';

function App() {
  const [walletAddress, setWalletAddress] = useState(null);
  const [contract, setContract] = useState(null);
  const [nftName, setNftName] = useState('');
  const [nftMetadata, setNftMetadata] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [tokenId, setTokenId] = useState('');
  const [price, setPrice] = useState('');
  const [listings, setListings] = useState([]);
  const [loadingListings, setLoadingListings] = useState(false);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        // --- FORCE NETWORK SWITCH TO POLYGON AMOY ---
        const amoyChainId = '0x13882'; // Chain ID 80002
        const amoyNetworkParams = {
          chainId: amoyChainId,
          chainName: 'Polygon Amoy Testnet',
          rpcUrls: ['https://rpc-amoy.polygon.technology/'],
          nativeCurrency: {
            name: 'POL',
            symbol: 'POL',
            decimals: 18,
          },
          blockExplorerUrls: ['https://amoy.polygonscan.com/'],
        };

        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: amoyChainId }],
          });
        } catch (switchError) {
          // This error code 4902 means the chain has not been added to MetaMask.
          if (switchError.code === 4902) {
            try {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [amoyNetworkParams],
              });
            } catch (addError) {
              console.error("Failed to add Amoy network:", addError);
              return;
            }
          } else {
            console.error("Failed to switch network:", switchError);
            return;
          }
        }
        // -------------------------------------------

        setWalletAddress(accounts[0]);

        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        setContract(contractInstance);

        console.log('✅ Contract connected:', contractInstance);
      } catch (err) {
        console.error('❌ Wallet connection error:', err);
      }
    } else {
      alert('Please install MetaMask.');
    }
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
    setContract(null);
  };

  const uploadToIPFS = async (file) => {
    if (file) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await axios({
          method: 'POST',
          url: 'https://api.pinata.cloud/pinning/pinFileToIPFS',
          data: formData,
          headers: {
            pinata_api_key: process.env.REACT_APP_PINATA_API_KEY,
            pinata_secret_api_key: process.env.REACT_APP_PINATA_SECRET_KEY,
            'Content-Type': 'multipart/form-data',
          },
        });
        
        console.log("Image uploaded to Pinata:", response.data.IpfsHash);
        const CID = response.data.IpfsHash;
        return CID;
      } catch (error) {
        console.error('Unable to upload image to Pinata:', error);
        alert('Image upload failed. Check API keys.');
      }
    }
  };

  const pinJSONToIPFS = async (name, description, CID) => {
    try {
      const data = JSON.stringify({
        name: name,
        description: description,
        image: `https://gateway.pinata.cloud/ipfs/${CID}`,
      });
      
      const res = await fetch(
        'https://api.pinata.cloud/pinning/pinJSONToIPFS',
        {
          method: 'POST',
          headers: {
            'Content-type': 'application/json',
            // It is safer to use the JWT token if available, or fall back to keys
             Authorization: `Bearer ${process.env.REACT_APP_PINATA_JWT}`, 
          },
          body: data,
        }
      );
      
      const resData = await res.json();
      console.log('Metadata uploaded, CID:', resData.IpfsHash);
      return resData.IpfsHash;
    } catch (error) {
      console.error('Metadata upload error:', error);
    }
  };

  const handleMint = async (e) => {
    e.preventDefault();
    if (!contract) return alert('Contract not connected.');
    if (!nftName || !nftMetadata || !imageFile) return alert('Fill all fields.');

    const imageCID = await uploadToIPFS(imageFile);
    if (!imageCID) return;

    const metadataCID = await pinJSONToIPFS(nftName, nftMetadata, imageCID);
    const metadataurl = `https://gateway.pinata.cloud/ipfs/${metadataCID}`;
    console.log("Final Metadata URL:", metadataurl);

    try {
      // Call safeMint (ensure your contract has this function)
      const tx = await contract.safeMint(metadataurl);
      const receipt = await tx.wait();

      // Find the NFTMinted event to get the Token ID
      const event = receipt.logs
        .map((log) => {
          try {
            return contract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((parsed) => parsed && parsed.name === 'NFTMinted');

      if (event) {
        const tokenId = event.args.tokenId.toString();
        console.log('✅ NFT minted with Token ID:', tokenId);
        alert(`NFT Minted! Token ID: ${tokenId}`);
        fetchListings(); // Refresh UI
      } else {
        console.log('❌ NFTMinted event not found in receipt. Check contract events.');
        alert('Mint transaction successful, but could not retrieve Token ID from events.');
      }

    } catch (error) {
      console.error('❌ Error minting NFT:', error);
      alert('Failed to mint NFT. See console.');
    }
  };

  const handleListNFT = async () => {
    if (!contract) return alert('Contract not connected.');
    if (!tokenId || !price) return alert('Enter both Token ID and Price.');

    try {
      const priceInWei = ethers.parseEther(price.toString());
      const tx = await contract.listing(tokenId, priceInWei);
      await tx.wait();

      alert(`✅ NFT listed successfully at ${price} POL!`);
      fetchListings();
    } catch (error) {
      console.error('❌ Error listing NFT:', error);
      alert('Failed to list NFT. See console.');
    }
  };

  const fetchListings = async () => {
    if (!contract) return;

    try {
      setLoadingListings(true);
      const [listingData, tokenIds] = await contract.getAllListings();

      const listingsArray = await Promise.all(
        tokenIds.map(async (tokenId, index) => {
          // Some contracts might throw if tokenURI is invalid, so we wrap in try/catch
          try {
            const tokenUri = await contract.tokenURI(tokenId);
            const res = await fetch(tokenUri);
            const metadata = await res.json();
            
            return {
              tokenId: tokenId.toString(),
              seller: listingData[index].seller,
              price: ethers.formatEther(listingData[index].price),
              metadata,
            };
          } catch (err) {
            console.warn(`❌ Error fetching data for token ${tokenId}:`, err);
            return null; // Filter these out later
          }
        })
      );

      // Filter out nulls (failed fetches)
      setListings(listingsArray.filter(item => item !== null));
    } catch (error) {
      console.error('❌ Error fetching listings:', error);
    } finally {
      setLoadingListings(false);
    }
  };

  useEffect(() => {
    if (contract) {
      fetchListings();
    }
  }, [contract]);

  const handleBuyNFT = async (tokenId, price) => {
    if (!contract) return alert('Contract not connected.');

    try {
      const tx = await contract.buyNFT(tokenId, { value: ethers.parseEther(price.toString()) });
      await tx.wait();

      alert(`✅ Successfully bought NFT #${tokenId}!`);
      fetchListings(); 
    } catch (error) {
      console.error('❌ Error buying NFT:', error);
      alert('Failed to buy NFT. See console.');
    }
  };

  return (
    <div className="App">
      <h1>ERC721 NFT Marketplace (Amoy)</h1>

      {walletAddress ? (
        <>
          <p className="wallet-address">Connected: {walletAddress.slice(0,6)}...{walletAddress.slice(-4)}</p>
          <button onClick={disconnectWallet}>Disconnect</button>

          <form onSubmit={handleMint} className="nft-form">
            <h2>Mint New NFT</h2>
            <div>
              <label>NFT Name:</label>
              <input type="text" value={nftName} onChange={(e) => setNftName(e.target.value)} />
            </div>

            <div>
              <label>Description:</label>
              <textarea value={nftMetadata} onChange={(e) => setNftMetadata(e.target.value)} />
            </div>

            <div>
              <label>Image File:</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files[0])}
              />
            </div>

            <button type="submit">Mint NFT</button>
          </form>

          <div className="listing-form">
            <h2>List NFT for Sale</h2>
            <div>
              <label>Token ID:</label>
              <input type="number" value={tokenId} onChange={(e) => setTokenId(e.target.value)} />
            </div>

            <div>
              <label>Price (in POL):</label>
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>

            <button onClick={handleListNFT}>List NFT</button>
          </div>
        </>
      ) : (
        <button onClick={connectWallet} className="connect-btn">Connect Wallet (Amoy)</button>
      )}

      <div className="marketplace-listings">
        <h2>Marketplace Listings</h2>
        {loadingListings ? (
          <p>Loading listings...</p>
        ) : listings.length === 0 ? (
          <p>No NFTs listed yet.</p>
        ) : (
          <div className="nft-listings">
            {listings.map((item) => (
              <div key={item.tokenId} className="nft-card">
                <img src={item.metadata.image} alt={item.metadata.name} width={200} />
                <h3>{item.metadata.name}</h3>
                <p>{item.metadata.description}</p>
                <p><strong>Token ID:</strong> {item.tokenId}</p>
                <p><strong>Price:</strong> {item.price} POL</p>
                <p>
                  <strong>Seller:</strong>{' '}
                  {item.seller.slice(0, 6)}...{item.seller.slice(-4)}
                </p>
                <button
                  className="buy-button"
                  onClick={() => handleBuyNFT(item.tokenId, item.price)}
                >
                  Buy Now
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;