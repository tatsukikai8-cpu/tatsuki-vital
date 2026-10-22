# Firebase Hosting 本番デプロイ手順書 (Deployment Guide)

本書は、「バイタル一括管理システム (VitalSign Pro)」を **Firebase Hosting** および **Cloud Firestore** へ本番デプロイ・運用するための完全手順書です。

---

## 1. プロジェクト構成と事前作成ファイル

本プロジェクトには、Firebase Hostingおよびセキュリティルールのデプロイに必要な設定ファイルがすべて準備されています。

| ファイル | 役割 |
| :--- | :--- |
| `firebase.json` | Firebase Hostingの配信ディレクトリ (`dist`)、SPA用リライト設定、HTTPセキュリティヘッダー、Firestoreルール定義 |
| `.firebaserc` | デプロイ先Firebaseプロジェクト (`cs-project-7wfoj3ka`) の紐付け設定 |
| `firestore.rules` | マルチテナント (`facilityId`) 対応の強固なFirestoreセキュリティルール |
| `firebase-applet-config.json` | アプリケーションが接続するFirebaseプロジェクト・認証・Firestore設定 |
| `package.json` | `build`, `deploy`, `deploy:hosting`, `deploy:rules` などの実行スクリプト |

---

## 2. デプロイ前の事前準備 (初回のみ)

### ① Node.js および npm の確認
端末（PCまたはCI/CD環境）に Node.js (v18以上推奨) がインストールされていることを確認します。
```bash
node -v
npm -v
```

### ② Firebase CLI のインストール
Firebase コマンドラインツールが未導入の場合は、グローバルにインストールします。
```bash
npm install -g firebase-tools
```

### ③ Firebase へのログイン
GoogleアカウントでFirebase CLIにログインします。
```bash
firebase login
```
※ CI/CD（GitHub Actions等）でデプロイする場合は、`firebase login:ci` でトークンを発行するか、サービスアカウントキー (GCP Workload Identity / Secret) を利用します。
※ **Google Cloud Shell を使用する場合**はブラウザ内ターミナルのため、以下のように `--no-localhost` オプションを付けて実行します：
```bash
firebase login --no-localhost
```

### ④ デプロイ対象プロジェクトの確認
プロジェクト設定が `.firebaserc` に記述されていますが、念のためアクティブプロジェクトを確認します。
```bash
firebase use cs-project-7wfoj3ka
```

---

## 3. Google Cloud Shell を使ったデプロイ手順（PC環境構築不要）

ローカルPCに Node.js や Firebase CLI を導入せず、ブラウザだけで完結させたい場合は **Google Cloud Shell** を利用するのが最も簡単です。

### Cloud Shell での実行手順（5ステップ）

