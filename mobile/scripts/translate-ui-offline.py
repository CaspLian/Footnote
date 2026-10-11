"""Build bundled UI catalogs locally. This script never makes network requests.
Usage: python translate-ui-offline.py /path/to/pinned-nllb-ct2-model [--fresh] [--languages=es,fr] [--threads=3]
Build-only dependencies: ctranslate2, sentencepiece, opencc-python-reimplemented.
Model: JustFrederik/nllb-200-distilled-600M-ct2-int8, revision
302d78f00e6fdb50a1064059df7c392b735e9d05. The model is not part of the app.
Generated translations need native-speaker review before public production use.
"""
import json, re, sys, time
from pathlib import Path
import ctranslate2
import sentencepiece
from opencc import OpenCC
folder = Path(__file__).resolve().parents[1] / 'src/localization'
source = json.loads((folder / 'en.json').read_text())
langs = {
 'es':'spa_Latn', 'fr':'fra_Latn', 'de':'deu_Latn', 'it':'ita_Latn',
 'zh-Hans':'zho_Hans', 'zh-Hant':'zho_Hant', 'ja':'jpn_Jpan', 'ko':'kor_Hang',
 'hi':'hin_Deva', 'ar':'arb_Arab', 'he':'heb_Hebr', 'nl':'nld_Latn', 'sv':'swe_Latn',
 'da':'dan_Latn', 'fi':'fin_Latn', 'no':'nob_Latn', 'pl':'pol_Latn', 'cs':'ces_Latn',
 'sk':'slk_Latn', 'hu':'hun_Latn', 'ro':'ron_Latn', 'el':'ell_Grek', 'ru':'rus_Cyrl',
 'uk':'ukr_Cyrl', 'tr':'tur_Latn', 'id':'ind_Latn', 'ms':'zsm_Latn', 'th':'tha_Thai',
 'vi':'vie_Latn', 'pt-PT':'por_Latn',
}
sp = sentencepiece.SentencePieceProcessor(model_file=str(Path(sys.argv[1]) / 'sentencepiece.bpe.model'))
selected = next((arg.split('=', 1)[1].split(',') for arg in sys.argv[2:] if arg.startswith('--languages=')), None)
threads = int(next((arg.split('=', 1)[1] for arg in sys.argv[2:] if arg.startswith('--threads=')), '6'))
translator = ctranslate2.Translator(sys.argv[1], device='cpu', compute_type='int8', intra_threads=threads)
cc = OpenCC('s2twp')
protected = re.compile(r'\{\d+\}|\b(?:Footnote|Unfold|Gemini|ElevenLabs|Snowflake|Tiger Data|Medicare|Face ID|Touch ID|PDFs?|EOB|USD|ZIP|CPT|HCPCS)\b|(?<!\w)\$?\d+(?:[.,]\d+)*(?:%|\b)')
context_labels = {
 'Statement balance':'Outstanding amount on the medical bill',
 'Patient responsibility':'Amount owed by the patient',
 'Allowed amount':'Amount approved by the insurance plan',
 'Insurer payment':'Payment made by the insurance company',
 'Prior patient payments':'Payments already made by the patient',
 'Remaining responsibility':'Remaining amount owed by the patient',
 'Patient balance':'Amount owed by the patient',
 'Charges':'Medical charges',
 'Bill':'Medical bill', 'Bills':'Medical bills',
 'Policy':'Insurance policy', 'Coverage':'Health insurance coverage',
 'Claim':'Health insurance claim', 'Appeal':'Insurance appeal',
}
def context(text):
 text = context_labels.get(text, text)
 text = re.sub(r'\bbills\b', 'medical bills', text, flags=re.I)
 text = re.sub(r'(?<!medical )\bbill\b', 'medical bill', text, flags=re.I)
 text = re.sub(r'(?<!medical )\bcharges\b', 'medical charges', text, flags=re.I)
 return text

def infer(texts, target):
 if not texts: return []
 result = translator.translate_batch([sp.encode(context(s), out_type=str) + ['</s>', 'eng_Latn'] for s in texts], target_prefix=[[target]] * len(texts), beam_size=2, max_batch_size=8, max_decoding_length=256)
 return [sp.decode(value.hypotheses[0][1:]).strip().replace('\u2014', ' · ') for value in result]

def tokens(text): return sorted(protected.findall(text))
for code, target_language in langs.items():
 if selected is not None and code not in selected: continue
 path = folder / (code + '.json')
 catalog = json.loads(path.read_text()) if path.exists() and '--fresh' not in sys.argv else {}
 keys = [key for key in source if key not in catalog or tokens(key) != tokens(catalog[key]) or '--repair' in sys.argv and catalog[key] == key and len(key)>20]
 if not keys: continue
 started = time.time()
 result = infer(keys, target_language)
 recovered = 0
 for key, text in zip(keys, result):
  if tokens(key) != tokens(text):
   # Preserve interpolation data, amounts and proper nouns even if the model alters them.
   chunks = protected.split(key)
   spans = [span.strip() for span in chunks if re.search(r'[A-Za-z]', span)]
   translated = iter(infer(spans, target_language))
   pieces = []
   ends = 0
   for match in protected.finditer(key):
    before = key[ends:match.start()]
    if re.search(r'[A-Za-z]', before):pieces.append((' ' if before.startswith(' ') else '') + next(translated) + (' ' if before.endswith(' ') else ''))
    else:pieces.append(before)
    pieces.append(match.group());ends = match.end()
   after = key[ends:]
   if re.search(r'[A-Za-z]', after):pieces.append((' ' if after.startswith(' ') else '') + next(translated) + (' ' if after.endswith(' ') else ''))
   else:pieces.append(after)
   text = ''.join(pieces)
   for token in protected.findall(key):
    if re.search(r'[A-Za-z0-9]$', token):text = re.sub(re.escape(token) + r'(?=[A-Za-zÀ-ž])', token + ' ', text)
   recovered += 1
  if code == 'zh-Hant':text = cc.convert(text)
  if tokens(key) != tokens(text):
   print('Review required:', code, repr(key), repr(text), flush=True)
   text = key # Never change an amount or product name to fill coverage.
  catalog[key] = text or key
 assert all(tokens(key) == tokens(catalog[key]) for key in source), code
 path.write_text(json.dumps({key:catalog[key] for key in source}, ensure_ascii=False, indent=2) + '\n')
 print(code, len(keys), 'new messages', round(time.time() - started, 1), 'seconds', recovered, 'protected-value repairs', flush=True)
