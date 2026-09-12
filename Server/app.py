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
from typing import Tuple
import subprocess

try:
    from PIL import Image, ImageOps
except Exception:
    Image = None

try:
    import pytesseract
except Exception:
    pytesseract = None

try:
    import docx
except Exception:
    docx = None

if pytesseract:
    # Configure Tesseract path on Windows if not already available in PATH
    possible_paths = [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    ]
    for path in possible_paths:
        if os.path.exists(path):
            pytesseract.pytesseract.tesseract_cmd = path
            break
    # Prefer a writable tessdata directory inside the Server folder
    server_dir = os.path.dirname(__file__)
    tessdata_dir = os.path.join(server_dir, "tessdata")
    # TESSDATA_PREFIX should point to the parent that contains tessdata/
    os.environ["TESSDATA_PREFIX"] = server_dir
    TESSDATA_DIR = tessdata_dir
    try:
        os.makedirs(tessdata_dir, exist_ok=True)
    except Exception:
        pass
else:
    TESSDATA_DIR = None

TESS_LANG_CACHE = None

def get_tesseract_languages(refresh: bool = False):
    global TESS_LANG_CACHE
    if TESS_LANG_CACHE is not None and not refresh:
        return TESS_LANG_CACHE
    if not pytesseract or not TESSDATA_DIR:
        TESS_LANG_CACHE = []
        return TESS_LANG_CACHE
    try:
        cmd = [pytesseract.pytesseract.tesseract_cmd, "--list-langs", "--tessdata-dir", TESSDATA_DIR]
        output = subprocess.check_output(cmd, text=True)
        langs = []
        for line in output.splitlines():
            line = line.strip()
            if not line or line.lower().startswith("list of available"):
                continue
            langs.append(line)
        TESS_LANG_CACHE = langs
    except Exception:
        TESS_LANG_CACHE = []
    return TESS_LANG_CACHE

print("OCR ready:", "yes" if (Image and pytesseract) else "no")
from textwrap import wrap
from supabase import create_client, Client
from datetime import datetime, timezone
import uuid
import logging
import json
import re
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
    r"/.*": {
        "origins": [
            "https://lexassist-frontend.onrender.com",
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:5175",
            "http://localhost:3000"
        ],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "X-User-ID", "Authorization"],
        "supports_credentials": True
    }
})

# ✅ ADDED: Root route
@app.route('/')
def home():
    return jsonify({
        "message": "LexAssist Backend Server is Running!",
        "status": "success", 
        "service": "AI Legal Assistant",
        "endpoints": {
            "root": "GET /",
            "health": "GET /api/health",
            "submit_form": "POST /submit-form",
            "chat_services": [
                "POST /personal-and-family-legal-assistance/chat",
                "POST /business-consumer-and-criminal-legal-assistance/chat", 
                "POST /consultation/chat",
                "POST /self-lawyer-guide/chat",
                "POST /virtual-courtroom-experience/chat",
                "POST /document-analyser/chat"
            ],
            "chat_history": [
                "GET /personal-and-family-legal-assistance/history",
                "GET /business-consumer-and-criminal-legal-assistance/history",
                "GET /consultation/history",
                "GET /self-lawyer-guide/history",
                "GET /virtual-courtroom-experience/history",
                "GET /document-analyser/history"
            ]
        },
        "models_loaded": {
            "embedding": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
            "llm": "llama-3.3-70b-versatile"
        }
    })

# ✅ ADDED: Health check route
@app.route('/api/health')
def health_check():
    return jsonify({
        "status": "healthy",
        "server": "Flask",
        "pinecone_connected": bool(PINECONE_API_KEY),
        "groq_connected": bool(GROQ_API_KEY),
        "supabase_connected": bool(SUPABASE_URL and SUPABASE_KEY),
        "model_loaded": True
    })


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
    # App dropdown uses ne-IN; Google Cloud uses ne-NP.
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

        # First try with explicit voice name for consistency.
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
            # Fallback to any available voice for that language code.
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

@app.route('/document-analyser/upload', methods=['POST', 'OPTIONS'])
def document_analyser_upload():
    if request.method == 'OPTIONS':
        response = jsonify({"message": "CORS preflight successful"})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type, X-User-ID")
        return response, 200

    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file_storage = request.files["file"]
    ocr_lang = request.form.get("ocr_lang") or "eng"
    text, error = extract_text_from_upload(file_storage, ocr_lang=ocr_lang)
    if error:
        return jsonify({
            "error": error,
            "filename": file_storage.filename,
            "mimetype": file_storage.mimetype,
        }), 400

    trimmed = (text or "").strip()
    if not trimmed:
        return jsonify({"error": "No text could be extracted from the file."}), 400

    # Limit size to avoid oversized prompts
    if len(trimmed) > 12000:
        trimmed = trimmed[:12000] + "\n...[truncated]"

    return jsonify({"text": trimmed}), 200

dotenv.load_dotenv()

# Ensure HuggingFace cache is writable to avoid permission issues
HF_HOME = os.getenv("HF_HOME")
if not HF_HOME:
    HF_HOME = os.path.join(os.path.dirname(__file__), ".hf_cache")
    os.environ["HF_HOME"] = HF_HOME
    os.environ["HUGGINGFACE_HUB_CACHE"] = os.path.join(HF_HOME, "hub")
    os.environ["TRANSFORMERS_CACHE"] = os.path.join(HF_HOME, "transformers")
try:
    os.makedirs(os.environ["HF_HOME"], exist_ok=True)
    os.makedirs(os.environ["HUGGINGFACE_HUB_CACHE"], exist_ok=True)
    os.makedirs(os.environ["TRANSFORMERS_CACHE"], exist_ok=True)
except Exception:
    pass

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
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY
if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase URL or Key.")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Supabase helpers
def safe_supabase_insert(table_name: str, payload):
    try:
        supabase.table(table_name).insert(payload).execute()
    except Exception as e:
        logger.warning("Supabase insert failed for %s: %s", table_name, str(e))

