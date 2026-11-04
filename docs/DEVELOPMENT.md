# 開発者向けメモ

## 構成

| 場所 | 内容 |
|---|---|
| `index.html` | Web アプリ本体 (1 ファイル) |
| `manifest.webmanifest`, `icons/` | PWA の情報とアイコン |
| `.well-known/assetlinks.json` | Android アプリとサイトを結びつける証明 (Digital Asset Links) |
| `android/` | Android アプリ (Trusted Web Activity) の Gradle プロジェクト |
| `.github/workflows/release.yml` | タグを push すると署名済み APK を Releases に公開する |

Vercel は `main` への push で自動デプロイする。`.vercelignore` で `android/` などは公開対象から外している。

## Android アプリ (TWA)

- [androidbrowserhelper](https://github.com/GoogleChrome/android-browser-helper) の `LauncherActivity` で `https://cheki-totonoe.vercel.app/` を開くだけのアプリ。アプリ側にコードはなく、設定は `android/app/src/main/AndroidManifest.xml` と `res/values/` にある
- applicationId: `cheki.totonoe` (公開後は変更不可)
- minSdk 24 (androidbrowserhelper の下限)
- TWA に対応したブラウザ (Chrome など) がない端末では WebView で開く (`FALLBACK_STRATEGY = webview`)
- アドレスバーが消えるのは、サイトの `/.well-known/assetlinks.json` にある SHA-256 指紋と APK の署名鍵が一致したときだけ。署名鍵を変えたら assetlinks.json も更新する
- アイコンは Pillow で描いたもの (`icons/`, `android/app/src/main/res/mipmap-*`)

### ローカルでビルド

```bash
cd android
./gradlew :app:assembleDebug      # デバッグ版
./gradlew :app:assembleRelease    # リリース版 (署名情報がなければ未署名)
```

デバッグ版はデバッグ鍵で署名されるので、assetlinks.json と一致せずアドレスバーが出る。

## 署名

チェキ整え専用の keystore を使う (他のアプリと共有しない)。keystore とパスワードは Git に入れない (`android/.gitignore` で除外済み)。

署名情報は次のどちらかから読む。

- 環境変数 (CI): `CHEKI_KEYSTORE_FILE`, `CHEKI_KEYSTORE_PASSWORD`, `CHEKI_KEY_ALIAS`, `CHEKI_KEY_PASSWORD`
- `android/keystore.properties` (ローカル):

  ```properties
  storeFile=/path/to/cheki-totonoe-release.jks
  storePassword=...
  keyAlias=cheki-totonoe
  keyPassword=...
  ```

SHA-256 指紋の確認:

```bash
keytool -list -v -keystore cheki-totonoe-release.jks -alias cheki-totonoe
```

## リリース

GitHub の Secrets に次を登録しておく。

| 名前 | 中身 |
|---|---|
| `CHEKI_KEYSTORE_BASE64` | keystore ファイルを base64 にした文字列 (`base64 -i cheki-totonoe-release.jks \| pbcopy`) |
| `CHEKI_KEYSTORE_PASSWORD` | keystore のパスワード |
| `CHEKI_KEY_ALIAS` | 鍵の別名 (`cheki-totonoe`) |
| `CHEKI_KEY_PASSWORD` | 鍵のパスワード (keystore と同じにした場合は同じ値) |

`v0.1.0` のようなタグを push すると、`ChekiTotonoe-0.1.0.apk` が Releases に公開される。versionCode は Actions の実行番号。

```bash
git tag v0.1.0
git push origin v0.1.0
```
