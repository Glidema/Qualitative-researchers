import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { questions, dimensions, personalityTypes } from './data';
import { ChevronRight, ChevronLeft, Send, User, Hash, Lock, LogOut, X, AlertCircle, Loader2, Check } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** API 返回的 createdAt 可能是 ISO 字符串或 Firestore 风格 { toDate } */
function getCreatedAtDate(item: { createdAt?: string | { toDate?: () => Date } }): Date | null {
  if (!item?.createdAt) return null;
  const c = item.createdAt;
  if (typeof c === 'string') return new Date(c);
  if (typeof c?.toDate === 'function') return c.toDate();
  return null;
}

// --- Error Display Component ---
function ErrorDisplay({ error, onRetry }: { error: string, onRetry: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-200 max-w-md w-full text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-xl font-medium text-stone-900 mb-2">抱歉，出错了</h2>
        <p className="text-stone-600 mb-6">
          {error || "应用程序遇到了一个意外错误。请尝试刷新页面。"}
        </p>
        <button
          onClick={onRetry}
          className="px-6 py-2 bg-stone-800 text-white rounded-xl hover:bg-stone-900 transition-colors"
        >
          重试
        </button>
      </div>
    </div>
  );
}

type AppState = 'intro' | 'quiz' | 'result' | 'admin';

interface UserInfo {
  name: string;
  studentId: string;
}