def fetch_latest_chat_history(user_id: str, service: str):
    try:
        response = (
            supabase.table("chat_histories")
            .select("history")
            .eq("user_id", user_id)
            .eq("service", service)
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        if response.data and len(response.data) > 0:
            return response.data[0].get("history") or []
    except Exception as e:
        logger.warning("Supabase fetch history failed: %s", str(e))
    return []

def persist_chat_history(user_id: str, service: str, history: list):
    payload = {
        "user_id": user_id,
        "service": service,
        "history": history,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    safe_supabase_insert("chat_histories", payload)

def normalize_reminder_payload(item, user_id: str):
    return {
        "id": item.get("id") or str(uuid.uuid4()),
        "user_id": user_id,
        "title": item.get("title"),
        "date": item.get("date"),
        "time": item.get("time"),
        "location": item.get("location"),
        "type": item.get("type"),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

# Store conversation history
conversation_histories = {
    "personal-and-family-legal-assistance": {},
    "business-consumer-and-criminal-legal-assistance": {},
    "consultation": {},
    "self-lawyer-guide": {},
    "virtual-courtroom-experience": {},
    "document-analyser": {},
}

# Route aliases used by frontend slugs.
SERVICE_ALIASES = {
    "consumer-rights": "business-consumer-and-criminal-legal-assistance",
}


def normalize_service_key(service: str) -> str:
    key = (service or "").strip().lower()
    return SERVICE_ALIASES.get(key, key)

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
                # Use stream parameter for PyMuPDF to handle bytes properly on Windows
                if isinstance(pdf_data, bytes):
                    doc = fitz.open(stream=pdf_data, filetype="pdf")
                else:
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

def extract_text_from_upload(file_storage, ocr_lang: str = "eng") -> Tuple[str, str]:
    """Extract text from uploaded file. Returns (text, error_message)."""
    filename = (file_storage.filename or "").lower()
    mimetype = (file_storage.mimetype or "").lower()
    data = file_storage.read()
    if not data:
        return "", "Empty file."

    is_pdf = filename.endswith(".pdf") or "application/pdf" in mimetype or data[:4] == b"%PDF"
    is_image = filename.endswith((".png", ".jpg", ".jpeg", ".webp")) or mimetype.startswith("image/")
    is_docx = filename.endswith(".docx") or "application/vnd.openxmlformats-officedocument.wordprocessingml.document" in mimetype

    if is_pdf:
        try:
            doc = fitz.open(stream=data, filetype="pdf")
            text_parts = []
            for page in doc:
                page_text = page.get_text("text")
                if page_text.strip():
                    text_parts.append(page_text)
            return "\n".join(text_parts), ""
        except Exception as e:
            return "", f"Failed to read PDF: {e}"

    if is_image:
        if not Image or not pytesseract:
            return "", "Image OCR is not configured on the server."
        try:
            image = Image.open(BytesIO(data))
            # Basic preprocessing to improve OCR on scanned forms
            image = image.convert("RGB")
            gray = ImageOps.grayscale(image)
            enhanced = ImageOps.autocontrast(gray)
            # Upscale for better OCR accuracy on low-res scans
            scale = 2
            resized = enhanced.resize(
                (enhanced.width * scale, enhanced.height * scale),
                resample=Image.Resampling.LANCZOS,
            )
            bw = resized.point(lambda x: 0 if x < 150 else 255, "1")
            ocr_lang = (ocr_lang or "eng").strip()
            available_langs = get_tesseract_languages(refresh=True)
            if available_langs:
                requested = [part for part in ocr_lang.split("+") if part]
                filtered = [part for part in requested if part in available_langs]
                if not filtered:
                    return "", f"OCR language pack not installed on the server. Requested: {ocr_lang}. Available: {', '.join(available_langs)}"
                ocr_lang = "+".join(filtered)

            def count_malayalam_chars(text: str) -> int:
                return sum(1 for ch in text if "\u0D00" <= ch <= "\u0D7F")

            def run_ocr(img, lang: str, config: str) -> str:
                return pytesseract.image_to_string(img, lang=lang, config=config)

            tessdata_arg = ""
            if TESSDATA_DIR:
                tessdata_arg = f" --tessdata-dir {TESSDATA_DIR.replace('\\\\', '/')}"
            configs = [
                f"--oem 1 --psm 6 --dpi 300{tessdata_arg}",
                f"--oem 1 --psm 4 --dpi 300{tessdata_arg}",
                f"--oem 1 --psm 3 --dpi 300{tessdata_arg}",
            ]
            def best_ocr_for_lang(lang: str) -> Tuple[str, int]:
                best_text = ""
                best_score = -1
                for cfg in configs:
                    for img in (resized, bw):
                        candidate = run_ocr(img, lang, cfg)
                        score = count_malayalam_chars(candidate)
                        if score > best_score:
                            best_score = score
                            best_text = candidate
                return best_text, best_score

            text = ""
            if "mal" in ocr_lang:
                text, score = best_ocr_for_lang(ocr_lang)
                if score < 5:
                    return "", "Malayalam OCR failed. Please upload a clearer scan or higher-resolution image."
            else:
                text = run_ocr(bw, ocr_lang, configs[0])
                # Auto-fallback to Malayalam if user forgot to set language
                mal_text, mal_score = best_ocr_for_lang("mal+eng")
                if mal_score >= 10:
                    text = mal_text
            return text, ""
        except Exception as e:
            msg = str(e)
            if "Error opening data file" in msg or "Failed loading language" in msg:
                available_langs = get_tesseract_languages(refresh=True)
                extra = f" Requested: {ocr_lang}. Available: {', '.join(available_langs) or 'none'}. Tessdata: {TESSDATA_DIR}"
                return "", f"OCR language pack not installed on the server. Error: {msg}.{extra}"
            return "", f"Failed to read image: {e}"

    if is_docx:
        if not docx:
            return "", "DOCX parsing is not configured on the server."
        try:
            document = docx.Document(BytesIO(data))
            text_parts = [p.text for p in document.paragraphs if p.text.strip()]
            return "\n".join(text_parts), ""
        except Exception as e:
            return "", f"Failed to read DOCX: {e}"

    if filename.endswith(".doc"):
        return "", "Legacy .doc files are not supported. Please upload DOCX."

    return "", "Unsupported file type."

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
        print("Index created successfully!")
    index = pc.Index(index_name)
    existing_vector_count = index.describe_index_stats()["total_vector_count"]
    if existing_vector_count > 0:
        print(f"Pinecone already has {existing_vector_count} vectors. Skipping processing.")
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
            source_name = filenames[i + j]
            vectors.append(
                (
                    source_name,
                    embedding.tolist(),
                    {"text": batch_texts[j], "source": source_name},
                )
            )
    batch_size = 100
    for i in range(0, len(vectors), batch_size):
        batch = vectors[i:i + batch_size]
        index.upsert(vectors=batch)

# Function to retrieve relevant chunks from Pinecone
def retrieve_context(index_name: str, query: str, top_k: int = 3):
    try:
        index = pc.Index(index_name)
    except Exception as e:
        print(f"Pinecone index access error for '{index_name}': {e}")
        return []
    query_embedding = model.encode(query).tolist()
    try:
        results = index.query(vector=query_embedding, top_k=top_k, include_metadata=True)
        contexts = []
        for match in results.get("matches", []):
            metadata = match.get("metadata") or {}
            text = metadata.get("text")
            if not text:
                continue
            contexts.append(
                {
                    "text": text,
                    "source": metadata.get("source") or match.get("id") or "unknown",
                    "score": match.get("score", 0),
                }
            )
        return contexts
    except Exception as e:
        print(f"Error retrieving from Pinecone: {e}")
        return []

# Function to safely encode string for Windows
def safe_encode_str(s):
    """Safely encode a string to handle Unicode on Windows"""
    if not s:
        return ""
    try:
        if isinstance(s, bytes):
            return s.decode('utf-8', errors='replace')
        # Convert to string, then encode/decode to ensure UTF-8
        return str(s).encode('utf-8', errors='replace').decode('utf-8', errors='replace')
    except Exception:
        return str(s) if s else ""

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
        # Devanagari family
        "hi-IN": [(0x0900, 0x097F)],
        "mr-IN": [(0x0900, 0x097F)],
        "ne-IN": [(0x0900, 0x097F)],
        # Bengali-Assamese script
        "bn-IN": [(0x0980, 0x09FF)],
        "as-IN": [(0x0980, 0x09FF)],
        # Gurmukhi
        "pa-IN": [(0x0A00, 0x0A7F)],
        # Gujarati
        "gu-IN": [(0x0A80, 0x0AFF)],
        # Odia
        "or-IN": [(0x0B00, 0x0B7F)],
        # Tamil
        "ta-IN": [(0x0B80, 0x0BFF)],
        # Telugu
        "te-IN": [(0x0C00, 0x0C7F)],
        # Kannada
        "kn-IN": [(0x0C80, 0x0CFF)],
        # Malayalam
        "ml-IN": [(0x0D00, 0x0D7F)],
        # Urdu (Arabic script)
        "ur-IN": [(0x0600, 0x06FF), (0x0750, 0x077F), (0x08A0, 0x08FF)],
    }
    ranges = script_ranges.get(language)
    if not ranges:
        return True
    return _contains_script_range(text, ranges)

def _script_ranges_for_language(language: str):
    ranges_map = {
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
    return ranges_map.get(language, [])

def _extract_json_object(raw_text: str):
    if not raw_text:
        return None
    text = str(raw_text).strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except Exception:
        pass
    first = text.find("{")
    last = text.rfind("}")
    if first != -1 and last != -1 and last > first:
        candidate = text[first:last + 1]
        try:
            return json.loads(candidate)
        except Exception:
            return None
    return None

def _iterate_string_values(node):
    if isinstance(node, dict):
        for value in node.values():
            yield from _iterate_string_values(value)
    elif isinstance(node, list):
        for value in node:
            yield from _iterate_string_values(value)
    elif isinstance(node, str):
        yield node

def _latin_ratio_in_values(node) -> float:
    latin = 0
    total = 0
    for text in _iterate_string_values(node):
        for ch in text:
            if ch.isalpha():
                total += 1
                if ("A" <= ch <= "Z") or ("a" <= ch <= "z"):
                    latin += 1
    return (latin / total) if total else 0.0

def _target_script_ratio_in_values(node, language: str) -> float:
    if language == "en-US":
        return 1.0
    ranges = _script_ranges_for_language(language)
    if not ranges:
        return 1.0
    target = 0
    total = 0
    for text in _iterate_string_values(node):
        for ch in text:
            if ch.isalpha():
                total += 1
                code = ord(ch)
                if any(start <= code <= end for start, end in ranges):
                    target += 1
    return (target / total) if total else 0.0


# Minimum ratio of target-script alphabetic characters expected in multilingual
# Document Analyser values. If lower, run an additional repair pass.
DOC_ANALYSER_MIN_SCRIPT_RATIO = float(os.getenv("DOC_ANALYSER_MIN_SCRIPT_RATIO", "0.60"))

def _normalize_malayalam_string(text: str) -> str:
    if not isinstance(text, str):
        return text
    out = text.strip()
    replacements = [
        (r"Not mentioned in the document\.?", "ഈ രേഖയിൽ കണ്ടെത്താനായില്ല."),
        (r"\bTo fill in the missing information\.?", "കുറവുള്ള വിവരങ്ങൾ പൂരിപ്പിക്കുക."),
        (r"\bTo have the .* reviewed by a lawyer\.?", "കരാർ ഒരു അഭിഭാഷകൻ പരിശോധിക്കാൻ നൽകുക."),
        (r"\breviewed by a lawyer\b", "അഭിഭാഷകൻ പരിശോധിക്കുക"),
        (r"\blender\b", "കടം കൊടുക്കുന്നയാൾ"),
        (r"\bborrower\b", "കടം വാങ്ങുന്നയാൾ"),
        (r"\bloan\b", "കടം"),
        (r"\bagreement\b", "കരാർ"),
        (r"\bcontract\b", "കരാർ"),
        (r"\binterest\b", "പലിശ"),
        (r"\bdeadline\b", "അവസാന തീയതി"),
        (r"\bobligation\b", "ചെയ്യേണ്ട ബാധ്യത"),
        (r"\brisk\b", "ശ്രദ്ധിക്കേണ്ട അപകടം"),
        (r"\bparty 1\b", "പാർട്ടി 1"),
        (r"\bparty 2\b", "പാർട്ടി 2"),
    ]
    for pattern, replacement in replacements:
        out = re.sub(pattern, replacement, out, flags=re.IGNORECASE)
    return out

def _normalize_malayalam_json(node):
    if isinstance(node, dict):
        return {k: _normalize_malayalam_json(v) for k, v in node.items()}
    if isinstance(node, list):
        return [_normalize_malayalam_json(v) for v in node]
    if isinstance(node, str):
        return _normalize_malayalam_string(node)
    return node


def _normalize_tamil_string(text: str) -> str:
    if not isinstance(text, str):
        return text
    out = text.strip()
    replacements = [
        (r"Not mentioned in the document\.?", "இந்த ஆவணத்தில் இந்த தகவல் இல்லை."),
        (r"\bloan amount\b", "கடன் தொகை"),
        (r"\binterest rate\b", "வட்டி விகிதம்"),
        (r"\brepayment schedule\b", "திருப்பிச் செலுத்தும் அட்டவணை"),
        (r"\blender\b", "கடன் கொடுப்பவர்"),
        (r"\bborrower\b", "கடன் பெறுபவர்"),
        (r"\bloan\b", "கடன்"),
        (r"\bagreement\b", "ஒப்பந்தம்"),
        (r"\bcontract\b", "ஒப்பந்தம்"),
        (r"\bparty 1\b", "கட்சி 1"),
        (r"\bparty 2\b", "கட்சி 2"),
        (r"\bmedium\b", "நடுத்தரம்"),
        (r"\bhigh\b", "உயர்"),
        (r"\blow\b", "குறைவு"),
    ]
    for pattern, replacement in replacements:
        out = re.sub(pattern, replacement, out, flags=re.IGNORECASE)
    return out


def _normalize_tamil_json(node):
    if isinstance(node, dict):
        return {k: _normalize_tamil_json(v) for k, v in node.items()}
    if isinstance(node, list):
        return [_normalize_tamil_json(v) for v in node]
    if isinstance(node, str):
        return _normalize_tamil_string(node)
    return node

def _normalize_language_json(node, language: str):
    not_found_map = {
        "en-US": "Not found in this document.",
        "hi-IN": "यह जानकारी दस्तावेज़ में नहीं मिली।",
        "ta-IN": "இந்த ஆவணத்தில் இந்த தகவல் இல்லை.",
        "te-IN": "ఈ పత్రంలో ఈ సమాచారం కనిపించలేదు.",
        "kn-IN": "ಈ ದಾಖಲೆಯಲ್ಲಿ ಈ ಮಾಹಿತಿ ಸಿಗಲಿಲ್ಲ.",
        "ml-IN": "ഈ രേഖയിൽ കണ്ടെത്താനായില്ല.",
        "gu-IN": "આ દસ્તાવેજમાં આ માહિતી મળી નથી.",
        "mr-IN": "ही माहिती या दस्तऐवजात सापडली नाही.",
        "bn-IN": "এই নথিতে এই তথ্য পাওয়া যায়নি।",
        "pa-IN": "ਇਹ ਜਾਣਕਾਰੀ ਇਸ ਦਸਤਾਵੇਜ਼ ਵਿੱਚ ਨਹੀਂ ਮਿਲੀ।",
        "ur-IN": "یہ معلومات اس دستاویز میں نہیں ملی۔",
        "as-IN": "এই তথ্যটো এই নথিত পোৱা নগ'ল।",
        "or-IN": "ଏହି ତଥ୍ୟ ଏହି ଦଳିଳରେ ମିଳିଲା ନାହିଁ।",
        "ne-IN": "यो जानकारी यस कागजातमा भेटिएन।",
    }
    not_found = not_found_map.get(language, "Not found in this document.")

    def _norm(value):
        if isinstance(value, dict):
            return {k: _norm(v) for k, v in value.items()}
        if isinstance(value, list):
            return [_norm(v) for v in value]
        if isinstance(value, str):
            out = value.strip()
            out = re.sub(r"Not mentioned in the document\.?", not_found, out, flags=re.IGNORECASE)
            return out
        return value

    return _norm(node)


def _contains_latin_in_values(node) -> bool:
    for text in _iterate_string_values(node):
        if re.search(r"[A-Za-z]", text or ""):
            return True
    return False


DOC_ANALYSER_MAX_LANGUAGE_REPAIR_ATTEMPTS = int(os.getenv("DOC_ANALYSER_MAX_LANGUAGE_REPAIR_ATTEMPTS", "2"))
DOC_ANALYSER_MAX_LATIN_RATIO = float(os.getenv("DOC_ANALYSER_MAX_LATIN_RATIO", "0.01"))


def _apply_language_specific_normalization(node, language: str):
    if language == "ml-IN":
        return _normalize_malayalam_json(node)
    if language == "ta-IN":
        return _normalize_tamil_json(node)
    return node


def _enforce_document_language_purity(node, language: str, language_name: str):
    if language == "en-US" or not isinstance(node, dict):
        return node

    current = _apply_language_specific_normalization(_normalize_language_json(node, language), language)
    attempts = 0

    while attempts < DOC_ANALYSER_MAX_LANGUAGE_REPAIR_ATTEMPTS:
        script_ratio = _target_script_ratio_in_values(current, language)
        latin_ratio = _latin_ratio_in_values(current)
        has_latin = _contains_latin_in_values(current)
        if script_ratio >= DOC_ANALYSER_MIN_SCRIPT_RATIO and latin_ratio <= DOC_ANALYSER_MAX_LATIN_RATIO and not has_latin:
            break

        strict_repair_prompt = f"""You are Strict Language Lock Agent.
Rewrite ONLY JSON values into natural, everyday {language_name}.
Rules:
- Keep EXACT same JSON keys and structure.
- Output must be 100% in {language_name}.
- Do not use any English words.
- JSON values must contain zero Latin letters (A-Z, a-z).
- Keep legal meaning accurate and simple for common users.
- Keep numbers, dates, and proper legal section numbers unchanged.
- IMPORTANT EXCEPTION: For each item in "fields", do NOT translate or alter "label". Keep "label" exactly as it appears in the original document, even if it contains Latin letters.
- Output VALID JSON only.

JSON:
{json.dumps(current, ensure_ascii=False)}
"""
        strict_repair = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "Return strict JSON only. Never output any Latin letters in JSON values."},
                {"role": "user", "content": strict_repair_prompt},
            ],
            max_completion_tokens=4096,
            temperature=0.05,
            top_p=0.9,
            stream=False,
        )
        strict_raw = strict_repair.choices[0].message.content if strict_repair and strict_repair.choices else ""
        strict_obj = _extract_json_object(strict_raw)
        if not strict_obj:
            break

        current = _apply_language_specific_normalization(_normalize_language_json(strict_obj, language), language)
        attempts += 1

    return current

