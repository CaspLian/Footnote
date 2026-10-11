"""One private development agent; no outbound calls, server tools or uploads."""
from __future__ import annotations

from pathlib import Path

try:
    from ..text_to_speech.voices import load_catalog
except ImportError:
    from text_to_speech.voices import load_catalog

AGENT_NAME = "Footnote Bill Helper"
LLM = "gemini-3.5-flash"
CLIENT_TOOL_NAMES = ("show_line_item", "show_price_check")
PRIVACY_NOTICE = ("The bill details and everything said in this call go to ElevenLabs, "
                  "which uses Google's Gemini, and ElevenLabs keeps them for 7 days.")
ALLOWED_OVERRIDES = {"agent": {"language": True, "first_message": True}, "tts": {"voice_id": True},
                     "conversation": {"text_only": True}, "asr": {"keywords": True}}
CLIENT_EVENTS = ["conversation_initiation_metadata", "ping", "audio", "interruption", "user_transcript",
                 "agent_response", "agent_response_correction", "agent_chat_response_part",
                 "agent_response_complete", "client_tool_call", "agent_tool_response", "client_error"]
GREETINGS = {
    "en": "Hi! I'm the Footnote helper. What would you like to know about your bill?",
    "es": "¡Hola! Soy el asistente de Footnote. ¿Qué le gustaría saber sobre su factura?",
    "fr": "Bonjour ! Je suis l'assistant Footnote. Que souhaitez-vous savoir sur votre facture ?",
    "pt": "Olá! Sou o assistente Footnote. O que gostaria de saber sobre a sua fatura?",
    "pt-br": "Olá! Sou o assistente Footnote. O que você gostaria de saber sobre sua conta?",
    "de": "Hallo! Ich bin der Footnote-Assistent. Was möchten Sie über Ihre Rechnung wissen?",
    "it": "Ciao! Sono l'assistente Footnote. Cosa vorrebbe sapere sulla sua fattura?",
    "nl": "Hallo! Ik ben de Footnote-assistent. Wat wilt u weten over uw rekening?",
    "pl": "Dzień dobry! Jestem asystentem Footnote. Co chce Pan lub Pani wiedzieć o rachunku?",
    "sv": "Hej! Jag är Footnote-assistenten. Vad vill du veta om din faktura?",
    "da": "Hej! Jeg er Footnote-assistenten. Hvad vil du vide om din regning?",
    "no": "Hei! Jeg er Footnote-assistenten. Hva vil du vite om regningen din?",
    "fi": "Hei! Olen Footnote-avustaja. Mitä haluaisit tietää laskustasi?",
    "tr": "Merhaba! Ben Footnote yardımcısıyım. Faturanız hakkında ne bilmek istersiniz?",
    "id": "Halo! Saya asisten Footnote. Apa yang ingin Anda ketahui tentang tagihan Anda?",
    "ms": "Hai! Saya pembantu Footnote. Apakah yang ingin anda tahu tentang bil anda?",
    "tl": "Kumusta! Ako ang katulong ng Footnote. Ano ang gusto mong malaman tungkol sa iyong bill?",
    "vi": "Xin chào! Tôi là trợ lý Footnote. Bạn muốn biết gì về hóa đơn của mình?",
    "ja": "こんにちは。Footnoteのアシスタントです。請求書について何を知りたいですか？",
    "zh": "您好！我是Footnote助手。关于您的账单，您想了解什么？",
    "ko": "안녕하세요! Footnote 도우미입니다. 청구서에 대해 무엇을 알고 싶으신가요?",
    "hi": "नमस्ते! मैं Footnote सहायक हूँ। आप अपने बिल के बारे में क्या जानना चाहते हैं?",
    "ta": "வணக்கம்! நான் Footnote உதவியாளர். உங்கள் கட்டணப் பட்டியல் பற்றி என்ன தெரிந்துகொள்ள விரும்புகிறீர்கள்?",
    "ar": "مرحبًا! أنا مساعد Footnote. ماذا تريد أن تعرف عن فاتورتك؟",
    "ru": "Здравствуйте! Я помощник Footnote. Что вы хотите узнать о своём счёте?",
    "uk": "Вітаю! Я помічник Footnote. Що ви хочете дізнатися про свій рахунок?",
    "bg": "Здравейте! Аз съм помощникът на Footnote. Какво искате да знаете за сметката си?",
    "ro": "Bună! Sunt asistentul Footnote. Ce doriți să aflați despre factura dumneavoastră?",
    "cs": "Dobrý den! Jsem pomocník Footnote. Co chcete vědět o svém účtu?",
    "el": "Γεια σας! Είμαι ο βοηθός Footnote. Τι θα θέλατε να μάθετε για τον λογαριασμό σας;",
    "hr": "Dobar dan! Ja sam pomoćnik Footnote. Što želite znati o svom računu?",
    "sk": "Dobrý deň! Som pomocník Footnote. Čo chcete vedieť o svojom účte?",
    "hu": "Üdvözlöm! A Footnote segítője vagyok. Mit szeretne tudni a számlájáról?",
}
# Not Hebrew or Thai: v4 Turbo speaks both, but agents accept preset languages only from Flash's list
# (ElevenLabs refused "he" and "th" presets on 2026-10-11), so the app says live calls are unavailable in them.
# A conversation about a Guide term starts with no greeting: once connected, the app sends this request in the
# call's language, and the agent answers it by explaining the term (guide_topic) in that language.
GUIDE_OPENERS = {
    "en": "Please explain this term in simple words, with a short example.",
    "es": "Explícame este término con palabras sencillas y un ejemplo corto, por favor.",
    "fr": "Expliquez-moi ce terme avec des mots simples et un court exemple, s'il vous plaît.",
    "pt": "Explique-me este termo em palavras simples, com um pequeno exemplo, por favor.",
    "pt-br": "Me explique este termo com palavras simples e um exemplo curto, por favor.",
    "de": "Bitte erklären Sie mir diesen Begriff in einfachen Worten, mit einem kurzen Beispiel.",
    "it": "Spiegami questo termine con parole semplici e un breve esempio, per favore.",
    "nl": "Leg deze term alsjeblieft uit in eenvoudige woorden, met een kort voorbeeld.",
    "pl": "Proszę wyjaśnić mi to pojęcie prostymi słowami, z krótkim przykładem.",
    "sv": "Förklara gärna det här begreppet med enkla ord och ett kort exempel.",
    "da": "Forklar venligst dette begreb med enkle ord og et kort eksempel.",
    "no": "Forklar dette begrepet med enkle ord og et kort eksempel, takk.",
    "fi": "Selitä tämä termi yksinkertaisin sanoin ja lyhyen esimerkin avulla.",
    "tr": "Lütfen bu terimi basit kelimelerle ve kısa bir örnekle açıklayın.",
    "id": "Tolong jelaskan istilah ini dengan kata-kata sederhana dan contoh singkat.",
    "ms": "Sila terangkan istilah ini dengan perkataan yang mudah dan contoh ringkas.",
    "tl": "Pakipaliwanag ang terminong ito sa simpleng salita, na may maikling halimbawa.",
    "vi": "Hãy giải thích thuật ngữ này bằng lời đơn giản, kèm một ví dụ ngắn.",
    "ja": "この用語を、短い例を挙げてわかりやすく説明してください。",
    "zh": "请用简单的话解释这个术语，并举一个简短的例子。",
    "ko": "이 용어를 쉬운 말로, 짧은 예를 들어 설명해 주세요.",
    "hi": "कृपया इस शब्द को आसान शब्दों में, एक छोटे उदाहरण के साथ समझाइए।",
    "ta": "இந்தச் சொல்லை எளிய வார்த்தைகளில், ஒரு சிறிய எடுத்துக்காட்டுடன் விளக்குங்கள்.",
    "ar": "من فضلك اشرح لي هذا المصطلح بكلمات بسيطة مع مثال قصير.",
    "ru": "Пожалуйста, объясните этот термин простыми словами и приведите короткий пример.",
    "uk": "Будь ласка, поясніть цей термін простими словами й наведіть короткий приклад.",
    "bg": "Моля, обяснете ми този термин с прости думи и кратък пример.",
    "ro": "Vă rog să-mi explicați acest termen în cuvinte simple, cu un exemplu scurt.",
    "cs": "Vysvětlete mi prosím tento pojem jednoduchými slovy a krátkým příkladem.",
    "el": "Εξηγήστε μου, παρακαλώ, αυτόν τον όρο με απλά λόγια και ένα σύντομο παράδειγμα.",
    "hr": "Molim vas, objasnite mi ovaj pojam jednostavnim riječima i kratkim primjerom.",
    "sk": "Vysvetlite mi, prosím, tento pojem jednoduchými slovami a krátkym príkladom.",
    "hu": "Kérem, magyarázza el ezt a fogalmat egyszerű szavakkal, egy rövid példával.",
}


