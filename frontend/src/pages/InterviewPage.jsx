import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  base64ToAudioUrl,
  createSession,
  finishSession,
  getNextQuestion,
  getSessionState,
  listTopics,
  skipQuestion,
  submitAnswer,
} from "../api";
import AppHeader from "../components/AppHeader";
import SessionSetup from "../components/SessionSetup";
import TranscriptPanel from "../components/TranscriptPanel";
import InterviewWorkspace from "../components/InterviewWorkspace";
import OverallResults from "../components/OverallResults";

export default function InterviewPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [topics, setTopics] = useState([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState("");
  const [maxQuestions, setMaxQuestions] = useState(5);

  const [interviewSession, setInterviewSession] = useState(null);
  const [starting, setStarting] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [latestAnswerFeedback, setLatestAnswerFeedback] = useState(null);
  const [overallFeedback, setOverallFeedback] = useState(null);
  const [error, setError] = useState(null);

  const audioRef = useRef(null);
  const micStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    listTopics()
      .then(setTopics)
      .catch((err) => setError(err.message))
      .finally(() => setTopicsLoading(false));
  }, []);

  useEffect(() => {
    const resumeId = searchParams.get("resume");
    if (!resumeId) return;

    (async () => {
      setStarting(true);
      setError(null);
      try {
        const state = await getSessionState(resumeId);
        if (state.session.status !== "in_progress") {
          navigate(`/sessions/${resumeId}`, { replace: true });
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;
        setInterviewSession(state.session);
        setAnswers(state.answers);
        setOverallFeedback(null);
        await loadNextQuestion(state.session.id);
      } catch (err) {
        setError(err.message);
      } finally {
        setStarting(false);
        setSearchParams({}, { replace: true });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!currentQuestion || !audioUrl || !audioRef.current) return;
    const audioEl = audioRef.current;
    audioEl.src = audioUrl;
    audioEl.play().catch(() => {
      // Autoplay blocked — the candidate can still start recording manually
      // by clicking "Next Question" once they've read the question.
      setError('Audio autoplay was blocked by the browser. Read the question, then click "Next Question" when ready to move on.');
    });
    return () => URL.revokeObjectURL(audioUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl]);

  useEffect(() => {
    return () => {
      micStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function startRecording() {
    const stream = micStreamRef.current;
    if (!stream) return;
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setPhase("recording");
  }

  function stopRecordingAndGetBlob() {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve(null);
        return;
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        mediaRecorderRef.current = null;
        resolve(blob);
      };
      recorder.stop();
    });
  }

  async function loadNextQuestion(sessionId) {
    setPhase("loading-question");
    setCurrentQuestion(null);
    setLatestAnswerFeedback(null);
    setError(null);
    try {
      const question = await getNextQuestion(sessionId);
      if (!question) {
        await handleFinish(sessionId);
        return;
      }
      setCurrentQuestion(question);
      setAudioUrl(base64ToAudioUrl(question.audio_base64, question.audio_mime));
      setPhase("playing-question");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleStart() {
    setStarting(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const newSession = await createSession(selectedTopic, maxQuestions);
      setInterviewSession(newSession);
      setAnswers([]);
      setOverallFeedback(null);
      await loadNextQuestion(newSession.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  }

  async function handleAudioEnded() {
    startRecording();
  }

  async function handleNext() {
    if (!interviewSession || !currentQuestion) return;
    setPhase("submitting");
    setError(null);
    try {
      const blob = await stopRecordingAndGetBlob();
      if (blob && blob.size > 0) {
        const feedback = await submitAnswer(interviewSession.id, currentQuestion.question_id, blob);
        setAnswers((prev) => [...prev, feedback]);
        setLatestAnswerFeedback(feedback);
      }
      await loadNextQuestion(interviewSession.id);
    } catch (err) {
      setError(err.message);
      setPhase("recording");
    }
  }

  async function handleSkip() {
    if (!interviewSession || !currentQuestion) return;
    setPhase("skipping");
    setError(null);
    try {
      await stopRecordingAndGetBlob(); // discard whatever was recorded so far
      await skipQuestion(interviewSession.id, currentQuestion.question_id);
      setLatestAnswerFeedback(null);
      await loadNextQuestion(interviewSession.id);
    } catch (err) {
      setError(err.message);
      setPhase("recording");
    }
  }

  async function handleFinish(sessionIdOverride) {
    const sessionId = sessionIdOverride || interviewSession?.id;
    if (!sessionId) return;
    setPhase("finishing");
    setError(null);
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      }
      const overall = await finishSession(sessionId);
      setOverallFeedback(overall);
      setCurrentQuestion(null);
      setPhase("finished");
      micStreamRef.current?.getTracks().forEach((track) => track.stop());
    } catch (err) {
      setError(err.message);
    }
  }

  const sessionEnded = phase === "finished";

  return (
    <div className="app-shell">
      <AppHeader>
        <Link to="/sessions" className="secondary nav-link">
          Session History
        </Link>
      </AppHeader>

      <main className="two-panel">
        <section className="left-panel">
          <SessionSetup
            topics={topics}
            topicsLoading={topicsLoading}
            selectedTopic={selectedTopic}
            setSelectedTopic={setSelectedTopic}
            maxQuestions={maxQuestions}
            setMaxQuestions={setMaxQuestions}
            onStart={handleStart}
            starting={starting}
            disabled={!!interviewSession}
          />
          {sessionEnded && <TranscriptPanel answers={answers} />}
        </section>

        <section className="right-panel">
          <InterviewWorkspace
            session={interviewSession}
            currentQuestion={currentQuestion}
            phase={phase}
            error={error}
            audioRef={audioRef}
            onAudioEnded={handleAudioEnded}
            onNext={handleNext}
            onSkip={handleSkip}
            onFinish={() => handleFinish()}
            latestAnswerFeedback={latestAnswerFeedback}
          />
          {sessionEnded && overallFeedback && <OverallResults overallFeedback={overallFeedback} />}
        </section>
      </main>
    </div>
  );
}