def _preserve_document_schema_controls(result_obj, extracted_obj):
    if not isinstance(result_obj, dict) or not isinstance(extracted_obj, dict):
        return result_obj

    safe = dict(result_obj)
    def _infer_type(obj):
        if not isinstance(obj, dict):
            return "other"
        raw_type = str(obj.get("document_type", "")).strip().lower()
        if raw_type in {"form", "contract", "legal_notice", "other"}:
            return raw_type
        if any(token in raw_type for token in ["form", "application", "affidavit"]):
            return "form"
        if any(token in raw_type for token in ["contract", "agreement", "notice", "legal_notice", "legal notice"]):
            if "notice" in raw_type:
                return "legal_notice"
            return "contract"
        fields = obj.get("fields")
        if isinstance(fields, list) and len(fields) > 0:
            return "form"
        if obj.get("claims_against_user") or obj.get("deadlines") or obj.get("hearing_dates"):
            return "legal_notice"
        if obj.get("financial_terms") or obj.get("obligations") or obj.get("termination_conditions"):
            return "contract"
        return "other"

    safe["document_type"] = _infer_type(extracted_obj) or _infer_type(result_obj)

    result_fields = safe.get("fields")
    extracted_fields = extracted_obj.get("fields")
    if isinstance(result_fields, list) and isinstance(extracted_fields, list):
        for idx, field in enumerate(result_fields):
            if not isinstance(field, dict):
                continue
            if idx < len(extracted_fields) and isinstance(extracted_fields[idx], dict):
                source_field = extracted_fields[idx]
                extracted_type_value = source_field.get("field_type")
                if extracted_type_value in {"text", "date", "number", "checkbox", "signature", "other"}:
                    field["field_type"] = extracted_type_value
                # Always restore the ORIGINAL label exactly as captured during extraction.
                # Later language passes are not allowed to translate this; users must
                # be able to match the printed wording on the physical document.
                original_label = source_field.get("label")
                if isinstance(original_label, str) and original_label.strip():
                    field["label"] = original_label
    return safe

