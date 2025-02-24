import chalk from "chalk";
import Table from "cli-table3";
import dayjs from "dayjs";
import fs from "fs-extra";
import mysql from "mysql2/promise";
import puppeteer from "puppeteer";

// Konfigurasi server SQL
const servers = [
  {
    host: "your-db-host",
    user: "your-db-user",
    password: "your-db-password",
    servername: "DB123",
  },
];

// Daftar user yang akan dikecualikan
const excludedUsers = [
  "piket",
  "event_scheduler",
  "system user",
  "babu",
  "kenny_batch_unvr_40",
];

const logDir = "logs";
fs.ensureDirSync(logDir);
const logFile = `${logDir}/long_queries_${dayjs().format(
  "YYYY-MM-DD_HH-mm"
)}.log`;

let summary = [];
let detailedLog = [];

async function checkAndKillLongQueries(server) {
  let connection;
  let totalLongQueries = 0;
  let totalSleepQueries = 0;
  let killedSleepCount = 0;
  let killedLongRunningCount = 0;
  let longRunningQueries = 0;

  try {
    connection = await mysql.createConnection({
      host: server.host,
      user: server.user,
      password: server.password,
    });

    console.log(chalk.blue(`\n🔍 Checking ${server.servername}...`));

    const [allRows] = await connection.execute(`
      SELECT ID, USER, HOST, DB, COMMAND, TIME, STATE, INFO
      FROM INFORMATION_SCHEMA.PROCESSLIST
      WHERE TIME > 300
    `);

    const rows = allRows.filter((row) => !excludedUsers.includes(row.USER));

    totalLongQueries = rows.length;
    totalSleepQueries = rows.filter((row) => row.COMMAND === "Sleep").length;
    longRunningQueries = totalLongQueries - totalSleepQueries;

    if (totalLongQueries === 0) {
      console.log(chalk.green("✅ No long-running queries found."));
      summary.push({
        server: server.servername,
        host: server.host,
        totalLongQueries,
        totalSleepQueries,
        longRunningQueries,
        killedSleepCount,
        killedLongRunningCount,
      });
      return;
    }

    for (const row of rows) {
      const logEntry = {
        timestamp: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        server: server.servername,
        host: server.host,
        processId: row.ID,
        user: row.USER,
        db: row.DB || "N/A",
        command: row.COMMAND,
        time: row.TIME,
        state: row.STATE || "N/A",
        info: row.INFO || "N/A",
        killed: true,
      };

      detailedLog.push(logEntry);

      await connection.execute(`KILL ${row.ID}`);
      if (row.COMMAND === "Sleep") {
        killedSleepCount++;
      } else {
        killedLongRunningCount++;
      }
    }

    console.log(
      chalk.red(
        `🛑 Killed ${killedSleepCount} sleep processes on ${server.servername}`
      )
    );
    console.log(
      chalk.red(
        `🛑 Killed ${killedLongRunningCount} long-running queries on ${server.servername}`
      )
    );

    console.log(
      chalk.yellow(
        `📊 Total Sleep Queries: ${totalSleepQueries}, Long Running Queries (Non-Sleep): ${longRunningQueries}`
      )
    );

    summary.push({
      server: server.servername,
      host: server.host,
      totalLongQueries,
      totalSleepQueries,
      longRunningQueries,
      killedSleepCount,
      killedLongRunningCount,
      killedCount: killedSleepCount + killedLongRunningCount,
    });
  } catch (error) {
    console.error(
      chalk.red(`❌ Error on ${server.servername}: ${error.message}`)
    );
    summary.push({
      server: server.servername,
      host: server.host,
      totalLongQueries,
      totalSleepQueries,
      longRunningQueries,
      killedSleepCount,
      killedLongRunningCount,
      error: error.message,
    });
  } finally {
    if (connection) await connection.end();
  }
}
(async () => {
  console.log(chalk.cyan("\n🚀 Starting SQL Process Check..."));
  for (const server of servers) {
    await checkAndKillLongQueries(server);
  }

  console.log(chalk.green("\n✅ SQL Process Check Completed.\n"));

  console.log(chalk.magenta("📊 Summary"));
  const summaryTable = new Table({
    head: [
      chalk.yellow("Server"),
      chalk.yellow("Long Queries"),
      chalk.yellow("Sleep Queries"),
      chalk.yellow("Active Long Queries"),
      chalk.yellow("Killed Sleep Queries"),
      chalk.yellow("Killed Active Queries"),
    ],
    colAligns: ["center", "center", "center", "center", "center", "center"],
  });

  summary.forEach((item) => {
    summaryTable.push([
      item.server,
      item.totalLongQueries || 0,
      item.totalSleepQueries || 0,
      item.longRunningQueries || 0,
      item.killedSleepCount || 0,
      item.killedLongRunningCount || 0,
    ]);
  });

  console.log(summaryTable.toString());

  let logText = `📌 Detailed Log of Long-Running Queries (>5 min) - ${dayjs().format(
    "YYYY-MM-DD HH:mm:ss"
  )}\n\n`;

  detailedLog.forEach((log) => {
    logText += `Timestamp: ${log.timestamp}\n`;
    logText += `Server: ${log.servername} (${log.host})\n`;
    logText += `Process ID: ${log.processId}\n`;
    logText += `User: ${log.user}\n`;
    logText += `Database: ${log.db}\n`;
    logText += `Command: ${log.command}\n`;
    logText += `Time Running: ${log.time} sec\n`;
    logText += `State: ${log.state}\n`;
    logText += `Query Info: ${log.info}\n`;
    logText += `Killed: ${log.killed ? "Yes" : "No"}\n`;
    logText += "-".repeat(50) + "\n";
  });

  try {
    await fs.writeFile(logFile, logText, "utf8");
    console.log(chalk.green(`\n✅ Detailed log saved to ${logFile}`));
  } catch (writeError) {
    console.error(
      chalk.red(`❌ Error writing detailed log: ${writeError.message}`)
    );
  }

  const reportText = summary
    .map(
      (item) =>
        `Server: ${item.server} (${item.host})
Total Queries >5m: ${item.totalLongQueries || 0}
Sleep Queries: ${item.totalSleepQueries || 0}
Long Running Queries: ${item.longRunningQueries || 0}
Killed Sleep Queries: ${item.killedSleepCount || 0}
Killed Long Running Queries: ${item.killedLongRunningCount || 0}
Total Killed Queries: ${
          (item.killedSleepCount || 0) + (item.killedLongRunningCount || 0)
        }
${item.error ? `Error: ${item.error}\n` : ""}
`
    )
    .join("\n");

  const reportFilePath = `${logDir}/summary_${dayjs().format(
    "YYYY-MM-DD_HH-mm"
  )}.txt`;
  try {
    await fs.writeFile(reportFilePath, reportText, "utf8");
    console.log(chalk.green(`✅ Summary report saved to ${reportFilePath}`));
  } catch (writeError) {
    console.error(
      chalk.red(`❌ Error writing summary report: ${writeError.message}`)
    );
  }

  await generateImage();
})();