1. **Google Cloud Console で Cloud Shell を開く**
   - ブラウザで [Google Cloud Console (cs-project-7wfoj3ka)](https://console.cloud.google.com/?project=cs-project-7wfoj3ka) を開きます。
   - 画面右上にある **「Cloud Shell をアクティブにする」アイコン（`>_`）** をクリックします。

2. **ソースコードの配置**
   - Cloud Shell 画面のメニュー「︙」またはドラッグ＆ドロップでプロジェクトの zip ファイルをアップロードして展開するか、Gitリポジトリから clone します：
     ```bash
     # 例: zipをアップロードした場合
     unzip vitalsign-pro.zip
     cd vitalsign-pro
     ```

3. **Firebase プロジェクトの設定と認証**
   ```bash
   # プロジェクトの指定
   gcloud config set project cs-project-7wfoj3ka
   
   # Firebase CLIのログイン（Cloud Shell用）
   firebase login --no-localhost
   ```
   ※ 表示されたURLを新しいタブで開き、Googleアカウントで許可して表示された認証コードを Cloud Shell のプロンプトに貼り付けます。
   
   ```bash
   # プロジェクトを紐付け
   firebase use cs-project-7wfoj3ka
   ```

4. **依存パッケージのインストールと本番ビルド**
   ```bash
   npm install
   npm run build
   ```

5. **Firebase Hosting & Firestore ルールを一括デプロイ**
   ```bash
   firebase deploy
   ```
   完了すると、`Hosting URL: https://cs-project-7wfoj3ka.web.app` が表示され、即座に一般公開・本番運用が開始されます。

---

## 4. Firebase Console での初期設定確認

Firebase コンソール ([https://console.firebase.google.com/project/cs-project-7wfoj3ka/overview](https://console.firebase.google.com/project/cs-project-7wfoj3ka/overview)) で以下が有効になっていることを確認します。

1. **Authentication（認証）**:
   - 左メニュー「Authentication」→「Sign-in method」を開く
   - **メール / パスワード** が「有効 (Enabled)」になっていることを確認（Googleログインも必要に応じて有効化）
   - 「設定 (Settings)」→「承認済みドメイン (Authorized domains)」に以下が含まれていることを確認：
     - `localhost`
     - `cs-project-7wfoj3ka.firebaseapp.com`
     - `cs-project-7wfoj3ka.web.app`
     - （独自ドメインを使用する場合はそのドメイン名）

2. **Cloud Firestore（データベース）**:
   - 左メニュー「Firestore Database」が作成済みであることを確認。
   - データベースID: `ai-studio-remixvitalsignpr-adfa4042-3f4d-4dec-b1ab-6c9ecb113f11` またはデフォルトDB

---

## 5. 本番デプロイの実行（ローカルPC または Cloud Shell）

プロジェクトのルートディレクトリで以下のコマンドを実行します。

### 一括デプロイ（ビルド ＋ Hosting ＋ Firestoreルール）
```bash
npm run deploy
```
※ このスクリプトは内部で `tsc --noEmit && vite build` を実行して型チェックを行い、静的ファイルを `dist/` に生成した後、`firebase deploy` を実行します。

---

### 個別デプロイを行う場合

#### A. Web画面（Hosting）のみデプロイする場合
UIの変更や機能追加時など、ホスティングのみ更新したい場合：
```bash
npm run deploy:hosting
```
または
```bash
npm run build
firebase deploy --only hosting
```

#### B. Firestoreセキュリティルールのみデプロイする場合
権限ルール (`firestore.rules`) のみを反映させたい場合：
```bash
npm run deploy:rules
```
または
```bash
firebase deploy --only firestore:rules
```

---

## 6. デプロイ完了後の確認

デプロイが成功すると、ターミナルに以下のようなHosting URLが出力されます：

```text
✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/cs-project-7wfoj3ka/overview
Hosting URL: https://cs-project-7wfoj3ka.web.app
```

ブラウザで上記URL（または `https://cs-project-7wfoj3ka.firebaseapp.com`）にアクセスし、以下の動作を確認してください：

1. **ログイン画面の表示**: 未ログイン状態でバイタル管理画面が保護され、ログイン/新規登録フォームが表示されること。
2. **新規職員の登録・ログイン**: メールアドレスとパスワードでログインできること。
3. **施設切り替え**: ヘッダーの施設ドロップダウン（A施設・B施設など）が切り替わり、データが施設ごとに隔離されていること。
4. **バイタル入力と異常値警告**:
   - 体温 37.5℃以上、血圧 140/90 mmHg 以上の入力時に赤字太字でハイライトされること。
   - 「マスタ」画面で施設ごとに閾値をカスタマイズ・保存できること。
5. **リロードテスト**: ブラウザをリロード（F5）しても 404 エラーにならず、正常に画面が維持されること（`firebase.json` の SPA リライトが機能していることの証明）。

---

## 7. 独自カスタムドメインの設定（任意）

自法人の独自ドメイン（例: `vital.your-facility.or.jp`）で運用する場合：

1. Firebase Console の「Hosting」ダッシュボードを開きます。
2. 「カスタム ドメインを追加」ボタンをクリックします。
3. 取得済みのドメイン名を入力し、画面の案内に従ってDNSレコード（AレコードまたはTXTレコード）をお使いのDNSプロバイダ（お名前.com, Route53, Cloudflare等）に設定します。
4. 数時間以内にSSL証明書（Let's Encrypt）が自動発行され、HTTPSで安全にアクセス可能になります。
5. Firebase Console「Authentication」→「承認済みドメイン」に独自ドメインを追加登録します。

---

## 8. トラブルシューティング

| 症状 | 原因と対策 |
| :--- | :--- |
| **画面をリロードすると 404 Not Found になる** | `firebase.json` 内の `rewrites`（`destination: "/index.html"`）が設定されていないか、デプロイされていません。`firebase.json` を確認し `npm run deploy:hosting` を再実行してください。 |
| **ログイン時に「auth/unauthorized-domain」エラー** | Firebase Consoleの「Authentication」→「承認済みドメイン」に、現在アクセスしているドメインが登録されていません。ドメインを追加してください。 |
| **「Missing or insufficient permissions」エラー** | Firestoreセキュリティルールによりアクセスがブロックされています。ログインユーザーの `/users/{uid}` ドキュメントの `allowedFacilities` 配列に対象の `facilityId` が含まれているか確認してください。 |
| **ビルドで型エラーが発生する** | `npm run lint` (`tsc --noEmit`) を実行して型エラーの詳細を確認し、修正後に再度デプロイしてください。 |
