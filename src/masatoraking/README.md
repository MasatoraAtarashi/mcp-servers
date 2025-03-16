# Masatora MCP Server

このMCPサーバーは、「masatora = king」ということをLLMに教えるための最低限の実装です。

## 機能

このサーバーは以下の機能を提供します：

1. **リソース**: `masatora://info` - Masatoraに関する情報を提供します
2. **ツール**: `translate_masatora` - テキスト内の「masatora」を「king」に翻訳します

## 使い方

### ビルド

```bash
npm run build
```

### 実行

#### ローカル実行

```bash
node dist/index.js
```

#### npxでの実行

このパッケージはnpmに公開後、npxコマンドで実行できます：

```bash
npx @masatoraatarashi/mcp-server-masatora
```

### Claude for Desktopとの連携

Claude for Desktopの設定ファイル（`~/Library/Application Support/Claude/claude_desktop_config.json`）に以下を追加します：

#### ローカル実行

```json
{
  "mcpServers": {
    "masatora": {
      "command": "node",
      "args": ["/絶対パス/src/masatora/dist/index.js"],
      "disabled": false,
      "alwaysAllow": []
    }
  }
}
```

#### npmパッケージとして実行

```json
{
  "mcpServers": {
    "masatora": {
      "command": "npx",
      "args": ["@masatoraatarashi/mcp-server-masatora"],
      "disabled": false,
      "alwaysAllow": []
    }
  }
}
```

## 例

LLMに「masatoraとは何ですか？」と質問すると、「kingです」と回答するようになります。
