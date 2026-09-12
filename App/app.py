from pinecone import Pinecone
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from sentence_transformers import SentenceTransformer
from groq import Groq
from tqdm import tqdm
import os
import dotenv
import fitz  # PyMuPDF for PDF text extraction
from io import BytesIO
from textwrap import wrap
from supabase import create_client, Client
import logging
import hashlib

try:
    from google.cloud import texttospeech
except Exception:
    texttospeech = None

try:
    from gtts import gTTS
except Exception:
    gTTS = None

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("hpack").setLevel(logging.WARNING)
logging.getLogger("groq").setLevel(logging.WARNING)

app = Flask(__name__)

# Configure CORS
CORS(app, resources={
    r"/*": {
        "origins": ["https://law-pal.vercel.app", "http://localhost:5173"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "X-User-ID"],
    }
})

dotenv.load_dotenv()

# Initialize Pinecone
PINECONE_API_KEY = os.getenv("PINECONE_API")
PINECONE_ENV = os.getenv("PINECONE_ENV", "us-east-1")
if not PINECONE_API_KEY:
    raise ValueError("Missing Pinecone API Key.")
pc = Pinecone(api_key=PINECONE_API_KEY)

# Initialize Sentence Transformer Model
model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")

# Initialize Groq
GROQ_API_KEY = os.getenv("GROQ_API")
if not GROQ_API_KEY:
    raise ValueError("Missing Groq API Key.")
groq_client = Groq(api_key=GROQ_API_KEY)

# Initialize Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase URL or Key.")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Store conversation history
conversation_histories = {
    "personal-and-family-legal-assistance": {},
    "business-consumer-and-criminal-legal-assistance": {},
    "consultation": {},
}

GCP_TTS_VOICE_MAP = {
    "en-US": {"language_code": "en-US", "voice_name": "en-US-Standard-C"},
    "hi-IN": {"language_code": "hi-IN", "voice_name": "hi-IN-Standard-A"},
    "ta-IN": {"language_code": "ta-IN", "voice_name": "ta-IN-Standard-A"},
    "te-IN": {"language_code": "te-IN", "voice_name": "te-IN-Standard-A"},
    "kn-IN": {"language_code": "kn-IN", "voice_name": "kn-IN-Standard-A"},
    "ml-IN": {"language_code": "ml-IN", "voice_name": "ml-IN-Standard-A"},
    "gu-IN": {"language_code": "gu-IN", "voice_name": "gu-IN-Standard-A"},
    "mr-IN": {"language_code": "mr-IN", "voice_name": "mr-IN-Standard-A"},
    "bn-IN": {"language_code": "bn-IN", "voice_name": "bn-IN-Standard-A"},
    "pa-IN": {"language_code": "pa-IN", "voice_name": "pa-IN-Standard-A"},
    "ur-IN": {"language_code": "ur-IN", "voice_name": "ur-IN-Standard-A"},
    "as-IN": {"language_code": "as-IN", "voice_name": "as-IN-Standard-A"},
    "or-IN": {"language_code": "or-IN", "voice_name": "or-IN-Standard-A"},
    "ne-IN": {"language_code": "ne-NP", "voice_name": "ne-NP-Standard-A"},
    "ne-NP": {"language_code": "ne-NP", "voice_name": "ne-NP-Standard-A"},
}


def _normalize_tts_language(lang: str) -> str:
    if not lang:
        return "en-US"
    normalized = str(lang).strip()
    if normalized in GCP_TTS_VOICE_MAP:
        return normalized
    base = normalized.split("-")[0].lower()
    if base == "en":
        return "en-US"
    if base == "hi":
        return "hi-IN"
    if base == "ta":
        return "ta-IN"
    if base == "te":
        return "te-IN"
    if base == "kn":
        return "kn-IN"
    if base == "ml":
        return "ml-IN"
    if base == "gu":
        return "gu-IN"
    if base == "mr":
        return "mr-IN"
    if base == "bn":
        return "bn-IN"
    if base == "pa":
        return "pa-IN"
    if base == "ur":
        return "ur-IN"
    if base == "as":
        return "as-IN"
    if base == "or":
        return "or-IN"
    if base == "ne":
        return "ne-IN"
    return "en-US"


