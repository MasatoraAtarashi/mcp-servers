# Slack MCP Server

https://github.com/modelcontextprotocol/servers/tree/main/src/slack を参考に実装

MCP Server for the Slack API, enabling Claude to interact with Slack workspaces with read-only permissions.

## 特徴

- **読み取り専用アクセス**: 書き込み権限を必要とせず、Slackワークスペースのデータを安全に読み取ります
- **高度な検索機能**: メッセージの検索と関連コンテキストの取得
- **RAG対応**: 会話コンテキストの取得とスレッド分析機能

## リソース

### 静的リソース

1. `slack://channels`
   - ワークスペース内の全公開チャンネルのリスト
   - 返り値: チャンネルIDと情報のリスト

2. `slack://users`
   - ワークスペース内の全ユーザーのリスト
   - 返り値: ユーザーIDと基本情報のリスト

### リソーステンプレート

1. `slack://channel/{channel_id}/history`
   - 特定のチャンネルのメッセージ履歴を取得
   - 返り値: メッセージとそのメタデータのリスト

2. `slack://thread/{channel_id}/{thread_ts}`
   - 特定のスレッド内のすべてのメッセージを取得
   - 返り値: スレッドのメッセージとそのメタデータのリスト

3. `slack://user/{user_id}/profile`
   - 特定のユーザーの詳細プロフィール情報を取得
   - 返り値: ユーザープロフィールの詳細情報

## ツール

1. `slack_list_channels`
   - ワークスペース内の公開チャンネルをリスト表示
   - オプション入力:
     - `limit` (数値, デフォルト: 100, 最大: 200): 返すチャンネルの最大数
     - `cursor` (文字列): 次のページのページネーションカーソル
   - 返り値: チャンネルIDと情報のリスト

2. `slack_get_channel_history`
   - チャンネルから最近のメッセージを取得
   - 必須入力:
     - `channel_id` (文字列): チャンネルID
   - オプション入力:
     - `limit` (数値, デフォルト: 10): 取得するメッセージ数
   - 返り値: メッセージの内容とメタデータのリスト

3. `slack_get_thread_replies`
   - メッセージスレッド内のすべての返信を取得
   - 必須入力:
     - `channel_id` (文字列): スレッドを含むチャンネルのID
     - `thread_ts` (文字列): 親メッセージのタイムスタンプ（'1234567890.123456'形式）
   - 返り値: スレッド内のメッセージのリスト

4. `slack_get_users`
   - ワークスペース内のすべてのユーザーの基本プロフィール情報を取得
   - オプション入力:
     - `cursor` (文字列): 次のページの結果のページネーションカーソル
     - `limit` (数値, デフォルト: 100, 最大: 200): 返すユーザーの最大数
   - 返り値: ユーザーとその基本情報のリスト

5. `slack_get_user_profile`
   - 特定のユーザーの詳細プロフィール情報を取得
   - 必須入力:
     - `user_id` (文字列): ユーザーのID
   - 返り値: ユーザーの詳細プロフィール情報

6. `slack_search_messages`
   - チャンネル内のメッセージを検索
   - 必須入力:
     - `query` (文字列): 検索クエリ文字列
   - オプション入力:
     - `channels` (文字列の配列): 検索対象のチャンネルIDのリスト（指定しない場合はアクセス可能なすべてのチャンネルを検索）
     - `limit` (数値, デフォルト: 20, 最大: 100): 返す結果の最大数
   - 返り値: 検索クエリにマッチするメッセージのリスト

7. `slack_get_message_context`
   - 特定のメッセージの前後のコンテキストを取得（前後のメッセージ）
   - 必須入力:
     - `channel_id` (文字列): メッセージを含むチャンネルのID
     - `message_ts` (文字列): コンテキストを取得するメッセージのタイムスタンプ
   - オプション入力:
     - `context_size` (数値, デフォルト: 5): ターゲットメッセージの前後に含めるメッセージ数
   - 返り値: ターゲットメッセージとその前後のメッセージのリスト

8. `slack_get_thread_context`
   - スレッドのメッセージと親メッセージの周囲のコンテキストを取得
   - 必須入力:
     - `channel_id` (文字列): スレッドを含むチャンネルのID
     - `thread_ts` (文字列): 親メッセージのタイムスタンプ
   - 返り値: スレッドのメッセージと親メッセージのコンテキスト

## セットアップ

1. Slack Appを作成:
   - [Slack Appsページ](https://api.slack.com/apps)にアクセス
   - "Create New App"をクリック
   - "From scratch"を選択
   - アプリに名前を付け、ワークスペースを選択

2. Bot Token Scopesを設定:
   "OAuth & Permissions"に移動し、以下のスコープを追加:
   - `channels:history` - 公開チャンネルのメッセージやその他のコンテンツを表示
   - `channels:read` - 基本的なチャンネル情報を表示
   - `search:read` - メッセージの検索
   - `users:read` - ユーザーとその基本情報を表示

3. ワークスペースにAppをインストール:
   - "Install to Workspace"をクリックし、アプリを承認
   - `xoxb-`で始まる"Bot User OAuth Token"を保存

4. チームID（`T`で始まる）を取得するには、[このガイダンス](https://slack.com/help/articles/221769328-Locate-your-Slack-URL-or-ID#find-your-workspace-or-org-id)に従ってください

### npxでの実行

このパッケージはnpmに公開後、npxコマンドで実行できます：

```bash
# 環境変数を設定
export SLACK_BOT_TOKEN=xoxb-your-bot-token
export SLACK_TEAM_ID=T01234567

# npxで実行
npx @masatoraatarashi/mcp-server-slack
```

### Claude Desktopでの使用

`claude_desktop_config.json`に以下を追加:

#### ローカル実行

```json
{
  "mcpServers": {
    "slack": {
      "command": "node",
      "args": [
        "/path/to/mcp-servers/src/slack/dist/index.js"
      ],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-your-bot-token",
        "SLACK_TEAM_ID": "T01234567"
      }
    }
  }
}
```

#### npmパッケージとして実行

```json
{
  "mcpServers": {
    "slack": {
      "command": "npx",
      "args": [
        "@masatoraatarashi/mcp-server-slack"
      ],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-your-bot-token",
        "SLACK_TEAM_ID": "T01234567"
      }
    }
  }
}
```

## RAG（Retrieval Augmented Generation）の使用例

このSlack MCPサーバーは、RAGワークフローに最適化されています。以下は一般的な使用例です：

1. **特定のトピックに関する会話の検索**:
   ```
   use_mcp_tool slack_search_messages "プロジェクトXの進捗"
   ```

2. **検索結果から特定のメッセージのコンテキストを取得**:
   ```
   use_mcp_tool slack_get_message_context {channel_id} {message_ts} 10
   ```

3. **関連するスレッドの詳細分析**:
   ```
   use_mcp_tool slack_get_thread_context {channel_id} {thread_ts}
   ```

4. **特定のチャンネルの最近の会話を要約**:
   ```
   use_mcp_tool slack_get_channel_history {channel_id} 50
   ```

これらのツールを組み合わせることで、Slackの会話から関連情報を効率的に抽出し、より正確な回答を生成できます。

## トラブルシューティング

権限エラーが発生した場合は、以下を確認してください:
1. Slackアプリに必要なすべてのスコープが追加されていること
2. アプリがワークスペースに正しくインストールされていること
3. トークンとワークスペースIDが設定に正しくコピーされていること
4. アプリがアクセスする必要のあるチャンネルに追加されていること