def _run_document_analyser_agent_pipeline(query: str, language: str, language_name: str, intense: bool = False):
    intense_block = (
        "If high-risk clauses are present, include: risk_score (0-100), critical_risk_clauses, "
        "ambiguous_clauses, negotiation_points, legal_review_recommended."
        if intense
        else "Do not force risk scoring if not needed."
    )
    try:
        extraction_prompt = f"""You are Extraction Agent for legal documents.
Return VALID JSON only.

Classify document_type as: form | contract | legal_notice | other.
Use only facts present in text. If missing, write "Not mentioned in the document".
For every document type, summary_simple must be a clear 4-5 sentence explanation.
Detect unfair or one-sided clauses and include them in unfair_clauses. If none, return [].
If document_type is form, include practical form_fill_guidance steps in {language_name} to help the user fill it.
For follow-up questions, use user answers to progressively fill form fields.
If the user appears to be a foreigner (passport/visa/non-Indian identity hints), include foreigner_guidance with document-specific help.

CRITICAL FOR FORM FIELDS:
- "label" MUST be the EXACT original wording as it appears on the document (in the document's original language/script). Do NOT translate it.
- "label_translation" must be a short translation/explanation of that label in {language_name} so the user understands what to write.
- "example_value" must be a concrete sample answer in {language_name} (e.g., "John Doe", "01/01/1990", "Male") so a beginner can copy the format.
- This way a user can match the original printed label on the paper, and still understand it.
{intense_block}

Required shape:
{{
  "document_type": "form|contract|legal_notice|other",
  "confidence_score": 0-100,
  "reasoning": "",
  "form_purpose": "",
  "summary_simple": "",
  "fields": [{{"label":"","label_translation":"","example_value":"","field_type":"text|date|number|checkbox|signature|other","required":true}}],
  "form_fill_guidance": [],
  "filled_form_data": [{{"field":"","value":"","status":"filled|missing|needs_confirmation","source":"document|user_followup|inferred"}}],
  "next_questions": [],
  "foreigner_guidance": [],
  "missing_info": [],
  "consequences_if_incomplete": [],
  "unfair_clauses": [],
  "parties": [],
  "duration": {{"start_date":"","end_date":"","renewal":""}},
  "financial_terms": [],
  "obligations": {{"party_1":[],"party_2":[]}},
  "rights": [],
  "termination_conditions": [],
  "risk_flags": [],
  "liability_exposure_level": "",
  "governing_law": "",
  "jurisdiction": "",
  "recommended_actions": [],
  "case_details": {{"issuing_authority":"","case_number":""}},
  "claims_against_user": [],
  "required_actions": [],
  "deadlines": [],
  "hearing_dates": [],
  "consequences_if_ignored": [],
  "urgency_level": "",
  "key_points": [],
  "dates_and_deadlines": [],
  "next_steps": []
}}

Document text:
{query}
"""
        extraction_response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "Return strict JSON only."},
                {"role": "user", "content": extraction_prompt},
            ],
            max_completion_tokens=4096,
            temperature=0.1,
            top_p=0.9,
            stream=False,
        )
        extraction_raw = extraction_response.choices[0].message.content if extraction_response and extraction_response.choices else ""
        extracted_obj = _extract_json_object(extraction_raw)
        if not extracted_obj:
            return extraction_raw.strip() if extraction_raw else "AI service temporary failure while generating response. Please retry."

        simplify_prompt = f"""You are Plain-Language Agent.
Rewrite the given JSON values for common people (class-5 reading level).
Rules:
- Keep EXACT same JSON keys and structure.
- Use short, practical, everyday language.
- Keep sentences around 8-12 words.
- No legal jargon unless unavoidable.
- Output language: {language_name}.
- If any value is missing, keep "Not mentioned in the document".
- IMPORTANT: For each entry in "fields", do NOT translate or rewrite "label". Keep "label" exactly as it appears in the document (original wording). Only translate "label_translation" and "example_value" into {language_name}.

JSON to rewrite:
{json.dumps(extracted_obj, ensure_ascii=False)}
"""
        simplify_response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "Return strict JSON only."},
                {"role": "user", "content": simplify_prompt},
            ],
            max_completion_tokens=4096,
            temperature=0.2,
            top_p=0.9,
            stream=False,
        )
        simplified_raw = simplify_response.choices[0].message.content if simplify_response and simplify_response.choices else ""
        simplified_obj = _extract_json_object(simplified_raw) or extracted_obj
        final_obj = simplified_obj

        if language != "en-US":
            language_qa_prompt = f"""You are Language Quality Agent.
Rewrite ONLY JSON values into natural {language_name}.
Rules:
- Keep EXACT same JSON keys and structure.
- Use only {language_name} in values (avoid mixed English).
- Keep class-5 friendly wording and short lines.
- Preserve meaning and document facts.
- IMPORTANT: For each item in "fields", do NOT translate "label". Keep "label" exactly as it appears in the original document. Translate "label_translation" and "example_value" only.
- Output VALID JSON only.

JSON:
{json.dumps(simplified_obj, ensure_ascii=False)}
"""
            language_qa_response = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "Return strict JSON only."},
                    {"role": "user", "content": language_qa_prompt},
                ],
                max_completion_tokens=4096,
                temperature=0.15,
                top_p=0.9,
                stream=False,
            )
            language_qa_raw = language_qa_response.choices[0].message.content if language_qa_response and language_qa_response.choices else ""
            language_qa_obj = _extract_json_object(language_qa_raw)
            if language_qa_obj:
                final_obj = language_qa_obj

        if language == "ml-IN":
            malayalam_prompt = f"""You are Malayalam Quality Agent.
Normalize Malayalam in this JSON.
Rules:
- Keep EXACT same JSON keys and structure.
- Use natural spoken Malayalam used in Kerala.
- Avoid transliterated English where Malayalam meaning exists.
- Keep wording simple and friendly.
- IMPORTANT: For each item in "fields", do NOT translate "label". Keep "label" exactly as in the original document. Only "label_translation" and "example_value" should be in Malayalam.
- Prefer these terms:
  lender = കടം കൊടുക്കുന്നയാൾ
  borrower = കടം വാങ്ങുന്നയാൾ
  loan = കടം
  contract/agreement = കരാർ
  interest = പലിശ
  deadline = അവസാന തീയതി
  required field = നിറയ്ക്കേണ്ട വിവരം
  obligation = ചെയ്യേണ്ട ബാധ്യത
  risk = ശ്രദ്ധിക്കേണ്ട അപകടം

JSON:
{json.dumps(simplified_obj, ensure_ascii=False)}
"""
            mal_response = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "Return strict JSON only."},
                    {"role": "user", "content": malayalam_prompt},
                ],
                max_completion_tokens=4096,
                temperature=0.2,
                top_p=0.9,
                stream=False,
            )
            mal_raw = mal_response.choices[0].message.content if mal_response and mal_response.choices else ""
            mal_obj = _extract_json_object(mal_raw)
            if mal_obj:
                final_obj = mal_obj
            final_obj = _normalize_malayalam_json(final_obj)

            # Repair pass if too much Latin script remains in value strings.
            if _latin_ratio_in_values(final_obj) > 0.12:
                repair_prompt = f"""You are Malayalam Repair Agent.
Rewrite ONLY JSON values to natural Malayalam (Kerala everyday usage).
Rules:
- Keep EXACT same JSON keys and structure.
- Do not leave English words unless they are unavoidable proper names.
- Convert mixed English-Malayalam sentences into full Malayalam meaning.
- Keep class-5 readability and short lines.
- IMPORTANT: For each item in "fields", do NOT translate "label". Keep "label" exactly as it appears in the original document.
- Output VALID JSON only.

JSON:
{json.dumps(final_obj, ensure_ascii=False)}
"""
                repair_response = groq_client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=[
                        {"role": "system", "content": "Return strict JSON only."},
                        {"role": "user", "content": repair_prompt},
                    ],
                    max_completion_tokens=4096,
                    temperature=0.1,
                    top_p=0.9,
                    stream=False,
                )
                repair_raw = repair_response.choices[0].message.content if repair_response and repair_response.choices else ""
                repair_obj = _extract_json_object(repair_raw)
                if repair_obj:
                    final_obj = _normalize_malayalam_json(repair_obj)

        if language != "en-US":
            final_obj = _apply_language_specific_normalization(
                _normalize_language_json(final_obj, language),
                language,
            )
            target_ratio = _target_script_ratio_in_values(final_obj, language)
            if target_ratio < DOC_ANALYSER_MIN_SCRIPT_RATIO:
                generic_repair_prompt = f"""You are Final Language Repair Agent.
Rewrite ONLY JSON values into clear {language_name}.
Rules:
- Keep EXACT same JSON keys and structure.
- Do not leave mixed-language phrases.
- Keep lines short and simple for common users.
- IMPORTANT: For each item in "fields", do NOT translate "label". Keep "label" exactly as it appears in the original document.
- Output VALID JSON only.

JSON:
{json.dumps(final_obj, ensure_ascii=False)}
"""
                generic_repair = groq_client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=[
                        {"role": "system", "content": "Return strict JSON only."},
                        {"role": "user", "content": generic_repair_prompt},
                    ],
                    max_completion_tokens=4096,
                    temperature=0.1,
                    top_p=0.9,
                    stream=False,
                )
                generic_repair_raw = generic_repair.choices[0].message.content if generic_repair and generic_repair.choices else ""
                generic_repair_obj = _extract_json_object(generic_repair_raw)
                if generic_repair_obj:
                    final_obj = _apply_language_specific_normalization(
                        _normalize_language_json(generic_repair_obj, language),
                        language,
                    )

            final_obj = _enforce_document_language_purity(final_obj, language, language_name)

        final_obj = _preserve_document_schema_controls(final_obj, extracted_obj)

        return json.dumps(final_obj, ensure_ascii=False)
    except Exception as e:
        try:
            logger.warning("document-analyser agent pipeline failed [%s]: %s", type(e).__name__, str(e)[:280])
        except Exception:
            pass
        error_text = str(e).lower()
        if (
            "rate limit" in error_text
            or "rate_limit_exceeded" in error_text
            or "quota" in error_text
            or "too many requests" in error_text
            or "429" in error_text
        ):
            wait_match = re.search(r"try again in ([^\\.]+)", str(e), flags=re.IGNORECASE)
            wait_hint = f" Please retry in about {wait_match.group(1).strip()}." if wait_match else ""
            return f"AI quota/rate limit reached for document analysis.{wait_hint}"
        return _run_document_analyser_fallback(query, language, language_name, intense)

def _run_document_analyser_fallback(query: str, language: str, language_name: str, intense: bool = False):
    try:
        intense_block = (
            "Also include risk_score, critical_risk_clauses, ambiguous_clauses, negotiation_points, legal_review_recommended."
            if intense
            else ""
        )
        fallback_prompt = f"""You are a legal document analyser.
Return VALID JSON only.
Use very simple language for common users (class-5 level).
Output language: {language_name}.
Do not mix languages.
summary_simple must be a clear 4-5 sentence explanation.
Detect unfair or one-sided clauses and include them in unfair_clauses. If none, return [].
If document_type is form, include practical form_fill_guidance steps in {language_name} to help the user fill it.
For follow-up questions, use user answers to progressively fill form fields.
If the user appears to be a foreigner (passport/visa/non-Indian identity hints), include foreigner_guidance with document-specific help.

For form fields:
- "label" MUST be the EXACT original wording as it appears on the document. Do NOT translate it.
- "label_translation" must be a short translation/explanation in {language_name}.
- "example_value" must be a sample answer in {language_name} so a beginner knows what to write.

Required keys:
{{
  "document_type": "form|contract|legal_notice|other",
  "summary_simple": "",
  "form_fill_guidance": [],
  "filled_form_data": [],
  "next_questions": [],
  "foreigner_guidance": [],
  "unfair_clauses": [],
  "fields": [{{"label":"","label_translation":"","example_value":"","field_type":"text|date|number|checkbox|signature|other","required":true}}],
  "key_points": [],
  "missing_info": [],
  "required_actions": [],
  "deadlines": [],
  "next_steps": []
}}

{intense_block}

Document text:
{query}
"""
        fallback_response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "Return strict JSON only."},
                {"role": "user", "content": fallback_prompt},
            ],
            max_completion_tokens=3200,
            temperature=0.2,
            top_p=0.9,
            stream=False,
        )
        raw = fallback_response.choices[0].message.content if fallback_response and fallback_response.choices else ""
        obj = _extract_json_object(raw)
        if obj:
            if language != "en-US":
                obj = _enforce_document_language_purity(obj, language, language_name)
            return json.dumps(obj, ensure_ascii=False)
        return raw.strip() if raw else "AI service temporary failure while generating response. Please retry."
    except Exception as e:
        error_text = str(e).lower()
        if (
            "rate limit" in error_text
            or "rate_limit_exceeded" in error_text
            or "quota" in error_text
            or "too many requests" in error_text
            or "429" in error_text
        ):
            wait_match = re.search(r"try again in ([^\\.]+)", str(e), flags=re.IGNORECASE)
            wait_hint = f" Please retry in about {wait_match.group(1).strip()}." if wait_match else ""
            return f"AI quota/rate limit reached for document analysis.{wait_hint}"
        return "AI service temporary failure while generating response. Please retry."