def agent_language(locale: str) -> str:
    if locale == "pt-BR":
        return "pt-br"
    base = locale.split("-")[0]
    language = {"fil": "tl", "nb": "no"}.get(base, base)
    if language not in GREETINGS:
        raise ValueError("The conversation agent does not support this language.")
    return language


def greeting_for_locale(locale: str) -> str:
    if locale == "zh-TW":
        return "您好！我是Footnote助手。關於您的帳單，您想了解什麼？"
    return GREETINGS[agent_language(locale)]


def guide_opener_for_locale(locale: str) -> str:
    if locale == "zh-TW":
        return "請用簡單的話解釋這個術語，並舉一個簡短的例子。"
    return GUIDE_OPENERS[agent_language(locale)]



def tool_configs() -> list[dict]:
    descriptions = ["Shows one line of the bill on the person's screen. Use it when discussing a specific charge.",
                    "Shows the Medicare reference for one charge on the person's screen. Use it when discussing that line's price check."]
    return [{"type": "client", "name": name, "description": description,
             "parameters": {"type": "object", "required": ["line_number"],
                            "properties": {"line_number": {"type": "integer", "description": "The bill line number counting from 1."}}},
             "expects_response": False, "execution_mode": "immediate", "pre_tool_speech": "off"}
            for name, description in zip(CLIENT_TOOL_NAMES, descriptions)]


