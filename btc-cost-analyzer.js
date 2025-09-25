#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 1) {
    console.error('Usage: node btc-cost-analyzer.js <csv-file-path> [startDate]');
    console.error('Example: node btc-cost-analyzer.js ./transactions.csv 2024-01-01');
    process.exit(1);
}

const csvFilePath = args[0];
const startDate = args[1] ? new Date(args[1]) : null;

// Validate CSV file exists
if (!fs.existsSync(csvFilePath)) {
    console.error(`Error: CSV file not found: ${csvFilePath}`);
    process.exit(1);
}

// Function to parse CSV
function parseCSV(csvContent) {
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',');
    const rows = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });
        rows.push(row);
    }
    
    return rows;
}

// Function to properly parse CSV line (handles commas within quoted values)
function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    values.push(current);
    return values;
}

// Function to filter Bitcoin deposits
function filterBitcoinDeposits(transactions, startDate = null) {
    return transactions.filter(tx => {
        // Filter by TYPE=deposit and INCURRENCY=BTC
        if (tx.TYPE !== 'deposit' || tx.INCURRENCY !== 'BTC') {
            return false;
        }
        
        // Filter by startDate if provided
        if (startDate) {
            const txDate = new Date(tx.DATE);
            if (txDate < startDate) {
                return false;
            }
        }
        
        // Ensure we have a valid INAMOUNT
        if (!tx.INAMOUNT || isNaN(parseFloat(tx.INAMOUNT))) {
            return false;
        }
        
        return true;
    });
}

// Function to fetch Bitcoin price from CryptoCompare API using node-fetch
async function fetchBitcoinPrice(date) {
    try {
        // Convert date to Unix timestamp (seconds)
        const timestamp = Math.floor(date.getTime() / 1000);
        
        const url = `https://min-api.cryptocompare.com/data/pricehistorical?fsym=BTC&tsyms=USD&ts=${timestamp}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const json = await response.json();
        
        if (json.BTC && json.BTC.USD) {
            return json.BTC.USD;
        } else if (json.Response === 'Error') {
            throw new Error(`API Error: ${json.Message || 'Unknown error'}`);
        } else {
            throw new Error(`No price data found for timestamp ${timestamp}`);
        }
    } catch (error) {
        throw new Error(`Failed to fetch price data for timestamp ${Math.floor(date.getTime() / 1000)}: ${error.message}`);
    }
}

// Function to add delay between API calls to respect rate limits
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to calculate average and median
function calculateStatistics(values) {
    if (values.length === 0) return { average: 0, median: 0 };
    
    const sum = values.reduce((acc, val) => acc + val, 0);
    const average = sum / values.length;
    
    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];
    
    return { average, median };
}

// Main function
async function main() {
    try {
        console.log('Reading CSV file...');
        const csvContent = fs.readFileSync(csvFilePath, 'utf8');
        
        console.log('Parsing transactions...');
        const transactions = parseCSV(csvContent);
        
        console.log('Filtering Bitcoin deposits...');
        const bitcoinDeposits = filterBitcoinDeposits(transactions, startDate);
        
        console.log(`Found ${bitcoinDeposits.length} Bitcoin deposit transactions`);
        
        if (bitcoinDeposits.length === 0) {
            console.log('No Bitcoin deposits found matching the criteria.');
            return;
        }
        
        console.log('Fetching Bitcoin prices for each transaction...');
        const enrichedTransactions = [];
        
        for (let i = 0; i < bitcoinDeposits.length; i++) {
            const tx = bitcoinDeposits[i];
            const txDate = new Date(tx.DATE);
            
            try {
                console.log(`Fetching price for ${tx.DATE} (${i + 1}/${bitcoinDeposits.length})`);
                const btcPrice = await fetchBitcoinPrice(txDate);
                const btcAmount = parseFloat(tx.INAMOUNT);
                const usdCost = btcAmount * btcPrice;
                const costPerBtc = usdCost / btcAmount;
                
                enrichedTransactions.push({
                    date: tx.DATE,
                    btcAmount,
                    btcPrice,
                    usdCost,
                    costPerBtc
                });
                
                // Add delay to respect API rate limits
                if (i < bitcoinDeposits.length - 1) {
                    await delay(3000); // 3 second delay between requests to avoid throttling
                }
            } catch (error) {
                console.warn(`Warning: Could not fetch price for ${tx.DATE}: ${error.message}`);
            }
        }
        
        if (enrichedTransactions.length === 0) {
            console.log('No price data could be retrieved for any transactions.');
            return;
        }
        
        // Calculate statistics
        const btcPrices = enrichedTransactions.map(tx => tx.btcPrice);
        const btcAmounts = enrichedTransactions.map(tx => tx.btcAmount);
        const usdCosts = enrichedTransactions.map(tx => tx.usdCost);
        
        const priceStats = calculateStatistics(btcPrices);
        const totalBtc = btcAmounts.reduce((sum, amount) => sum + amount, 0);
        const totalUsd = usdCosts.reduce((sum, cost) => sum + cost, 0);
        const weightedAverageCost = totalUsd / totalBtc;
        
        // Display results
        console.log('\n' + '='.repeat(60));
        console.log('BITCOIN COST ANALYSIS RESULTS');
        console.log('='.repeat(60));
        
        if (startDate) {
            console.log(`Start Date Filter: ${startDate.toISOString().split('T')[0]}`);
        }
        
        console.log(`Total Transactions Analyzed: ${enrichedTransactions.length}`);
        console.log(`Total BTC Deposited: ${totalBtc.toFixed(8)} BTC`);
        console.log(`Total USD Cost: $${totalUsd.toFixed(2)}`);
        console.log('\nBITCOIN PRICE STATISTICS:');
        console.log(`Average BTC Price: $${priceStats.average.toFixed(2)}`);
        console.log(`Median BTC Price: $${priceStats.median.toFixed(2)}`);
        console.log(`Weighted Average Cost: $${weightedAverageCost.toFixed(2)} per BTC`);
        
        console.log('\nTRANSACTION DETAILS:');
        console.log('-'.repeat(60));
        console.log('Date'.padEnd(25) + 'BTC Amount'.padEnd(15) + 'BTC Price'.padEnd(15) + 'USD Cost');
        console.log('-'.repeat(60));
        
        enrichedTransactions.forEach(tx => {
            const date = tx.date.split('T')[0];
            const btcAmount = tx.btcAmount.toFixed(8);
            const btcPrice = `$${tx.btcPrice.toFixed(2)}`;
            const usdCost = `$${tx.usdCost.toFixed(2)}`;
            
            console.log(
                date.padEnd(25) + 
                btcAmount.padEnd(15) + 
                btcPrice.padEnd(15) + 
                usdCost
            );
        });
        
        console.log('-'.repeat(60));
        
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

// Run the script
main();