def _merge_text_with_overlap(base_text: str, continuation_text: str, max_overlap_chars: int = 320) -> str:
    base = (base_text or "").rstrip()
    cont = (continuation_text or "").lstrip()
    if not base:
        return cont
    if not cont:
        return base
    window = min(len(base), len(cont), max_overlap_chars)
    overlap_len = 0
    for size in range(window, 0, -1):
        if base[-size:] == cont[:size]:
            overlap_len = size
            break
    if overlap_len:
        return f"{base}{cont[overlap_len:]}".strip()
    return f"{base}\n{cont}".strip()

# Function to generate response using Groq
def generate_response(query: str, contexts: list, history: list, service: str, language: str = "en-US", intense: bool = False):
    # Safely encode query first
    try:
        query = safe_encode_str(query)
    except Exception:
        query = str(query) if query else ""
    
    # Safely join contexts with UTF-8 encoding (include sources)
    try:
        if contexts:
            context_lines = []
            max_context_chars = 9000
            current_context_chars = 0
            for item in contexts:
                if isinstance(item, dict):
                    text = safe_encode_str(str(item.get("text", "")))
                    source = safe_encode_str(str(item.get("source", "unknown")))
                    if text:
                        # Keep context compact so multilingual responses have enough output tokens.
                        compact_text = text[:1400] + (" ...[truncated]" if len(text) > 1400 else "")
                        line = f"[Source: {source}]\n{compact_text}"
                        if current_context_chars + len(line) > max_context_chars:
                            break
                        context_lines.append(line)
                        current_context_chars += len(line)
                else:
                    line = safe_encode_str(str(item))
                    if current_context_chars + len(line) > max_context_chars:
                        break
                    context_lines.append(line)
                    current_context_chars += len(line)
            context_str = "\n\n".join(context_lines) if context_lines else "No specific information found."
        else:
            context_str = "No specific information found."
    except Exception:
        context_str = "No specific information found."
    
    # Limit history to last 4-6 messages to avoid token limits (each message can be very long)
    # Also truncate very long messages in history to prevent prompt from becoming too large
    limited_history = history[-6:] if len(history) > 6 else history
    history_items = []
    for msg in limited_history:
        role = msg.get('role', 'user')
        content = msg.get('content', '')
        # Truncate very long messages to prevent prompt bloat (keep first 500 chars)
        if len(content) > 500:
            content = content[:500] + "... [truncated for length]"
        history_items.append(f"{role}: {content}")
    history_str = "\n".join(history_items)
    
    # History processing complete
    
    # Map language codes to language names for the prompt (English only to avoid encoding issues)
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
        "en-US": "English"
    }
    language_name = language_map.get(language, "English")
    is_commoner_service = False
    if service == "document-analyser":
        return _run_document_analyser_agent_pipeline(query, language, language_name, intense)
    
    # COMPLETELY SEPARATE PROMPT FOR VIRTUAL COURTROOM - NATURAL CONVERSATIONAL FLOW
    if service == "virtual-courtroom-experience":
        # Add language instruction
        language_instruction = ""
        if language != "en-US":
            language_instruction = f"\n\nCRITICAL: You MUST respond ENTIRELY in {language_name} language. All dialogue from Judge and Defense Counsel must be in {language_name}. Write naturally as native speakers would speak in court."
        
        # Build conversation history for natural flow (like ChatGPT - just the actual conversation)
        courtroom_history = []
        for msg in limited_history:
            role = msg.get('role', 'user')
            content = msg.get('content', '')
            content = safe_encode_str(content)
            if role == "user":
                courtroom_history.append(f"Petitioner: {content}")
            elif role == "bot":
                # Include previous court proceedings for context
                if "=== JUDGE ===" in content or "=== DEFENSE COUNSEL ===" in content:
                    courtroom_history.append(f"{content}")
        
        courtroom_history_str = "\n\n".join(courtroom_history) if courtroom_history else "(This is the beginning of the trial)"
        
        prompt = f"""You are running a live Indian courtroom interaction. The user is the petitioner. You must speak as TWO voices in one reply:
1) JUDGE – presides, responds to the petitioner, asks focused follow-ups, rules, and keeps order.
2) DEFENSE COUNSEL – counters the petitioner, questions gaps, and advances the defense position.

Style:
- Natural, concise, courtroom-realistic; no meta-talk.
- Respond directly to the petitioner’s latest message and the running context.
- If ending the matter, replace the JUDGE section with "=== FINAL JUDGMENT ===".
- Each section 2–5 sentences; no bullet lists, no headings beyond the required tags.
- Reference Indian law naturally (BNS/BNSS/BSA) only when relevant.

Required format (exactly):
=== JUDGE ===
[concise, natural dialogue to the petitioner]

=== DEFENSE COUNSEL ===
[concise, natural dialogue to the petitioner]

Context so far:
{courtroom_history_str}

Petitioner just said:
{query}

Language: stay in the petitioner’s language if specified. {language_instruction}

Respond now with only the two sections."""
        
        system_message = (
            "Simulate a realistic Indian courtroom exchange. In one reply, provide exactly two sections: "
            "=== JUDGE === and === DEFENSE COUNSEL ===. Each is 2–5 sentences, concise, natural, and responsive to "
            "the petitioner’s latest statement. No meta-text, no explanations, no extra headers. Reference BNS/BNSS/BSA "
            "only when relevant. Use the petitioner’s language when requested."
        )
    elif service == "self-lawyer-guide":
        # COMPLETELY SEPARATE PROMPT FOR SELF-LAWYER-GUIDE - ACT AS EXPERT LEGAL TEACHER
        # Add language instruction
        language_instruction = ""
        if language != "en-US":
            language_instruction = (
                f"\n\nCRITICAL: You MUST respond ENTIRELY in {language_name} language. "
                f"Use warm, everyday colloquial {language_name} that common people speak in day-to-day life. "
                "Avoid dictionary-style, overly formal, literary, or textbook wording."
            )
        
        # Build conversation history for teaching context
        teaching_history = []
        for msg in limited_history:
            role = msg.get('role', 'user')
            content = msg.get('content', '')
            if role == "user":
                teaching_history.append(f"Student: {content}")
            elif role == "bot":
                teaching_history.append(f"Teacher: {content}")
        
        teaching_history_str = "\n\n".join(teaching_history) if teaching_history else "(Beginning of the lesson)"
        
        prompt = f"""You are an EXPERT SELF-REPRESENTATION LEGAL COACH for Indian courts.
Your goal is to help users prepare and present their own case clearly, safely, and practically.

COACHING PRINCIPLES (follow in every answer):
1) Plain language first - explain legal ideas like a mentor, not a textbook.
2) Actionable guidance - prioritize what to do next.
3) Structured outputs - make responses easy to use in real hearings.
4) Risk awareness - clearly flag legal/procedural risks and urgency.
5) Confidence building - supportive but realistic.

LEGAL FRAMEWORK (use when relevant):
- BNS (Bharatiya Nyaya Sanhita, 2023)
- BNSS (Bharatiya Nagarik Suraksha Sanhita, 2023)
- BSA (Bharatiya Sakshya Adhiniyam, 2023)

RESPONSE FORMAT (default):
1. **Case Snapshot** (2-4 bullets)
2. **Priority Action Plan** with timelines:
   - Today
   - This Week
   - Before Next Hearing
3. **Documents & Evidence Checklist**:
   - What to collect
   - Why each item matters
   - Basic admissibility/relevance notes under BSA where useful
4. **Courtroom Script Support**:
   - Short opening statement draft (customized)
   - Key points to submit orally
   - Polite phrases for addressing the court
5. **Possible Objections and Responses** (opposite party likely points + your rebuttal ideas)
6. **Risk Flags & Boundaries**:
   - common mistakes to avoid
   - when user should urgently consult a licensed advocate

ADAPTIVE RULES:
- If user asks for one specific item (example: "draft opening"), focus deeply on that item.
- If key facts are missing, ask at most 3 concise clarification questions first.
- If evidence text is provided, explicitly cite which parts support which arguments.
- Include procedural sequencing when relevant (filing, notice, evidence, hearing, arguments, order, appeal).
- Keep tone practical and user-friendly; avoid long theory unless requested.
- Do not claim guaranteed outcomes.

{language_instruction}

PREVIOUS CONVERSATION:
{teaching_history_str}

STUDENT'S CURRENT MESSAGE/QUESTION:
{query}

Respond now as a practical Indian self-lawyer mentor."""
        
        system_message = "You are an expert Indian self-representation legal coach. Provide plain-language, practical, step-based guidance for users handling their own case. Use structured outputs (snapshot, action plan, evidence checklist, courtroom script, objections, risk flags). Reference BNS/BNSS/BSA when relevant, be supportive, and avoid guaranteed outcomes."
    elif service == "document-analyser":
        language_instruction = ""
        if language != "en-US":
            language_instruction = (
                f"\n\nCRITICAL: You MUST respond ENTIRELY in {language_name} language. "
                f"Use simple, conversational {language_name} as spoken daily by common people. "
                "Avoid formal dictionary-style wording."
            )
        if language == "ml-IN":
            language_instruction += (
                "\n\nMALAYALAM QUALITY RULES (STRICT):"
                "\n- Avoid half-English transliteration terms when a natural Malayalam phrase exists."
                "\n- Prefer meaning-based Malayalam, not direct sound-based transliteration."
                "\n- Keep legal language child-friendly (class-5 level)."
                "\n- Use these preferred terms consistently:"
                "\n  lender -> കടം കൊടുക്കുന്നയാൾ"
                "\n  borrower -> കടം വാങ്ങുന്നയാൾ"
                "\n  loan -> കടം"
                "\n  agreement/contract -> കരാർ"
                "\n  interest -> പലിശ"
                "\n  due date/deadline -> അവസാന തീയതി"
                "\n  required field -> നിറയ്ക്കേണ്ട വിവരം"
                "\n  risk -> ശ്രദ്ധിക്കേണ്ട അപകടം"
                "\n  obligation -> ചെയ്യേണ്ട ബാധ്യത"
            )

        intense_instruction = ""
        if intense:
            intense_instruction = """
INTENSE LEGAL ANALYSIS MODE:
- Perform clause-by-clause breakdown.
- Detect ambiguous language and risky clauses.
- Identify legally dangerous phrases, vague indemnities, and compliance risks.
- Provide risk_score (0–100), critical_risk_clauses, ambiguous_clauses, negotiation_points, legal_review_recommended.
"""

        prompt = f"""You are a LEGAL DOCUMENT ANALYSER for Indian courts. Your task is to analyze documents and output VALID JSON only (no markdown, no extra text).

CORE OBJECTIVE:
1) Detect document type: "form" | "contract" | "legal_notice" | "other"
2) Return confidence_score (0–100) and reasoning.
3) Extract structured details based on document type.
4) Use only facts present in the document. If uncertain, say "Not mentioned in the document."

OUTPUT MUST BE VALID JSON ONLY.

BASE JSON KEYS (always required):
{{
  "document_type": "form|contract|legal_notice|other",
  "confidence_score": 0-100,
  "reasoning": "why classified as such"
}}

IF document_type = "form", include:
{{
  "form_purpose": "simple explanation",
  "fields": [
    {{
      "label": "EXACT original wording from the document (DO NOT translate)",
      "label_translation": "short translation/explanation in the user's chosen language",
      "example_value": "sample answer the user can copy or adapt (in user's language)",
      "field_type": "text|date|number|checkbox|signature|other",
      "required": true|false|\"unknown\",
      "category": "personal|identification|financial|legal_declaration|supporting_documents|signature|other"
    }}
  ],
  "missing_info": ["..."],
  "consequences_if_incomplete": ["..."]
}}

IF document_type = "contract", include:
{{
  "summary_simple": "plain language long-form summary for commoners",
  "parties": ["..."],
  "duration": {{
    "start_date": "",
    "end_date": "",
    "renewal": ""
  }},
  "financial_terms": ["..."],
  "obligations": {{
    "party_1": ["..."],
    "party_2": ["..."]
  }},
  "rights": ["..."],
  "termination_conditions": ["..."],
  "risk_flags": ["..."],
  "liability_exposure_level": "Low|Medium|High|Not mentioned in the document",
  "governing_law": "",
  "jurisdiction": "",
  "recommended_actions": ["..."]
}}

IF document_type = "legal_notice", include:
{{
  "summary_simple": "plain language summary",
  "case_details": {{
    "issuing_authority": "",
    "case_number": ""
  }},
  "parties": ["..."],
  "claims_against_user": ["..."],
  "required_actions": ["..."],
  "deadlines": ["..."],
  "hearing_dates": ["..."],
  "consequences_if_ignored": ["..."],
  "urgency_level": "Low|Medium|High|Not mentioned in the document"
}}

If document_type = "other", include:
{{
  "summary_simple": "plain language explanation of the real content",
  "key_points": ["..."],
  "dates_and_deadlines": ["..."],
  "obligations": ["..."],
  "next_steps": ["..."]
}}

{intense_instruction}

RULES:
- Do NOT invent facts or clauses not present in the document.
- If a field is missing, output "Not mentioned in the document".
- Use very simple words that a class-5 student can understand.
- Keep every sentence short (around 8-12 words).
- Avoid legal jargon; if unavoidable, explain it in plain words immediately.
- Keep tone practical and friendly, not academic.
- Do NOT output generic platform descriptions unless explicitly present.

Do NOT give legal advice. Focus on clarity, structure, and procedural guidance.
If you asked for the preferred language, keep the response short and wait for the user's reply.

Use ONLY the current document text provided below. Ignore any prior conversation or previous documents.

User input (document text or description):
{query}

Language: {language_name}.{language_instruction}
"""

        system_message = (
            "You analyze Indian legal documents. Explain in simple language, detect if it is a form, "
            "and guide the user on how to fill it or next steps. Ask clarifying questions when data is missing. "
            "No legal advice."
        )
    else:
        # Regular prompt for other services
        # Determine service context message
        service_context_msg = f"You are providing guidance related to Indian {service.replace('-', ' ').title()} Services, with priority references to BNS/BNSS/BSA."
        
        # Add language instruction to the prompt - ALWAYS override based on current query language
        language_instruction = ""
        if language != "en-US":
            language_instruction = (
                f"\n\nCRITICAL LANGUAGE INSTRUCTION: The user's current query is in {language_name}. "
                f"You MUST respond ENTIRELY in {language_name}. Ignore previous language context and use ONLY {language_name} for this response. "
                f"Write in natural colloquial {language_name} used in daily conversation by common people. "
                "Do NOT use stiff, literary, or dictionary-like words. "
                "Keep tone warm, supportive, and easy to understand."
            )
        if language == "ml-IN":
            language_instruction += (
                "\n\nMALAYALAM STYLE RULES:"
                "\n- Use day-to-day spoken Malayalam (friendly and natural), not formal/literary Malayalam."
                "\n- Prefer short lines that sound like a trusted local helper speaking to a family member."
                "\n- If you must include a legal/English term, immediately explain it in simple Malayalam."
                "\n- Avoid rare Sanskrit-heavy vocabulary and avoid rigid textbook tone."
            )

        citation_requirement_block = """- You MUST cite at least 3 specific sections from BNS/BNSS/BSA in EVERY response
- Format: **"Section [number] of BNS"** or **"BNSS Section [number]"** or **"BSA Section [number]"**
- Examples: "**Section 103 of BNS**", "**BNSS Section 172**", "**BSA Section 57**"
- Always cite section numbers when explaining legal provisions
- Extract section numbers from the provided context
- Section citations are MANDATORY for credibility"""
        if language == "ml-IN":
            citation_requirement_block = """- For Malayalam responses, prioritize clarity and comfort first.
- Cite 1-2 most relevant BNS/BNSS/BSA sections only when they materially help the user.
- Put section references near the end under a short plain-language line (avoid interrupting the flow).
- If exact section is uncertain from context, do not force citation; give practical next steps instead."""
        
        no_intro_services = {
            "personal-and-family-legal-assistance",
            "business-consumer-and-criminal-legal-assistance",
        }
        is_commoner_service = service in no_intro_services
        commoner_label_instruction = ""
        if service in no_intro_services:
            response_structure = """- Do NOT include an introduction or query restatement.
- Start directly with **4 to 7 short bullets**.
- Keep language very simple for non-lawyers in the user's chosen language.
- REQUIRED bullets (adapt to query):
  1) **Immediate step now** (what to do first)
  2) **Next 24-48 hours**
  3) **Documents / proof checklist**
  4) **Where to go / who to contact** (helpline, police, consumer forum, legal services, etc.)
  5) **Law support** with 1-3 relevant BNS/BNSS/BSA section references only when useful
- Use section format: "Section [number] of BNS" or "BNSS Section [number]" or "BSA Section [number]".
- Avoid jargon; if any legal term is used, explain it in plain words."""
            spacing_rule = "- Use a blank line before the bullet list and before the closing line."
            length_rule = "- Provide 8-14 short sentences total (clear and practical)."
            if language == "ml-IN":
                commoner_label_instruction = """- Use these exact Malayalam label prefixes (bold), one bullet each:
  - **നിങ്ങൾക്ക് ഇപ്പോൾ ചെയ്യാൻ പറ്റിയ കാര്യങ്ങൾ:**
  - **നിങ്ങൾക്ക് ശേഷം 24-48 മണിക്കൂറുകൾ നേരിടേണ്ടിവരുന്ന കാര്യങ്ങൾ:**
  - **നിങ്ങൾക്ക് ആവശ്യമായ ഡോക്യുമെന്റുകൾ/തെളിവുകൾ:**
  - **നിങ്ങൾക്ക് നേരിടേണ്ടിവരുന്ന സ്ഥലം/ആരെ സമീപിക്കണം:**
- Under each label, write complete sentences only.
- Never leave a word cut in the middle; never repeat half-lines."""
            else:
                commoner_label_instruction = """- Use these exact label prefixes (bold), one bullet each:
  - **Immediate step now:**
  - **Next 24-48 hours:**
  - **Documents / proof checklist:**
  - **Where to go / who to contact:**
- Under each label, write complete sentences only.
- Never leave a word cut in the middle; never repeat half-lines."""
            context_usage_rules = """- Use context only to support practical steps; do not force citations in every bullet.
- If context is weak or not directly relevant, still give actionable next steps in plain language.
- Add a short 'Where to go now' or helpline/authority suggestion when useful."""
            final_response_rules = """- Keep it direct and practical.
- Do NOT force a 5-part legal essay.
- Prefer concrete actions over theory.
- Use warm, everyday language."""
        else:
            response_structure = """- Start with a 1-2 sentence plain-language restatement of the user's issue.
- Then give **3 to 6 short bullets** total:
  - At least 1 bullet must cite BNS/BNSS/BSA sections with exact numbers.
  - Use the format: "Section [number] of BNS" or "BNSS Section [number]" or "BSA Section [number]".
  - Focus on what the law says and what the user can practically do next.
- End with **one brief line** if professional help is recommended."""
            spacing_rule = "- Use blank lines between the short opening and the bullet list, and between bullet list and closing line."
            length_rule = "- Provide 8-12 sentences total (concise but complete)."
            context_usage_rules = """- The context above contains excerpts from BNS, BNSS, and BSA with section numbers
- You MUST extract and cite the section numbers from the context (e.g., "Section 103", "Section 172", etc.)
- When you see section numbers in the context, you MUST cite them in your response
- Format your citations as: "Section [number] of BNS" or "BNSS Section [number]" or "BSA Section [number]"
- Do not paraphrase legal provisions without citing their section numbers from the context
- If the context mentions multiple sections, cite ALL relevant sections in your response
- Add a short "Sources" line at the end listing the PDF sources you used, based on the [Source: ...] labels in the context"""
            final_response_rules = """- Keep it concise: 12-18 sentences total (not 20-25)
- Use proper spacing: Double line breaks between major sections, single line breaks between paragraphs
- Format for readability: Short paragraphs (2-4 sentences max), use bullet points when listing items
- MUST cite 2-4 specific sections from BNS/BNSS/BSA (use **bold** for section numbers)
- Follow the 5-part structure with proper spacing between sections
- Be precise and focused - avoid unnecessary repetition
- Ensure the response is easy to read and scan"""

        prompt = f"""
You are an expert Indian legal assistant specializing in post-2023 criminal law codes. Your role is to provide concise, actionable guidance that is easy to read when the user is stressed.

LEGAL FRAMEWORK - STRICTLY USE:
- Bharatiya Nyaya Sanhita, 2023 (BNS) - for substantive criminal law
- Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS) - for criminal procedure  
- Bharatiya Sakshya Adhiniyam, 2023 (BSA) - for evidence law

IMPORTANT: Do not cite or mention older IPC/CrPC/Indian Evidence Act unless explicitly comparing old vs new laws. Always prefer BNS/BNSS/BSA with precise section numbers.

MANDATORY RESPONSE STRUCTURE - KEEP IT SHORT AND READABLE:

{response_structure}

FORMATTING REQUIREMENTS:
{spacing_rule}
- Keep every bullet to 1-2 sentences max.
- Do NOT use headings or numbered section titles at all.
- Do NOT include any "Introduction", "Legal Analysis", "Practical Implications", "Recommendations", or "Conclusion" labels.
- Bold important section numbers or key terms using ** for emphasis
- Ensure the response is well-spaced and easy to scan
 - Include safety guidance ONLY when the user's situation is harmful or life-threatening

RESPONSE LENGTH AND FORMATTING REQUIREMENTS:
{length_rule}
- Use clear, readable sentences (10-15 words per sentence is ideal)
- Format your response with proper spacing and structure for easy reading
- Avoid long walls of text - break content into digestible chunks

CRITICAL SECTION CITATION REQUIREMENTS:
{citation_requirement_block}

LABEL REQUIREMENTS:
{commoner_label_instruction}

TONE & STYLE:
- Professional but warm and human
- Factual and precise
- Empathetic, reassuring, and practical
- Use plain, common words; explain legal terms immediately
- In non-English replies, prefer everyday spoken style over formal dictionary style
- Clear and well-organized
- No speculation, opinions, or unverified interpretations



SERVICE CONTEXT:
{service_context_msg}

{language_instruction}

NOTE: The conversation history below may contain messages in different languages. However, you MUST respond to the current query in the language specified above, regardless of the language used in previous messages.

CONTEXT FROM LEGAL DOCUMENTS (BNS/BNSS/BSA):
{context_str}

CRITICAL INSTRUCTIONS FOR USING CONTEXT:
{context_usage_rules}

CONVERSATION HISTORY:
{history_str}

USER'S QUERY:
{query}

Now provide your response following the structure above. Remember:
{final_response_rules}

"""
    try:
        # System message is already set above for virtual-courtroom, self-lawyer-guide, and document-analyser - only set it here for other services
        if service not in ["virtual-courtroom-experience", "self-lawyer-guide", "document-analyser"] and not is_commoner_service:
            system_message = "You are an expert Indian legal assistant specializing in post-2023 criminal law codes (BNS, BNSS, BSA). Provide clear, concise, and well-formatted legal responses. Use proper spacing, paragraph breaks, and formatting for readability. Keep responses concise (12-18 sentences total). Follow the 5-part structure with double line breaks between sections: Introduction (2-3 sentences), Legal Analysis (5-8 sentences with section citations), Practical Implications (3-4 sentences), Recommendations (3-4 sentences), and Conclusion (2-3 sentences). Format section numbers in **bold** for emphasis. Keep paragraphs short (2-4 sentences max) for better readability."
        if is_commoner_service:
            system_message = "You are a warm, practical Indian legal helper for common people. Give clear next steps in very simple spoken language. Avoid legal jargon and avoid long formal essays. If legal terms are necessary, explain them immediately in plain words. Prioritize immediate action, safety, and where to go next."

        if language != "en-US":
            system_message = (
                f"{system_message}\n\nMANDATORY OUTPUT LANGUAGE: {language_name}. "
                f"Return the final answer only in {language_name}. "
                "Do not switch to English unless the user explicitly asks in this turn."
            )
        
        # Keep completion budgets tighter for faster chatbot responses.
        if service == "document-analyser":
            completion_budget = 1600
        else:
            completion_budget = 2200 if is_commoner_service else 1800
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": prompt}
            ],
            max_completion_tokens=completion_budget,
            temperature=0.7,  # Slightly higher for more natural, comprehensive responses
            top_p=0.9,
            stream=False
        )
        
        # Validate response structure (removed logging to avoid encoding issues)
        if not response or not response.choices or len(response.choices) == 0:
            return "I apologize, but I couldn't generate a response. Please try again."
        
        result = response.choices[0].message.content
        if not result:
            return "I apologize, but I couldn't generate a response. Please try again."
        
        result = result.strip()
        
        # Ensure result is not empty
        if not result or len(result.strip()) == 0:
            return "I apologize, but I couldn't generate a proper response. Please try again."
        
        # If response is truncated, continue up to 3 times.
        finish_reason = response.choices[0].finish_reason
        continuation_attempts = 0
        while finish_reason == "length" and continuation_attempts < 3:
            continuation_attempts += 1
            try:
                continuation = groq_client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=[
                        {"role": "system", "content": system_message},
                        {"role": "user", "content": prompt},
                        {"role": "assistant", "content": result},
                        {
                            "role": "user",
                            "content": (
                                "Your previous response was cut off due to length. Continue from exactly where you stopped. "
                                "Do not restart, do not repeat earlier text, and finish cleanly in the same language."
                            ),
                        },
                    ],
                    max_completion_tokens=1400,
                    temperature=0.5,
                    top_p=0.9,
                    stream=False,
                )
                if not continuation or not continuation.choices:
                    break
                next_chunk = continuation.choices[0].message.content or ""
                if not next_chunk.strip():
                    break
                result = _merge_text_with_overlap(result, next_chunk.strip())
                finish_reason = continuation.choices[0].finish_reason
            except Exception:
                break
        
        if language != "en-US" and not _response_matches_language(result, language):
            try:
                translation_prompt = (
                    f"Translate the following legal guidance into natural, everyday {language_name}. "
                    f"Output only {language_name} text. Keep legal references unchanged.\n\n"
                    f"TEXT:\n{result}"
                )
                translated = groq_client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=[
                        {
                            "role": "system",
                            "content": (
                                f"You are a strict translator. Return only {language_name} output "
                                "without commentary or prefaces."
                            ),
                        },
                        {"role": "user", "content": translation_prompt},
                    ],
                    max_completion_tokens=completion_budget,
                    temperature=0.2,
                    top_p=0.9,
                    stream=False,
                )
                translated_text = ((translated.choices[0].message.content or "").strip() if translated and translated.choices else "")
                if translated_text and _response_matches_language(translated_text, language):
                    result = translated_text
            except Exception:
                pass

        has_obvious_repeat = bool(re.search(r"(\S+(?:\s+\S+){4,10})\s+\1", result or "", flags=re.IGNORECASE))
        if is_commoner_service and (continuation_attempts > 0 or has_obvious_repeat):
            try:
                repair_rules = (
                    "Rewrite this draft in the SAME language and preserve meaning.\n"
                    "Fix broken/truncated words and incomplete sentences.\n"
                    "Remove repeated fragments.\n"
                    "Return 4-7 clean bullets in practical plain language.\n"
                    "Do not add legal facts not already present.\n"
                )
                if language == "ml-IN":
                    repair_rules += (
                        "Use these exact Malayalam bold labels once each:\n"
                        "- **നിങ്ങൾക്ക് ഇപ്പോൾ ചെയ്യാൻ പറ്റിയ കാര്യങ്ങൾ:**\n"
                        "- **നിങ്ങൾക്ക് ശേഷം 24-48 മണിക്കൂറുകൾ നേരിടേണ്ടിവരുന്ന കാര്യങ്ങൾ:**\n"
                        "- **നിങ്ങൾക്ക് ആവശ്യമായ ഡോക്യുമെന്റുകൾ/തെളിവുകൾ:**\n"
                        "- **നിങ്ങൾക്ക് നേരിടേണ്ടിവരുന്ന സ്ഥലം/ആരെ സമീപിക്കണം:**\n"
                        "Each bullet must be complete and natural.\n"
                    )
                repair_prompt = f"{repair_rules}\nDraft:\n{result}"
                repaired = groq_client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=[
                        {"role": "system", "content": "You repair and polish user-facing responses without changing core meaning."},
                        {"role": "user", "content": repair_prompt},
                    ],
                    max_completion_tokens=1200,
                    temperature=0.2,
                    top_p=0.9,
                    stream=False,
                )
                repaired_text = ((repaired.choices[0].message.content or "").strip() if repaired and repaired.choices else "")
                if repaired_text:
                    result = repaired_text
            except Exception:
                pass

        # Validate minimum response length (removed logging to avoid encoding issues)
        return result
        
    except OSError as e:
        # Catch encoding errors (Errno 22) - return simple error message
        if getattr(e, 'winerror', getattr(e, 'errno', None)) == 22 or "Invalid argument" in str(e):
            return "AI response encoding failed on server. Please retry."
        raise
    except Exception as e:
        # Return simple error message without logging to avoid encoding issues
        try:
            raw_error = str(e)
            error_msg = raw_error.lower()
            try:
                logger.warning("generate_response failure [%s]: %s", type(e).__name__, raw_error[:300])
            except Exception:
                pass
            if (
                "quota" in error_msg
                or "insufficient_quota" in error_msg
                or "rate limit" in error_msg
                or "too many requests" in error_msg
                or "429" in error_msg
            ):
                return "I'm sorry, but the AI quota/rate limit was reached. Please wait a bit and try again."
            if "api" in error_msg or "connection" in error_msg:
                return "I'm sorry, but I encountered an issue generating a response. API connection error. Please try again."
            elif "timeout" in error_msg:
                return "I'm sorry, but I encountered an issue generating a response. Request timed out. Please try again."
            elif "token" in error_msg or "length" in error_msg:
                return "I'm sorry, but I encountered an issue generating a response. Request too long. Please try again."
            else:
                return "AI service temporary failure while generating response. Please retry."
        except Exception:
            return "AI service temporary failure while generating response. Please retry."

