import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  HelpCircle,
  Trophy,
  PlayCircle,
  X,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import type { MissionId } from '../types/simulation.ts';
import {
  KNOWLEDGE_ARTICLES,
  TRIVIA_QUESTIONS,
} from '../data/knowledgeAndTrivia.ts';
import {
  fetchTriviaLeaderboard,
  submitTriviaScoreApi,
  type TriviaScoreRecord,
} from '../services/apiClient.ts';
import { AnimatedDecodeText } from './AnimatedText.tsx';

interface KnowledgeAndTriviaModalProps {
  isOpen: boolean;
  initialTab: 'knowledge' | 'trivia';
  onClose: () => void;
  onSimulateConcept: (missionId: MissionId, epochs: number) => void;
}

export const KnowledgeAndTriviaModal: React.FC<KnowledgeAndTriviaModalProps> = ({
  isOpen,
  initialTab,
  onClose,
  onSimulateConcept,
}) => {
  const [activeTab, setActiveTab] = useState<'knowledge' | 'trivia'>(initialTab);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [callsign, setCallsign] = useState('');
  const [leaderboard, setLeaderboard] = useState<TriviaScoreRecord[]>([]);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!isOpen) return;
    fetchTriviaLeaderboard()
      .then((rows) => setLeaderboard(rows))
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const currentQ = TRIVIA_QUESTIONS[questionIdx];

  const handleSelectAnswer = (idx: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(idx);
    setAnsweredCount((c) => c + 1);
    if (idx === currentQ.correctIndex) {
      setScore((s) => s + 1);
    }
  };

  const handleNextQuestion = () => {
    setSelectedOption(null);
    setQuestionIdx((idx) => (idx + 1) % TRIVIA_QUESTIONS.length);
  };

  const handleLeaderboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = callsign.trim();
    if (cleaned.length < 2) {
      setSubmitStatus('Callsign must be at least 2 characters.');
      return;
    }
    try {
      setSubmitStatus('Recording score...');
      await submitTriviaScoreApi({
        pilotCallsign: cleaned,
        score,
        totalQuestions: TRIVIA_QUESTIONS.length,
      });
      const updated = await fetchTriviaLeaderboard();
      setLeaderboard(updated);
      setCallsign('');
      setSubmitStatus('Score saved to leaderboard!');
    } catch (err) {
      setSubmitStatus(err instanceof Error ? err.message : 'Unable to save score');
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="ML Knowledge Lab and Engineering Trivia">
      <div className="modal-dialog">
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setActiveTab('knowledge')}
              className={`action-btn ${activeTab === 'knowledge' ? 'primary' : ''}`}
            >
              <BookOpen size={15} />
              How Tesla &amp; SpaceX Implement It
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('trivia')}
              className={`action-btn ${activeTab === 'trivia' ? 'primary' : ''}`}
            >
              <HelpCircle size={15} />
              Interactive Physics &amp; ML Trivia ({score}/{TRIVIA_QUESTIONS.length})
            </button>
          </div>

          <button type="button" onClick={onClose} className="action-btn" aria-label="Close Modal">
            <X size={16} />
            Close
          </button>
        </div>

        {activeTab === 'knowledge' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '0.9rem' }}>
            {KNOWLEDGE_ARTICLES.map((art) => (
              <article
                key={art.id}
                style={{
                  background: '#0d0d0d',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                }}
              >
                <span style={{ fontSize: '0.68rem', fontWeight: 900, color: '#ffffff', letterSpacing: '0.09em' }}>
                  {art.tag}
                </span>
                <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#ffffff' }}>
                  <AnimatedDecodeText text={art.title} />
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#d4d4d4', lineHeight: 1.45 }}>{art.summary}</p>
                <ul style={{ paddingLeft: '1.1rem', fontSize: '0.75rem', color: '#9e9e9e', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {art.deepDivePoints.map((pt) => (
                    <li key={pt}>{pt}</li>
                  ))}
                </ul>
                <div
                  style={{
                    background: '#000000',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    padding: '0.45rem 0.65rem',
                    borderRadius: '0.35rem',
                    fontFamily: 'monospace',
                    fontSize: '0.72rem',
                    color: '#ffffff',
                    overflowX: 'auto',
                  }}
                >
                  {art.equationLatex}
                </div>
                <div style={{ marginTop: 'auto', paddingTop: '0.35rem' }}>
                  <button
                    type="button"
                    className="action-btn primary"
                    onClick={() => {
                      onSimulateConcept(art.linkedMissionId, art.demoEpochs);
                      onClose();
                    }}
                  >
                    <PlayCircle size={15} />
                    Simulate This in 3D (Epoch {art.demoEpochs})
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1rem' }}>
            {/* Trivia Question Card */}
            <div
              style={{
                background: '#0d0d0d',
                border: '1px solid rgba(255, 255, 255, 0.35)',
                borderRadius: '0.5rem',
                padding: '1.1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#ffffff', fontWeight: 800 }}>
                <span>CATEGORY: {currentQ.category.toUpperCase()}</span>
                <span>
                  QUESTION {questionIdx + 1} OF {TRIVIA_QUESTIONS.length}
                </span>
              </div>

              <h3 style={{ fontSize: '0.96rem', color: '#ffffff', lineHeight: 1.4 }}>{currentQ.question}</h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {currentQ.options.map((opt, idx) => {
                  const isChosen = selectedOption === idx;
                  const isCorrect = idx === currentQ.correctIndex;
                  let borderCol = 'rgba(255, 255, 255, 0.25)';
                  let bgCol = '#050505';
                  let textCol = '#f5f5f5';

                  if (selectedOption !== null) {
                    if (isCorrect) {
                      borderCol = '#ffffff';
                      bgCol = '#ffffff';
                      textCol = '#000000';
                    } else if (isChosen) {
                      borderCol = '#737373';
                      bgCol = '#1f1f1f';
                      textCol = '#9e9e9e';
                    }
                  }

                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => handleSelectAnswer(idx)}
                      style={{
                        textAlign: 'left',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '0.45rem',
                        border: `1px solid ${borderCol}`,
                        background: bgCol,
                        color: textCol,
                        fontWeight: selectedOption !== null && isCorrect ? 800 : 500,
                        fontSize: '0.78rem',
                        cursor: selectedOption === null ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                      }}
                    >
                      <span>{opt}</span>
                      {selectedOption !== null && isCorrect && <CheckCircle size={16} color="#000000" />}
                      {selectedOption !== null && isChosen && !isCorrect && <XCircle size={16} color="#9e9e9e" />}
                    </button>
                  );
                })}
              </div>

              {selectedOption !== null && (
                <div
                  style={{
                    background: '#050505',
                    border: '1px solid rgba(255, 255, 255, 0.45)',
                    borderRadius: '0.45rem',
                    padding: '0.8rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.45rem',
                  }}
                >
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#ffffff' }}>
                    Physics &amp; ML Breakdown:
                  </div>
                  <p style={{ fontSize: '0.76rem', color: '#d4d4d4', lineHeight: 1.4 }}>{currentQ.explanation}</p>
                  <div
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.72rem',
                      color: '#ffffff',
                      background: '#000000',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      padding: '0.35rem 0.55rem',
                      borderRadius: '0.35rem',
                    }}
                  >
                    {currentQ.formulaLatex}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem' }}>
                    <button
                      type="button"
                      className="action-btn primary"
                      onClick={() => {
                        onSimulateConcept(currentQ.linkedMissionId, currentQ.linkedEpochDemo);
                        onClose();
                      }}
                    >
                      <PlayCircle size={14} />
                      Demonstrate in 3D (Epoch {currentQ.linkedEpochDemo})
                    </button>
                    <button type="button" className="action-btn" onClick={handleNextQuestion}>
                      Next Trivia Question →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Score & SQLite Leaderboard */}
            <div
              style={{
                background: '#0d0d0d',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                borderRadius: '0.5rem',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 800, color: '#ffffff' }}>
                <Trophy size={16} />
                Chief Flight Engineer Leaderboard
              </div>

              <div style={{ fontSize: '0.8rem', color: '#d4d4d4' }}>
                Current Session Score:{' '}
                <strong style={{ color: '#ffffff' }}>
                  {score} / {TRIVIA_QUESTIONS.length}
                </strong>{' '}
                ({answeredCount} answered)
              </div>

              <form onSubmit={handleLeaderboardSubmit} style={{ display: 'flex', gap: '0.4rem' }}>
                <input
                  type="text"
                  value={callsign}
                  onChange={(e) => setCallsign(e.target.value)}
                  placeholder="Enter pilot callsign..."
                  maxLength={28}
                  style={{
                    flex: 1,
                    background: '#000000',
                    border: '1px solid rgba(255, 255, 255, 0.35)',
                    borderRadius: '0.35rem',
                    padding: '0.4rem 0.6rem',
                    color: '#ffffff',
                    fontSize: '0.76rem',
                  }}
                />
                <button type="submit" className="action-btn primary">
                  Post Score
                </button>
              </form>
              {submitStatus && <div style={{ fontSize: '0.72rem', color: '#ffffff' }}>{submitStatus}</div>}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.25rem' }}>
                {leaderboard.length === 0 ? (
                  <div style={{ fontSize: '0.74rem', color: '#737373' }}>
                    No flight engineers logged yet. Be the first!
                  </div>
                ) : (
                  leaderboard.map((entry, i) => (
                    <div
                      key={entry.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '0.4rem 0.6rem',
                        background: '#050505',
                        border: '1px solid rgba(255, 255, 255, 0.14)',
                        borderRadius: '0.35rem',
                        fontSize: '0.75rem',
                      }}
                    >
                      <span>
                        #{i + 1} <strong>{entry.pilotCallsign}</strong>
                      </span>
                      <span style={{ color: '#ffffff', fontFamily: 'monospace', fontWeight: 800 }}>
                        {entry.score}/{entry.totalQuestions}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