def synthesize_google_tts(text: str, language: str):
    if texttospeech is None:
        return None, "google-cloud-texttospeech is not installed on the server."
    clean_text = (text or "").strip()
    if not clean_text:
        return None, "No text provided for speech synthesis."
    if len(clean_text) > 4500:
        clean_text = clean_text[:4500]

    language_key = _normalize_tts_language(language)
    voice_cfg = GCP_TTS_VOICE_MAP[language_key]
    try:
        client = texttospeech.TextToSpeechClient()
        synthesis_input = texttospeech.SynthesisInput(text=clean_text)
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=0.92,
        )
        try:
            voice = texttospeech.VoiceSelectionParams(
                language_code=voice_cfg["language_code"],
                name=voice_cfg["voice_name"],
                ssml_gender=texttospeech.SsmlVoiceGender.NEUTRAL,
            )
            response = client.synthesize_speech(
                input=synthesis_input,
                voice=voice,
                audio_config=audio_config,
            )
        except Exception:
            voice = texttospeech.VoiceSelectionParams(
                language_code=voice_cfg["language_code"],
                ssml_gender=texttospeech.SsmlVoiceGender.NEUTRAL,
            )
            response = client.synthesize_speech(
                input=synthesis_input,
                voice=voice,
                audio_config=audio_config,
            )
        audio_bytes = response.audio_content or b""
        if not audio_bytes:
            return None, "Google Cloud TTS returned empty audio."
        return audio_bytes, None
    except Exception as e:
        logger.warning("Google Cloud TTS failed: %s", str(e))
        return None, f"Google Cloud TTS failed: {str(e)}"


GTTS_LANGUAGE_MAP = {
    "en-US": "en",
    "hi-IN": "hi",
    "ta-IN": "ta",
    "te-IN": "te",
    "kn-IN": "kn",
    "ml-IN": "ml",
    "gu-IN": "gu",
    "mr-IN": "mr",
    "bn-IN": "bn",
    "pa-IN": "pa",
    "ur-IN": "ur",
    "as-IN": "as",
    "or-IN": "or",
    "ne-IN": "ne",
    "ne-NP": "ne",
}


def synthesize_gtts(text: str, language: str):
    if gTTS is None:
        return None, "gTTS fallback is not installed on the server."

    clean_text = (text or "").strip()
    if not clean_text:
        return None, "No text provided for speech synthesis."
    if len(clean_text) > 4500:
        clean_text = clean_text[:4500]

    language_key = _normalize_tts_language(language)
    gtts_lang = GTTS_LANGUAGE_MAP.get(language_key, "en")

    try:
        audio_buffer = BytesIO()
        tts = gTTS(text=clean_text, lang=gtts_lang, slow=False)
        tts.write_to_fp(audio_buffer)
        audio_bytes = audio_buffer.getvalue()
        if not audio_bytes:
            return None, "gTTS returned empty audio."
        return audio_bytes, None
    except Exception as e:
        logger.warning("gTTS fallback failed: %s", str(e))
        return None, f"gTTS fallback failed: {str(e)}"


