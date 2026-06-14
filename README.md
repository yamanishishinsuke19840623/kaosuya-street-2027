# KAOSUYA STREET MUSIC FESTIVAL 2027 — 協賛募集LP

## フォルダ構成

```
クライアント/カオスやストリート/
├── index.html       ← LP本体（このファイル）
├── photos/
│   ├── logo.png     ← メインロゴ（カオスやストリート2027ロゴ-横長-背景透明.png）
│   ├── hero.png     ← ヒーロー背景（カオスや宝探し2027.png）
│   ├── gallery1.jpg ← ギャラリー1（過去のイベント写真）
│   ├── gallery2.jpg ← ギャラリー2
│   ├── gallery3.jpg ← ギャラリー3
│   ├── gallery4.jpg ← ギャラリー4
│   ├── gallery5.jpg ← ギャラリー5
│   └── gallery6.jpg ← ギャラリー6
└── README.md

```

## 写真の入れ方

### ヒーロー背景
- `photos/hero.png` を差し替えると Hero セクションの背景が変わります

### ギャラリー（過去の様子）
- 過去のイベント写真を `gallery1.jpg〜gallery6.jpg` という名前で `photos/` に入れる
- 推奨サイズ：横 800px 以上、4:3 比率
- 入れた瞬間にブラウザで開くと自動表示されます（絵文字フォールバック付き）

おすすめ写真の置き場所：
```
E:\▲伸典\20160506 安岡まちづくり協議会\20270313-14 カオスやストリート 第8回\
├── あ・音楽フェス\ ← ステージ・演奏写真
├── さ・写真・動画\ ← 全般
└── ち・チラシ\が。画像\ ← ロゴ・デザイン素材
```

## Formspree 設定（申込フォームの受信）

現在はフォーム送信で`mailto:`が起動する設定。本番稼働前に以下を設定してください。

1. https://formspree.io/ でアカウント作成
2. 新しいフォームを作成 → 受信先: `yamanishishinsuke19840623@gmail.com`
3. `index.html` の `var ENDPOINT = '';` にFormspreeのURLを入力

```javascript
var ENDPOINT = 'https://formspree.io/f/xxxxxxxx';  // ← ここ
```

## 公開方法

### GitHub Pages（推奨）
```bash
cd "クライアント/カオスやストリート"
git init
git add .
git commit -m "KAOSUYA STREET 2027 LP 初版"
git remote add origin https://github.com/yamanishi/kaosuya-street-2027.git
git push -u origin main
```
GitHub のリポジトリ設定 > Pages > Source: main branch で公開。

### Netlify
`index.html` と `photos/` フォルダをまとめて Netlify にドラッグ＆ドロップするだけで公開できます。

## 金額・プラン変更

```html
<!-- プラチナ価格を変更 -->
<div class="pc-price">¥33,000<small>/1口（税込）</small></div>

<!-- ゴールド価格を変更 -->
<div class="pc-price" style="color:var(--org-l)">¥11,000<small>/1口（税込）</small></div>

<!-- 残枠数を変更（JavaScript） -->
renderSlots('pt-slots', 3, 0);   // 3社枠・0社埋まり
renderSlots('gd-slots', 10, 0);  // 10社枠・0社埋まり
```

## イベント情報

| 項目 | 内容 |
|------|------|
| 名称 | KAOSUYA STREET MUSIC FESTIVAL 2027 |
| 開催日 | 2027年3月13日(土)・14日(日) 10:00〜16:00 |
| 会場 | 下関安岡地区公園 |
| 主催 | Ystudio+（ワイスタジオプラス）|
| 後援 | 下関市・下関市教育委員会 |
| 担当 | 山西伸典 070-5483-0623 |
| メール | yamanishishinsuke19840623@gmail.com |