def agent_body(tool_ids: list[str]) -> dict:
    catalog = load_catalog()
    presets = {}
    for language, greeting in GREETINGS.items():
        if language == "en":
            continue
        locale = {"pt-br": "pt-BR", "tl": "fil-PH", "no": "nb-NO"}.get(language, language)
        presets[language] = {"overrides": {"agent": {"first_message": greeting},
                                          "tts": {"model_id": "eleven_flash_v2_5", "voice_id": catalog.default_for(locale).voice_id}}}
    return {"name": AGENT_NAME, "tags": ["footnote", "private"],
            "conversation_config": {
                "agent": {"language": "en", "first_message": GREETINGS["en"],
                          "dynamic_variables": {"dynamic_variable_placeholders": {
                              "language_name": "English (United States)", "today": "2026-10-10", "bill_loaded": "yes",
                              "bill_facts": "Synthetic hospital bill. Total billed $1,200.00. Amount owed not shown.",
                              "bill_lines": "Line 1: Emergency room visit. Code 99284. Billed $1,200.00.",
                              "price_check": "Only the doctor's part is compared. The hospital charge cannot be judged.",
                              "bill_summary": "This is a synthetic emergency-room bill.", "questions_to_ask": "Can I get an itemized bill?",
                              "guide_topic": "none"}},
                          "prompt": {"prompt": Path(__file__).with_name("system_prompt.md").read_text(encoding="utf-8"),
                                     "llm": LLM, "temperature": 0.2, "tool_ids": tool_ids,
                                     "backup_llm_config": {"preference": "override", "order": ["gemini-3.5-flash-lite", "gemini-2.5-flash"]},
                                     "built_in_tools": {
                                         "end_call": {"type": "system", "name": "end_call", "description": "", "params": {"system_tool_type": "end_call"}},
                                         "language_detection": {"type": "system", "name": "language_detection", "description": "",
                                                                "params": {"system_tool_type": "language_detection", "only_at_conversation_start": False}}}}},
                # The live Agents API requires Flash/Turbo v2 for its English base agent.
                # Non-English language presets above use multilingual Flash v2.5.
                "tts": {"model_id": "eleven_flash_v2", "voice_id": catalog.default.voice_id, "text_normalisation_type": "system_prompt"},
                "asr": {"provider": "scribe_realtime", "quality": "high", "keywords": ["Footnote", "Medicare"]},
                "turn": {"turn_timeout": 15, "turn_eagerness": "patient", "silence_end_call_timeout": 120},
                "conversation": {"max_duration_seconds": 600, "file_input": {"enabled": False}, "client_events": CLIENT_EVENTS},
                "language_presets": presets},
            "platform_settings": {"auth": {"enable_auth": True},
                                  "overrides": {"conversation_config_override": ALLOWED_OVERRIDES},
                                  "privacy": {"record_voice": False, "retention_days": 7}, "analysis_llm": "gemini-2.5-flash",
                                  "call_limits": {"agent_concurrency_limit": 4, "daily_limit": 60, "bursting_enabled": False},
                                  "queueing_config": {"enabled": False}}}
