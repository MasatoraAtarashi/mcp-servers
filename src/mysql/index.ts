#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import mysql from "mysql2/promise";

// 環境変数から接続情報を取得
const {
  MYSQL_HOST,
  MYSQL_PORT,
  MYSQL_USER,
  MYSQL_PASSWORD,
  MYSQL_DATABASE,
} = process.env;

// 接続情報が不足している場合はエラーを表示
if (!MYSQL_HOST || !MYSQL_PORT || !MYSQL_USER || !MYSQL_DATABASE) {
  console.error("必要な環境変数が設定されていません");
  console.error("MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_DATABASE を設定してください");
  process.exit(1);
}

const server = new Server(
  {
    name: "example-servers/mysql",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  },
);

// データベースURLを構築
const databaseUrl = `mysql://${MYSQL_USER}:${MYSQL_PASSWORD}@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}`;

const resourceBaseUrl = new URL(databaseUrl);
resourceBaseUrl.protocol = "mysql:";
resourceBaseUrl.password = "";

// MySQLの接続プールを作成
const pool = mysql.createPool({
  host: MYSQL_HOST,
  port: parseInt(MYSQL_PORT, 10),
  user: MYSQL_USER,
  password: MYSQL_PASSWORD,
  database: MYSQL_DATABASE,
});

const SCHEMA_PATH = "schema";

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  // MySQLからテーブル一覧を取得
  const [rows] = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = ?",
    [resourceBaseUrl.pathname.replace(/^\//, "")]
  );

  const tables = rows as { table_name: string }[];

  return {
    resources: tables.map((row) => ({
      uri: new URL(`${row.table_name}/${SCHEMA_PATH}`, resourceBaseUrl).href,
      mimeType: "application/json",
      name: `"${row.table_name}" database schema`,
    })),
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const resourceUrl = new URL(request.params.uri);

  const pathComponents = resourceUrl.pathname.split("/");
  const schema = pathComponents.pop();
  const tableName = pathComponents.pop();

  if (schema !== SCHEMA_PATH) {
    throw new Error("Invalid resource URI");
  }

  // MySQLからテーブルのカラム情報を取得
  const [rows] = await pool.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = ? AND table_schema = ?",
    [tableName, resourceBaseUrl.pathname.replace(/^\//, "")]
  );

  return {
    contents: [
      {
        uri: request.params.uri,
        mimeType: "application/json",
        text: JSON.stringify(rows, null, 2),
      },
    ],
  };
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "query",
        description: "Run a read-only SQL query",
        inputSchema: {
          type: "object",
          properties: {
            sql: { type: "string" },
          },
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "query") {
    const sql = request.params.arguments?.sql as string;

    // MySQLでは読み取り専用トランザクションを開始
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      // MySQLでは読み取り専用モードを設定
      await connection.query("SET TRANSACTION READ ONLY");

      const [rows] = await connection.query(sql);

      return {
        content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
        isError: false,
      };
    } catch (error) {
      throw error;
    } finally {
      // トランザクションをロールバック
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.warn("Could not roll back transaction:", rollbackError);
      }

      // 接続を解放
      connection.release();
    }
  }
  throw new Error(`Unknown tool: ${request.params.name}`);
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MySQL MCP server running on stdio");
}

runServer().catch(console.error);
