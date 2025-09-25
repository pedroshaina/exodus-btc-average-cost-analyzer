# Bitcoin Average Cost Calculator

A Node.js script that analyzes Bitcoin transaction data from CSV files (like those exported from Exodus wallet) to calculate average and median Bitcoin costs.

## Features

- Filters Bitcoin deposit transactions from CSV data
- Fetches historical Bitcoin prices from CryptoCompare API
- Calculates average, median, and weighted average Bitcoin costs
- Supports date filtering with optional start date
- Displays detailed transaction analysis

## Usage

```bash
node btc-cost-analyzer.js <csv-file-path> [startDate]
```

### Arguments

- `csv-file-path` (required): Path to the CSV file containing transaction data
- `startDate` (optional): Filter transactions from this date onwards (format: YYYY-MM-DD)

### Examples

```bash
# Analyze all Bitcoin deposits
node btc-cost-analyzer.js ./exodus_0-all-txs-2025-09-24_14-24-12.csv

# Analyze Bitcoin deposits from 2024 onwards
node btc-cost-analyzer.js ./exodus_0-all-txs-2025-09-24_14-24-12.csv 2024-01-01
```

## Requirements

- Node.js 14.0.0 or higher
- Internet connection (for fetching Bitcoin price data)

## Installation

1. Install dependencies:
```bash
npm install
```

## CSV Format

The script expects CSV files with the following columns:
- `DATE`: Transaction date in ISO format
- `TYPE`: Transaction type (filters for "deposit")
- `INCURRENCY`: Currency received (filters for "BTC")
- `INAMOUNT`: Amount of Bitcoin received

## Output

The script provides:
- Total number of transactions analyzed
- Total BTC deposited and USD cost
- Average and median Bitcoin prices
- Detailed transaction breakdown
