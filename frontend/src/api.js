import { supabase } from "./supabaseClient";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

async function authHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");
  return { Authorization: `Bearer ${session.access_token}` };
}

async function handleResponse(response) {
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      // ignore — use statusText
    }
    throw new Error(detail);
  }
  if (response.status === 204) return null;
  return response.json();
}

export async function listTopics() {
  const headers = await authHeaders();
  const response = await fetch(`${API_BASE_URL}/question-bank/topics`, { headers });
  return handleResponse(response);
}

export async function listSessions() {
  const headers = await authHeaders();
  const response = await fetch(`${API_BASE_URL}/sessions`, { headers });
  return handleResponse(response);
}

export async function createSession(topic, maxQuestions) {
  const headers = await authHeaders();
  const response = await fetch(`${API_BASE_URL}/sessions`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ topic, max_questions: maxQuestions }),
  });
  return handleResponse(response);
}

export async function getNextQuestion(sessionId) {
  const headers = await authHeaders();
  const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/next-question`, { headers });
  return handleResponse(response);
}

export async function submitAnswer(sessionId, questionId, audioBlob) {
  const headers = await authHeaders();
  const formData = new FormData();
  formData.append("question_id", questionId);
  formData.append("file", audioBlob, "answer.webm");
  const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/answer`, {
    method: "POST",
    headers,
    body: formData,
  });
  return handleResponse(response);
}

export async function skipQuestion(sessionId, questionId) {
  const headers = await authHeaders();
  const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/skip`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ question_id: questionId }),
  });
  return handleResponse(response);
}

export async function finishSession(sessionId) {
  const headers = await authHeaders();
  const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/finish`, {
    method: "POST",
    headers,
  });
  return handleResponse(response);
}

export async function getSessionState(sessionId) {
  const headers = await authHeaders();
  const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`, { headers });
  return handleResponse(response);
}

export function base64ToAudioUrl(base64, mime) {
  const bytes = atob(base64);
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) buffer[i] = bytes.charCodeAt(i);
  const blob = new Blob([buffer], { type: mime });
  return URL.createObjectURL(blob);
}
