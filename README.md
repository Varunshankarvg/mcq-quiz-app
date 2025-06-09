
# 📚 MCQ Quiz App – Adaptive Learning with Flask + React

This is a full-stack adaptive quiz system that allows users to practice MCQs dynamically using a Flask backend and a React frontend. The system adjusts difficulty based on performance and uses local datasets for questions.

---

## 🛠 Tech Stack

| Layer     | Tech                     |
|-----------|--------------------------|
| Frontend  | React.js, Axios, Tailwind CSS (if used) |
| Backend   | Python Flask             |
| Database  | Local file-based dataset |
| Dev Tools | VS Code, Git, Node.js, Python 3.8+ |

---

## 📁 Project Structure

```
mcq-quiz-app/
├── backend/         # Flask backend (app.py)
│   ├── app.py
│   ├── dataset/     # Folder containing text files with questions
│   └── requirements.txt
├── frontend/        # React frontend
│   ├── public/
│   └── src/
├── dataset/         # Shared MCQ question files
└── README.md
```

---

## 🚀 How to Run the Project

### 🔹 1. Run the Flask Backend

```bash
cd backend
python -m venv venv
venv/Scripts/activate      # Windows
# or
source venv/bin/activate   # macOS/Linux

pip install -r requirements.txt
python app.py
```

> Runs at: `http://localhost:5000`

---

### 🔹 2. Run the React Frontend

```bash
cd frontend
npm install
npm start
```

> Runs at: `http://localhost:3000`  
> Ensure your frontend makes API calls to the Flask server at port `5000`.

---

## 📂 Dataset Format

Questions are organized by topic and difficulty level using `.txt` files inside `/dataset/`.  
Each file contains structured MCQs used by the backend.

---

## ✨ Features

- 🔁 Adaptive quiz logic (auto-adjusts difficulty)
- 📊 Score tracking and user feedback
- 📂 Question bank read from text dataset
- 💬 Clean UI and fast backend API

