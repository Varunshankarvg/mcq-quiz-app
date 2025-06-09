from flask import Flask, request, jsonify
import os
import random
import spacy
import bcrypt
import jwt
import datetime
from functools import wraps
from pymongo import MongoClient

app = Flask(__name__)
nlp = spacy.load("en_core_web_sm")

# Enable CORS for frontend communication
from flask_cors import CORS
CORS(app)

# Secret key for JWT
app.config['SECRET_KEY'] = 'your_super_secret_key'  # Replace with a strong key in production

# MongoDB setup
#client = MongoClient("mongodb+srv://varun:HV@hv.o2mfi1r.mongodb.net/", tls=True, tlsAllowInvalidCertificates=True)

client = MongoClient(
    "mongodb+srv://hemadiksitha:HV@hema.arbgjdb.mongodb.net/?retryWrites=true&w=majority&tls=true"
)


db = client.mcq_quiz
progress_collection = db.user_progress
users_collection = db.users

# Test MongoDB connection
try:
    client.admin.command('ping')
    print("✅ MongoDB Connected Successfully!")
except Exception as e:
    print(f"❌ MongoDB Connection Failed: {e}")

DATASET_PATH = os.path.join(os.path.dirname(__file__), 'dataset')
#DATASET_PATH = "../dataset"

# ✅ JWT Token Required Decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if token and token.startswith("Bearer "):
            token = token.split(" ")[1]
        else:
            return jsonify({"error": "Token is missing!"}), 401

        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = data['user_id']
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        return f(current_user, *args, **kwargs)
    return decorated

def list_topics():
    return sorted([folder for folder in os.listdir(DATASET_PATH) if os.path.isdir(os.path.join(DATASET_PATH, folder))])

def list_subtopics(topic, difficulty):
    difficulty_path = os.path.join(DATASET_PATH, topic, difficulty)
    return sorted([file for file in os.listdir(difficulty_path) if file.endswith(".txt")])

def load_text(topic, difficulty, subtopic):
    file_path = os.path.join(DATASET_PATH, topic, difficulty, subtopic)
    try:
        with open(file_path, "r", encoding="utf-8") as file:
            return file.read().strip()
    except:
        return None

def generate_mcqs(text, num_questions=1):
    if not text:
        return []

    doc = nlp(text)
    sentences = [sent.text.strip() for sent in doc.sents if len(sent.text.strip()) > 5]

    if len(sentences) < 2:
        return []

    num_questions = min(num_questions, len(sentences))
    selected_sentences = random.sample(sentences, num_questions)
    mcqs = []

    for sentence in selected_sentences:
        sent_doc = nlp(sentence)
        nouns = [token.text for token in sent_doc if token.pos_ == "NOUN"]
        if len(nouns) < 2:
            continue

        subject = random.choice(nouns)
        question_stem = sentence.replace(subject, "_______")

        num_distractors = min(3, len(set(nouns)) - 1)
        answer_choices = [subject] + random.sample(list(set(nouns) - {subject}), num_distractors) if num_distractors > 0 else [subject]
        random.shuffle(answer_choices)
        correct_answer = chr(65 + answer_choices.index(subject))

        mcqs.append({
            "question": question_stem,
            "options": answer_choices,
            "answer": correct_answer
        })

    return mcqs

def user_exists(username):
    return users_collection.find_one({"username": username}) is not None

# 🔹 Signup
@app.route("/signup", methods=["POST"])
def signup():
    data = request.json
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    if user_exists(username):
        return jsonify({"error": "Username already exists"}), 409

    hashed_pw = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    users_collection.insert_one({
        "username": username,
        "password": hashed_pw
    })

    return jsonify({"message": "User registered successfully!"}), 201

# 🔹 Login with JWT generation
@app.route("/login", methods=["POST"])
def login():
    data = request.json
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    user = users_collection.find_one({"username": username})
    if not user:
        return jsonify({"error": "Invalid username or password"}), 401

    if bcrypt.checkpw(password.encode("utf-8"), user["password"]):
        token = jwt.encode({
            "user_id": username,
            "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=2)
        }, app.config['SECRET_KEY'], algorithm="HS256")

        return jsonify({"success": True, "message": "Login successful", "token": token}), 200

    else:
        return jsonify({"error": "Invalid username or password"}), 401

@app.route("/topics", methods=["GET"])
def get_topics():
    return jsonify({"topics": list_topics()})


@app.route("/subtopics/<topic>", methods=["GET"])
def get_subtopics(topic):
    return jsonify({"subtopics": list_subtopics(topic, "Easy")})

@app.route("/quiz", methods=["POST"])
def get_mcqs():
    data = request.json
    topic, difficulty, subtopic = data["topic"], data["difficulty"], data["subtopic"]

    text = load_text(topic, difficulty, subtopic)
    if not text:
        return jsonify({"error": "No data found"}), 400

    mcqs = generate_mcqs(text, num_questions=3)
    return jsonify({"mcqs": mcqs})

@app.route("/progress", methods=["POST"])
def save_progress():
    data = request.json
    username = data.get("username")
    session_subtopics = data.get("subtopics", {})

    if not username or not isinstance(session_subtopics, dict):
        return jsonify({"error": "Missing or invalid data"}), 400

    try:
        existing_progress = progress_collection.find_one({"username": username}) or {
            "subtopics": {},
            "score": 0,
            "total_questions": 0
        }

        # Merge subtopic scores
        merged_subtopics = existing_progress.get("subtopics", {})
        for subtopic, session_stats in session_subtopics.items():
            session_correct = session_stats.get("correct", 0)
            session_total = session_stats.get("total", 0)

            prev = merged_subtopics.get(subtopic, {"correct": 0, "total": 0})
            merged_subtopics[subtopic] = {
                "correct": prev["correct"] + session_correct,
                "total": prev["total"] + session_total
            }

        # Recompute overall score from merged data
        total_correct = sum(sub["correct"] for sub in merged_subtopics.values())
        total_questions = sum(sub["total"] for sub in merged_subtopics.values())

        progress_collection.update_one(
            {"username": username},
            {
                "$set": {
                    "subtopics": merged_subtopics,
                    "score": total_correct,
                    "total_questions": total_questions
                }
            },
            upsert=True
        )

        return jsonify({"message": "Progress saved!"}), 200

    except Exception as e:
        return jsonify({"error": f"Failed to save progress: {str(e)}"}), 500




# 🔹 Protected route: Get progress (requires JWT token)
@app.route("/progress/<username>", methods=["GET"])
@token_required
def get_progress(current_user, username):
    if current_user != username:
        return jsonify({"error": "Unauthorized access"}), 403

    progress = progress_collection.find_one({"username": username}, {"_id": 0})
    if not progress:
        progress = {"username": username, "score": 0, "total_questions": 0, "subtopics": {}}

    return jsonify(progress)


# 🔹 JWT Token Validator Route (Optional)
@app.route("/verify-token", methods=["GET"])
@token_required
def verify_token(current_user):
    return jsonify({"message": "Token is valid", "user_id": current_user}), 200

if __name__ == "__main__":
    app.run(debug=True)