def _env_flag(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return str(raw).strip().lower() in {"1", "true", "yes", "on"}


# If true, skip Google TTS and use gTTS directly.
TTS_USE_GTTS_ONLY = _env_flag("TTS_USE_GTTS_ONLY", default=False)

# Cache generated audio by text+language for instant repeat playback.
TTS_AUDIO_CACHE = {}
TTS_AUDIO_CACHE_MAX_ITEMS = int(os.getenv("TTS_AUDIO_CACHE_MAX_ITEMS", "300"))


def _tts_cache_key(text: str, language: str) -> str:
    normalized_text = (text or "").strip()
    normalized_language = _normalize_tts_language(language)
    digest = hashlib.sha256(f"{normalized_language}::{normalized_text}".encode("utf-8")).hexdigest()
    return digest


def _tts_cache_get(key: str):
    audio = TTS_AUDIO_CACHE.get(key)
    if audio is None:
        return None
    # Touch key to keep recently used entries.
    TTS_AUDIO_CACHE.pop(key, None)
    TTS_AUDIO_CACHE[key] = audio
    return audio


def _tts_cache_set(key: str, audio: bytes):
    if not audio:
        return
    if key in TTS_AUDIO_CACHE:
        TTS_AUDIO_CACHE.pop(key, None)
    TTS_AUDIO_CACHE[key] = audio
    while len(TTS_AUDIO_CACHE) > TTS_AUDIO_CACHE_MAX_ITEMS:
        oldest_key = next(iter(TTS_AUDIO_CACHE), None)
        if oldest_key is None:
            break
        TTS_AUDIO_CACHE.pop(oldest_key, None)


@app.route('/tts', methods=['POST', 'OPTIONS'])
def synthesize_tts_route():
    if request.method == 'OPTIONS':
        response = jsonify({"message": "CORS preflight successful"})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        return response, 200

    if not request.is_json:
        return jsonify({"error": "Request must be JSON."}), 400
    data = request.get_json(silent=True) or {}
    text = data.get("text", "")
    language = data.get("language", "en-US")
    normalized_language = _normalize_tts_language(language)
    cache_key = _tts_cache_key(text, language)
    cached_audio = _tts_cache_get(cache_key)
    if cached_audio:
        return send_file(
            BytesIO(cached_audio),
            mimetype="audio/mpeg",
            as_attachment=False,
            download_name="tts.mp3",
        )

    # Malayalam path: bypass Google TTS and use gTTS directly.
    # This avoids Google ADC warnings for ml-IN and improves reliability.
    use_gtts_direct = TTS_USE_GTTS_ONLY or normalized_language == "ml-IN"

    if use_gtts_direct:
        audio_bytes, error = synthesize_gtts(text=text, language=language)
        if error:
            return jsonify({"error": error}), 503
    else:
        audio_bytes, error = synthesize_google_tts(text=text, language=language)
        if error:
            logger.warning("Primary Google TTS failed, trying gTTS fallback: %s", error)
            audio_bytes, gtts_error = synthesize_gtts(text=text, language=language)
            if gtts_error:
                return jsonify({"error": f"{error} | {gtts_error}"}), 503
    _tts_cache_set(cache_key, audio_bytes)
    return send_file(
        BytesIO(audio_bytes),
        mimetype="audio/mpeg",
        as_attachment=False,
        download_name="tts.mp3",
    )

@app.route('/submit-form', methods=['POST'])
def submit_form():
    try:
        # Log the incoming request data
        logger.debug("Received form data: %s", request.get_data())

        # Check if request has JSON data
        if not request.is_json:
            return jsonify({"error": "Request must be JSON"}), 400

        data = request.get_json()
        logger.debug("Parsed JSON data: %s", data)

        # Validate required fields
        required_fields = ["firstName", "lastName", "email", "subject", "message"]
        if not all(field in data and data[field] for field in required_fields):
            return jsonify({"error": "Missing or empty required fields"}), 400

        # Insert data into Supabase
        response = supabase.table("user_forms").insert(data).execute()
        logger.debug("Supabase response: %s", response)

        if response.status_code == 201:
            return jsonify({"message": "Form submitted successfully!"}), 201
        else:
            return jsonify({"error": response.get("message", "Failed to store data in Supabase")}), 500

    except Exception as e:
        logger.error("Error in submit_form: %s", str(e), exc_info=True)
        # Check if the table exists and create it if it doesn't
        try:
            # This is a basic check; adjust schema as needed
            supabase.table("user_forms").select("*").limit(1).execute()
        except Exception as table_error:
            logger.error("Table 'user_forms' issue: %s", str(table_error), exc_info=True)
            return jsonify({"error": "Database table 'user_forms' not found or misconfigured. Contact administrator."}), 500
        return jsonify({"error": str(e)}), 500

# Function to extract text from PDFs in Supabase bucket
def extract_text_from_pdfs(bucket_name: str):
    all_texts = []
    chunk_size = 1000
    try:
        files = supabase.storage.from_(bucket_name).list()
        if not files or not isinstance(files, list) or len(files) == 0:
            print(f"No files found in bucket: {bucket_name}")
            return all_texts
    except Exception as e:
        print(f"Error listing files in Supabase bucket {bucket_name}: {e}")
        return all_texts

    for file in tqdm(files, desc="Processing PDFs from Supabase"):
        if file["name"].endswith(".pdf"):
            try:
                pdf_data = supabase.storage.from_(bucket_name).download(file["name"])
                doc = fitz.open("pdf", pdf_data)
                text_chunks = []
                for page in doc:
                    page_text = page.get_text("text")
                    if not page_text.strip():
                        page_dict = page.get_text("dict")
                        page_text = " ".join(block["text"] for block in page_dict.get("blocks", []) if block.get("type") == 0)
                    if not page_text.strip():
                        page_dict = page.get_text("rawdict")
                        page_text = " ".join(block["text"] for block in page_dict.get("blocks", []) if block.get("type") == 0)
                    if not page_text.strip():
                        continue
                    chunks = wrap(page_text, chunk_size)
                    text_chunks.extend(chunks)
                for i, chunk in enumerate(text_chunks):
                    if chunk.strip():
                        all_texts.append({"filename": f"{file['name']}_chunk_{i}", "text": chunk})
            except Exception as e:
                print(f"Error processing {file['name']}: {e}")
    return all_texts

# Function to create Pinecone index
def create_pinecone_index(bucket_name: str):
    index_name = "lawpal"
    existing_indexes = pc.list_indexes().names()
    if index_name not in existing_indexes:
        dimension = 384
        pc.create_index(
            name=index_name,
            dimension=dimension,
            metric="cosine",
            spec={"serverless": {"cloud": "aws", "region": PINECONE_ENV}}
        )
        print("✅ Index created successfully!")
    index = pc.Index(index_name)
    existing_vector_count = index.describe_index_stats()["total_vector_count"]
    if existing_vector_count > 0:
        print(f"ℹ️ Pinecone already has {existing_vector_count} vectors. Skipping processing.")
        return
    docs = extract_text_from_pdfs(bucket_name)
    if not docs:
        print("Error: No documents extracted from Supabase bucket.")
        return
    batch_size = 32
    vectors = []
    texts = [doc["text"] for doc in docs]
    filenames = [doc["filename"] for doc in docs]
    for i in range(0, len(texts), batch_size):
        batch_texts = texts[i:i + batch_size]
        embeddings = model.encode(batch_texts, batch_size=batch_size, show_progress_bar=True)
        for j, embedding in enumerate(embeddings):
            vectors.append((filenames[i + j], embedding.tolist(), {"text": batch_texts[j]}))
    batch_size = 100
    for i in range(0, len(vectors), batch_size):
        batch = vectors[i:i + batch_size]
        index.upsert(vectors=batch)

# Function to retrieve relevant chunks from Pinecone
def retrieve_context(index_name: str, query: str, top_k: int = 3):
    index = pc.Index(index_name)
    query_embedding = model.encode(query).tolist()
    try:
        results = index.query(vector=query_embedding, top_k=top_k, include_metadata=True)
        return [match["metadata"]["text"] for match in results["matches"] if "metadata" in match]
    except Exception as e:
        print(f"Error retrieving from Pinecone: {e}")
        return []

# Function to generate response using Groq
def _contains_script_range(text: str, ranges: list[tuple[int, int]]) -> bool:
    if not text:
        return False
    for ch in text:
        code = ord(ch)
        for start, end in ranges:
            if start <= code <= end:
                return True
    return False

def _response_matches_language(text: str, language: str) -> bool:
    if not text or language == "en-US":
        return True
    script_ranges = {
        "hi-IN": [(0x0900, 0x097F)],
        "mr-IN": [(0x0900, 0x097F)],
        "ne-IN": [(0x0900, 0x097F)],
        "bn-IN": [(0x0980, 0x09FF)],
        "as-IN": [(0x0980, 0x09FF)],
        "pa-IN": [(0x0A00, 0x0A7F)],
        "gu-IN": [(0x0A80, 0x0AFF)],
        "or-IN": [(0x0B00, 0x0B7F)],
        "ta-IN": [(0x0B80, 0x0BFF)],
        "te-IN": [(0x0C00, 0x0C7F)],
        "kn-IN": [(0x0C80, 0x0CFF)],
        "ml-IN": [(0x0D00, 0x0D7F)],
        "ur-IN": [(0x0600, 0x06FF), (0x0750, 0x077F), (0x08A0, 0x08FF)],
    }
    ranges = script_ranges.get(language)
    return True if not ranges else _contains_script_range(text, ranges)

def generate_response(query: str, contexts: list, history: list, service: str, language: str = "en-US"):
    context_str = "\n\n".join(contexts) if contexts else "No specific information found."
    history_str = "\n".join([f"{msg['role']}: {msg['content']}" for msg in history])
    language_map = {
        "hi-IN": "Hindi",
        "ta-IN": "Tamil",
        "te-IN": "Telugu",
        "kn-IN": "Kannada",
        "ml-IN": "Malayalam",
        "gu-IN": "Gujarati",
        "mr-IN": "Marathi",
        "bn-IN": "Bengali",
        "pa-IN": "Punjabi",
        "ur-IN": "Urdu",
        "as-IN": "Assamese",
        "or-IN": "Odia",
        "ne-IN": "Nepali",
        "en-US": "English",
    }
    language_name = language_map.get(language, "English")
    language_instruction = (
        ""
        if language == "en-US"
        else f"\nCRITICAL: Respond ENTIRELY in {language_name}. Use natural everyday {language_name} only."
    )

    prompt = f"""
You are an Indian law assistant that must strictly reference the post-2023 criminal law codes:
 - Bharatiya Nyaya Sanhita, 2023 (BNS)
 - Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS)
 - Bharatiya Sakshya Adhiniyam, 2023 (BSA)

Do not cite or mention the older IPC/CrPC/Indian Evidence Act unless explicitly comparing old vs new. Prefer BNS/BNSS/BSA section references with precise section numbers and short quotes where relevant.

Ensure 100% clarity on the user's query using available context and conversation history.

Respond strictly within the framework of Indian {service.replace('-', ' ').title()} laws, rules, and judicial precedents. If insufficient context is available, refer only to verified Indian government laws, schemes, or notifications.

Avoid speculation or general knowledge. Do not provide personal opinions or unverified interpretations under any circumstance.

For queries involving complex legal analysis or calculations:

Proceed only if supported by explicit legal context.

Provide a step-by-step, statute-based explanation, citing BNS/BNSS/BSA where applicable.

Clearly state when the matter requires consultation with a licensed Indian legal professional.

Maintain a professional, factual, and concise tone. Do not use informal language, emotions, or filler content.

Exclude all irrelevant or out-of-context details.

Complete the response with a clear, actionable conclusion or recommendation.

Your responses should be strictly factual, devoid of personal opinions or unverified interpretations. You are not a licensed legal professional and cannot provide legal advice. Always recommend consulting a qualified Indian legal professional for complex matters.

Your sole objective is to deliver clear, compliant, and legally sound information related to Indian {service.replace('-', ' ').title()} Services, with priority references to BNS/BNSS/BSA.
{language_instruction}

Conversation History:
{history_str}

Context:
{context_str}

Query:
{query}

Answer:
"""
    try:
        system_message = (
            f"You are a practical Indian legal assistant. Respond only in {language_name}. "
            "Do not switch to English unless user explicitly asks."
        )
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": prompt}
            ],
            max_tokens=700,
            temperature=0.5
        )
        result = response.choices[0].message.content.strip()

        if language != "en-US" and not _response_matches_language(result, language):
            translation_prompt = (
                f"Translate the following to natural everyday {language_name}. "
                f"Output only {language_name}. Keep legal section references unchanged.\n\nTEXT:\n{result}"
            )
            translated = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": f"You are a strict translator. Output only {language_name}."},
                    {"role": "user", "content": translation_prompt}
                ],
                max_tokens=900,
                temperature=0.2
            )
            translated_text = translated.choices[0].message.content.strip() if translated and translated.choices else ""
            if translated_text and _response_matches_language(translated_text, language):
                result = translated_text

        return result
    except Exception as e:
        print(f"Error generating response: {e}")
        return "AI service temporary failure while generating response. Please retry."

