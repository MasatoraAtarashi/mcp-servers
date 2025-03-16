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

// グローバルエラーハンドラを設定
server.onerror = (error) => {
  console.error("サーバーエラー:", error instanceof Error ? error.message : String(error));
};

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
  console.log("テーブル一覧を取得しています...");
  try {
    // MySQLからテーブル一覧を取得
    const [rows] = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = ?",
      [resourceBaseUrl.pathname.replace(/^\//, "")]
    );

    const tables = rows as { table_name: string }[];
    console.log(`${tables.length}個のテーブルが見つかりました`);

    return {
      resources: tables.map((row) => ({
        uri: new URL(`${row.table_name}/${SCHEMA_PATH}`, resourceBaseUrl).href,
        mimeType: "application/json",
        name: `"${row.table_name}" database schema`,
      })),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`テーブル一覧の取得中にエラーが発生しました: ${errorMessage}`);
    
    // エラーオブジェクトを返す代わりに、空のリソースリストを返す
    return {
      resources: [],
      error: errorMessage
    };
  }
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  console.log(`リソースを読み込んでいます: ${request.params.uri}`);
  try {
    const resourceUrl = new URL(request.params.uri);

    const pathComponents = resourceUrl.pathname.split("/");
    const schema = pathComponents.pop();
    const tableName = pathComponents.pop();

    console.log(`テーブル名: ${tableName}, スキーマパス: ${schema}`);

    if (schema !== SCHEMA_PATH) {
      console.log(`無効なリソースURI: スキーマパスが ${SCHEMA_PATH} ではありません`);
      const errorMessage = `Invalid resource URI: expected path '${SCHEMA_PATH}'`;
      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: "application/json",
            text: JSON.stringify({ error: errorMessage }, null, 2),
          },
        ],
      };
    }

    console.log(`テーブル "${tableName}" のカラム情報を取得しています...`);
    // MySQLからテーブルのカラム情報を取得
    const [rows] = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = ? AND table_schema = ?",
      [tableName, resourceBaseUrl.pathname.replace(/^\//, "")]
    );

    const columnsCount = Array.isArray(rows) ? rows.length : 0;
    console.log(`${columnsCount}個のカラムが見つかりました`);

    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: "application/json",
          text: JSON.stringify(rows, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`リソース読み込み中にエラーが発生しました: ${errorMessage}`);
    
    // エラーをスローする代わりに、エラーメッセージを含むJSONを返す
    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: "application/json",
          text: JSON.stringify({ error: errorMessage }, null, 2),
        },
      ],
    };
  }
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.log("利用可能なツール一覧を提供しています");
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
    console.log(`SQLクエリを実行します: ${sql}`);

    // MySQLでは読み取り専用トランザクションを開始
    const connection = await pool.getConnection();
    console.log("データベース接続を取得しました");
    try {
      await connection.beginTransaction();
      console.log("トランザクションを開始しました");
      // MySQLでは読み取り専用モードを設定
      await connection.query("SET TRANSACTION READ ONLY");
      console.log("読み取り専用モードを設定しました");

      console.log("クエリを実行中...");
      const [rows] = await connection.query(sql);
      console.log(`クエリが完了しました: ${Array.isArray(rows) ? rows.length : 1}件の結果`);

      return {
        content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
        isError: false,
      };
    } catch (error) {
      console.log(`エラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
      // エラーメッセージをLLMに返す
      return {
        content: [{
          type: "text",
          text: `SQLクエリの実行中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true,
      };
    } finally {
      // トランザクションをロールバック
      try {
        await connection.rollback();
        console.log("トランザクションをロールバックしました");
      } catch (rollbackError) {
        console.warn("トランザクションのロールバックに失敗しました:", rollbackError);
      }

      // 接続を解放
      connection.release();
      console.log("データベース接続を解放しました");
    }
  }
  console.log(`未知のツールが要求されました: ${request.params.name}`);
  // 未知のツール名の場合もLLMにエラーメッセージを返す
  return {
    content: [{
      type: "text",
      text: `エラー: 未知のツールです: ${request.params.name}`
    }],
    isError: true,
  };
});

async function runServer() {
  console.log("MySQL MCP サーバーを起動しています...");
  try {
    const transport = new StdioServerTransport();
    console.log("StdioServerTransportを初期化しました");
    
    await server.connect(transport);
    console.log("MySQL MCP サーバーが正常に起動しました");
    console.error("MySQL MCP server running on stdio");
  } catch (error) {
    console.log(`サーバー起動中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

runServer().catch((error) => {
  console.error("サーバー実行中に致命的なエラーが発生しました:", error);
  process.exit(1);
});
