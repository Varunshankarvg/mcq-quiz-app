import React, { useState, useEffect, useRef } from "react";
import {
  getTopics,
  getSubtopics,
  getQuiz,
  saveProgress,
  getProgress
} from "./api";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  Label
} from "recharts";
import { motion } from "framer-motion";
import "./QuizApp.css";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';











const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

const QuizApp = ({ user }) => {
  const [topics, setTopics] = useState([]);
  const [subtopics, setSubtopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState("");
  const [selectedSubtopic, setSelectedSubtopic] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answeredQuestions, setAnsweredQuestions] = useState(new Set());

  const [score, setScore] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [sessionScore, setSessionScore] = useState(0);
  const [sessionQuestions, setSessionQuestions] = useState(0);

  const [subtopicProgress, setSubtopicProgress] = useState({});
  const [sessionSubtopicProgress, setSessionSubtopicProgress] = useState({});

  const [quizActive, setQuizActive] = useState(false);
  const [difficulty, setDifficulty] = useState("Easy");
  const [correctStreak, setCorrectStreak] = useState(0);
  const [wrongStreak, setWrongStreak] = useState(0);

  const [timeLeft, setTimeLeft] = useState(30);
  const timerRef = useRef(null);
  const isHandlingAnswerRef = useRef(false); // ✅ useRef for locking state
  const [quizHistory, setQuizHistory] = useState([]);


  useEffect(() => {
    getTopics().then((res) => setTopics(res.topics));
  }, []);

  useEffect(() => {
    if (selectedTopic) {
      getSubtopics(selectedTopic).then((res) => setSubtopics(res.subtopics));
    }
  }, [selectedTopic]);

  useEffect(() => {
    if (user) {
      getProgress(user.username)
        .then((data) => {
          setScore(data.score || 0);
          setTotalQuestions(data.total_questions || 0);
          if (data.subtopics) {
            setSubtopicProgress(data.subtopics);
          }
        })
        .catch((error) => {
          console.error("Error loading progress:", error);
        });
    }
  }, [user]);

  useEffect(() => {
    if (quizActive && currentQuestion) {
      setTimeLeft(30);
      if (timerRef.current) clearInterval(timerRef.current);

      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            timerRef.current = null;
            handleTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [currentQuestion]);

  const handleTimeout = () => {
    if (!currentQuestion || isHandlingAnswerRef.current) return;

    isHandlingAnswerRef.current = true;
    alert(`⏱️ Time's up! Correct answer is ${currentQuestion.answer}`);
    handleAnswerClick("TIMEOUT", true);
  };

  const startQuiz = () => {
    setQuizActive(true);
    setAnsweredQuestions(new Set());
    setDifficulty("Easy");
    setCorrectStreak(0);
    setWrongStreak(0);
    setSessionScore(0);
    setSessionQuestions(0);
    setSessionSubtopicProgress({});
    fetchNewQuestion("Easy");
  };

  const stopQuiz = () => {
    isHandlingAnswerRef.current = false; // ✅ properly reset the ref
    setQuizActive(false);
    setCurrentQuestion(null);
    clearInterval(timerRef.current);

    const updatedScore = score + sessionScore;
    const updatedTotal = totalQuestions + sessionQuestions;

    setScore(updatedScore);
    setTotalQuestions(updatedTotal);

    if (!user) return;

    saveProgress(user.username, {
      score: sessionScore,
      total_questions: sessionQuestions,
      subtopics: sessionSubtopicProgress
    })
      .then(() => {
        console.log("✅ Final Progress saved");
        return getProgress(user.username);
      })
      .then((res) => {
        if (res) {
          setScore(res.score || 0);
          setTotalQuestions(res.total_questions || 0);
          if (res.subtopics) {
            setSubtopicProgress(res.subtopics);
          }
        }
      })
      .catch((err) => console.error("❌ Error saving progress:", err));

    alert(`🎯 Quiz Stopped! Your Final Score: ${sessionScore}/${sessionQuestions}`);
    setSessionScore(0);
    setSessionQuestions(0);
    setSessionSubtopicProgress({});
  };

  const fetchNewQuestion = (updatedDifficulty) => {
    getQuiz(selectedTopic, updatedDifficulty, selectedSubtopic).then((res) => {
      const newQuestions = res.mcqs.filter(
        (q) => !answeredQuestions.has(q.question)
      );
      if (newQuestions.length > 0) {
        const nextQuestion = newQuestions[0];
        setCurrentQuestion(nextQuestion);
        setAnsweredQuestions((prev) => new Set(prev).add(nextQuestion.question));
      } else {
        alert(`No more ${updatedDifficulty} questions available!`);
        stopQuiz();
      }
    });
  };

  const handleAnswerClick = (selectedOption, isTimeout = false) => {
    if (!currentQuestion) return;
  
    if (!isTimeout && isHandlingAnswerRef.current) return;
  
    isHandlingAnswerRef.current = true;
  
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  
    const correctAnswer = currentQuestion.answer;
    let updatedDifficulty = difficulty;
    const isCorrect = selectedOption === correctAnswer;
  
    // Track answer in history
    setQuizHistory((prev) => [
      ...prev,
      {
        question: currentQuestion.question,
        options: currentQuestion.options,
        selectedOption,
        correctAnswer
      }
    ]);
  
    if (!isTimeout && isCorrect) {
      setSessionScore((prev) => prev + 1);
      setCorrectStreak((prev) => prev + 1);
      setWrongStreak(0);
      alert("✅ Correct!");
      if (correctStreak + 1 >= 3) {
        if (difficulty === "Easy") updatedDifficulty = "Medium";
        else if (difficulty === "Medium") updatedDifficulty = "Hard";
        setCorrectStreak(0);
      }
    } else {
      setWrongStreak((prev) => prev + 1);
      setCorrectStreak(0);
      if (!isTimeout) {
        alert(`❌ Incorrect! Correct answer is ${correctAnswer}`);
      }
      if (wrongStreak + 1 >= 3) {
        if (difficulty === "Hard") updatedDifficulty = "Medium";
        else if (difficulty === "Medium") updatedDifficulty = "Easy";
        setWrongStreak(0);
      }
    }
  
    setSessionQuestions((prev) => prev + 1);
  
    setSubtopicProgress((prev) => {
      const existing = prev[selectedSubtopic] || { correct: 0, total: 0 };
      return {
        ...prev,
        [selectedSubtopic]: {
          correct: existing.correct + (isCorrect ? 1 : 0),
          total: existing.total + 1
        }
      };
    });
  
    setSessionSubtopicProgress((prev) => {
      const existing = prev[selectedSubtopic] || { correct: 0, total: 0 };
      return {
        ...prev,
        [selectedSubtopic]: {
          correct: existing.correct + (isCorrect ? 1 : 0),
          total: existing.total + 1
        }
      };
    });
  
    setTimeout(() => {
      setDifficulty(updatedDifficulty);
      fetchNewQuestion(updatedDifficulty);
      isHandlingAnswerRef.current = false;
    }, 500);
  };
  

  const overallProgressData = [
    { name: "Correct", value: score },
    { name: "Incorrect", value: Math.max(totalQuestions - score, 0) }
  ];


  
  const exportToPDF = () => {
    const doc = new jsPDF();
  
    const title = `Quiz Report - ${user?.username || "Anonymous"}`;
    const date = new Date().toLocaleString();
  
    doc.setFontSize(18);
    doc.text(title, 14, 15);
    doc.setFontSize(12);
    doc.text(`Date: ${date}`, 14, 25);
    doc.text(`Topic: ${selectedTopic}`, 14, 33);
    doc.text(`Subtopic: ${selectedSubtopic}`, 14, 40);
  
    const tableData = quizHistory.map((item, idx) => {
      const selected = item.selectedOption || "Not Answered";
      let result = "Wrong";
  
      if (selected === "TIMEOUT") {
        result = "Time Over";
      } else if (selected === item.correctAnswer) {
        result = "Correct";
      }
  
      return [
        idx + 1,
        item.question,
        item.options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join("\n"),
        selected,
        result,
        item.correctAnswer
      ];
    });
  
    autoTable(doc, {
      head: [["#", "Question", "Options", "Your Answer", "Result", "Correct Answer"]],
      body: tableData,
      startY: 50,
      styles: {
        fontSize: 8,
        cellWidth: 'wrap',
        overflow: 'linebreak', // allow long text to wrap
      },
      columnStyles: {
        1: { cellWidth: 60 }, // Question column
        2: { cellWidth: 50 }, // Options column
      },
      headStyles: { fillColor: [22, 160, 133] }
    });
  
    doc.save(`quiz_report_${user?.username || "user"}.pdf`);
  };
  
  
  

  return (
    <div className="quiz-container">
      <motion.h1 animate={{ scale: [0.9, 1] }} transition={{ duration: 0.5 }}>
        MCQ Quiz
      </motion.h1>
      <p className="difficulty"><strong>Current Difficulty:</strong> {difficulty}</p>
      <p className="score"><strong>Score:</strong> {score}/{totalQuestions}</p>

      <motion.select
        className="dropdown"
        value={selectedTopic}
        onChange={(e) => {
          setSelectedTopic(e.target.value);
          setSelectedSubtopic("");
        }}
      >
        <option value="">Select Topic</option>
        {topics.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </motion.select>

      {selectedTopic && (
        <motion.select
          className="dropdown"
          value={selectedSubtopic}
          onChange={(e) => setSelectedSubtopic(e.target.value)}
        >
          <option value="">Select Subtopic</option>
          {subtopics.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </motion.select>
      )}

      {!quizActive ? (
        <motion.button
          className="start-btn"
          whileHover={{ scale: 1.1 }}
          disabled={!selectedTopic || !selectedSubtopic}
          onClick={startQuiz}
        >
          Start Quiz
        </motion.button>
      ) : (
        <motion.button
          className="stop-btn"
          whileHover={{ scale: 1.1 }}
          onClick={stopQuiz}
        >
          Stop Quiz
        </motion.button>
      )}

      {currentQuestion && quizActive && (
        <motion.div className="question-container">
          <p>{currentQuestion.question}</p>
          <p className="timer">⏱️ Time Left: {timeLeft} sec</p>
          {currentQuestion.options.map((opt, i) => (
            <motion.button
              key={i}
              className="answer-btn"
              whileHover={{ scale: 1.1 }}
              onClick={() => handleAnswerClick(String.fromCharCode(65 + i))}
            >
              {String.fromCharCode(65 + i)}. {opt}
            </motion.button>
          ))}
        </motion.div>
      )}

      <h2>Overall Performance</h2>
      <PieChart width={300} height={300}>
        <Pie
          data={overallProgressData}
          cx="50%"
          cy="50%"
          outerRadius={80}
          dataKey="value"
        >
          <Label
            value={`Total: ${score}/${totalQuestions}`}
            position="center"
            fill="#000"
          />
          {overallProgressData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>

      

      <h2>Subtopic Performance</h2>
      {Object.entries(subtopicProgress).map(([sub, data], index) => {
        const incorrect = data.total - data.correct;
        const chartData = [
          { name: "Correct", value: data.correct },
          { name: "Incorrect", value: Math.max(incorrect, 0) }
        ];
        return (
          <div key={index}>
            <h3>{sub}</h3>
            <PieChart width={300} height={300}>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
              >
                <Label
                  value={`Total: ${data.correct}/${data.total}`}
                  position="center"
                  fill="#000"
                />
                {chartData.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </div>
        );
      })}

      {/* 📄 Export to PDF button goes here */}
    {quizHistory.length > 0 && (
      <motion.button
        className="export-btn"
        whileHover={{ scale: 1.1 }}
        onClick={exportToPDF}
      >
        📄 Export Quiz Report as PDF
      </motion.button>
    )}
    </div>
  );
};

export default QuizApp;
