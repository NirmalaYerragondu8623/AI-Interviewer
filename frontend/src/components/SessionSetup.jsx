export default function SessionSetup({
  topics,
  topicsLoading,
  selectedTopic,
  setSelectedTopic,
  maxQuestions,
  setMaxQuestions,
  onStart,
  starting,
  disabled,
}) {
  return (
    <div className="panel-card">
      <h2>Session Setup</h2>

      <label>
        Topic
        <select
          value={selectedTopic}
          onChange={(e) => setSelectedTopic(e.target.value)}
          disabled={disabled || topicsLoading}
        >
          <option value="" disabled>
            {topicsLoading ? "Loading topics…" : "Select a topic"}
          </option>
          {topics.map((topic) => (
            <option key={topic} value={topic}>
              {topic}
            </option>
          ))}
        </select>
      </label>

      <label>
        Maximum number of questions
        <input
          type="number"
          min={1}
          value={maxQuestions}
          onChange={(e) => setMaxQuestions(Number(e.target.value))}
          disabled={disabled}
        />
      </label>

      <button type="button" onClick={onStart} disabled={disabled || starting || !selectedTopic}>
        {starting ? "Starting…" : "Start Interview"}
      </button>
    </div>
  );
}
