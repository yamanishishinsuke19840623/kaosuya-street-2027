// ===== カオスやストリート MUSIC FESTIVAL 2027 協賛管理 GAS =====
// 最終更新: 2026-06-28
//
// ■ 初回セットアップ
//   1. Googleドライブで新規スプレッドシートを作成
//   2. URLの /d/ と /edit の間の文字列を SHEET_ID に設定
//   3. setupSheet() を実行してヘッダーを初期化
//   4. デプロイ → ウェブアプリ → 全員（アクセスを許可）
//   5. デプロイURLをコピーしてindex.htmlの GAS_ENDPOINT に貼る

var SHEET_ID   = '1t18wcFhyc1UV-Ix8XMdlmDWK0SL2S0awYR962j-e3w4';
var ADMIN_EMAIL = 'yamanishishinsuke19840623@gmail.com';
var EVENT_NAME  = 'カオスやストリート MUSIC FESTIVAL 2027';
var LP_URL      = 'https://yamanishishinsuke19840623.github.io/kaosuya-street-2027/';

// ===== doPost: フォーム申し込み受信 =====
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    logToSheet(data);
    sendAutoReplyToApplicant(data);
    sendNotificationToAdmin(data);
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log('doPost error: ' + err);
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', msg: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ===== doGet: LP用 協賛企業一覧 + 残枠 (JSONP) =====
function doGet(e) {
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName('台帳') || ss.getSheets()[0];
  var rows  = sheet.getDataRange().getValues();

  var sponsors = [];
  var ptUsed = 0, gdUsed = 0;

  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0]) continue;                      // 空行スキップ
    var plan = String(r[5] || '');
    var lp   = String(r[12] || '');

    if (plan === 'プラチナ') ptUsed++;
    if (plan === 'ゴールド')  gdUsed++;

    if (lp === 'はい') {
      sponsors.push({
        name:    r[8]  || r[1] || '',         // I列: 掲載名、なければ法人名
        plan:    plan,
        message: r[9]  || ''                  // J列: 応援メッセージ
      });
    }
  }

  var result = {
    sponsors: sponsors,
    slots: {
      pt: { total: 3,  used: ptUsed },
      gd: { total: 10, used: gdUsed }
    }
  };

  var cb = (e && e.parameter && e.parameter.callback) ? e.parameter.callback : 'ksCallback';
  return ContentService
    .createTextOutput(cb + '(' + JSON.stringify(result) + ')')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

// ===== スプレッドシートに申込記録 =====
function logToSheet(d) {
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName('台帳') || ss.getSheets()[0];

  var planLabel = d.plan === 'platinum' ? 'プラチナ' : 'ゴールド';
  var unitPrice = d.plan === 'platinum' ? 33000 : 11000;
  var count     = parseInt(d.count || 1);
  var price     = unitPrice * count;

  sheet.appendRow([
    new Date(),                              // A: 申込日時
    d.company     || '',                     // B: 法人名
    d.name        || '',                     // C: 担当者名
    d.email       || '',                     // D: メール
    d.tel         || '',                     // E: 電話
    planLabel,                               // F: プラン
    count,                                   // G: 口数
    price,                                   // H: 金額
    d.displayName || d.company || '',        // I: 掲載名（LP表示）
    d.message     || '',                     // J: 応援メッセージ
    d.note        || '',                     // K: 備考
    '未確認',                                // L: 振込確認
    'いいえ',                                // M: LP掲載
    ''                                       // N: 確認メール送信日
  ]);
}

// ===== 申込者への自動返信メール =====
function sendAutoReplyToApplicant(d) {
  if (!d.email) return;

  var planLabel = d.plan === 'platinum'
    ? 'プラチナスポンサー（¥33,000/口）'
    : 'ゴールドスポンサー（¥11,000/口）';
  var count = parseInt(d.count || 1);
  var price = (d.plan === 'platinum' ? 33000 : 11000) * count;

  var subject = '【' + EVENT_NAME + '】協賛お申し込みありがとうございます';
  var body = [
    d.name + ' 様',
    '',
    'この度は「' + EVENT_NAME + '」へのご協賛申し込みをいただき、',
    '誠にありがとうございます。',
    '',
    '■ お申し込み内容',
    '法人名   ：' + (d.company || ''),
    'ご担当者 ：' + (d.name || '') + ' 様',
    'プラン   ：' + planLabel,
    '口数     ：' + count + '口',
    '申込金額 ：¥' + price.toLocaleString(),
    '',
    '■ 振込先口座',
    '銀行名   ：GMOあおぞらネット銀行（金融機関コード：0310）',
    '支店名   ：うみ支店（支店コード：301）',
    '科目     ：普通預金',
    '口座番号 ：2338638',
    '口座名義 ：ヤマニシ シンスケ',
    '',
    '■ 今後の流れ',
    '1. 請求書をメールにてお送りします',
    '2. 上記口座へお振込みください',
    '3. ご入金確認後、HP・SNS・チラシへの掲載を順次進めます',
    '',
    'ご不明な点がございましたら、お気軽にご連絡ください。',
    '',
    '---',
    EVENT_NAME + ' 実行委員会',
    '担当：山西伸典',
    'TEL ：070-5483-0623',
    'MAIL：' + ADMIN_EMAIL,
    'HP  ：' + LP_URL
  ].join('\n');

  MailApp.sendEmail({ to: d.email, subject: subject, body: body });
}