# Common function to handle chat requests
def handle_chat(service: str):
    try:
        service = normalize_service_key(service)
        data = request.json
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400
        query = data.get('query')
        user_id = data.get('user_id', 'default_user')
        language = data.get('language', 'en-US')  # inferred language (legacy)
        selected_language = data.get('selected_language')  # explicit dropdown language
        allowed_langs = {
            "en-US", "hi-IN", "ta-IN", "te-IN", "kn-IN", "ml-IN", "gu-IN",
            "mr-IN", "bn-IN", "pa-IN", "ur-IN", "as-IN", "or-IN", "ne-IN"
        }
        if selected_language in allowed_langs and service in {
            "personal-and-family-legal-assistance",
            "business-consumer-and-criminal-legal-assistance",
            "consumer-rights",
            "self-lawyer-guide",
            "document-analyser",
        }:
            language = selected_language
        elif language not in allowed_langs:
            language = "en-US"
        intense = bool(data.get('intense', False))
        if not query:
            return jsonify({"error": "No query provided"}), 400
        if service not in conversation_histories:
            return jsonify({"error": f"Invalid service category: {service}. Available services: {list(conversation_histories.keys())}"}), 400
        history = conversation_histories[service].setdefault(user_id, [])
        try:
            contexts = [] if service == "document-analyser" else retrieve_context("lawpal", query)
            response = generate_response(query, contexts, history, service, language, intense)
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
            # Keep only last 10 messages in full history (store more for context, but use less in prompt)
            if len(history) > 10:
                conversation_histories[service][user_id] = history[-10:]
            persist_chat_history(user_id, service, conversation_histories[service][user_id])
            return jsonify({"response": response})
        except Exception as e:
            try:
                error_msg = str(e)
                logger.error(f"Error in handle_chat for service {service}: {error_msg}", exc_info=True)
            except Exception as log_error:
                logger.error("Error in handle_chat (encoding issue in logging)")
                error_msg = repr(e)
            
            # Safely return error message
            try:
                safe_error_msg = error_msg[:200] if error_msg else "Unknown error"
                return jsonify({"error": f"Error generating response: {safe_error_msg}"}), 500
            except Exception:
                return jsonify({"error": "Error generating response. Please try again."}), 500
    except Exception as e:
        try:
            error_msg = str(e)
            logger.error(f"Error in handle_chat: {error_msg}", exc_info=True)
        except Exception as log_error:
            logger.error("Error in handle_chat (encoding issue in logging)")
            error_msg = repr(e)
        
        try:
            safe_error_msg = error_msg[:200] if error_msg else "Unknown error"
            return jsonify({"error": f"Server error: {safe_error_msg}"}), 500
        except Exception:
            return jsonify({"error": "Server error. Please try again."}), 500

