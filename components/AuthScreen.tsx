import React, { useState } from 'react';
import { 
  ClipboardList, 
  AlertCircle, 
  Loader2, 
  ShieldCheck,
  Building2,
  Lock
} from 'lucide-react';
import { signInWithGoogle } from '../firebase';
import { FirebaseError } from 'firebase/app';

interface AuthScreenProps {
  externalError?: string | null;
  isCheckingAuth?: boolean;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ externalError, isCheckingAuth = false }) => {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const errorMessage = externalError || localError;

  const handleGoogleSignIn = async () => {
    setLocalError(null);
    setIsGoogleLoading(true);
    try {
      await signInWithGoogle();
      // App.tsx handles the onAuthStateChanged and authorization check
    } catch (err) {
      if (err instanceof FirebaseError) {
        if (err.code === 'auth/popup-closed-by-user') {
          setLocalError('ログイン用ポップアップが閉じられました。もう一度お試しください。');
        } else if (err.code === 'auth/cancelled-popup-request') {
          // ignore or show message
        } else if (err.code === 'auth/unauthorized-domain') {
          setLocalError('このドメインはFirebaseの承認済みドメインに登録されていません。');
        } else {
          setLocalError(`Googleログインに失敗しました: ${err.message}`);
        }
      } else {
        setLocalError(err instanceof Error ? err.message : 'Googleログイン中にエラーが発生しました。');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50/40 to-slate-100 p-4 sm:p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200/80 overflow-hidden">
        {/* Brand Banner */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 px-8 pt-9 pb-8 text-white text-center relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-36 h-36 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-blue-400/20 rounded-full blur-xl pointer-events-none" />

          <div className="relative z-10">
            <div className="bg-white/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-md border border-white/20 shadow-inner">
              <ClipboardList className="text-white w-9 h-9" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">VitalSign Pro</h1>
            <p className="text-blue-100 text-xs mt-1.5 font-medium">介護施設向けクラウドバイタル管理システム</p>
            <div className="inline-flex items-center gap-1.5 bg-white/15 px-3 py-1 rounded-full text-[11px] font-semibold mt-3.5 text-white backdrop-blur-sm">
              <ShieldCheck size={14} className="text-emerald-300" />
              <span>Google ワークスペース認証</span>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 sm:p-8">
          <div className="text-center mb-6">
            <h2 className="text-base font-bold text-slate-800">職員ログイン</h2>
            <p className="text-xs text-slate-500 mt-1">
              施設から配布・許可されたGoogleアカウントでログインしてください。
            </p>
          </div>

          {/* Feedback Alert for Unauthorized or Login Error */}
          {errorMessage && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-left animate-in fade-in slide-in-from-top-1">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="text-xs font-bold text-red-800">
                    認証・権限エラー
                  </div>
                  <div className="text-xs font-medium text-red-700 leading-relaxed">
                    {errorMessage}
                  </div>
                  <div className="pt-1.5 text-[11px] text-red-600/80">
                    ※ログインしたGoogleアカウントが未登録、または所属施設が割り当てられていません。
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Checking Auth Indicator */}
          {isCheckingAuth ? (
            <div className="py-6 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <div className="text-xs font-bold text-slate-600">アカウントの権限を確認中...</div>
              <div className="text-[11px] text-slate-400">所属施設データベースを照合しています</div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Single Google Sign-In Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading}
                className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50/30 text-slate-700 hover:text-slate-900 font-bold py-3.5 px-5 rounded-2xl transition-all duration-200 active:scale-[0.98] text-sm disabled:opacity-60 disabled:cursor-not-allowed shadow-sm group cursor-pointer"
              >
                {isGoogleLoading ? (
                  <>
                    <Loader2 size={20} className="animate-spin text-blue-600" />
                    <span>Google認証を処理中...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span className="text-slate-800 group-hover:text-blue-700 transition-colors">
                      Googleアカウントでログイン
                    </span>
                  </>
                )}
              </button>

              {/* Guide card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-left">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 mb-1.5">
                  <Lock size={14} className="text-blue-600" />
                  <span>施設セキュリティポリシー</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  不正アクセス防止のため、管理者によって事前に登録されたGoogleアカウントのみアクセスが許可されます。新規職員の方は施設管理者へ登録をご依頼ください。
                </p>
              </div>
            </div>
          )}

          <div className="mt-8 pt-5 border-t border-slate-100 flex flex-col items-center gap-2 text-center">
            <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold tracking-wider uppercase">
              <Building2 size={13} className="text-slate-400" />
              <span>Multi-Tenant Access Guard</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
