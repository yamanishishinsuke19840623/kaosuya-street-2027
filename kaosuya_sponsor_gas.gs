// ===== カオスやストリート MUSIC FESTIVAL 2027 協賛管理 GAS =====
// 最終更新: 2026-06-28

var SHEET_ID    = '1t18wcFhyc1UV-Ix8XMdlmDWK0SL2S0awYR962j-e3w4';
var ADMIN_EMAIL = 'yamanishishinsuke19840623@gmail.com';
var EVENT_NAME  = 'カオスやストリート MUSIC FESTIVAL 2027';
var LP_URL      = 'https://yamanishishinsuke19840623.github.io/kaosuya-street-2027/';

// Stripe Payment Link ID → プラン対応表
var STRIPE_LINKS = {
  'https://buy.stripe.com/14AeV67EQg7UdrT8rFao804': 'プラチナ',
  'https://buy.stripe.com/eVqbIU0codZM9bDdLZao805': 'ゴールド'
};

// ===== doPost: フォーム申し込み / Stripe Webhook 振り分け =====
function doPost(e) {
  try {
    var raw  = e.postData.contents;
    var data = JSON.parse(raw);

    // Stripe Webhook の検出（type フィールドがある）
    if (data.type && data.data && data.data.object) {
      handleStripeWebhook(data);
      return ContentService
        .createTextOutput(JSON.stringify({ received: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 通常のフォーム申し込み
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

// ===== Stripe Webhook ハンドラ =====
function handleStripeWebhook(event) {
  if (event.type !== 'checkout.session.completed') return;

  var session = event.data.object;
  var amount  = session.amount_total || 0;  // JPY はゼロ小数点（そのまま円）

  // 金額でプランを判定
  var plan      = amount >= 33000 ? 'プラチナ' : 'ゴールド';
  var unitPrice = plan === 'プラチナ' ? 33000 : 11000;

  var details = session.customer_details || {};
  var email   = details.email || session.customer_email || '';
  var name    = details.name  || '';

  // 台帳に記録（クレカ決済なので振込確認は即「確認済」）
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName('台帳') || ss.getSheets()[0];
  sheet.appendRow([
    new Date(),
    name,
    name,
    email,
    '',
    plan,
    1,
    unitPrice,
    name,
    '',
    'Stripe決済完了　' + (session.id || ''),
    '確認済',
    'いいえ',
    '',
    '',
    ''
  ]);

  // 管理者へ通知
  var planLabel = plan + 'スポンサー（¥' + unitPrice.toLocaleString() + '）';
  MailApp.sendEmail({
    to:      ADMIN_EMAIL,
    subject: '【Stripe決済完了】' + name + '　' + planLabel,
    body: [
      'Stripeでの協賛申し込み（クレジットカード決済）が完了しました。',
      '',
      '名前    ：' + name,
      'メール  ：' + email,
      'プラン  ：' + planLabel,
      'Session ：' + (session.id || ''),
      '',
      '■ 次の作業',
      '振込確認は「確認済」として自動記録済みです。',
      'M列「LP掲載」を「はい」に変更するとLP協賛一覧に自動反映されます。',
      '',
      '台帳：https://docs.google.com/spreadsheets/d/' + SHEET_ID
    ].join('\n')
  });

  // 申込者へ自動返信
  if (email) {
    MailApp.sendEmail({
      to:      email,
      subject: '【' + EVENT_NAME + '】ご協賛ありがとうございます（カード決済完了）',
      body: [
        name + ' 様',
        '',
        'カオスやストリート MUSIC FESTIVAL 2027への',
        'クレジットカードでのご協賛が完了いたしました。',
        '',
        '■ お申し込み内容',
        'プラン ：' + planLabel,
        '',
        '今後の流れ：',
        '・公式HP・SNSへの掲載を順次進めます',
        '・チラシ（2026年12月発行予定）への掲載',
        '',
        '改めて担当（山西）よりご連絡いたします。',
        '',
        '---',
        EVENT_NAME + ' 実行委員会',
        '担当：山西伸典　TEL：070-5483-0623',
        'MAIL：' + ADMIN_EMAIL
      ].join('\n')
    });
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
    if (!r[0]) continue;
    var plan = String(r[5] || '');
    var lp   = String(r[12] || '');

    if (plan === 'プラチナ') ptUsed++;
    if (plan === 'ゴールド')  gdUsed++;

    if (lp === 'はい') {
      sponsors.push({
        name:    r[8]  || r[1] || '',
        plan:    plan,
        message: r[9]  || ''
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
    new Date(),
    d.company     || '',
    d.name        || '',
    d.email       || '',
    d.tel         || '',
    planLabel,
    count,
    price,
    d.displayName || d.company || '',
    d.message     || '',
    d.note        || '',
    '未確認',
    'いいえ',
    '',
    '',
    ''
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
    '■ 今後の流れ',
    '1. 請求書（PDF）をメールにてお送りします',
    '2. 下記口座へお振込みください',
    '3. ご入金確認後、HP・SNS・チラシへの掲載を順次進めます',
    '',
    '■ お振込先（請求書送付後にご利用ください）',
    'GMOあおぞらネット銀行　うみ支店（支店コード：301）',
    '普通　2338638　ヤマニシ シンスケ',
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

// ===== 管理者への通知メール =====
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
    '■ 次の作業',
    '① メニュー「請求書PDFを送信」で請求書を発行',
    '② 入金確認後：L列「確認済」→ メニュー「振込確認メール送信」',
    '③ M列「はい」→ LP協賛一覧に自動表示',
    '',
    '台帳：https://docs.google.com/spreadsheets/d/' + SHEET_ID
  ].join('\n');

  MailApp.sendEmail({ to: ADMIN_EMAIL, subject: subject, body: body });
}

// ===== 請求書テンプレートを作成（初回1回のみ実行） =====
function createInvoiceTemplate() {
  var doc  = DocumentApp.create('【テンプレート】カオスやストリート2027 請求書');
  var body = doc.getBody();
  body.clear();
  body.setMarginTop(50).setMarginBottom(50).setMarginLeft(60).setMarginRight(60);

  // タイトル
  var titleP = body.appendParagraph('請　求　書');
  titleP.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  titleP.editAsText().setFontSize(24).setBold(true);

  // No / 発行日
  body.appendParagraph('');
  var infoP = body.appendParagraph('No.  {{請求書番号}}\n発行日：{{発行日}}');
  infoP.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  infoP.editAsText().setFontSize(10);

  // 請求先 ＋ 発行元（2段）
  body.appendParagraph('');
  var toP = body.appendParagraph('{{請求先法人名}}\n{{請求先担当者}} 様');
  toP.editAsText().setFontSize(13).setBold(true);

  body.appendParagraph('');
  var fromLines = [
    'カオスやストリート MUSIC FESTIVAL 2027 実行委員会',
    '代表：山西　伸典',
    'TEL：070-5483-0623',
    'MAIL：yamanishishinsuke19840623@gmail.com'
  ].join('\n');
  var fromP = body.appendParagraph(fromLines);
  fromP.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  fromP.editAsText().setFontSize(9);

  // 区切り
  body.appendParagraph('').setBorderBottom(true);
  body.appendParagraph('下記のとおりご請求申し上げます。').editAsText().setFontSize(10);
  body.appendParagraph('');

  // 請求金額ハイライト
  var amtP = body.appendParagraph('ご請求金額　{{請求金額}}　（税込）');
  amtP.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  amtP.editAsText().setFontSize(18).setBold(true);
  body.appendParagraph('');

  // 明細テーブル
  var tbl = body.appendTable([
    ['品目',       '単価',    '口数',    '金額'],
    ['{{品目}}', '{{単価}}', '{{口数}}', '{{金額}}'],
    ['',          '',        '合　計',   '{{請求金額}}']
  ]);
  // ヘッダー行スタイル
  var hRow = tbl.getRow(0);
  for (var c = 0; c < 4; c++) {
    hRow.getCell(c).editAsText().setBold(true).setFontSize(10);
    hRow.getCell(c).setBackgroundColor('#C8E6C9');
  }
  // 合計行スタイル
  var tRow = tbl.getRow(2);
  for (var c2 = 0; c2 < 4; c2++) {
    tRow.getCell(c2).editAsText().setBold(true).setFontSize(11);
  }
  tbl.editAsText().setFontSize(10);

  body.appendParagraph('');

  // 振込期限
  var dlP = body.appendParagraph('お振込期限：{{振込期限}}');
  dlP.editAsText().setFontSize(12).setBold(true);
  body.appendParagraph('');

  // 振込先
  var bankLines = [
    '■ お振込先',
    'GMOあおぞらネット銀行　うみ支店（支店コード：301）',
    '普通　2338638　ヤマニシ シンスケ'
  ].join('\n');
  body.appendParagraph(bankLines).editAsText().setFontSize(10);
  body.appendParagraph('');

  // 備考
  body.appendParagraph('※ ご不明な点はお気軽にご連絡ください。').editAsText()
    .setFontSize(9).setForegroundColor('#888888');

  doc.saveAndClose();

  // IDをスクリプトプロパティに保存
  PropertiesService.getScriptProperties().setProperty('TEMPLATE_DOC_ID', doc.getId());

  SpreadsheetApp.getUi().alert(
    '請求書テンプレートを作成しました！\n\n' +
    'Googleドライブに\n「【テンプレート】カオスやストリート2027 請求書」\nが作成されています。\n\n' +
    '次回からメニュー「請求書PDFを送信」で使えます。'
  );
}

// ===== 請求書PDF生成 ＋ メール送信 =====
function createAndSendInvoicePDF(rowData, invoiceNo) {
  var templateId = PropertiesService.getScriptProperties().getProperty('TEMPLATE_DOC_ID');
  if (!templateId) {
    throw new Error('テンプレートが未作成です。メニューから「請求書テンプレートを作成」を先に実行してください。');
  }

  // テンプレートをコピー
  var templateFile = DriveApp.getFileById(templateId);
  var copyName     = '請求書_' + invoiceNo + '_' + (rowData.company || rowData.name);
  var copy         = templateFile.makeCopy(copyName);
  var doc          = DocumentApp.openById(copy.getId());
  var body         = doc.getBody();

  var planLabel = rowData.plan === 'プラチナ'
    ? 'プラチナスポンサー協賛金'
    : 'ゴールドスポンサー協賛金';
  var unitPrice = rowData.plan === 'プラチナ' ? 33000 : 11000;
  var count     = parseInt(rowData.count) || 1;
  var total     = unitPrice * count;

  var fmt = function(n) {
    return '¥' + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // 振込期限: 発行から21日後
  var deadline = new Date();
  deadline.setDate(deadline.getDate() + 21);
  var dlStr = deadline.getFullYear() + '年' + (deadline.getMonth() + 1) + '月' + deadline.getDate() + '日';

  var today = new Date();
  var todayStr = today.getFullYear() + '年' + (today.getMonth() + 1) + '月' + today.getDate() + '日';

  // プレースホルダー置換
  body.replaceText('\\{\\{請求書番号\\}\\}',   invoiceNo);
  body.replaceText('\\{\\{発行日\\}\\}',        todayStr);
  body.replaceText('\\{\\{請求先法人名\\}\\}',  rowData.company || '');
  body.replaceText('\\{\\{請求先担当者\\}\\}',  rowData.name    || '');
  body.replaceText('\\{\\{品目\\}\\}',          planLabel);
  body.replaceText('\\{\\{単価\\}\\}',          fmt(unitPrice));
  body.replaceText('\\{\\{口数\\}\\}',          count + '口');
  body.replaceText('\\{\\{金額\\}\\}',          fmt(total));
  body.replaceText('\\{\\{請求金額\\}\\}',      fmt(total));
  body.replaceText('\\{\\{振込期限\\}\\}',      dlStr);

  doc.saveAndClose();

  // PDF変換
  var pdfBlob = copy.getAs('application/pdf').setName(copyName + '.pdf');

  // メール送信
  var subject = '【' + EVENT_NAME + '】請求書のご送付';
  var mailBody = [
    rowData.name + ' 様',
    '',
    'この度はカオスやストリート MUSIC FESTIVAL 2027へのご協賛、',
    '誠にありがとうございます。',
    '',
    '請求書をPDFにてお送りいたします。',
    'お手数ですが、' + dlStr + 'までにお振込みいただけますと幸いです。',
    '',
    '■ お振込先',
    'GMOあおぞらネット銀行　うみ支店（支店コード：301）',
    '普通　2338638　ヤマニシ シンスケ',
    '',
    'ご不明な点がございましたらお気軽にご連絡ください。',
    '',
    '---',
    EVENT_NAME + ' 実行委員会',
    '担当：山西伸典　TEL：070-5483-0623',
    'MAIL：' + ADMIN_EMAIL
  ].join('\n');

  MailApp.sendEmail({
    to:          rowData.email,
    subject:     subject,
    body:        mailBody,
    attachments: [pdfBlob],
    name:        'カオスやストリート2027実行委員会'
  });

  // コピー（Docファイル）を削除
  copy.setTrashed(true);

  return dlStr;
}

// ===== 請求書PDF送信（メニュー操作） =====
function menuSendInvoice() {
  var ui    = SpreadsheetApp.getUi();
  var sheet = SpreadsheetApp.getActiveSheet();
  var row   = sheet.getActiveCell().getRow();
  if (row <= 1) { ui.alert('2行目以降の申込行を選択してください。'); return; }

  var data    = sheet.getRange(row, 1, 1, 16).getValues()[0];
  var company = data[1];
  var name    = data[2];
  var email   = data[3];
  var plan    = data[5];
  var count   = data[6];
  var price   = data[7];

  if (!email) { ui.alert('メールアドレスが空です。'); return; }

  // 請求書番号（O列に既存があればそれを使用）
  var invoiceNo = data[14] || ('KS2027-' + String(row - 1).padStart(3, '0'));

  var ans = ui.alert(
    '請求書PDFを送信します\n\n' +
    '請求書番号：' + invoiceNo + '\n' +
    '請求先    ：' + company + ' ' + name + ' 様\n' +
    'メール    ：' + email + '\n' +
    'プラン    ：' + plan + '　¥' + (parseInt(price) || 0).toLocaleString() + '\n\n' +
    'よろしいですか？',
    ui.ButtonSet.YES_NO
  );
  if (ans !== ui.Button.YES) return;

  try {
    var deadline = createAndSendInvoicePDF(
      { company: company, name: name, email: email, plan: plan, count: count },
      invoiceNo
    );
    sheet.getRange(row, 15).setValue(invoiceNo);   // O列: 請求書番号
    sheet.getRange(row, 16).setValue(new Date());  // P列: 請求書送信日
    ui.alert('請求書PDFを送信しました！\n振込期限：' + deadline + '\n→ ' + email);
  } catch(err) {
    ui.alert('エラー：' + err.toString());
  }
}

// ===== 振込確認メール送信（メニュー操作） =====
function menuSendConfirmation() {
  var ui    = SpreadsheetApp.getUi();
  var sheet = SpreadsheetApp.getActiveSheet();
  var row   = sheet.getActiveCell().getRow();
  if (row <= 1) { ui.alert('2行目以降の申込行を選択してください。'); return; }

  var data  = sheet.getRange(row, 1, 1, 16).getValues()[0];
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
    '・公式HP（' + LP_URL + '）への掲載',
    '・Instagram @kaosuya_street での企業様紹介',
    '・チラシ（2026年12月発行予定）へのロゴ・社名掲載',
    '',
    '引き続きよろしくお願いいたします。',
    '',
    '---',
    EVENT_NAME + ' 実行委員会',
    '担当：山西伸典　TEL：070-5483-0623',
    'MAIL：' + ADMIN_EMAIL
  ].join('\n');

  MailApp.sendEmail({ to: email, subject: subject, body: body });
  sheet.getRange(row, 14).setValue(new Date());    // N列: 確認メール送信日
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

// ===== カスタムメニュー =====
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('カオスやストリート LP')
    .addItem('請求書PDFを送信（選択行）',     'menuSendInvoice')
    .addItem('振込確認メールを送信（選択行）', 'menuSendConfirmation')
    .addItem('LP掲載を「はい」にする（選択行）', 'menuSetLpDisplay')
    .addSeparator()
    .addItem('請求書テンプレートを作成',       'createInvoiceTemplate')
    .addItem('台帳シートを初期化',             'setupSheet')
    .addToUi();
}

// ===== スプレッドシート初期化（初回1回のみ） =====
function setupSheet() {
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName('台帳');
  if (!sheet) sheet = ss.insertSheet('台帳');

  var headers = [
    '申込日時', '法人名・屋号', '担当者名', 'メール', '電話',
    'プラン', '口数', '金額', '掲載名（LP表示）', '応援メッセージ',
    '備考', '振込確認', 'LP掲載', '確認メール送信日', '請求書番号', '請求書送信日'
  ];
  var range = sheet.getRange(1, 1, 1, headers.length);
  range.setValues([headers]);
  range.setBackground('#1B5E20').setFontColor('#ffffff').setFontWeight('bold');
  sheet.setFrozenRows(1);

  var colWidths = [160, 200, 120, 200, 130, 100, 60, 100, 200, 250, 200, 100, 100, 160, 120, 160];
  colWidths.forEach(function(w, i) { sheet.setColumnWidth(i + 1, w); });

  // LP掲載「はい」の行を緑ハイライト
  var rule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$M2="はい"')
    .setBackground('#E8F5E9')
    .setRanges([sheet.getRange('A2:P1000')])
    .build();
  sheet.setConditionalFormatRules([rule]);

  SpreadsheetApp.getUi().alert(
    '台帳シートを作成しました！\n\n' +
    '次のステップ：\n' +
    '「カオスやストリート LP」メニュー →「請求書テンプレートを作成」を実行してください。'
  );
}
