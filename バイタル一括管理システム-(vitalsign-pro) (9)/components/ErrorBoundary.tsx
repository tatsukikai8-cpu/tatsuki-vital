import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, LayoutGrid } from 'lucide-react';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error caught by ErrorBoundary:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      try {
        this.props.onReset();
      } catch (err) {
        console.error("Error during ErrorBoundary onReset:", err);
      }
    }
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white p-8 rounded-2xl border border-red-200 shadow-md max-w-xl mx-auto my-12 text-center space-y-4 animate-in fade-in">
          <div className="w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto border border-red-100">
            <AlertCircle size={28} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">画面の表示中にエラーが発生しました</h2>
            <p className="text-xs text-slate-500 mt-1">
              権限制限または通信の乱れにより画面が一時的に停止しました。下のボタンから一括入力画面へ安全にお戻りいただけます。
            </p>
            {this.state.error?.message && (
              <p className="text-[11px] font-mono text-red-700 bg-red-50 p-2.5 rounded-lg mt-3 break-all border border-red-100 text-left">
                {this.state.error.message}
              </p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <LayoutGrid size={15} />
              <span>一括入力画面へ戻る</span>
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw size={14} />
              <span>画面を再読み込み</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
