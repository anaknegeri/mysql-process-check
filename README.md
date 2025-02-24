# SQL Process Monitoring Tool

## Overview

This is a Node.js script for monitoring and managing long-running SQL queries across multiple database servers. The tool identifies and terminates queries that have been running for more than 5 minutes, generates detailed logs, and creates visual reports.

## Features

- Detect long-running database queries (> 5 minutes)
- Separate tracking of sleep and active queries
- Exclude specific users from monitoring
- Generate detailed logs
- Create summary reports (text and screenshot)
- Configurable for multiple database servers

## Prerequisites

- Node.js (v16+ recommended)
- npm (Node Package Manager)

## Installation

1. Clone the repository:

```bash
git clone git@github.com:anaknegeri/mysql-process-check.git
cd mysql-process-check
```

2. Install dependencies:

```bash
npm install
```

## Configuration

### Database Servers

Edit the `servers` array in `check-sql.mjs` to add your database server details:

```javascript
const servers = [
  {
    host: "your-db-host",
    user: "your-db-user",
    password: "your-db-password",
    servername: "DB_NAME",
  },
  // Add more servers as needed
];
```

### Excluded Users

Modify the `excludedUsers` array to specify users to be ignored:

```javascript
const excludedUsers = [
  "system_user",
  "monitoring_user",
  // Add more excluded users
];
```

## Usage

Run the script:

```bash
npm start
```

## Output

The script generates:

- Detailed log file in `logs/long_queries_YYYY-MM-DD_HH-mm.log`
- Summary text report in `logs/summary_YYYY-MM-DD_HH-mm.txt`
- Screenshot report in `logs/report_YYYY-MM-DD_HH-mm.png`

## Customization

- Adjust the long query threshold (currently 5 minutes)
- Modify logging and reporting formats
- Add more sophisticated query filtering

## Dependencies

- chalk: Colorful console output
- cli-table3: Terminal table formatting
- dayjs: Date manipulation
- fs-extra: Enhanced file system operations
- mysql2: MySQL database connection
- puppeteer: Report screenshot generation

## Troubleshooting

- Ensure database user has sufficient permissions
- Check network connectivity to database servers
- Verify database credentials

## Security

- Keep database credentials secure
- Do not commit sensitive information to version control

## License

ISC License

## Author

Heru Pras

## Contributing

Contributions are welcome! Please submit pull requests or open issues on the repository.