async function generateImage() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  const htmlContent = `
    <html>
      <head>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
          }
          .header {
            background-color: #2c3e50;
            color: white;
            padding: 15px;
            text-align: center;
            border-radius: 5px;
          }
          .summary-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            background-color: white;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
          }
          .summary-table th, .summary-table td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
          }
          .summary-table th {
            background-color: #3498db;
            color: white;
          }
          .summary-table tr:nth-child(even) {
            background-color: #f2f2f2;
          }
          .details {
            margin-top: 20px;
            background-color: white;
            padding: 15px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
          }
          .summary-table td.text-right {
            text-align: right !important;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>SQL Process Monitoring Report</h1>
          <p>${dayjs().format("YYYY-MM-DD HH:mm:ss")}</p>
        </div>

        <table class="summary-table">
          <thead>
            <tr>
              <th>Server</th>
              <th>Total Long Queries</th>
              <th>Sleep Queries</th>
              <th>Active Long Queries</th>
              <th>Killed Sleep Queries</th>
              <th>Killed Active Queries</th>
              <th>Total Killed Queries</th>
            </tr>
          </thead>
          <tbody>
            ${summary
              .map(
                (item) => `
                <tr>
                  <td>${item.server}</td>
                  <td class="text-right">${item.totalLongQueries || 0}</td>
                  <td class="text-right">${item.totalSleepQueries || 0}</td>
                  <td class="text-right">${item.longRunningQueries || 0}</td>
                  <td class="text-right">${item.killedSleepCount || 0}</td>
                  <td class="text-right">${
                    item.killedLongRunningCount || 0
                  }</td>
                  <td class="text-right">${
                    (item.killedSleepCount || 0) +
                    (item.killedLongRunningCount || 0)
                  }</td>
                </tr>
              `
              )
              .join("")}
          </tbody>
        </table>

        <div class="details">
          <h2>Additional Insights</h2>
          <p><strong>Total Servers Checked:</strong> ${summary.length}</p>
          <p><strong>Total Long-Running Queries Detected:</strong> ${summary.reduce(
            (sum, item) => sum + (item.totalLongQueries || 0),
            0
          )}</p>
          <p><strong>Total Queries Killed:</strong> ${summary.reduce(
            (sum, item) =>
              sum +
              ((item.killedSleepCount || 0) +
                (item.killedLongRunningCount || 0)),
            0
          )}</p>
        </div>
      </body>
    </html>
  `;

  try {
    await page.setViewport({ width: 1200, height: 800 });

    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    const screenshotPath = `${logDir}/report_${dayjs().format(
      "YYYY-MM-DD_HH-mm"
    )}.png`;

    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
    });

    console.log(
      chalk.green(`\n📸 Detailed report screenshot saved as ${screenshotPath}`)
    );
  } catch (screenshotError) {
    console.error(
      chalk.red(`❌ Error creating screenshot: ${screenshotError.message}`)
    );
  } finally {
    await browser.close();
  }
}
