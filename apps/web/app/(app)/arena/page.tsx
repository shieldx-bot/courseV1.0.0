'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface Question {
    id: string;
    title: string;
    description: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
    points: number;
    category: string;
    difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert';
}

interface Player {
    rank: number;
    name: string;
    score: number;
    tier: string;
    isUser?: boolean;
}

export default function ArenaPage() {
    const [timeLeft, setTimeLeft] = useState(45);
    const [score, setScore] = useState(0);
    const [displayScore, setDisplayScore] = useState(0);
    const [aiScore, setAiScore] = useState(0);
    const [displayAiScore, setDisplayAiScore] = useState(0);
    const [streak, setStreak] = useState(5);
    const [gameStatus, setGameStatus] = useState<'intro' | 'matching' | 'playing' | 'ended'>('intro');
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [answerFeedback, setAnswerFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [matchingTimer, setMatchingTimer] = useState(3);
    const [battleLogs, setBattleLogs] = useState<string[]>([]);
    const [showExplanation, setShowExplanation] = useState(false);
    const [hintUsed, setHintUsed] = useState(false);
    const [screenShake, setScreenShake] = useState(false);
    const [confetti, setConfetti] = useState(false);
    const [matchProgress, setMatchProgress] = useState(0);
    
    const scoreRef = useRef(0);
    const aiScoreRef = useRef(0);
    const animationFrameRef = useRef<number>();

    const questions: Question[] = [
        {
            id: '1',
            title: 'Linux File Permissions',
            description: 'Which command sets read and write permissions for the owner, and read-only for everyone else?',
            options: [
                'chmod 644 filename',
                'chmod 755 filename',
                'chmod 600 filename',
                'chmod 664 filename'
            ],
            correctAnswer: 'chmod 644 filename',
            explanation: '644 translates to owner having read/write (4+2=6), group having read-only (4), and others having read-only (4).',
            points: 10,
            category: 'Linux',
            difficulty: 'Easy'
        },
        {
            id: '2',
            title: 'AWS IAM Policies',
            description: 'Which IAM policy element describes the specific action or actions that are allowed or denied?',
            options: [
                'Effect',
                'Action',
                'Resource',
                'Principal'
            ],
            correctAnswer: 'Action',
            explanation: 'The Action element describes the specific API action or list of actions (e.g., s3:GetObject) that are allowed or denied.',
            points: 15,
            category: 'AWS',
            difficulty: 'Medium'
        },
        {
            id: '3',
            title: 'Kubernetes Pod Scheduling',
            description: 'Which field in a Pod specification allows you to restrict which nodes the pod can be scheduled on based on labels?',
            options: [
                'nodeSelector',
                'affinity',
                'tolerations',
                'nodeName'
            ],
            correctAnswer: 'nodeSelector',
            explanation: 'nodeSelector is the simplest form of node selection constraint, matching label key-value pairs of nodes directly.',
            points: 20,
            category: 'Kubernetes',
            difficulty: 'Hard'
        }
    ];

    const currentQuestion = questions[currentQuestionIndex];

    // Animate score counter
    useEffect(() => {
        if (gameStatus === 'playing' || gameStatus === 'ended') {
            const animate = () => {
                if (displayScore < scoreRef.current) {
                    setDisplayScore(prev => Math.min(prev + Math.ceil((scoreRef.current - prev) / 10), scoreRef.current));
                }
                if (displayAiScore < aiScoreRef.current) {
                    setDisplayAiScore(prev => Math.min(prev + Math.ceil((aiScoreRef.current - prev) / 10), aiScoreRef.current));
                }
                if (displayScore < scoreRef.current || displayAiScore < aiScoreRef.current) {
                    animationFrameRef.current = requestAnimationFrame(animate);
                }
            };
            animationFrameRef.current = requestAnimationFrame(animate);
        }
        return () => {
            if (animationFrameRef.current !== undefined) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [score,

    // Matching countdown
    useEffect(() => {
        if (gameStatus === 'matching') {
            if (matchingTimer > 0) {
                const timer = setTimeout(() => {
                    setMatchingTimer(matchingTimer - 1);
                }, 800);
                return () => clearTimeout(timer);
            } else {
                setGameStatus('playing');
                setTimeLeft(45);
                setScore(0);
                setAiScore(0);
                setCurrentQuestionIndex(0);
                setMatchProgress(0);
                setBattleLogs(['Match started against Opponent_AI!', 'Arena category: Devops & Cloud Systems']);
            }
        }
    }, [gameStatus, matchingTimer]);

    // Active playing loop timer
    useEffect(() => {
        if (gameStatus === 'playing' && timeLeft > 0) {
            const timer = setTimeout(() => {
                setTimeLeft(timeLeft - 1);
                setMatchProgress(100 - (timeLeft - 1) / 45 * 100);
                
                // Simulate AI activity
                if (timeLeft % 12 === 0 && timeLeft !== 45) {
                    const aiGain = Math.floor(Math.random() * 8) + 8;
                    setAiScore(prev => prev + aiGain);
                    setBattleLogs(prev => [
                        `Opponent_AI answered correctly! (+${aiGain} pts)`,
                        ...prev
                    ]);
                }
            }, 1000);
            return () => clearTimeout(timer);
        } else if (timeLeft === 0 && gameStatus === 'playing') {
            setGameStatus('ended');
            if (score >= aiScore) {
                setConfetti(true);
                setTimeout(() => setConfetti(false), 3000);
            }
        }
    }, [timeLeft, gameStatus, score, aiScore]);

    const triggerMatchmaking = () => {
        setMatchingTimer(3);
        setGameStatus('matching');
    };

    const handleAnswerClick = useCallback((option: string) => {
        if (selectedAnswer !== null) return;

        setSelectedAnswer(option);
        const isCorrect = option === currentQuestion.correctAnswer;
        
        if (isCorrect) {
            setAnswerFeedback('correct');
            const timeBonus = Math.max(2, Math.floor(timeLeft / 10));
            const earned = currentQuestion.points + timeBonus;
            setScore(prev => prev + earned);
            setBattleLogs(prev => [
                `You answered correctly! (+${earned} pts)`,
                ...prev
            ]);
        } else {
            setAnswerFeedback('incorrect');
            setScreenShake(true);
            setTimeout(() => setScreenShake(false), 400);
            setBattleLogs(prev => [
                'You answered incorrectly. Check out the explanation!',
                ...prev
            ]);
        }

        // Auto transition after showing answer
        setTimeout(() => {
            if (currentQuestionIndex < questions.length - 1) {
                setCurrentQuestionIndex(prev => prev + 1);
                setSelectedAnswer(null);
                setAnswerFeedback(null);
                setShowExplanation(false);
                setHintUsed(false);
            } else {
                setGameStatus('ended');
                if (score >= aiScore) {
                    setConfetti(true);
                    setTimeout(() => setConfetti(false), 3000);
                }
            }
        }, 2000);
    }, [selectedAnswer, currentQuestion, currentQuestionIndex, timeLeft, score, aiScore]);

    const handleHintClick = () => {
        if (hintUsed || selectedAnswer !== null) return;
        setHintUsed(true);
        setScore(prev => prev - 5); // Cost 5 points for hint
        setBattleLogs(prev => ['Hint used (-5 pts): Eliminate one wrong answer', ...prev]);
    };

    const handleReset = () => {
        setGameStatus('intro');
        setSelectedAnswer(null);
        setAnswerFeedback(null);
        setCurrentQuestionIndex(0);
        setScore(0);
        setAiScore(0);
        setDisplayScore(0);
        setDisplayAiScore(0);
        setBattleLogs([]);
        setShowExplanation(false);
        setHintUsed(false);
        setMatchProgress(0);
    };

    const getDifficultyColor = (difficulty: string) => {
        switch (difficulty) {
            case 'Easy': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
            case 'Medium': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
            case 'Hard': return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
            case 'Expert': return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
            default: return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
        }
    };

    const getTierColor = (tier: string) => {
        switch (tier) {
            case 'DIAMOND': return 'text-cyan-400';
            case 'PLATINUM': return 'text-slate-300';
            case 'GOLD': return 'text-yellow-400';
            case 'SILVER': return 'text-slate-400';
            case 'BRONZE': return 'text-amber-600';
            default: return 'text-slate-400';
        }
    };

    const renderConfetti = () => {
        if (!confetti) return null;
        return (
            <div className="fixed inset-0 pointer-events-none z-50" style={{ overflow: 'hidden' }}>
                {Array.from({ length: 50 }).map((_, i) => (
                    <div
                        key={i}
                        className="fixed w-3 h-3 rounded-full"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `-10px`,
                            background: `hsl(${Math.random() * 360}, 70%, 60%)`,
                            animation: `fall ${1 + Math.random() * 2}s linear forwards`,
                            transform: `rotate(${Math.random() * 360}deg)`
                        }}
                    />
                ))}
                <style jsx global>{`
                    @keyframes fall {
                        to { transform: translateY(110vh) rotate(720deg); opacity: 0; }
                    }
                `}</style>
            </div>
        );
    };

    return (
        <>
            {renderConfetti()}
            <div className={`min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 font-sans selection:bg-rose-500 selection:text-white ${screenShake ? 'animate-shake' : ''}`}>
                <style jsx global>{`
                    @keyframes shake {
                        0%, 100% { transform: translateX(0); }
                        25% { transform: translateX(-10px); }
                        75% { transform: translateX(10px); }
                    }
                    .animate-shake { animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both; }
                    @keyframes slideIn {
                        from { opacity: 0; transform: translateY(-10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    .animate-slide-in { animation: slideIn 0.3s ease-out; }
                    @keyframes pulseGlow {
                        0%, 100% { box-shadow: 0 0 20px rgba(251, 113, 133, 0.3); }
                        50% { box-shadow: 0 0 40px rgba(251, 113, 133, 0.6); }
                    }
                    .animate-pulse-glow { animation: pulseGlow 2s infinite; }
                `}</style>

                {/* Header section */}
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center mb-8 pb-6 border-b border-slate-800 gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-rose-600 text-white text-xs font-bold tracking-widest px-3 py-1.5 rounded-lg uppercase animate-pulse relative overflow-hidden">
                            <span className="relative z-10">Live PvP Arena</span>
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-ping" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-rose-500 via-orange-400 to-yellow-400 bg-clip-text text-transparent">
                                COMPETITIVE ARENA
                            </h1>
                            <p className="text-sm text-slate-400">Challenge other professionals and our master AI in live tech battles</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6 bg-slate-900 border border-slate-800 px-5 py-2.5 rounded-xl shadow-lg">
                        <div className="text-center">
                            <span className="block text-xs text-slate-500 font-bold uppercase tracking-wider">Your Streak</span>
                            <span className="text-lg font-bold text-orange-400 flex items-center justify-center gap-1">
                                <span className="animate-pulse">🔥</span> {streak} Days
                            </span>
                        </div>
                        <div className="h-8 w-px bg-slate-800" />
                        <div className="text-center relative">
                            <span className="block text-xs text-slate-500 font-bold uppercase tracking-wider">Timer</span>
                            <div className="relative w-16 h-16 mx-auto">
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle 
                                        cx="32" cy="32" r="28" 
                                        fill="none" stroke="#1e293b" strokeWidth="4" 
                                    />
                                    <circle 
                                        cx="32" cy="32" r="28" 
                                        fill="none" stroke={timeLeft <= 10 ? '#fb7185' : '#fb923c'} strokeWidth="4"
                                        strokeDasharray="176"
                                        strokeDashoffset={`${176 * (1 - timeLeft / 45)}`}
                                        strokeLinecap="round"
                                        className={`transition-all duration-1000 ${timeLeft <= 10 ? 'animate-pulse text-rose-500' : ''}`}
                                    />
                                </svg>
                                <span className={`absolute inset-0 flex items-center justify-center text-xl font-mono font-bold ${timeLeft <= 10 ? 'text-rose-500 animate-pulse' : 'text-rose-400'}`}>
                                    {timeLeft}s
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Layout Grid */}
                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content Area */}
                    <div className="lg:col-span-2 space-y-6">
                        {gameStatus === 'intro' && (
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 md:p-12 text-center shadow-xl space-y-6 relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-transparent to-indigo-500/5" />
                                <div className="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto border border-rose-500/20 relative z-10 animate-pulse-glow">
                                    <span className="text-4xl">⚔️</span>
                                </div>
                                <h2 className="text-2xl md:text-3xl font-bold relative z-10">Live Technical Matchmaking</h2>
                                <p className="text-slate-400 max-w-md mx-auto text-sm md:text-base leading-relaxed relative z-10">
                                    Join a competitive match in Cloud, Linux, and Kubernetes. You will compete in real-time against our customized <strong className="text-rose-400">Opponent_AI</strong> for glory, reputations, and Elo points.
                                </p>
                                <div className="flex flex-wrap justify-center gap-3 pt-2 relative z-10">
                                    <span className="text-xs bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-slate-300 font-mono">⏱️ 45 Seconds</span>
                                    <span className="text-xs bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-slate-300 font-mono">🎯 Elo Multipliers</span>
                                    <span className="text-xs bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-slate-300 font-mono">🎓 Skill-based System</span>
                                </div>
                                <button 
                                    onClick={triggerMatchmaking}
                                    className="px-8 py-4 bg-gradient-to-r from-rose-600 via-orange-500 to-rose-600 hover:from-rose-500 hover:via-orange-400 hover:to-rose-500 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-rose-600/30 active:scale-95 relative overflow-hidden group"
                                >
                                    <span className="relative z-10">Find Match Now ⚔️</span>
                                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
                                </button>
                            </div>
                        )}

                        {gameStatus === 'matching' && (
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center shadow-xl space-y-6 flex flex-col items-center justify-center min-h-[350px] relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-transparent to-indigo-500/5" />
                                <div className="relative mb-4 z-10">
                                    <div className="w-24 h-24 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin relative">
                                        <div className="absolute inset-4 border-4 border-indigo-500/20 border-b-indigo-500 rounded-full animate-spin reverse" style={{ animationDuration: '0.8s' }} />
                                    </div>
                                    <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold">⚡</span>
                                </div>
                                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-orange-400 to-yellow-400 relative z-10">
                                    Matchmaking in Progress...
                                </h2>
                                <p className="text-slate-400 text-sm max-w-xs font-mono relative z-10">
                                    Searching for an active opponent or training AI... Starting in {matchingTimer} seconds.
                                </p>
                                <div className="flex items-center gap-8 mt-4 relative z-10">
                                    <div className="text-center">
                                        <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/30 rounded-full flex items-center justify-center mx-auto text-2xl mb-2 animate-pulse">👤</div>
                                        <span className="text-xs font-bold text-slate-400">You (Elo 1420)</span>
                                    </div>
                                    <span className="text-sm font-bold text-slate-600 font-mono animate-pulse">VS</span>
                                    <div className="text-center">
                                        <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/30 rounded-full flex items-center justify-center mx-auto text-2xl mb-2 animate-pulse">🤖</div>
                                        <span className="text-xs font-bold text-indigo-400">Opponent_AI (Elo 1450)</span>
                                    </div>
                                </div>
                                <div className="w-full max-w-md mx-auto mt-8 relative z-10">
                                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-rose-500 via-orange-400 to-indigo-500 rounded-full animate-ping" style={{ width: `${(3 - matchingTimer) / 3 * 100}%` }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {gameStatus === 'playing' && (
                            <div className="space-y-6">
                                {/* Match Progress Bar */}
                                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-400">Match Progress</span>
                                        <span className="font-mono text-rose-400">{Math.round(matchProgress)}%</span>
                                    </div>
                                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-gradient-to-r from-rose-500 via-orange-400 to-indigo-500 rounded-full transition-all duration-1000" 
                                            style={{ width: `${matchProgress}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-500">
                                        <span>Question 1</span>
                                        <span>Question {questions.length}</span>
                                    </div>
                                </div>

                                {/* Question Card */}
                                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 opacity-5 pointer-events-none text-9xl font-black text-slate-800">
                                        {currentQuestion.category}
                                    </div>
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <span className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 bg-rose-500/10 text-rose-400 rounded-lg border border-rose-500/20">
                                            Question {currentQuestionIndex + 1} of {questions.length}
                                        </span>
                                        <span className={`text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border ${getDifficultyColor(currentQuestion.difficulty)}`}>
                                            {currentQuestion.difficulty}
                                        </span>
                                        <span className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 bg-slate-800 text-slate-400 rounded-lg border border-slate-700">
                                            {currentQuestion.category}
                                        </span>
                                    </div>
                                    <h3 className="text-xl md:text-2xl font-extrabold text-slate-100">{currentQuestion.title}</h3>
                                    <p className="text-slate-300 text-sm md:text-base leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-slate-800 font-mono">
                                        {currentQuestion.description}
                                    </p>
                                </div>

                                {/* Multiple Choices List */}
                                <div className="grid grid-cols-1 gap-4">
                                    {currentQuestion.options.map((option, idx) => {
                                        const isSelected = selectedAnswer === option;
                                        const isCorrect = option === currentQuestion.correctAnswer;
                                        const letters = ['A', 'B', 'C', 'D'];

                                        let buttonStyle = "border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60";
                                        if (selectedAnswer !== null) {
                                            if (isSelected) {
                                                buttonStyle = isCorrect 
                                                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 font-bold shadow-lg shadow-emerald-500/10" 
                                                    : "border-rose-500 bg-rose-500/10 text-rose-400 font-bold shadow-lg shadow-rose-500/10";
                                            } else if (isCorrect) {
                                                buttonStyle = "border-emerald-500 bg-emerald-500/10 text-emerald-400 font-bold";
                                            } else {
                                                buttonStyle = "border-slate-900 bg-slate-950/40 text-slate-600 cursor-not-allowed opacity-60";
                                            }
                                        }

                                        return (
                                            <button 
                                                key={idx}
                                                onClick={() => handleAnswerClick(option)}
                                                disabled={selectedAnswer !== null}
                                                className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-center justify-between group ${buttonStyle}`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                                                        isSelected ? (isCorrect ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white') : 'bg-slate-950 text-slate-500 border border-slate-700'
                                                    }`}>
                                                        {letters[idx]}
                                                    </span>
                                                    <span className="flex-1">{option}</span>
                                                </div>
                                                {isSelected && isCorrect && <span className="text-emerald-400 text-xl">✓</span>}
                                                {isSelected && !isCorrect && <span className="text-rose-400 text-xl">✗</span>}
                                                {!isSelected && isCorrect && selectedAnswer !== null && <span className="text-emerald-400 text-xl opacity-50">✓</span>}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Hint Button */}
                                {!hintUsed && selectedAnswer === null && (
                                    <button
                                        onClick={handleHintClick}
                                        className="w-full py-3 px-4 bg-slate-800 border border-slate-700 rounded-xl text-slate-300 hover:bg-slate-700 hover:border-slate-600 transition-all flex items-center justify-center gap-2"
                                    >
                                        <span>💡</span>
                                        <span>Use Hint (-5 XP) - Eliminate one wrong answer</span>
                                    </button>
                                )}

                                {/* Explanation Card */}
                                {selectedAnswer !== null && (
                                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4 animate-slide-in">
                                        <div className="flex items-center gap-3">
                                            <span className={`text-lg font-bold ${answerFeedback === 'correct' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {answerFeedback === 'correct' ? '✓ Correct!' : '✗ Incorrect'}
                                            </span>
                                            <span className="text-xs text-slate-400 ml-auto">Time remaining: {timeLeft}s</span>
                                        </div>
                                        <details className="group">
                                            <summary className="flex items-center justify-between cursor-pointer text-slate-300 text-sm leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-slate-800 list-none">
                                                <span className="flex items-center gap-2">
                                                    <strong className="text-slate-100">Explanation:</strong>
                                                    {currentQuestion.explanation}
                                                </span>
                                                <span className="text-slate-500 transition-transform group-open:rotate-180">▼</span>
                                            </summary>
                                            <div className="p-4 border-t border-slate-800 text-slate-400 text-sm animate-slide-in">
                                                <p><strong className="text-slate-200">Key Concept:</strong> This question tests your understanding of {currentQuestion.category.toLowerCase()} fundamentals.</p>
                                                <p className="mt-2"><strong className="text-slate-200">Pro Tip:</strong> In real scenarios, always verify your configuration with dry-run commands before applying.</p>
                                            </div>
                                        </details>
                                    </div>
                                )}

                                {/* Score Board */}
                                <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-xl relative overflow-hidden">
                                    <div className="flex items-center gap-4 relative z-10">
                                        <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/30 rounded-full flex items-center justify-center text-xl">👤</div>
                                        <div>
                                            <p className="text-xs text-slate-500">Your Score</p>
                                            <p className="text-3xl font-bold text-rose-400 font-mono tabular-nums">{displayScore}</p>
                                        </div>
                                    </div>
                                    <div className="text-center relative z-10">
                                        <p className="text-xs text-slate-500">VS</p>
                                        <p className="text-3xl font-bold text-indigo-400 font-mono tabular-nums">{displayAiScore}</p>
                                    </div>
                                    <div className="flex items-center gap-4 justify-end relative z-10">
                                        <div className="text-right">
                                            <p className="text-xs text-slate-500">AI Score</p>
                                            <p className="text-3xl font-bold text-indigo-400 font-mono tabular-nums">{displayAiScore}</p>
                                        </div>
                                        <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/30 rounded-full flex items-center justify-center text-xl">🤖</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {gameStatus === 'ended' && (
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 md:p-12 text-center shadow-xl space-y-6 relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-transparent to-indigo-500/5" />
                                <div className="w-20 h-20 bg-gradient-to-r from-rose-500 to-orange-400 rounded-full flex items-center justify-center mx-auto relative z-10 animate-pulse-glow">
                                    <span className="text-4xl">🏆</span>
                                </div>
                                <h2 className="text-2xl md:text-3xl font-bold relative z-10">Match Complete!</h2>
                                <p className="text-slate-400 max-w-md mx-auto text-sm md:text-base leading-relaxed relative z-10">
                                    Final Score: <strong className="text-rose-400">{displayScore}</strong> vs AI: <strong className="text-indigo-400">{displayAiScore}</strong>
                                </p>
                                <p className={`text-lg md:text-xl font-bold ${displayScore >= displayAiScore ? 'text-emerald-400' : 'text-rose-400'} relative z-10 animate-pulse`}>
                                    {displayScore >= displayAiScore ? 'VICTORY!' : 'DEFEAT'}
                                </p>
                                <div className="flex flex-wrap justify-center gap-3 pt-2 relative z-10">
                                    <span className="text-xs bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-slate-300 font-mono">
                                        +{Math.floor(displayScore / 10)} Reputation
                                    </span>
                                    <span className="text-xs bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-slate-300 font-mono">
                                        +{Math.floor(displayScore / 5)} XP
                                    </span>
                                    <span className="text-xs bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-lg text-rose-400 font-mono">
                                        Elo +{Math.floor((displayScore - displayAiScore) / 20) + 10}
                                    </span>
                                </div>
                                <button 
                                    onClick={handleReset}
                                    className="px-8 py-4 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white font-bold rounded-xl transition-all shadow-lg active:scale-95 relative z-10"
                                >
                                    Play Again
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Right Sidebar - Battle Log & Leaderboard */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Live Battle Feed */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 sticky top-24">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                    <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>
                                    Live Feed
                                </h3>
                                <span className="text-xs text-slate-500 font-mono">{timeLeft}s</span>
                            </div>
                            <div className="max-h-96 overflow-y-auto space-y-3">
                                {battleLogs.length === 0 ? (
                                    <p className="text-slate-500 text-sm text-center py-8">Waiting for match to start...</p>
                                ) : (
                                    battleLogs.map((log, idx) => (
                                        <div key={idx} className="text-sm text-slate-300 bg-slate-950/50 p-3 rounded-lg border border-slate-800 animate-slide-in relative overflow-hidden">
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-rose-500 to-orange-400" />
                                            <div className="pl-3">
                                                <span className="text-slate-500 mr-2 font-mono">[+{45 - timeLeft}s]</span> {log}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Mini Leaderboard */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                                Arena Leaderboard
                            </h3>
                            <div className="space-y-3">
                                {[
                                    { rank: 1, name: 'CloudMaster_Pro', score: 2840, tier: 'DIAMOND' },
                                    { rank: 2, name: 'KubeNinja', score: 2710, tier: 'DIAMOND' },
                                    { rank: 3, name: 'SecOpsGuru', score: 2650, tier: 'PLATINUM' },
                                    { rank: 4, name: 'You', score: displayScore || 1420, tier: 'GOLD', isUser: true },
                                    { rank: 5, name: 'LinuxWizard', score: 1380, tier: 'GOLD' }
                                ].map((player) => (
                                    <div 
                                        key={player.rank} 
                                        className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                                            player.isUser 
                                                ? 'bg-rose-500/5 border-rose-500/20 ring-1 ring-rose-500/10' 
                                                : 'bg-slate-950/50 border-slate-800'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className={`font-bold text-xl ${player.rank <= 3 ? 'text-yellow-400' : player.isUser ? 'text-rose-400' : 'text-slate-400'}`}>
                                                {player.rank <= 3 ? (
                                                    ['🥇', '🥈', '🥉'][player.rank - 1]
                                                ) : (
                                                    `#${player.rank}`
                                                )}
                                            </span>
                                            <div>
                                                <p className={`font-bold text-sm ${player.isUser ? 'text-rose-400' : 'text-slate-100'}`}>
                                                    {player.name} {player.isUser && <span className="text-xs text-rose-500 ml-1">(You)</span>}
                                                </p>
                                                <span className={`text-xs font-medium px-2 py-0.5 rounded ${getTierColor(player.tier)} bg-opacity-10`}>
                                                    {player.tier}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="font-mono font-bold text-rose-400 tabular-nums">{player.score}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}