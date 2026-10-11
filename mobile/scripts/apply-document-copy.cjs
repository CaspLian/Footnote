/* Explicit offline document copy. Apply after model generation and common-control overrides. */
const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'../src/localization');
const keys=['Capture a clear bill or EOB.','Add a bill, an EOB, or both. We’ll use the evidence you have, and you can add more later.','Use this document','Use these documents'];
const rows={
 es:['Fotografía una factura o EOB con claridad.','Añade una factura, una EOB o ambas. Puedes añadir más documentos después.','Usar este documento','Usar estos documentos'],
 fr:['Photographiez clairement la facture ou le relevé de prestations.','Ajoutez une facture, un relevé de prestations ou les deux. Vous pourrez ajouter des documents plus tard.','Utiliser ce document','Utiliser ces documents'],
 de:['Fotografieren Sie die Rechnung oder Leistungsabrechnung gut lesbar.','Fügen Sie eine Rechnung, eine Leistungsabrechnung oder beides hinzu. Weitere Dokumente können Sie später ergänzen.','Dieses Dokument verwenden','Diese Dokumente verwenden'],
 it:['Fotografa chiaramente la fattura o il riepilogo delle prestazioni.','Aggiungi una fattura, un riepilogo delle prestazioni o entrambi. Puoi aggiungere altri documenti in seguito.','Usa questo documento','Usa questi documenti'],
 'zh-Hans':['清晰拍摄医疗账单或保险给付说明。','添加账单、保险给付说明或两者。之后可以继续添加文件。','使用此文件','使用这些文件'],
 'zh-Hant':['清楚拍攝醫療帳單或保險給付明細。','新增帳單、保險給付明細或兩者。之後可以繼續新增文件。','使用此文件','使用這些文件'],
 ja:['医療費の請求書または給付明細を鮮明に撮影します。','請求書、給付明細、または両方を追加してください。後から書類を追加できます。','この書類を使用','これらの書類を使用'],
 ko:['의료비 청구서나 보험 급여 명세서를 선명하게 촬영하세요.','청구서, 보험 급여 명세서 또는 둘 다 추가하세요. 나중에 문서를 더 추가할 수 있습니다.','이 문서 사용','이 문서들 사용'],
 hi:['बिल या बीमा लाभ विवरण की साफ़ फोटो लें।','बिल, बीमा लाभ विवरण या दोनों जोड़ें। बाद में और दस्तावेज़ जोड़ सकते हैं।','इस दस्तावेज़ का उपयोग करें','इन दस्तावेज़ों का उपयोग करें'],
 ar:['التقط صورة واضحة للفاتورة أو بيان مزايا التأمين.','أضف فاتورة أو بيان مزايا التأمين أو كليهما. يمكنك إضافة مستندات أخرى لاحقًا.','استخدام هذا المستند','استخدام هذه المستندات'],
 he:['צלמו בבירור את החשבון או פירוט תגמולי הביטוח.','הוסיפו חשבון, פירוט תגמולי ביטוח או את שניהם. אפשר להוסיף מסמכים נוספים בהמשך.','שימוש במסמך זה','שימוש במסמכים אלה'],
 nl:['Maak een duidelijke foto van de rekening of het verzekeringsoverzicht.','Voeg een rekening, verzekeringsoverzicht of beide toe. U kunt later meer documenten toevoegen.','Dit document gebruiken','Deze documenten gebruiken'],
 sv:['Ta ett tydligt foto av räkningen eller försäkringsbeskedet.','Lägg till en räkning, ett försäkringsbesked eller båda. Du kan lägga till fler dokument senare.','Använd det här dokumentet','Använd dessa dokument'],
 da:['Tag et tydeligt foto af regningen eller forsikringsoversigten.','Tilføj en regning, en forsikringsoversigt eller begge. Du kan tilføje flere dokumenter senere.','Brug dette dokument','Brug disse dokumenter'],
 fi:['Ota selkeä kuva laskusta tai vakuutuksen korvauserittelystä.','Lisää lasku, vakuutuksen korvauserittely tai molemmat. Voit lisätä asiakirjoja myöhemmin.','Käytä tätä asiakirjaa','Käytä näitä asiakirjoja'],
 no:['Ta et tydelig bilde av regningen eller forsikringsoppgjøret.','Legg til en regning, et forsikringsoppgjør eller begge. Du kan legge til flere dokumenter senere.','Bruk dette dokumentet','Bruk disse dokumentene'],
 pl:['Zrób wyraźne zdjęcie rachunku lub zestawienia świadczeń.','Dodaj rachunek, zestawienie świadczeń lub oba dokumenty. Więcej dokumentów możesz dodać później.','Użyj tego dokumentu','Użyj tych dokumentów'],
 cs:['Vyfoťte čitelně účet nebo přehled pojistného plnění.','Přidejte účet, přehled pojistného plnění nebo obojí. Další dokumenty můžete přidat později.','Použít tento dokument','Použít tyto dokumenty'],
 sk:['Odfoťte čitateľne účet alebo prehľad poistného plnenia.','Pridajte účet, prehľad poistného plnenia alebo oboje. Ďalšie dokumenty môžete pridať neskôr.','Použiť tento dokument','Použiť tieto dokumenty'],
 hu:['Készítsen jól olvasható képet a számláról vagy a biztosítási elszámolásról.','Adjon hozzá számlát, biztosítási elszámolást vagy mindkettőt. Később további dokumentumokat is hozzáadhat.','Dokumentum használata','Dokumentumok használata'],
 ro:['Fotografiază clar factura sau decontul de asigurare.','Adaugă o factură, un decont de asigurare sau ambele. Poți adăuga alte documente mai târziu.','Folosește acest document','Folosește aceste documente'],
 el:['Φωτογραφίστε καθαρά τον λογαριασμό ή την ανάλυση ασφαλιστικών παροχών.','Προσθέστε λογαριασμό, ανάλυση παροχών ή και τα δύο. Μπορείτε να προσθέσετε έγγραφα αργότερα.','Χρήση αυτού του εγγράφου','Χρήση αυτών των εγγράφων'],
 ru:['Сделайте чёткое фото счёта или страховой выписки.','Добавьте счёт, страховую выписку или оба документа. Другие документы можно добавить позже.','Использовать этот документ','Использовать эти документы'],
 uk:['Зробіть чітке фото рахунку або страхової виписки.','Додайте рахунок, страхову виписку або обидва документи. Інші документи можна додати пізніше.','Використати цей документ','Використати ці документи'],
 tr:['Faturanın veya sigorta ödeme dökümünün net bir fotoğrafını çekin.','Fatura, sigorta ödeme dökümü veya ikisini birden ekleyin. Daha sonra başka belgeler ekleyebilirsiniz.','Bu belgeyi kullan','Bu belgeleri kullan'],
 id:['Ambil foto tagihan atau rincian manfaat asuransi yang jelas.','Tambahkan tagihan, rincian manfaat asuransi, atau keduanya. Anda dapat menambahkan dokumen lain nanti.','Gunakan dokumen ini','Gunakan dokumen-dokumen ini'],
 ms:['Ambil foto bil atau penyata manfaat insurans yang jelas.','Tambah bil, penyata manfaat insurans atau kedua-duanya. Anda boleh menambah dokumen lain kemudian.','Gunakan dokumen ini','Gunakan dokumen-dokumen ini'],
 th:['ถ่ายภาพใบเรียกเก็บเงินหรือคำอธิบายผลประโยชน์ประกันให้ชัดเจน','เพิ่มใบเรียกเก็บเงิน คำอธิบายผลประโยชน์ประกัน หรือทั้งสองอย่าง คุณสามารถเพิ่มเอกสารภายหลังได้','ใช้เอกสารนี้','ใช้เอกสารเหล่านี้'],
 vi:['Chụp rõ hóa đơn hoặc bảng giải thích quyền lợi bảo hiểm.','Thêm hóa đơn, bảng giải thích quyền lợi hoặc cả hai. Bạn có thể thêm tài liệu sau.','Dùng tài liệu này','Dùng các tài liệu này'],
 'pt-PT':['Fotografe claramente a fatura ou o extrato de benefícios do seguro.','Adicione uma fatura, um extrato de benefícios ou ambos. Pode adicionar mais documentos depois.','Usar este documento','Usar estes documentos'],
};
for(const [locale,values]of Object.entries(rows)){
 const p=path.join(root,locale+'.json');const catalog=JSON.parse(fs.readFileSync(p,'utf8'));
 keys.forEach((key,i)=>catalog[key]=values[i]);
 const search={'zh-Hans':'给付说明、免赔额、申诉…','zh-Hant':'給付明細、自付額、申訴…',ja:'給付明細、免責金額、異議申し立て…'}[locale];
 if(search)catalog['EOB, deductible, appeal…']=search;
 fs.writeFileSync(p,JSON.stringify(catalog,null,2)+'\n');
}