# Route for fetching chat history (MUST be before /<service>/chat route to avoid conflicts)
@app.route('/<service>/history', methods=['GET', 'OPTIONS'])
def get_chat_history(service):
    if request.method == 'OPTIONS':
        response = jsonify({"message": "CORS preflight successful"})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Methods", "GET, OPTIONS")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type, X-User-ID")
        return response, 200
    # Normalize service name (strip whitespace, convert to lowercase)
    service = normalize_service_key(service)
    logger.info(f"Received history request for service: '{service}', method: {request.method}")
    if service not in conversation_histories:
        available_services = list(conversation_histories.keys())
        logger.error(f"Invalid service category for history: '{service}'. Available services: {available_services}")
        return jsonify({
            "error": f"Invalid service category: '{service}'",
            "received_service": service,
            "available_services": available_services
        }), 400
    user_id = request.headers.get('X-User-ID', 'default_user')
    history = conversation_histories[service].get(user_id, [])
    if not history:
        history = fetch_latest_chat_history(user_id, service)
        if history:
            conversation_histories[service][user_id] = history
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
        cleaned_history = []
        for item in history:
            if not isinstance(item, dict):
                continue
            if item.get("role") != "bot":
                cleaned_history.append(item)
                continue
            content = str(item.get("content", "")).strip().lower()
            if any(snippet in content for snippet in blocked_snippets):
                continue
            cleaned_history.append(item)
        if len(cleaned_history) != len(history):
            history = cleaned_history
            conversation_histories[service][user_id] = cleaned_history
            try:
                persist_chat_history(user_id, service, cleaned_history)
            except Exception:
                pass
    return jsonify({"history": history}), 200

