'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

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

interface BattleLogEntry {
    id: number;
    time: number;
    message: string;
    type: 'player' | 'ai' | 'system' | 'hint';
}

interface MatchResult {
    won: boolean;
    score: number;
    aiScore: number;
    accuracy: number;
    avgTime: number;
    eloChange: number;
    reputationGain: number;
    xpGain: number;
    perfectGame: boolean;
    questionResults: Array<{
        correct: boolean;
        timeSpent: number;
        pointsEarned: number;
    }>;
}

interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: string;
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

const ACHIEVEMENTS: Achievement[] = [
    { id: 'first_win', title: 'First Blood', description: 'Win your first arena match', icon: '⚔️', rarity: 'common' },
    { id: 'perfect_game', title: 'Flawless Victory', description: 'Answer all questions correctly', icon: '💎', rarity: 'epic' },
    { id: 'speed_demon', title: 'Speed Demon', description: 'Answer 3 questions in under 10 seconds each', icon: '⚡', rarity: 'rare' },
    { id: 'streak_7', title: 'Week Warrior', description: 'Maintain a 7-day streak', icon: '🔥', rarity: 'rare' },
    { id: 'streak_30', title: 'Month Master', description: 'Maintain a 30-day streak', icon: '🏆', rarity: 'legendary' },
    { id: 'comeback', title: 'Comeback King', description: 'Win after being 50+ points behind', icon: '🔄', rarity: 'epic' },
];