// ===== 管理者（やまちゃん）への通知メール =====
function sendNotificationToAdmin(d) {
  var planLabel = d.plan === 'platinum' ? 'プラチナ（¥33,000）' : 'ゴールド（¥11,000）';
  var count = parseInt(d.count || 1);
  var price = (d.plan === 'platinum' ? 33000 : 11000) * count;

  var subject = '【新規協賛申込】' + (d.company || d.name || '') + '　' + planLabel;
  var body = [
    '新しい協賛申し込みが届きました。',
    '',
    '法人名   ：' + (d.company || ''),
    '担当者   ：' + (d.name || ''),
    'メール   ：' + (d.email || ''),
    '電話     ：' + (d.tel || ''),
    'プラン   ：' + planLabel,
    '口数     ：' + count + '口',
    '金額     ：¥' + price.toLocaleString(),
    '掲載希望名：' + (d.displayName || ''),
    '応援メッセージ：' + (d.message || ''),
    '',
    '■ 台帳での作業',
    '・L列「振込確認」を「確認済」に変更',
    '　→ メニュー「カオスやストリート LP」→「振込確認メールを送信」',
    '・M列「LP掲載」を「はい」に変更',
    '　→ 次のページ読み込みから自動反映（git push不要）',
    '',
    '台帳を開く：',
    'https://docs.google.com/spreadsheets/d/' + SHEET_ID
  ].join('\n');

  MailApp.sendEmail({ to: ADMIN_EMAIL, subject: subject, body: body });
}

// ===== スプレッドシート初期化（初回1回のみ実行） =====
function setupSheet() {
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName('台帳');
  if (!sheet) sheet = ss.insertSheet('台帳');

  var headers = [
    '申込日時', '法人名・屋号', '担当者名', 'メール', '電話',
    'プラン', '口数', '金額', '掲載名（LP表示）', '応援メッセージ',
    '備考', '振込確認', 'LP掲載', '確認メール送信日'
  ];
  var range = sheet.getRange(1, 1, 1, headers.length);
  range.setValues([headers]);
  range.setBackground('#1B5E20').setFontColor('#ffffff').setFontWeight('bold');
  sheet.setFrozenRows(1);

  var colWidths = [160, 200, 120, 200, 130, 100, 60, 100, 200, 250, 200, 100, 100, 160];
  colWidths.forEach(function(w, i) { sheet.setColumnWidth(i + 1, w); });

  // 条件付き書式（LP掲載「はい」の行を緑でハイライト）
  var rule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$M2="はい"')
    .setBackground('#E8F5E9')
    .setRanges([sheet.getRange('A2:N1000')])
    .build();
  sheet.setConditionalFormatRules([rule]);

  SpreadsheetApp.getUi().alert('台帳シートを作成しました！続けてGASをデプロイしてください。');
}

// ===== カスタムメニュー =====
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('カオスやストリート LP')
    .addItem('振込確認メールを送信（選択行）', 'menuSendConfirmation')
    .addItem('LP掲載を「はい」にする（選択行）', 'menuSetLpDisplay')
    .addSeparator()
    .addItem('台帳シートを初期化', 'setupSheet')
    .addToUi();
}

// ===== 振込確認メール送信（メニュー操作） =====
function menuSendConfirmation() {
  var ui    = SpreadsheetApp.getUi();
  var sheet = SpreadsheetApp.getActiveSheet();
  var row   = sheet.getActiveCell().getRow();
  if (row <= 1) { ui.alert('2行目以降の申込行を選択してください。'); return; }

  var data  = sheet.getRange(row, 1, 1, 14).getValues()[0];
  var name  = data[2];
  var email = data[3];
  var plan  = data[5];
  var count = data[6];
  var price = data[7];

  if (!email) { ui.alert('メールアドレスが空です。'); return; }
  if (data[11] !== '確認済') {
    var ans = ui.alert('振込確認列が「確認済」になっていません。このまま送信しますか？', ui.ButtonSet.YES_NO);
    if (ans !== ui.Button.YES) return;
  }

  var subject = '【' + EVENT_NAME + '】ご入金確認のご連絡';
  var body = [
    name + ' 様',
    '',
    'この度はカオスやストリート MUSIC FESTIVAL 2027へのご協賛、',
    '誠にありがとうございます。',
    '',
    'ご入金を確認いたしました。',
    '',
    '■ ご確認内容',
    'プラン ：' + plan,
    '口数   ：' + count + '口',
    '金額   ：¥' + (parseInt(price) || 0).toLocaleString(),
    '',
    '今後の掲載スケジュール：',
    '・公式HP（' + LP_URL + '）への掲載 → 順次掲載',
    '・Instagram @kaosuya_street での企業様紹介',
    '・チラシ（2026年12月発行予定）へのロゴ・社名掲載',
    '',
    '引き続きどうぞよろしくお願いいたします。',
    '',
    '---',
    EVENT_NAME + ' 実行委員会',
    '担当：山西伸典　TEL：070-5483-0623',
    'MAIL：' + ADMIN_EMAIL
  ].join('\n');

  MailApp.sendEmail({ to: email, subject: subject, body: body });
  sheet.getRange(row, 14).setValue(new Date());         // N列: 送信日を記録
  ui.alert('振込確認メールを送信しました → ' + email);
}

// ===== LP掲載「はい」に変更（メニュー操作） =====
function menuSetLpDisplay() {
  var ui    = SpreadsheetApp.getUi();
  var sheet = SpreadsheetApp.getActiveSheet();
  var row   = sheet.getActiveCell().getRow();
  if (row <= 1) { ui.alert('2行目以降の申込行を選択してください。'); return; }

  sheet.getRange(row, 13).setValue('はい');
  var dispName = sheet.getRange(row, 9).getValue() || sheet.getRange(row, 2).getValue();
  ui.alert('"' + dispName + '" をLP掲載対象に設定しました。\nページを再読み込みすると自動反映されます。');
}