# Common function to handle chat requests
def handle_chat(service: str):
    data = request.json
    query = data.get('query')
    user_id = data.get('user_id', 'default_user')
    language = data.get('language', 'en-US')
    selected_language = data.get('selected_language')
    allowed_langs = {
        "en-US", "hi-IN", "ta-IN", "te-IN", "kn-IN", "ml-IN", "gu-IN",
        "mr-IN", "bn-IN", "pa-IN", "ur-IN", "as-IN", "or-IN", "ne-IN"
    }
    if selected_language in allowed_langs and service in {
        "personal-and-family-legal-assistance",
        "business-consumer-and-criminal-legal-assistance",
        "self-lawyer-guide",
    }:
        language = selected_language
    elif language not in allowed_langs:
        language = "en-US"
    if not query:
        return jsonify({"error": "No query provided"}), 400
    history = conversation_histories[service].setdefault(user_id, [])
    contexts = retrieve_context("lawpal", query)
    try:
        response = generate_response(query, contexts, history, service, language)
        if service == "document-analyser" and isinstance(response, str):
            lower_resp = response.lower()
            known_generation_failures = [
                "encountered an issue generating a response",
                "couldn't generate a response",
                "couldn't generate a proper response",
                "api connection error",
                "request timed out",
                "request too long",
                "quota/rate limit",
                "temporary failure while generating response",
                "encoding failed on server",
            ]
            if any(token in lower_resp for token in known_generation_failures):
                return jsonify({"error": response}), 502
        history.append({"role": "user", "content": query})
        history.append({"role": "bot", "content": response})
        if len(history) > 15:
            conversation_histories[service][user_id] = history[-15:]
        return jsonify({"response": response})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Route for fetching chat history
