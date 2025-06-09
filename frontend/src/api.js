import axios from "axios";

//const API_URL = "http://127.0.0.1:5000";
const API_URL = "https://quiz-backend-fzn8.onrender.com";

// Helper to get Authorization headers
const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

// Existing functions
export const getTopics = async () => {
  try {
    const response = await axios.get(`${API_URL}/topics`);
    return response.data;
  } catch (error) {
    console.error("Error fetching topics:", error);
    throw error;
  }
};

export const getSubtopics = async (topic) => {
  try {
    const response = await axios.get(`${API_URL}/subtopics/${topic}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching subtopics for ${topic}:`, error);
    throw error;
  }
};

export const getQuiz = async (topic, difficulty, subtopic) => {
  try {
    const response = await axios.post(`${API_URL}/quiz`, {
      topic,
      difficulty,
      subtopic,
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching quiz:", error);
    throw error;
  }
};

export const saveProgress = async (username, progress) => {
  try {
    const response = await axios.post(
      `${API_URL}/progress`,
      {
        username: username,  // 🔄 changed from user_id
        ...progress,
      },
      authHeaders()
    );
    return response.data;
  } catch (error) {
    console.error("Error saving progress:", error);
    throw error;
  }
};


export const getProgress = async (username) => {
  const token = localStorage.getItem("token");  // ⬅️ fetch token here
  if (!token) {
    throw new Error("No token found. User might not be logged in.");
  }

  try {
    const response = await axios.get(`${API_URL}/progress/${username}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching progress for user ${username}:`, error);
    throw error;
  }
};





// Updated login and signup functions using username
export const signupUser = async (username, password) => {
  try {
    const response = await axios.post(`${API_URL}/signup`, {
      username,
      password,
    });
    return response.data;
  } catch (error) {
    console.error("Signup error:", error.response?.data || error.message);
    throw error;
  }
};

export const loginUser = async (username, password) => {
  try {
    const response = await axios.post(`${API_URL}/login`, {
      username,
      password,
    });

    // Save token to localStorage
    if (response.data && response.data.token) {
      localStorage.setItem("token", response.data.token);
    }

    return response.data;
  } catch (error) {
    console.error("Login error:", error.response?.data || error.message);
    throw error;
  }
};