export default function ArenaPage() {
    const [timeLeft, setTimeLeft] = useState(45);
    const [score, setScore] = useState(0);
    const [displayScore, setDisplayScore] = useState(0);
    const [aiScore, setAiScore] = useState(0);
    const [displayAiScore, setDisplayAiScore] = useState(0);
    const [streak, setStreak] = useState(5);
    const [gameStatus, setGameStatus] = useState<'intro' | 'matching' | 'playing' | 'ended' | 'replay'>('intro');
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [answerFeedback, setAnswerFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [matchingTimer, setMatchingTimer] = useState(3);
    const [battleLogs, setBattleLogs] = useState<BattleLogEntry[]>([]);
    const [hintUsed, setHintUsed] = useState(false);
    const [screenShake, setScreenShake] = useState(false);
    const [confetti, setConfetti] = useState(false);
    const [matchProgress, setMatchProgress] = useState(0);
    const [aiThinking, setAiThinking] = useState(false);
    const [questionTransition, setQuestionTransition] = useState<'enter' | 'exit' | 'idle'>('idle');
    const [showKeyboardHints, setShowKeyboardHints] = useState(false);
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [showMobileSidebar, setShowMobileSidebar] = useState(false);
    const [showReplay, setShowReplay] = useState(false);
    const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
    const [replayIndex, setReplayIndex] = useState(0);
    const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);
    const [showShareCard, setShowShareCard] = useState(false);
    const [particles, setParticles] = useState<Array<{x: number; y: number; size: number; opacity: number; speed: number; hue: number}>>([]);

    const scoreRef = useRef(0);
    const aiScoreRef = useRef(0);
    const animationFrameRef = useRef<number>();
    const logIdRef = useRef(0);
    const questionStartTimeRef = useRef<number>(Date.now());
    const questionResultsRef = useRef<Array<{correct: boolean; timeSpent: number; pointsEarned: number}>>([]);
    const audioContextRef = useRef<AudioContext | null>(null);
    const particleAnimationRef = useRef<number>();

    const questions: Question[] = useMemo(() => [
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
    ], []);

    const currentQuestion = questions[currentQuestionIndex];
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

    // Forward declarations to avoid circular dependencies
    const addLog = useCallback((message: string, type: BattleLogEntry['type']) => {
        setBattleLogs(prev => [{
            id: logIdRef.current++,
            time: 45 - timeLeft,
            message,
            type
        }, ...prev].slice(0, 20));
    }, [timeLeft]);

    // Audio System
    const initAudio = useCallback(() => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        return audioContextRef.current;
    }, []);

    const playSound = useCallback((type: 'correct' | 'incorrect' | 'tick' | 'matchStart' | 'matchEnd' | 'achievement' | 'hint') => {
        if (!soundEnabled) return;
        const ctx = initAudio();
        if (ctx.state === 'suspended') ctx.resume();

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        switch (type) {
            case 'correct':
                osc.frequency.setValueAtTime(523.25, now); // C5
                osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
                osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
                osc.start(now);
                osc.stop(now + 0.5);
                break;
            case 'incorrect':
                osc.frequency.setValueAtTime(200, now);
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.3);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
                break;
            case 'tick':
                if (timeLeft <= 10) {
                    osc.frequency.setValueAtTime(800, now);
                    gain.gain.setValueAtTime(0.05, now);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                    osc.start(now);
                    osc.stop(now + 0.1);
                }
                break;
            case 'matchStart':
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.setValueAtTime(554.37, now + 0.15);
                osc.frequency.setValueAtTime(659.25, now + 0.3);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
                osc.start(now);
                osc.stop(now + 0.6);
                break;
            case 'matchEnd':
                if (score >= aiScore) {
                    // Victory fanfare
                    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
                        const o = ctx.createOscillator();
                        const g = ctx.createGain();
                        o.connect(g);
                        g.connect(ctx.destination);
                        o.frequency.setValueAtTime(f, now + i * 0.1);
                        g.gain.setValueAtTime(0.1, now + i * 0.1);
                        g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.4);
                        o.start(now + i * 0.1);
                        o.stop(now + i * 0.1 + 0.4);
                    });
                } else {
                    // Defeat sound
                    osc.frequency.setValueAtTime(300, now);
                    osc.frequency.exponentialRampToValueAtTime(150, now + 0.5);
                    gain.gain.setValueAtTime(0.1, now);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
                    osc.start(now);
                    osc.stop(now + 0.5);
                }
                break;
            case 'achievement':
                [659.25, 880, 1046.5, 1318.5].forEach((f, i) => {
                    const o = ctx.createOscillator();
                    const g = ctx.createGain();
                    o.connect(g);
                    g.connect(ctx.destination);
                    o.frequency.setValueAtTime(f, now + i * 0.08);
                    o.type = 'triangle';
                    g.gain.setValueAtTime(0.08, now + i * 0.08);
                    g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.3);
                    o.start(now + i * 0.08);
                    o.stop(now + i * 0.08 + 0.3);
                });
                break;
            case 'hint':
                osc.frequency.setValueAtTime(400, now);
                osc.frequency.setValueAtTime(500, now + 0.1);
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
                break;
        }
    }, [soundEnabled, timeLeft, score, aiScore, initAudio]);

    const endMatch = useCallback(() => {
        setGameStatus('ended');
        const won = score >= aiScore;
        const correctAnswers = questionResultsRef.current.filter(r => r.correct).length;
        const accuracy = Math.round((correctAnswers / questions.length) * 100);
        const avgTime = Math.round(questionResultsRef.current.reduce((a, b) => a + b.timeSpent, 0) / questions.length);
        const eloChange = won ? Math.floor((score - aiScore) / 20) + 10 : -Math.floor((aiScore - score) / 20) - 5;
        const reputationGain = Math.floor(score / 10);
        const xpGain = Math.floor(score / 5);
        const perfectGame = correctAnswers === questions.length && questions.length > 0;

        const result: MatchResult = {
            won,
            score,
            aiScore,
            accuracy,
            avgTime,
            eloChange,
            reputationGain,
            xpGain,
            perfectGame,
            questionResults: questionResultsRef.current,
        };
        setMatchResult(result);

        // Check achievements
        const unlocked: Achievement[] = [];
        if (won && !localStorage.getItem('achievement_first_win')) {
            unlocked.push(ACHIEVEMENTS.find(a => a.id === 'first_win')!);
            localStorage.setItem('achievement_first_win', 'true');
        }
        if (perfectGame && !localStorage.getItem('achievement_perfect_game')) {
            unlocked.push(ACHIEVEMENTS.find(a => a.id === 'perfect_game')!);
            localStorage.setItem('achievement_perfect_game', 'true');
        }
        if (avgTime < 10 && !localStorage.getItem('achievement_speed_demon')) {
            unlocked.push(ACHIEVEMENTS.find(a => a.id === 'speed_demon')!);
            localStorage.setItem('achievement_speed_demon', 'true');
        }
        if (streak >= 7 && !localStorage.getItem('achievement_streak_7')) {
            unlocked.push(ACHIEVEMENTS.find(a => a.id === 'streak_7')!);
            localStorage.setItem('achievement_streak_7', 'true');
        }
        if (streak >= 30 && !localStorage.getItem('achievement_streak_30')) {
            unlocked.push(ACHIEVEMENTS.find(a => a.id === 'streak_30')!);
            localStorage.setItem('achievement_streak_30', 'true');
        }
        if (won && score < aiScore - 50 && !localStorage.getItem('achievement_comeback')) {
            unlocked.push(ACHIEVEMENTS.find(a => a.id === 'comeback')!);
            localStorage.setItem('achievement_comeback', 'true');
        }
        if (unlocked.length > 0) {
            setNewAchievements(unlocked);
            playSound('achievement');
        }

        if (won) {
            setConfetti(true);
            setTimeout(() => setConfetti(false), 3000);
        }
        playSound('matchEnd');
    }, [score, aiScore, streak, playSound]);

    const handleHintClick = useCallback(() => {
        if (hintUsed || selectedAnswer !== null) return;
        setHintUsed(true);
        setScore(prev => prev - 5);
        addLog('Hint used (-5 pts): Eliminate one wrong answer', 'hint');
        playSound('hint');
    }, [hintUsed, selectedAnswer, addLog, playSound]);

    // Particle System
    useEffect(() => {
        if (prefersReducedMotion) return;
        const newParticles = Array.from({ length: 20 }, () => ({
            x: Math.random() * 100,
            y: Math.random() * 100,
            size: 1 + Math.random() * 2,
            opacity: 0.1 + Math.random() * 0.2,
            speed: 0.02 + Math.random() * 0.05,
            hue: 330 + Math.random() * 60,
        }));
        setParticles(newParticles);

        const animate = () => {
            setParticles(prev => prev.map(p => ({
                ...p,
                y: p.y > 100 ? 0 : p.y + p.speed,
                x: p.x + (Math.random() - 0.5) * 0.2,
            })));
            particleAnimationRef.current = requestAnimationFrame(animate);
        };
        particleAnimationRef.current = requestAnimationFrame(animate);
        return () => {
            if (particleAnimationRef.current !== undefined) {
                cancelAnimationFrame(particleAnimationRef.current);
            }
        };
    }, [prefersReducedMotion]);

    // Check for reduced motion preference
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        setPrefersReducedMotion(mediaQuery.matches);
        const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, []);

    // Animate score counter
    useEffect(() => {
        if (gameStatus === 'playing' || gameStatus === 'ended') {
            const animate = () => {
                if (displayScore < scoreRef.current) {
                    setDisplayScore(prev => Math.min(prev + Math.ceil((scoreRef.current - prev) / 8), scoreRef.current));
                }
                if (displayAiScore < aiScoreRef.current) {
                    setDisplayAiScore(prev => Math.min(prev + Math.ceil((aiScoreRef.current - prev) / 8), aiScoreRef.current));
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
    }, [score, aiScore, gameStatus, displayScore, displayAiScore]);

    // Sync refs
    useEffect(() => { scoreRef.current = score; }, [score]);
    useEffect(() => { aiScoreRef.current = aiScore; }, [aiScore]);

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
                questionStartTimeRef.current = Date.now();
                questionResultsRef.current = [];
                addLog('Match started against Opponent_AI!', 'system');
                addLog('Arena category: Devops & Cloud Systems', 'system');
                playSound('matchStart');
            }
        }
    }, [gameStatus, matchingTimer, playSound, addLog]);

    // Active playing loop timer
    useEffect(() => {
        if (gameStatus === 'playing' && timeLeft > 0) {
            const timer = setTimeout(() => {
                setTimeLeft(timeLeft - 1);
                setMatchProgress(100 - (timeLeft - 1) / 45 * 100);
                playSound('tick');

                // Simulate AI activity
                if (timeLeft % 12 === 0 && timeLeft !== 45) {
                    setAiThinking(true);
                    setTimeout(() => {
                        const aiGain = Math.floor(Math.random() * 8) + 8;
                        setAiScore(prev => prev + aiGain);
                        addLog(`Opponent_AI answered correctly! (+${aiGain} pts)`, 'ai');
                        setAiThinking(false);
                    }, 800 + Math.random() * 1200);
                }
            }, 1000);
            return () => clearTimeout(timer);
        } else if (timeLeft === 0 && gameStatus === 'playing') {
            endMatch();
        }
    }, [timeLeft, gameStatus, score, aiScore, playSound, addLog, endMatch]);

    const triggerMatchmaking = () => {
        setMatchingTimer(3);
        setGameStatus('matching');
    };

    const handleAnswerClick = useCallback((option: string) => {
        if (selectedAnswer !== null) return;

        setSelectedAnswer(option);
        const isCorrect = option === currentQuestion.correctAnswer;
        const timeSpent = 45 - timeLeft;
        const timeBonus = Math.max(2, Math.floor(timeLeft / 10));
        const earned = isCorrect ? currentQuestion.points + timeBonus : 0;

        questionResultsRef.current.push({ correct: isCorrect, timeSpent, pointsEarned: earned });

        if (isCorrect) {
            setAnswerFeedback('correct');
            setScore(prev => prev + earned);
            addLog(`You answered correctly! (+${earned} pts)`, 'player');
            playSound('correct');
        } else {
            setAnswerFeedback('incorrect');
            if (!prefersReducedMotion) setScreenShake(true);
            setTimeout(() => setScreenShake(false), 400);
            addLog('You answered incorrectly. Check out the explanation!', 'player');
            playSound('incorrect');
        }
    }, [selectedAnswer, currentQuestion, timeLeft, addLog, prefersReducedMotion, playSound]);

    const handleKeyPress = useCallback((e: KeyboardEvent) => {
        if (gameStatus !== 'playing' || selectedAnswer !== null) return;
        const keyMap: Record<string, number> = { '1': 0, '2': 1, '3': 2, '4': 3 };
        if (e.key in keyMap) {
            handleAnswerClick(currentQuestion.options[keyMap[e.key]]);
        }
        if (e.key === 'h' || e.key === 'H') {
            handleHintClick();
        }
        if (e.key === '?') {
            setShowKeyboardHints(true);
            setTimeout(() => setShowKeyboardHints(false), 3000);
        }
        if (e.key === 'm' || e.key === 'M') {
            setSoundEnabled(prev => !prev);
        }
    }, [gameStatus, selectedAnswer, currentQuestion.options, handleAnswerClick, handleHintClick]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [handleKeyPress]);

    const handleNextQuestion = useCallback(() => {
        if (currentQuestionIndex < questions.length - 1) {
            if (!prefersReducedMotion) {
                setQuestionTransition('exit');
                setTimeout(() => {
                    setCurrentQuestionIndex(prev => prev + 1);
                    setSelectedAnswer(null);
                    setAnswerFeedback(null);
                    setHintUsed(false);
                    questionStartTimeRef.current = Date.now();
                    setQuestionTransition('enter');
                    setTimeout(() => setQuestionTransition('idle'), 200);
                }, 200);
            } else {
                setCurrentQuestionIndex(prev => prev + 1);
                setSelectedAnswer(null);
                setAnswerFeedback(null);
                setHintUsed(false);
                questionStartTimeRef.current = Date.now();
            }
        } else {
            endMatch();
        }
    }, [currentQuestionIndex, prefersReducedMotion, endMatch]);

    // Auto-transition after answer
    useEffect(() => {
        if (selectedAnswer !== null && answerFeedback !== null) {
            const timer = setTimeout(handleNextQuestion, 2000);
            return () => clearTimeout(timer);
        }
    }, [selectedAnswer, answerFeedback, handleNextQuestion]);

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
        setHintUsed(false);
        setMatchProgress(0);
        setQuestionTransition('idle');
        setShowReplay(false);
        setReplayIndex(0);
        setMatchResult(null);
        setNewAchievements([]);
        setShowShareCard(false);
        logIdRef.current = 0;
    };

    const handleReplay = () => {
        setShowReplay(true);
        setReplayIndex(0);
        setGameStatus('replay');
    };

    const handleShare = () => {
        setShowShareCard(true);
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

    const getLogColor = (type: BattleLogEntry['type']) => {
        switch (type) {
            case 'player': return 'border-l-emerald-500 bg-emerald-500/5';
            case 'ai': return 'border-l-indigo-500 bg-indigo-500/5';
            case 'hint': return 'border-l-amber-500 bg-amber-500/5';
            default: return 'border-l-rose-500 bg-rose-500/5';
        }
    };

    const getRarityColor = (rarity: string) => {
        switch (rarity) {
            case 'legendary': return 'border-yellow-400 bg-yellow-400/10 text-yellow-400';
            case 'epic': return 'border-purple-400 bg-purple-400/10 text-purple-400';
            case 'rare': return 'border-blue-400 bg-blue-400/10 text-blue-400';
            default: return 'border-slate-400 bg-slate-400/10 text-slate-400';
        }
    };

    const renderConfetti = () => {
        if (!confetti) return null;
        return (
            <div className="fixed inset-0 pointer-events-none z-50" style={{ overflow: 'hidden' }}>
                {Array.from({ length: 80 }).map((_, i) => (
                    <ConfettiPiece key={i} index={i} reducedMotion={prefersReducedMotion} />
                ))}
            </div>
        );
    };

    const renderParticles = () => {
        if (prefersReducedMotion || particles.length === 0) return null;
        return (
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
                {particles.map((p, i) => (
                    <div
                        key={i}
                        className="fixed rounded-full"
                        style={{
                            left: `${p.x}%`,
                            top: `${p.y}%`,
                            width: `${p.size}px`,
                            height: `${p.size}px`,
                            background: `hsla(${p.hue}, 70%, 60%, ${p.opacity})`,
                            borderRadius: '50%',
                        }}
                    />
                ))}
            </div>
        );
    };

    const renderAchievementToasts = () => {
        if (newAchievements.length === 0) return null;
        return (
            <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3" role="region" aria-label="Achievements unlocked">
                {newAchievements.map((achievement, i) => (
                    <div
                        key={achievement.id}
                        className={`flex items-center gap-4 p-4 rounded-xl border shadow-xl animate-slide-in-right ${getRarityColor(achievement.rarity)} bg-slate-900/95 backdrop-blur`}
                        style={{ animationDelay: `${i * 150}ms` }}
                    >
                        <span className="text-3xl">{achievement.icon}</span>
                        <div>
                            <p className="text-xs text-slate-400 uppercase tracking-wider">Achievement Unlocked</p>
                            <p className="font-bold">{achievement.title}</p>
                            <p className="text-sm text-slate-400">{achievement.description}</p>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const renderShareCard = () => {
        if (!showShareCard || !matchResult) return null;
        const { won, score, accuracy, eloChange } = matchResult;
        return (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-slide-in" onClick={() => setShowShareCard(false)}>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-sm w-full relative animate-slide-in-right" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setShowShareCard(false)} className="absolute top-4 right-4 text-slate-500 hover:text-slate-300">✕</button>
                    <div className="text-center">
                        <div className={`text-6xl mb-4 ${won ? 'animate-float' : ''}`}>{won ? '🏆' : '💀'}</div>
                        <h3 className="text-2xl font-bold bg-gradient-to-r from-rose-500 to-orange-400 bg-clip-text text-transparent">
                            {won ? 'VICTORY!' : 'DEFEAT'}
                        </h3>
                        <p className="text-slate-400 mt-2">Competitive Arena Match</p>
                        <div className="mt-6 grid grid-cols-2 gap-4">
                            <div className="bg-slate-800 p-4 rounded-xl">
                                <p className="text-3xl font-bold text-rose-400 font-mono">{score}</p>
                                <p className="text-xs text-slate-500">Score</p>
                            </div>
                            <div className="bg-slate-800 p-4 rounded-xl">
                                <p className="text-3xl font-bold text-emerald-400 font-mono">{accuracy}%</p>
                                <p className="text-xs text-slate-500">Accuracy</p>
                            </div>
                        </div>
                        <div className="mt-4 flex justify-center gap-4">
                            <button className="px-4 py-2 bg-rose-600 hover:bg-rose-500 rounded-xl text-white text-sm font-bold transition-colors">
                                Share Result
                            </button>
                            <button onClick={() => setShowShareCard(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 text-sm font-bold transition-colors">
                                Close
                            </button>
                        </div>
                        <p className="text-xs text-slate-500 mt-4">competitive-learning.platform/arena</p>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            {renderParticles()}
            {renderConfetti()}
            {renderAchievementToasts()}
            {renderShareCard()}
            <div className={`min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 font-sans selection:bg-rose-500 selection:text-white ${screenShake && !prefersReducedMotion ? 'animate-shake' : ''} relative`}>

                {/* Mobile Sidebar Toggle */}
                {isMobile && (
                    <button
                        onClick={() => setShowMobileSidebar(!showMobileSidebar)}
                        className="fixed bottom-6 right-6 md:hidden z-40 w-14 h-14 bg-slate-900 border border-slate-800 rounded-xl shadow-xl flex flex-col items-center justify-center gap-1 transition-transform"
                    >
                        <span className="w-6 h-0.5 bg-slate-300 rounded transition-transform" style={{ transform: showMobileSidebar ? 'rotate(45deg) translate(4px, 4px)' : 'none' }} />
                        <span className="w-6 h-0.5 bg-slate-300 rounded transition-opacity" style={{ opacity: showMobileSidebar ? 0 : 1 }} />
                        <span className="w-6 h-0.5 bg-slate-300 rounded transition-transform" style={{ transform: showMobileSidebar ? 'rotate(-45deg) translate(4px, -4px)' : 'none' }} />
                    </button>
                )}

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
                        <div className="text-center relative">
                            <span className="block text-xs text-slate-500 font-bold uppercase tracking-wider">Your Streak</span>
                            <span className="text-lg font-bold text-orange-400 flex items-center justify-center gap-1 relative">
                                <span className={`animate-fire ${prefersReducedMotion ? '' : 'animate-fire'}`}>🔥</span> {streak} Days
                            </span>
                        </div>
                        <div className="h-8 w-px bg-slate-800" />
                        <div className="text-center relative">
                            <span className="block text-xs text-slate-500 font-bold uppercase tracking-wider">Timer</span>
                            <div className="relative w-16 h-16 mx-auto">
                                <svg className="w-full h-full transform -rotate-90" aria-hidden="true">
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
                                        className={`transition-all duration-1000 ${timeLeft <= 10 && !prefersReducedMotion ? 'animate-pulse' : ''}`}
                                    />
                                </svg>
                                <span className={`absolute inset-0 flex items-center justify-center text-xl font-mono font-bold ${timeLeft <= 10 ? 'text-rose-500' : 'text-rose-400'} ${timeLeft <= 10 && !prefersReducedMotion ? 'animate-pulse' : ''}`}>
                                    {timeLeft}s
                                </span>
                            </div>
                        </div>
                        <div className="h-8 w-px bg-slate-800" />
                        <button
                            onClick={() => setSoundEnabled(prev => !prev)}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-slate-300"
                            aria-label={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
                        >
                            {soundEnabled ? '🔊' : '🔇'}
                        </button>
                    </div>
                </div>

                {/* Keyboard Hints Overlay */}
                {showKeyboardHints && (
                    <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center p-4 animate-slide-in">
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full animate-slide-in-right">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">⌨️ Keyboard Shortcuts</h3>
                            <div className="space-y-2 text-sm text-slate-300">
                                <div className="flex justify-between"><kbd className="px-2 py-1 bg-slate-800 rounded">1-4</kbd><span>Select answer</span></div>
                                <div className="flex justify-between"><kbd className="px-2 py-1 bg-slate-800 rounded">H</kbd><span>Use hint</span></div>
                                <div className="flex justify-between"><kbd className="px-2 py-1 bg-slate-800 rounded">?</kbd><span>Show this help</span></div>
                                <div className="flex justify-between"><kbd className="px-2 py-1 bg-slate-800 rounded">M</kbd><span>Toggle sound</span></div>
                            </div>
                            <button onClick={() => setShowKeyboardHints(false)} className="mt-4 w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 transition-colors">Got it</button>
                        </div>
                    </div>
                )}

                {/* Layout Grid */}
                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content Area */}
                    <div className="lg:col-span-2 space-y-6">
                        {gameStatus === 'intro' && (
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 md:p-12 text-center shadow-xl space-y-6 relative overflow-hidden animate-slide-in">
                                <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-transparent to-indigo-500/5" />
                                <div className="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto border border-rose-500/20 relative z-10 animate-pulse-glow animate-float">
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
                                    className="px-8 py-4 bg-gradient-to-r from-rose-600 via-orange-500 to-rose-600 hover:from-rose-500 hover:via-orange-400 hover:to-rose-500 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-rose-600/30 active:scale-95 relative overflow-hidden group relative z-10"
                                >
                                    <span className="relative z-10">Find Match Now ⚔️</span>
                                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
                                </button>
                            </div>
                        )}

                        {gameStatus === 'matching' && (
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center shadow-xl space-y-6 flex flex-col items-center justify-center min-h-[350px] relative overflow-hidden animate-slide-in">
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
                                        <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/30 rounded-full flex items-center justify-center mx-auto text-2xl mb-2 animate-pulse animate-float">👤</div>
                                        <span className="text-xs font-bold text-slate-400">You (Elo 1420)</span>
                                    </div>
                                    <span className="text-sm font-bold text-slate-600 font-mono animate-pulse">VS</span>
                                    <div className="text-center">
                                        <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/30 rounded-full flex items-center justify-center mx-auto text-2xl mb-2 animate-pulse {aiThinking && 'animate-thinking'}">🤖</div>
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

                        {(gameStatus === 'playing' || gameStatus === 'replay') && (
                            <div className="space-y-6">
                                {/* Match Progress Bar */}
                                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2 animate-slide-in">
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
                                <div className={`bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4 relative overflow-hidden ${questionTransition === 'exit' && !prefersReducedMotion ? 'animate-slide-out' : ''} ${questionTransition === 'enter' && !prefersReducedMotion ? 'animate-slide-in-right' : ''}`}>
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
                                        const replayResult = matchResult?.questionResults[currentQuestionIndex];
                                        const showReplayAnswer = gameStatus === 'replay' && !!replayResult;

                                        let buttonStyle = "border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60";
                                        if (selectedAnswer !== null || showReplayAnswer) {
                                            const answerToCheck = showReplayAnswer ? currentQuestion.correctAnswer : selectedAnswer;
                                            const wasCorrect = answerToCheck === currentQuestion.correctAnswer;
                                            if (isSelected || (showReplayAnswer && isCorrect)) {
                                                buttonStyle = wasCorrect 
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
                                                onClick={() => !showReplayAnswer && handleAnswerClick(option)}
                                                disabled={selectedAnswer !== null || showReplayAnswer}
                                                className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-center justify-between group ${buttonStyle}`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                                                        isSelected || (showReplayAnswer && isCorrect) 
                                                            ? (isCorrect ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white') 
                                                            : 'bg-slate-950 text-slate-500 border border-slate-700'
                                                    }`}>
                                                        {letters[idx]}
                                                    </span>
                                                    <span className="flex-1">{option}</span>
                                                </div>
                                                {(isSelected || (showReplayAnswer && isCorrect)) && isCorrect && <span className="text-emerald-400 text-xl">✓</span>}
                                                {(isSelected && !isCorrect) && <span className="text-rose-400 text-xl">✗</span>}
                                                {!isSelected && isCorrect && (selectedAnswer !== null || showReplayAnswer) && <span className="text-emerald-400 text-xl opacity-50">✓</span>}
                                                {showReplayAnswer && replayResult && (
                                                    <span className={`text-xs font-bold px-2 py-1 rounded ${replayResult.correct ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                                                        {replayResult.correct ? `+${replayResult.pointsEarned}` : '0'}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Hint Button */}
                                {!hintUsed && selectedAnswer === null && gameStatus === 'playing' && (
                                    <button
                                        onClick={handleHintClick}
                                        className="w-full py-3 px-4 bg-slate-800 border border-slate-700 rounded-xl text-slate-300 hover:bg-slate-700 hover:border-slate-600 transition-all flex items-center justify-center gap-2 animate-slide-in"
                                    >
                                        <span>💡</span>
                                        <span>Use Hint (-5 XP) - Eliminate one wrong answer</span>
                                    </button>
                                )}

                                {/* Explanation Card */}
                                {(selectedAnswer !== null || (gameStatus === 'replay' && matchResult?.questionResults[currentQuestionIndex])) && (
                                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4 animate-slide-in">
                                        <div className="flex items-center gap-3">
                                            <span className={`text-lg font-bold ${answerFeedback === 'correct' || (gameStatus === 'replay' && matchResult?.questionResults[currentQuestionIndex]?.correct) ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {answerFeedback === 'correct' || (gameStatus === 'replay' && matchResult?.questionResults[currentQuestionIndex]?.correct) ? '✓ Correct!' : '✗ Incorrect'}
                                            </span>
                                            <span className="text-xs text-slate-400 ml-auto">
                                                {gameStatus === 'replay' 
                                                    ? `Time: ${matchResult?.questionResults[currentQuestionIndex]?.timeSpent}s`
                                                    : `Time remaining: ${timeLeft}s`}
                                            </span>
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
                                <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-xl relative overflow-hidden animate-slide-in">
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
                                        <div className={`w-12 h-12 bg-indigo-500/10 border border-indigo-500/30 rounded-full flex items-center justify-center text-xl ${aiThinking && !prefersReducedMotion ? 'animate-thinking' : ''}`}>🤖</div>
                                    </div>
                                </div>

                                {/* Replay Controls */}
                                {gameStatus === 'replay' && matchResult && (
                                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between animate-slide-in">
                                        <div className="flex items-center gap-4">
                                            <button 
                                                onClick={() => setReplayIndex(Math.max(0, replayIndex - 1))}
                                                disabled={replayIndex === 0}
                                                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 disabled:opacity-50 transition-colors"
                                            >←</button>
                                            <span className="text-sm font-mono text-rose-400">
                                                Question {replayIndex + 1} of {questions.length}
                                            </span>
                                            <button 
                                                onClick={() => setReplayIndex(Math.min(questions.length - 1, replayIndex + 1))}
                                                disabled={replayIndex === questions.length - 1}
                                                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 disabled:opacity-50 transition-colors"
                                            >→</button>
                                        </div>
                                        <button 
                                            onClick={() => { setShowReplay(false); setGameStatus('ended'); }}
                                            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 rounded-xl text-white text-sm font-bold transition-colors"
                                        >
                                            Exit Replay
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {gameStatus === 'ended' && (
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 md:p-12 text-center shadow-xl space-y-6 relative overflow-hidden animate-slide-in">
                                <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-transparent to-indigo-500/5" />
                                <div className="w-20 h-20 bg-gradient-to-r from-rose-500 to-orange-400 rounded-full flex items-center justify-center mx-auto relative z-10 animate-pulse-glow animate-float">
                                    <span className="text-4xl">{matchResult?.perfectGame ? '💎' : '🏆'}</span>
                                </div>
                                <h2 className="text-2xl md:text-3xl font-bold relative z-10">Match Complete!</h2>
                                <p className="text-slate-400 max-w-md mx-auto text-sm md:text-base leading-relaxed relative z-10">
                                    Final Score: <strong className="text-rose-400">{displayScore}</strong> vs AI: <strong className="text-indigo-400">{displayAiScore}</strong>
                                </p>
                                <p className={`text-lg md:text-xl font-bold ${displayScore >= displayAiScore ? 'text-emerald-400' : 'text-rose-400'} relative z-10 ${!prefersReducedMotion ? 'animate-pulse' : ''}`}>
                                    {displayScore >= displayAiScore ? 'VICTORY!' : 'DEFEAT'}
                                </p>
                                {matchResult && (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 relative z-10">
                                        <div className="bg-slate-800/50 border border-slate-700 p-3 rounded-xl">
                                            <p className="text-2xl font-bold text-emerald-400 font-mono">{matchResult.accuracy}%</p>
                                            <p className="text-xs text-slate-500">Accuracy</p>
                                        </div>
                                        <div className="bg-slate-800/50 border border-slate-700 p-3 rounded-xl">
                                            <p className="text-2xl font-bold text-amber-400 font-mono">{matchResult.avgTime}s</p>
                                            <p className="text-xs text-slate-500">Avg Time</p>
                                        </div>
                                        <div className="bg-slate-800/50 border border-slate-700 p-3 rounded-xl">
                                            <p className="text-2xl font-bold text-rose-400 font-mono">{matchResult.eloChange >= 0 ? '+' : ''}{matchResult.eloChange}</p>
                                            <p className="text-xs text-slate-500">Elo Change</p>
                                        </div>
                                        {matchResult.perfectGame && (
                                            <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-400/30 p-3 rounded-xl animate-pulse">
                                                <p className="text-2xl font-bold text-yellow-400">PERFECT</p>
                                                <p className="text-xs text-slate-500">Flawless Game!</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className="flex flex-wrap justify-center gap-3 pt-2 relative z-10">
                                    {matchResult && (
                                        <>
                                            <span className="text-xs bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-slate-300 font-mono">
                                                +{matchResult.reputationGain} Reputation
                                            </span>
                                            <span className="text-xs bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-slate-300 font-mono">
                                                +{matchResult.xpGain} XP
                                            </span>
                                            <span className="text-xs bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-lg text-rose-400 font-mono">
                                                Elo {matchResult.eloChange >= 0 ? '+' : ''}{matchResult.eloChange}
                                            </span>
                                        </>
                                    )}
                                </div>
                                <div className="flex flex-wrap justify-center gap-3 pt-4 relative z-10">
                                    <button 
                                        onClick={handleReplay}
                                        className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all"
                                    >
                                        Replay Match
                                    </button>
                                    <button 
                                        onClick={handleShare}
                                        className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition-all"
                                    >
                                        Share Result
                                    </button>
                                    <button 
                                        onClick={handleReset}
                                        className="px-6 py-3 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white font-bold rounded-xl transition-all"
                                    >
                                        Play Again
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Sidebar - Battle Log & Leaderboard */}
                    <div className={`lg:col-span-1 space-y-6 transition-transform duration-300 ${isMobile && showMobileSidebar ? 'translate-x-0' : isMobile ? 'translate-x-full' : ''} fixed inset-y-0 right-0 z-30 w-full lg:static lg:translate-x-0 max-w-sm lg:max-w-none bg-slate-950 border-l border-slate-800 lg:border-none p-6 lg:p-0 shadow-2xl lg:shadow-none`}>
                        {isMobile && showMobileSidebar && (
                            <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setShowMobileSidebar(false)} />
                        )}

                        {/* Live Battle Feed */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
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
                                    battleLogs.map((log) => (
                                        <div key={log.id} className={`text-sm text-slate-300 p-3 rounded-lg border animate-slide-in relative overflow-hidden ${getLogColor(log.type)}`}>
                                            <div className="absolute left-0 top-0 bottom-0 w-1" />
                                            <div className="pl-3 flex items-start gap-2">
                                                <span className="text-slate-500 mr-2 font-mono shrink-0">[+{log.time}s]</span>
                                                <span>{log.message}</span>
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
                                        className={`flex items-center justify-between p-3 rounded-lg border transition-all ${player.isUser ? 'bg-rose-500/5 border-rose-500/20 ring-1 ring-rose-500/10' : 'bg-slate-950/50 border-slate-800'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className={`font-bold text-xl ${player.rank <= 3 ? 'text-yellow-400' : player.isUser ? 'text-rose-400' : 'text-slate-400'}`}>
                                                {player.rank <= 3 ? ['🥇', '🥈', '🥉'][player.rank - 1] : `#${player.rank}`}
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

// Confetti Piece Component
function ConfettiPiece({ index, reducedMotion }: { index: number; reducedMotion: boolean }) {
    const left = Math.random() * 100;
    const delay = Math.random() * 0.5;
    const duration = 1.5 + Math.random() * 2;
    const rotation = Math.random() * 360;
    const size = 6 + Math.random() * 8;
    const hue = Math.random() * 360;

    if (reducedMotion) return null;

    return (
        <div
            className="fixed w-3 h-3 rounded-full"
            style={{
                left: `${left}%`,
                top: `-10px`,
                background: `hsl(${hue}, 70%, 60%)`,
                animation: `fall ${duration}s ease-in ${delay}s forwards`,
                transform: `rotate(${rotation}deg)`,
                width: `${size}px`,
                height: `${size}px`,
                borderRadius: Math.random() > 0.5 ? '50%' : '0',
            }}
        />
    );
}