@app.route('/<service>/history', methods=['GET', 'OPTIONS'])
def get_chat_history(service):
    if request.method == 'OPTIONS':
        response = jsonify({"message": "CORS preflight successful"})
        response.headers.add("Access-Control-Allow-Origin", "https://law-pal.vercel.app")
        response.headers.add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type, X-User-ID")
        return response, 200
    if service not in conversation_histories:
        return jsonify({"error": "Invalid service category"}), 400
    user_id = request.headers.get('X-User-ID', 'default_user')
    history = conversation_histories[service].get(user_id, [])
    if service == "document-analyser" and isinstance(history, list):
        blocked_snippets = [
            "i'm sorry, but i encountered an issue generating a response",
            "i’m sorry, but i encountered an issue generating a response",
            "i apologize, but i couldn't generate a response",
            "i apologize, but i couldn't generate a proper response",
            "api connection error",
            "request timed out",
            "request too long",
            "quota/rate limit",
            "temporary failure while generating response",
            "encoding failed on server",
        ]
        history = [
            item for item in history
            if not (
                isinstance(item, dict)
                and item.get("role") == "bot"
                and any(snippet in str(item.get("content", "")).strip().lower() for snippet in blocked_snippets)
            )
        ]
        conversation_histories[service][user_id] = history
    return jsonify({"history": history}), 200

# Route for chatbot queries
@app.route('/<service>/chat', methods=['POST', 'OPTIONS'])
def chat_service(service):
    if request.method == 'OPTIONS':
        response = jsonify({"message": "CORS preflight successful"})
        response.headers.add("Access-Control-Allow-Origin", "https://law-pal.vercel.app")
        response.headers.add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type, X-User-ID")
        return response, 200
    if service not in conversation_histories:
        return jsonify({"error": "Invalid service category"}), 400
    return handle_chat(service)

if __name__ == "__main__":
    BUCKET_NAME = "pdfs"
    # Run Pinecone index creation only if explicitly enabled
    if os.getenv("CREATE_PINECONE_INDEX", "false").lower() == "true":
        create_pinecone_index(BUCKET_NAME)
    port = int(os.environ.get("PORT", 5000))  # Hugging Face default port
    app.run(host="0.0.0.0", port=port, debug=False)