export default function App() {
  const [appState, setAppState] = useState<AppState>('intro');
  const [userInfo, setUserInfo] = useState<UserInfo>({ name: '', studentId: '' });
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false); // brief "提交成功" before showing result
  const [resultData, setResultData] = useState<any>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const submitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitTimedOutRef = useRef(false);

  // Admin state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminResults, setAdminResults] = useState<any[]>([]);
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [adminRefreshTrigger, setAdminRefreshTrigger] = useState(0);

  // Auto-save feature
  useEffect(() => {
    let savedData: string | null = null;
    try {
      savedData = localStorage.getItem('quiz_progress');
    } catch (_) {
      // 无痕模式等可能不可用
    }
    if (savedData) {
      try {
        const { userInfo: savedUserInfo, answers: savedAnswers, currentQuestionIndex: savedIndex, appState: savedState } = JSON.parse(savedData);
        if (savedUserInfo) setUserInfo(savedUserInfo);
        if (savedAnswers) setAnswers(savedAnswers);
        if (typeof savedIndex === 'number') {
          const clamped = Math.max(0, Math.min(savedIndex, questions.length - 1));
          setCurrentQuestionIndex(clamped);
        }
        // Only resume to quiz if they were in the middle of it
        if (savedState === 'quiz') setAppState('quiz');
      } catch (e) {
        console.error("Failed to load saved progress", e);
      }
    }
  }, []);

  useEffect(() => {
    if (appState === 'quiz' || (appState === 'intro' && (userInfo.name || userInfo.studentId))) {
      try {
        const dataToSave = {
          userInfo,
          answers,
          currentQuestionIndex,
          appState
        };
        localStorage.setItem('quiz_progress', JSON.stringify(dataToSave));
      } catch (_) {
        // Safari 无痕模式等可能不可用，忽略
      }
    }
  }, [userInfo, answers, currentQuestionIndex, appState]);

  // 防止 currentQuestionIndex 越界（如从 localStorage 恢复的异常值）导致 questions[index] 为 undefined
  useEffect(() => {
    if (appState === 'quiz' && questions.length > 0) {
      const safe = Math.max(0, Math.min(currentQuestionIndex, questions.length - 1));
      if (safe !== currentQuestionIndex) setCurrentQuestionIndex(safe);
    }
  }, [appState, currentQuestionIndex, questions.length]);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const correctPassword = (import.meta as any).env.VITE_ADMIN_PASSWORD || 'admin123';
    if (adminPassword === correctPassword) {
      setAppState('admin');
      setShowPasswordModal(false);
    } else {
      alert("密码错误！");
    }
  };

  useEffect(() => {
    if (appState !== 'admin' || !adminPassword) return;

    let cancelled = false;
    setIsLoadingAdmin(true);

    fetch('/api/results', {
      headers: { 'X-Admin-Password': adminPassword },
    })
      .then(async (res) => {
        const text = await res.text();
        let body: { error?: string } = {};
        try {
          body = JSON.parse(text);
        } catch {}
        if (!res.ok) {
          const msg = body.error || (res.status === 401 ? '未授权' : `获取失败 ${res.status}`);
          throw new Error(msg);
        }
        return JSON.parse(text) as any[];
      })
      .then((data: any[]) => {
        if (cancelled) return;
        setAdminResults(Array.isArray(data) ? data : []);
        setLastUpdated(new Date());
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Admin results error:', err);
          const msg = err instanceof Error ? err.message : String(err);
          const hint =
            msg === '未授权' || /未授权|Unauthorized/i.test(msg)
              ? '密码错误或已失效，请重新登录。'
              : /Storage not configured|未配置存储/i.test(msg)
                ? '未配置存储：请确保 Vercel 环境变量中已设置 REDIS_URL 并重新部署。'
                : msg;
          setGlobalError(hint);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingAdmin(false);
      });

    return () => {
      cancelled = true;
    };
  }, [appState, adminPassword, adminRefreshTrigger]);

  const handleResetProgress = () => {
    if (window.confirm("确定要清除所有进度并重新开始吗？")) {
      try {
        localStorage.removeItem('quiz_progress');
      } catch (_) {}
      setUserInfo({ name: '', studentId: '' });
      setAnswers({});
      setCurrentQuestionIndex(0);
      setAppState('intro');
    }
  };

  const handleAdminLogout = () => {
    setAppState('intro');
    setAdminPassword('');
  };

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (userInfo.name.trim() && userInfo.studentId.trim()) {
      setAppState('quiz');
    }
  };

  const handleAnswer = (value: number) => {
    const safeIdx = Math.max(0, Math.min(currentQuestionIndex, questions.length - 1));
    const q = questions[safeIdx];
    if (!q) return;
    setAnswers(prev => ({ ...prev, [q.id]: value }));
    if (safeIdx < questions.length - 1) {
      setTimeout(() => setCurrentQuestionIndex(safeIdx + 1), 300);
    }
  };

  const calculateResults = () => {
    const scores: Record<string, number> = {
      newPositivism: 0,
      originalism: 0,
      constructivism: 0,
      criticalTheory: 0
    };

    // Generic calculation for all dimensions
    Object.entries(dimensions).forEach(([dimKey, dimConfig]) => {
      dimConfig.questions.forEach((q: any) => {
        const qId = typeof q === 'number' ? q : q.id;
        const isReverse = typeof q === 'object' && q.reverse;
        const answer = answers[qId] || 0;
        
        if (answer === 0) return; // Should not happen if all questions are answered

        if (isReverse) {
          scores[dimKey] += (6 - answer);
        } else {
          scores[dimKey] += answer;
        }
      });
    });

    // Find highest score(s)
    let maxScore = -1;
    let topTypes: string[] = [];

    Object.entries(scores).forEach(([key, score]) => {
      if (score > maxScore) {
        maxScore = score;
        topTypes = [key];
      } else if (score === maxScore) {
        topTypes.push(key);
      }
    });

    return { scores, topTypes };
  };

  const handleSubmit = async () => {
    if (Object.keys(answers).length < questions.length) {
      alert("请回答所有问题后再提交！");
      return;
    }

    setIsSubmitting(true);
    setSubmitSuccess(false);
    submitTimedOutRef.current = false;

    const timeoutMs = 25000; // 25 秒，弱网/境外服务可能较慢
    const timeoutId = setTimeout(() => {
      submitTimedOutRef.current = true;
      if (submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current);
        submitTimeoutRef.current = null;
      }
      setIsSubmitting(false);
      setSubmitSuccess(false);
      setGlobalError("提交超时，请检查网络连接或重试。若在国内访问，可能因网络原因无法连接数据服务器。");
    }, timeoutMs);
    submitTimeoutRef.current = timeoutId;

    try {
      const { scores, topTypes } = calculateResults();

      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: userInfo.name,
          studentId: userInfo.studentId,
          scores,
          resultTypes: topTypes,
        }),
      });

      const text = await res.text();
      let apiError: string | null = null;
      try {
        const data = JSON.parse(text) as { error?: string };
        apiError = data.error || null;
      } catch {
        if (res.status === 404) apiError = '未找到提交接口，请确认已部署到 Vercel 并已添加 KV（Redis）存储。';
      }
      if (!res.ok) {
        throw new Error(apiError || `提交失败 ${res.status}`);
      }

      if (submitTimedOutRef.current) return; // 已显示超时，不再改状态
      if (submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current);
        submitTimeoutRef.current = null;
      }
      console.log("Result submitted successfully");

      try {
        localStorage.removeItem('quiz_progress');
      } catch (_) {}
      const data = { scores, topTypes };
      setResultData(data);
      setSubmitSuccess(true);
      setIsSubmitting(false);
      setTimeout(() => {
        setAppState('result');
        setSubmitSuccess(false);
      }, 450);
    } catch (error) {
      if (submitTimedOutRef.current) return;
      if (submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current);
        submitTimeoutRef.current = null;
      }
      setIsSubmitting(false);
      setSubmitSuccess(false);
      console.error("Error submitting results:", error);
      const msg = error instanceof Error ? error.message : String(error);
      const isPermission = /permission|权限|denied/i.test(msg);
      const isNetwork = /unavailable|network|failed to fetch|load/i.test(msg);
      const isApiHint = /Storage not configured|Invalid payload|Submit failed|未找到提交接口|not configured|KV|Redis|服务器写入失败|REDIS_URL/i.test(msg);
      const hint = isApiHint
        ? msg
        : isPermission
          ? "提交失败：无写入权限，请检查配置。"
          : isNetwork
            ? "提交失败：网络不可用或无法连接服务器，请检查网络后重试。"
            : "提交失败，请检查网络连接或重试。";
      setGlobalError(hint);
    }
  };

  if (globalError) {
    return <ErrorDisplay error={globalError} onRetry={() => setGlobalError(null)} />;
  }

  return (
    <div className="min-h-screen bg-[#f5f5f0] text-stone-800 font-sans selection:bg-stone-300">
      <header className="p-4 flex justify-end">
        {appState !== 'admin' && (
          <button 
            onClick={() => setShowPasswordModal(true)}
            className="text-stone-400 hover:text-stone-600 transition-colors flex items-center gap-2 text-sm"
          >
            <Lock className="w-4 h-4" />
            <span>管理员</span>
          </button>
        )}
      </header>

      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium text-stone-900">管理员登录</h3>
                <button onClick={() => setShowPasswordModal(false)} className="text-stone-400 hover:text-stone-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">请输入管理密码</label>
                  <input
                    type="password"
                    autoFocus
                    value={adminPassword}
                    onChange={e => setAdminPassword(e.target.value)}
                    className="block w-full px-4 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-stone-400 focus:border-stone-400 bg-stone-50"
                    placeholder="密码"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-stone-800 text-white rounded-lg hover:bg-stone-900 transition-colors font-medium"
                >
                  确认登录
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-[calc(3rem+env(safe-area-inset-bottom))] md:pb-20 md:pt-10">
        <AnimatePresence mode="wait">
          {appState === 'intro' && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-[2rem] p-6 md:p-12 shadow-sm border border-stone-100"
            >
              <div className="text-center mb-8 md:mb-10">
                <h1 className="text-2xl md:text-4xl font-serif font-medium text-stone-900 mb-3 md:mb-4">
                  质性研究者人格测试
                </h1>
                <p className="text-stone-500 text-sm md:text-base px-4">
                  探索你在质性研究中的认识论倾向与研究者底色
                </p>
              </div>

              <form onSubmit={handleStart} className="space-y-6 max-w-md mx-auto">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">姓名</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-stone-400" />
                    </div>
                    <input
                      type="text"
                      required
                      value={userInfo.name}
                      onChange={e => setUserInfo({ ...userInfo, name: e.target.value })}
                      className="block w-full pl-10 pr-3 py-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-400 focus:border-stone-400 bg-stone-50 transition-all"
                      placeholder="请输入您的姓名"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">学号</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Hash className="h-5 w-5 text-stone-400" />
                    </div>
                    <input
                      type="text"
                      required
                      value={userInfo.studentId}
                      onChange={e => setUserInfo({ ...userInfo, studentId: e.target.value })}
                      className="block w-full pl-10 pr-3 py-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-400 focus:border-stone-400 bg-stone-50 transition-all"
                      placeholder="请输入您的学号"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3 mt-8">
                  <button
                    type="submit"
                    className="w-full flex justify-center items-center min-h-[48px] py-3 px-4 border border-transparent rounded-xl shadow-sm text-white bg-stone-800 hover:bg-stone-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-stone-900 transition-all font-medium"
                  >
                    开始测试
                    <ChevronRight className="ml-2 h-5 w-5" />
                  </button>
                  
                  {(userInfo.name || userInfo.studentId || Object.keys(answers).length > 0) && (
                    <button
                      type="button"
                      onClick={handleResetProgress}
                      className="w-full py-2 text-stone-400 hover:text-stone-600 transition-colors text-sm font-medium"
                    >
                      清除进度并重新开始
                    </button>
                  )}
                </div>
              </form>
            </motion.div>
          )}

          {appState === 'quiz' && (() => {
            const safeIndex = Math.max(0, Math.min(currentQuestionIndex, questions.length - 1));
            const currentQuestion = questions[safeIndex];
            if (!currentQuestion) return null;
            return (
            <motion.div
              key="quiz"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white rounded-[2rem] p-6 md:p-12 shadow-sm border border-stone-100 relative"
            >
              {/* Submit overlay: loading or brief success */}
              <AnimatePresence>
                {(isSubmitting || submitSuccess) && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0 rounded-[2rem] bg-stone-900/60 backdrop-blur-[2px] flex flex-col items-center justify-center z-10 min-h-[280px]"
                    aria-live="polite"
                    aria-busy={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-10 h-10 text-white animate-spin mb-3" aria-hidden />
                        <p className="text-white font-medium">正在提交，请稍候...</p>
                        <p className="text-stone-300 text-sm mt-1">数据正在同步到云端</p>
                      </>
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-3">
                          <Check className="w-7 h-7 text-white" strokeWidth={2.5} aria-hidden />
                        </div>
                        <p className="text-white font-medium">提交成功</p>
                        <p className="text-stone-300 text-sm mt-1">正在跳转到结果页</p>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mb-6 md:mb-8">
                <div className="flex justify-between text-xs md:text-sm text-stone-500 mb-2 font-mono">
                  <span>Question {safeIndex + 1}</span>
                  <span>{questions.length}</span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-1">
                  <div
                    className="bg-stone-800 h-1 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${((safeIndex + 1) / questions.length) * 100}%` }}
                  ></div>
                </div>
              </div>

              <div className="min-h-[160px] md:min-h-[200px] flex flex-col justify-center mb-8 md:mb-10">
                <h2 className="text-xl md:text-3xl font-medium text-stone-900 leading-relaxed">
                  {currentQuestion.text}
                </h2>
              </div>

              <div className="space-y-2.5 md:space-y-3">
                {[
                  { value: 5, label: "很同意" },
                  { value: 4, label: "同意" },
                  { value: 3, label: "一般" },
                  { value: 2, label: "不同意" },
                  { value: 1, label: "很不同意" }
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleAnswer(option.value)}
                    className={cn(
                      "w-full text-left px-6 py-4 min-h-[48px] rounded-xl border transition-all duration-200 flex items-center justify-between group",
                      answers[currentQuestion.id] === option.value
                        ? "border-stone-800 bg-stone-800 text-white"
                        : "border-stone-200 hover:border-stone-400 hover:bg-stone-50 text-stone-700"
                    )}
                  >
                    <span className="font-medium">{option.label}</span>
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                      answers[currentQuestion.id] === option.value
                        ? "border-white"
                        : "border-stone-300 group-hover:border-stone-400"
                    )}>
                      {answers[currentQuestion.id] === option.value && (
                        <div className="w-2.5 h-2.5 bg-white rounded-full" />
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-10 flex justify-between items-center gap-4 min-h-[44px] [padding-bottom:env(safe-area-inset-bottom)]">
                <button
                  type="button"
                  onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                  disabled={safeIndex === 0}
                  className="flex items-center justify-center min-h-[44px] min-w-[44px] py-2.5 text-stone-500 hover:text-stone-800 disabled:opacity-30 disabled:hover:text-stone-500 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 mr-1" />
                  上一题
                </button>

                {safeIndex === questions.length - 1 ? (
                  <div className="flex flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isSubmitting || submitSuccess || Object.keys(answers).length < questions.length}
                      className="flex items-center justify-center min-h-[44px] px-6 py-2.5 bg-stone-800 text-white rounded-full hover:bg-stone-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                    >
                      {isSubmitting ? "提交中..." : "查看结果"}
                      {!isSubmitting && <Send className="w-4 h-4 ml-2" />}
                    </button>
                    {!isSubmitting && !submitSuccess && Object.keys(answers).length < questions.length && (
                      <span className="text-xs text-stone-400">请先选择本题上方一个选项</span>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}
                    disabled={!answers[currentQuestion.id]}
                    className="flex items-center justify-center min-h-[44px] min-w-[44px] py-2.5 text-stone-500 hover:text-stone-800 disabled:opacity-30 disabled:hover:text-stone-500 transition-colors"
                  >
                    下一题
                    <ChevronRight className="w-5 h-5 ml-1" />
                  </button>
                )}
              </div>
            </motion.div>
            );
          })()}

          {appState === 'result' && !resultData && (
            <motion.div
              key="result-loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white rounded-[2rem] p-8 md:p-12 shadow-sm border border-stone-100 flex flex-col items-center justify-center min-h-[280px]"
            >
              <Loader2 className="w-10 h-10 text-stone-400 animate-spin mb-4" aria-hidden />
              <p className="text-stone-600 font-medium">正在加载结果...</p>
              <button
                type="button"
                onClick={() => {
                  setAppState('intro');
                  setUserInfo({ name: '', studentId: '' });
                  setAnswers({});
                  setCurrentQuestionIndex(0);
                  setResultData(null);
                }}
                className="mt-6 text-sm text-stone-500 hover:text-stone-700 underline"
              >
                返回首页
              </button>
            </motion.div>
          )}

          {appState === 'result' && resultData && (() => {
            const topTypes = Array.isArray(resultData.topTypes) ? resultData.topTypes : [];
            const scores = resultData.scores && typeof resultData.scores === 'object' ? resultData.scores : {};
            return (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              {topTypes.map((typeKey: string) => {
                const typeInfo = typeKey ? personalityTypes[typeKey as keyof typeof personalityTypes] : null;
                if (!typeInfo) return null;
                return (
                  <div key={String(typeKey)} className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-stone-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-stone-50 rounded-full -mr-20 -mt-20 opacity-50 pointer-events-none" />
                    <div className="relative z-10">
                      <div className="text-[10px] md:text-sm font-mono text-stone-500 mb-2 md:mb-4 uppercase tracking-widest">Your Result</div>
                      <h2 className="text-2xl md:text-4xl font-serif font-medium text-stone-900 mb-4 md:mb-6 leading-tight">
                        {typeInfo.name}
                      </h2>
                      <div className="w-10 h-1 bg-stone-800 mb-6 md:mb-8" />
                      <p className="text-stone-600 text-base md:text-lg leading-relaxed mb-6 md:mb-10">
                        {typeInfo.description}
                      </p>
                    </div>
                  </div>
                );
              })}

              <div className="bg-white rounded-3xl p-8 shadow-sm border border-stone-100">
                <h3 className="text-xl font-medium text-stone-900 mb-6">维度得分详情</h3>
                <div className="space-y-5">
                  {[
                    { key: 'originalism', label: '原本论', color: 'bg-amber-700' },
                    { key: 'newPositivism', label: '新实证论', color: 'bg-blue-700' },
                    { key: 'constructivism', label: '建构论', color: 'bg-emerald-700' },
                    { key: 'criticalTheory', label: '批判理论', color: 'bg-rose-700' },
                  ].map((dim) => {
                    const score = scores[dim.key] ?? 0;
                    const num = Number(score);
                    const percentage = Number.isFinite(num) ? Math.min(100, Math.max(0, (num / 25) * 100)) : 0;
                    return (
                      <div key={dim.key}>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="font-medium text-stone-700">{dim.label}</span>
                          <span className="font-mono text-stone-500">{num} / 25</span>
                        </div>
                        <div className="w-full bg-stone-100 rounded-full h-2">
                          <div
                            className={cn("h-2 rounded-full transition-all duration-1000", dim.color)}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col items-center gap-4 pt-4">
                <p className="text-xs text-stone-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  数据已成功同步至云端数据库
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setAppState('intro');
                    setUserInfo({ name: '', studentId: '' });
                    setAnswers({});
                    setCurrentQuestionIndex(0);
                    setResultData(null);
                  }}
                  className="px-8 py-3 border border-stone-200 text-stone-600 rounded-full hover:bg-stone-50 transition-all font-medium"
                >
                  返回首页
                </button>
              </div>
            </motion.div>
            );
          })()}

          {appState === 'admin' && (
            <motion.div
              key="admin"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white rounded-[2rem] p-6 md:p-8 shadow-sm border border-stone-100"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                  <h2 className="text-xl md:text-2xl font-serif font-medium text-stone-900">测验数据管理</h2>
                  <p className="text-[10px] md:text-xs text-stone-400 mt-1">
                    {lastUpdated ? `最后更新: ${lastUpdated.toLocaleTimeString()}` : '正在连接云端...'}
                    <span className="ml-2 inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  </p>
                </div>
                <div className="flex gap-3 w-full md:w-auto flex-wrap">
                  <button
                    type="button"
                    onClick={() => setAdminRefreshTrigger((t) => t + 1)}
                    disabled={isLoadingAdmin}
                    className="flex-1 md:flex-none text-center text-stone-500 hover:text-stone-800 text-sm font-medium transition-colors py-2 disabled:opacity-50"
                  >
                    刷新
                  </button>
                  <button 
                    type="button"
                    onClick={() => setAppState('intro')}
                    className="flex-1 md:flex-none text-center text-stone-500 hover:text-stone-800 text-sm font-medium transition-colors py-2"
                  >
                    返回首页
                  </button>
                  <button 
                    type="button"
                    onClick={handleAdminLogout}
                    className="flex-1 md:flex-none flex items-center justify-center text-rose-600 hover:text-rose-700 text-sm font-medium transition-colors py-2"
                  >
                    <LogOut className="w-4 h-4 mr-1" />
                    退出登录
                  </button>
                </div>
              </div>

              {isLoadingAdmin ? (
                <div className="py-20 text-center text-stone-500">加载数据中...</div>
              ) : adminResults.length === 0 ? (
                <div className="py-20 text-center text-stone-500">暂无测验数据</div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-sm text-stone-600">
                      <thead className="text-xs text-stone-500 uppercase bg-stone-50 border-b border-stone-200">
                        <tr>
                          <th className="px-6 py-4 font-medium">时间</th>
                          <th className="px-6 py-4 font-medium">姓名</th>
                          <th className="px-6 py-4 font-medium">学号</th>
                          <th className="px-6 py-4 font-medium">测验结果</th>
                          <th className="px-6 py-4 font-medium text-right">原本论</th>
                          <th className="px-6 py-4 font-medium text-right">新实证论</th>
                          <th className="px-6 py-4 font-medium text-right">建构论</th>
                          <th className="px-6 py-4 font-medium text-right">批判理论</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminResults.map((result, i) => (
                          <tr key={(result as any).id ?? `row-${i}`} className="border-b border-stone-100 hover:bg-stone-50/50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap font-mono text-xs">
                              {getCreatedAtDate(result)?.toLocaleString() ?? 'N/A'}
                            </td>
                            <td className="px-6 py-4 font-medium text-stone-900">{result.name}</td>
                            <td className="px-6 py-4 font-mono">{result.studentId}</td>
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-1">
                                {result.resultTypes.map((type: string) => (
                                  <span key={type} className="inline-block px-2 py-1 bg-stone-100 text-stone-700 rounded text-xs">
                                    {personalityTypes[type as keyof typeof personalityTypes]?.name.split('·')[0].trim()}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right font-mono">{result.scores.originalism}</td>
                            <td className="px-6 py-4 text-right font-mono">{result.scores.newPositivism}</td>
                            <td className="px-6 py-4 text-right font-mono">{result.scores.constructivism}</td>
                            <td className="px-6 py-4 text-right font-mono">{result.scores.criticalTheory}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden space-y-4">
                    {adminResults.map((result, i) => (
                      <div key={(result as any).id ?? `card-${i}`} className="p-4 rounded-2xl bg-stone-50 border border-stone-100 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-stone-900">{result.name}</div>
                            <div className="text-xs text-stone-500 font-mono">{result.studentId}</div>
                          </div>
                          <div className="text-[10px] text-stone-400 font-mono">
                            {getCreatedAtDate(result)?.toLocaleTimeString() ?? 'N/A'}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {result.resultTypes.map((type: string) => (
                            <span key={type} className="inline-block px-2 py-1 bg-white text-stone-700 rounded text-[10px] border border-stone-200">
                              {personalityTypes[type as keyof typeof personalityTypes]?.name.split('·')[0].trim()}
                            </span>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-200/50">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-stone-400">原本论</span>
                            <span className="font-mono text-stone-700">{result.scores.originalism}</span>
                          </div>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-stone-400">新实证论</span>
                            <span className="font-mono text-stone-700">{result.scores.newPositivism}</span>
                          </div>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-stone-400">建构论</span>
                            <span className="font-mono text-stone-700">{result.scores.constructivism}</span>
                          </div>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-stone-400">批判理论</span>
                            <span className="font-mono text-stone-700">{result.scores.criticalTheory}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