# User reminders
@app.route('/user/reminders', methods=['GET', 'POST', 'OPTIONS'])
def user_reminders():
    if request.method == 'OPTIONS':
        response = jsonify({"message": "CORS preflight successful"})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type, X-User-ID")
        return response, 200

    user_id = request.headers.get('X-User-ID')
    if not user_id:
        return jsonify({"error": "Missing X-User-ID header"}), 400

    if request.method == 'GET':
        try:
            response = (
                supabase.table("court_reminders")
                .select("*")
                .eq("user_id", user_id)
                .order("date", desc=False)
                .execute()
            )
            return jsonify({"reminders": response.data or []}), 200
        except Exception as e:
            logger.error("Error fetching reminders: %s", str(e))
            return jsonify({"reminders": []}), 200

    data = request.get_json() or {}
    reminders = data.get("reminders") or data.get("reminder") or []
    if isinstance(reminders, dict):
        reminders = [reminders]
    if not isinstance(reminders, list) or len(reminders) == 0:
        return jsonify({"error": "No reminders provided"}), 400

    if data.get("replace") is True:
        try:
            supabase.table("court_reminders").delete().eq("user_id", user_id).execute()
        except Exception as e:
            logger.warning("Failed to replace reminders: %s", str(e))

    payloads = [normalize_reminder_payload(item, user_id) for item in reminders]
    safe_supabase_insert("court_reminders", payloads)
    return jsonify({"reminders": payloads}), 201

# Current case
@app.route('/user/current-case', methods=['GET', 'POST', 'OPTIONS'])
def user_current_case():
    if request.method == 'OPTIONS':
        response = jsonify({"message": "CORS preflight successful"})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type, X-User-ID")
        return response, 200

    user_id = request.headers.get('X-User-ID')
    if not user_id:
        return jsonify({"error": "Missing X-User-ID header"}), 400

    if request.method == 'GET':
        source = request.args.get("source")
        try:
            query = (
                supabase.table("user_cases")
                .select("*")
                .eq("user_id", user_id)
            )
            if source:
                query = query.eq("source", source)
            response = query.order("updated_at", desc=True).limit(1).execute()
            latest_case = response.data[0] if response.data else None
            return jsonify({"case": latest_case}), 200
        except Exception as e:
            logger.error("Error fetching current case: %s", str(e))
            return jsonify({"case": None}), 200

    data = request.get_json() or {}
    summary = data.get("summary")
    if not summary:
        return jsonify({"error": "Missing case summary"}), 400

    payload = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "summary": summary,
        "service": data.get("service"),
        "source": data.get("source"),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    safe_supabase_insert("user_cases", payload)
    return jsonify({"case": payload}), 201

# Route for chatbot queries (MUST be after /<service>/history route)
@app.route('/<service>/chat', methods=['POST', 'OPTIONS'])
def chat_service(service):
    if request.method == 'OPTIONS':
        response = jsonify({"message": "CORS preflight successful"})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type, X-User-ID")
        return response, 200
    # Normalize service name (strip whitespace, convert to lowercase)
    service = normalize_service_key(service)
    logger.info(f"Received service request: '{service}'")
    logger.info(f"Available services: {list(conversation_histories.keys())}")
    
    if service not in conversation_histories:
        available_services = list(conversation_histories.keys())
        logger.error(f"Invalid service category: '{service}' (type: {type(service)}). Available services: {available_services}")
        logger.error(f"Service comparison: received='{service}', checking against: {[s for s in available_services]}")
        # Check for exact matches
        for key in available_services:
            logger.error(f"Comparing '{service}' == '{key}': {service == key}")
        return jsonify({
            "error": f"Invalid service category: '{service}'",
            "received_service": service,
            "received_service_repr": repr(service),
            "available_services": available_services,
            "debug": f"Service '{service}' not found in conversation_histories"
        }), 400
    logger.info(f"Service '{service}' found, proceeding with handle_chat")
    return handle_chat(service)

if __name__ == "__main__":
    BUCKET_NAME = "pdfs"
    # Run Pinecone index creation only if explicitly enabled
    if os.getenv("CREATE_PINECONE_INDEX", "false").lower() == "true":
        create_pinecone_index(BUCKET_NAME)
    port = int(os.environ.get("PORT", 5000))  # Hugging Face default port
    app.run(host="0.0.0.0", port=port, debug=False)
