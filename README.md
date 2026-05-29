# 🎨 ERC-721 NFT Marketplace

A full-stack decentralized application (dApp) built on the **Polygon Amoy Testnet** that allows users to seamlessly mint, list, and trade ERC-721 Non-Fungible Tokens (NFTs). 

The platform features decentralized storage for NFT assets and metadata using **IPFS (via Pinata)** and ensures a smooth user experience by automatically prompting users to switch to or add the Amoy testnet in their MetaMask wallets.

---

## ✨ Features

* **Web3 Wallet Integration:** Connects securely with MetaMask.
* **Smart Network Switching:** Automatically detects and switches to the Polygon Amoy Testnet (or prompts the user to add it if missing).
* **Decentralized Minting:** Uploads image files and JSON metadata directly to IPFS via Pinata before minting the token on-chain.
* **Marketplace Functionality:** * **List NFTs:** Owners can list their minted NFTs for sale in `POL`.
  * **Buy NFTs:** Users can browse the marketplace and purchase listed NFTs.
* **Real-time Data Fetching:** Reads directly from the smart contract to render currently listed NFTs and their IPFS metadata.

---

## 🛠️ Tech Stack

* **Frontend:** React.js
* **Web3 Library:** ethers.js (v6)
* **Storage:** IPFS & Pinata API (Axios & Fetch)
* **Blockchain:** Polygon Amoy Testnet
* **Smart Contracts:** Solidity (ERC-721 standard)

---

## 📦 Prerequisites

Before running this project locally, ensure you have the following installed:
* [Node.js](https://nodejs.org/) (v16 or higher recommended)
* [MetaMask](https://metamask.io/) browser extension
* A [Pinata](https://www.pinata.cloud/) account for IPFS API keys

---

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone [https://github.com/showrayy28/NFT_marketplace.git](https://github.com/showrayy28/NFT_marketplace.git)
cd NFT_marketplace