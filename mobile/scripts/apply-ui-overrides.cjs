/* Curated common controls and financial labels. Remaining offline model output needs language review. */
const fs = require('fs'); const path = require('path');
const root = path.resolve(__dirname, '../src/localization');
const columns = ['Home','Bills','Guide','Timeline','Settings','Continue','Add documents','Try again','Statement balance','Your bills','Insurance terms','Choose a voice'];
const rows = {
 es:['Inicio','Facturas','Guía','Seguimiento','Ajustes','Continuar','Añadir documentos','Intentar de nuevo','Saldo de la factura','Tus facturas','Términos de seguros','Elegir una voz'],
 fr:['Accueil','Factures','Guide','Suivi','Réglages','Continuer','Ajouter des documents','Réessayer','Solde de la facture','Vos factures','Termes d’assurance','Choisir une voix'],
 de:['Start','Rechnungen','Ratgeber','Verlauf','Einstellungen','Weiter','Dokumente hinzufügen','Erneut versuchen','Offener Rechnungsbetrag','Ihre Rechnungen','Versicherungsbegriffe','Stimme auswählen'],
 it:['Home','Fatture','Guida','Cronologia','Impostazioni','Continua','Aggiungi documenti','Riprova','Saldo della fattura','Le tue fatture','Termini assicurativi','Scegli una voce'],
 'zh-Hans':['首页','账单','指南','进度','设置','继续','添加文件','重试','账单余额','您的账单','保险术语','选择声音'],
 'zh-Hant':['首頁','帳單','指南','進度','設定','繼續','新增文件','重試','帳單餘額','您的帳單','保險用語','選擇聲音'],
 ja:['ホーム','請求書','ガイド','経過','設定','続ける','書類を追加','再試行','請求残高','請求書一覧','保険用語','音声を選択'],
 ko:['홈','청구서','안내','진행 내역','설정','계속','문서 추가','다시 시도','청구서 잔액','내 청구서','보험 용어','음성 선택'],
 hi:['होम','बिल','मार्गदर्शिका','प्रगति','सेटिंग्स','जारी रखें','दस्तावेज़ जोड़ें','फिर कोशिश करें','बिल का बकाया','आपके बिल','बीमा संबंधी शब्द','आवाज़ चुनें'],
 ar:['الرئيسية','الفواتير','الدليل','المتابعة','الإعدادات','متابعة','إضافة مستندات','إعادة المحاولة','رصيد الفاتورة','فواتيرك','مصطلحات التأمين','اختيار صوت'],
 he:['בית','חשבונות','מדריך','מעקב','הגדרות','המשך','הוספת מסמכים','ניסיון נוסף','יתרת החשבון','החשבונות שלך','מונחי ביטוח','בחירת קול'],
 nl:['Home','Rekeningen','Gids','Tijdlijn','Instellingen','Doorgaan','Documenten toevoegen','Opnieuw proberen','Openstaand bedrag','Uw rekeningen','Verzekeringstermen','Een stem kiezen'],
 sv:['Hem','Räkningar','Guide','Tidslinje','Inställningar','Fortsätt','Lägg till dokument','Försök igen','Utestående belopp','Dina räkningar','Försäkringstermer','Välj en röst'],
 da:['Hjem','Regninger','Guide','Tidslinje','Indstillinger','Fortsæt','Tilføj dokumenter','Prøv igen','Udestående beløb','Dine regninger','Forsikringsbegreber','Vælg en stemme'],
 fi:['Etusivu','Laskut','Opas','Aikajana','Asetukset','Jatka','Lisää asiakirjoja','Yritä uudelleen','Laskun saldo','Omat laskut','Vakuutustermit','Valitse ääni'],
 no:['Hjem','Regninger','Veiledning','Tidslinje','Innstillinger','Fortsett','Legg til dokumenter','Prøv igjen','Utestående beløp','Dine regninger','Forsikringsbegreper','Velg en stemme'],
 pl:['Strona główna','Rachunki','Poradnik','Historia','Ustawienia','Dalej','Dodaj dokumenty','Spróbuj ponownie','Saldo rachunku','Twoje rachunki','Terminy ubezpieczeniowe','Wybierz głos'],
 cs:['Domů','Účty','Průvodce','Časová osa','Nastavení','Pokračovat','Přidat dokumenty','Zkusit znovu','Zůstatek účtu','Vaše účty','Pojmy pojištění','Vybrat hlas'],
 sk:['Domov','Účty','Sprievodca','Časová os','Nastavenia','Pokračovať','Pridať dokumenty','Skúsiť znova','Zostatok účtu','Vaše účty','Pojmy poistenia','Vybrať hlas'],
 hu:['Kezdőlap','Számlák','Útmutató','Idővonal','Beállítások','Folytatás','Dokumentumok hozzáadása','Újrapróbálás','Számlaegyenleg','Az Ön számlái','Biztosítási fogalmak','Hang kiválasztása'],
 ro:['Acasă','Facturi','Ghid','Istoric','Setări','Continuă','Adaugă documente','Încearcă din nou','Soldul facturii','Facturile tale','Termeni de asigurare','Alege o voce'],
 el:['Αρχική','Λογαριασμοί','Οδηγός','Ιστορικό','Ρυθμίσεις','Συνέχεια','Προσθήκη εγγράφων','Δοκιμάστε ξανά','Υπόλοιπο λογαριασμού','Οι λογαριασμοί σας','Ασφαλιστικοί όροι','Επιλογή φωνής'],
 ru:['Главная','Счета','Справочник','История','Настройки','Продолжить','Добавить документы','Повторить','Остаток по счёту','Ваши счета','Страховые термины','Выбрать голос'],
 uk:['Головна','Рахунки','Довідник','Історія','Налаштування','Продовжити','Додати документи','Спробувати знову','Залишок за рахунком','Ваші рахунки','Страхові терміни','Вибрати голос'],
 tr:['Ana sayfa','Faturalar','Rehber','Geçmiş','Ayarlar','Devam','Belge ekle','Tekrar dene','Fatura bakiyesi','Faturalarınız','Sigorta terimleri','Ses seç'],
 id:['Beranda','Tagihan','Panduan','Riwayat','Pengaturan','Lanjutkan','Tambah dokumen','Coba lagi','Sisa tagihan','Tagihan Anda','Istilah asuransi','Pilih suara'],
 ms:['Utama','Bil','Panduan','Sejarah','Tetapan','Teruskan','Tambah dokumen','Cuba lagi','Baki bil','Bil anda','Istilah insurans','Pilih suara'],
 th:['หน้าหลัก','ใบเรียกเก็บเงิน','คู่มือ','ประวัติ','การตั้งค่า','ดำเนินการต่อ','เพิ่มเอกสาร','ลองอีกครั้ง','ยอดคงเหลือในใบเรียกเก็บเงิน','ใบเรียกเก็บเงินของคุณ','คำศัพท์ประกันภัย','เลือกเสียง'],
 vi:['Trang chủ','Hóa đơn','Hướng dẫn','Tiến trình','Cài đặt','Tiếp tục','Thêm tài liệu','Thử lại','Số dư hóa đơn','Hóa đơn của bạn','Thuật ngữ bảo hiểm','Chọn giọng nói'],
 'pt-PT':['Início','Faturas','Guia','Histórico','Definições','Continuar','Adicionar documentos','Tentar novamente','Saldo da fatura','As suas faturas','Termos de seguros','Escolher uma voz'],
};
for (const [language, values] of Object.entries(rows)) {
 const p=path.join(root,language+'.json'); const catalog=JSON.parse(fs.readFileSync(p,'utf8'));
 columns.forEach((key,i)=>{if(key in catalog)catalog[key]=values[i];});
 fs.writeFileSync(p,JSON.stringify(catalog,null,2)+'\n');
}
console.log('Common controls and balance labels normalized for',Object.keys(rows).length,'languages');
