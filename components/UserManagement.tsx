import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Building2, 
  Mail, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  X, 
  ShieldAlert, 
  Sparkles, 
  Info, 
  Check, 
  Ban,
  Eye,
  Lock
} from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { Facility, UserProfile, UserRole } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';

interface UserManagementProps {
  currentUserEmail: string | null;
  facilities: Facility[];
}

export const UserManagement: React.FC<UserManagementProps> = ({
  currentUserEmail,
  facilities
}) => {
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  // Form states for New / Edit user
  const [formEmail, setFormEmail] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('editor');
  const [formFacilities, setFormFacilities] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Firestore real-time sync for users collection
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const list: UserProfile[] = [];
      snapshot.forEach((snapDoc) => {
        const data = snapDoc.data();
        const rawRole = data.role;
        // Normalize role for backward compatibility
        const normalizedRole: UserRole = rawRole === 'viewer' ? 'viewer' : (rawRole === 'admin' ? 'admin' : 'editor');

        list.push({
          uid: snapDoc.id,
          email: data.email || '',
          displayName: data.displayName || '',
          role: normalizedRole,
          allowedFacilities: Array.isArray(data.allowedFacilities) ? data.allowedFacilities : [],
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        });
      });
      // Sort: admins first, then editors, then viewers, then by email
      list.sort((a, b) => {
        const roleOrder: Record<UserRole, number> = { admin: 1, editor: 2, viewer: 3 };
        const orderA = roleOrder[a.role || 'editor'] || 99;
        const orderB = roleOrder[b.role || 'editor'] || 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.email.localeCompare(b.email);
      });
      setUsersList(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const openAddModal = () => {
    setEditingUser(null);
    setFormEmail('');
    setFormDisplayName('');
    setFormRole('editor');
    // Default to selecting all facilities or first facility
    setFormFacilities(facilities.length > 0 ? [facilities[0].id] : []);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (target: UserProfile) => {
    setEditingUser(target);
    setFormEmail(target.email);
    setFormDisplayName(target.displayName || '');
    setFormRole(target.role || 'editor');
    setFormFacilities([...target.allowedFacilities]);
    setFormError(null);
    setIsModalOpen(true);
  };

  const toggleFacility = (facilityId: string) => {
    setFormFacilities(prev => 
      prev.includes(facilityId)
        ? prev.filter(id => id !== facilityId)
        : [...prev, facilityId]
    );
  };

  const handleSelectAllFacilities = () => {
    setFormFacilities(facilities.map(f => f.id));
  };

  const handleClearFacilities = () => {
    setFormFacilities([]);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const cleanEmail = formEmail.trim().toLowerCase();

    if (!cleanEmail) {
      setFormError('Google メールアドレスを入力してください。');
      return;
    }
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setFormError('有効なメールアドレス形式を入力してください。');
      return;
    }

    if (formFacilities.length === 0) {
      setFormError('所属施設を1つ以上選択してください。（施設が0件のアカウントはログイン時に遮断されます）');
      return;
    }

    setFormSubmitting(true);
    try {
      const now = new Date().toISOString();

      if (editingUser) {
        // Edit existing user doc
        const docRef = doc(db, 'users', editingUser.uid);
        await setDoc(docRef, {
          email: cleanEmail,
          displayName: formDisplayName.trim(),
          role: formRole,
          allowedFacilities: formFacilities,
          updatedAt: now
        }, { merge: true });

        setActionSuccess(`「${cleanEmail}」の権限情報（ロール: ${formRole}）を更新しました`);
      } else {
        // Create new user doc
        // Check if email already registered
        const existing = usersList.find(u => u.email.toLowerCase() === cleanEmail);
        if (existing) {
          setFormError(`このメールアドレスは既に登録されています（現在のロール: ${existing.role}）。既存のユーザーを編集してください。`);
          setFormSubmitting(false);
          return;
        }

        // Use a safe document ID for pre-registration: email converted or invited_xxx
        const safeDocId = `invited_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
        await setDoc(doc(db, 'users', safeDocId), {
          email: cleanEmail,
          displayName: formDisplayName.trim() || cleanEmail.split('@')[0],
          role: formRole,
          allowedFacilities: formFacilities,
          createdAt: now,
          updatedAt: now
        });

        setActionSuccess(`「${cleanEmail}」（ロール: ${formRole}）を事前登録しました。該当のGoogleアカウントでログインするとアクセスが許可されます。`);
      }

      setIsModalOpen(false);
      setTimeout(() => setActionSuccess(null), 4500);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '保存に失敗しました。');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteUser = async (target: UserProfile) => {
    if (target.email.toLowerCase() === currentUserEmail?.toLowerCase()) {
      alert('現在ログイン中の管理者アカウント自身を削除することはできません。');
      return;
    }

    const confirmMsg = `「${target.email}」（${target.displayName || '氏名未設定'}）の権限を完全に削除しますか？\n\n削除すると、このGoogleアカウントでのログインが直ちに拒否されます。`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await deleteDoc(doc(db, 'users', target.uid));
      setActionSuccess(`「${target.email}」のアカウント登録を削除しました`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      alert(err instanceof Error ? err.message : '削除に失敗しました。');
    }
  };

  const handleToggleSuspend = async (target: UserProfile) => {
    if (target.email.toLowerCase() === currentUserEmail?.toLowerCase()) {
      alert('現在ログイン中のアカウントの権限を停止することはできません。');
      return;
    }

    const isSuspended = target.allowedFacilities.length === 0;
    const actionText = isSuspended ? 'アクセス許可（全施設復元）' : 'アクセス停止（全施設解除）';
    
    if (!window.confirm(`「${target.email}」の${actionText}を実行しますか？`)) {
      return;
    }

    try {
      const docRef = doc(db, 'users', target.uid);
      const newFacilities = isSuspended ? facilities.map(f => f.id) : [];
      await setDoc(docRef, {
        allowedFacilities: newFacilities,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setActionSuccess(
        isSuspended 
          ? `「${target.email}」のアクセス権限を再開しました` 
          : `「${target.email}」を権限停止に設定しました（ログイン遮断）`
      );
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      alert('操作に失敗しました。');
    }
  };

  const editorCount = usersList.filter(u => u.role === 'editor').length;
  const viewerCount = usersList.filter(u => u.role === 'viewer').length;
  const adminCount = usersList.filter(u => u.role === 'admin').length;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-amber-100 p-3 rounded-2xl text-amber-700">
            <ShieldCheck size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 uppercase tracking-wider">
                Admin Console
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight mt-1">職員・アカウント権限管理</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Google ログイン認可ガード・役割ロール（編集者 / 閲覧のみ / 管理者）・所属施設の一括管理
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={openAddModal}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all text-xs active:scale-[0.98] cursor-pointer"
          >
            <UserPlus size={16} />
            <span>新規スタッフを事前登録</span>
          </button>
        </div>
      </div>

      {/* Action Notification Toast */}
      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-xs text-emerald-800 animate-in fade-in">
          <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
          <span className="font-semibold">{actionSuccess}</span>
        </div>
      )}

      {/* Role explanation cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 text-xs text-slate-700 flex items-start gap-2.5">
          <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg shrink-0 mt-0.5">
            <Edit3 size={15} />
          </div>
          <div>
            <div className="font-bold text-emerald-900 flex items-center gap-1.5">
              <span>編集者 (editor)</span>
              <span className="bg-emerald-200/80 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded font-bold">{editorCount} 名</span>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">バイタル記録の入力・自動保存・修正、およびCSV出力が可能です。</p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700 flex items-start gap-2.5">
          <div className="p-1.5 bg-slate-200 text-slate-700 rounded-lg shrink-0 mt-0.5">
            <Eye size={15} />
          </div>
          <div>
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <span>閲覧のみ (viewer)</span>
              <span className="bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.2 rounded font-bold">{viewerCount} 名</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">データの閲覧や印刷・CSV出力のみ可能。入力欄はロックされ変更不可。</p>
          </div>
        </div>

        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 text-xs text-slate-700 flex items-start gap-2.5">
          <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg shrink-0 mt-0.5">
            <Sparkles size={15} />
          </div>
          <div>
            <div className="font-bold text-amber-900 flex items-center gap-1.5">
              <span>管理者 (admin)</span>
              <span className="bg-amber-200/80 text-amber-800 text-[10px] px-1.5 py-0.2 rounded font-bold">{adminCount} 名</span>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">全データ編集に加え、職員アカウント登録・所属施設権限の変更が可能。</p>
          </div>
        </div>
      </div>

      {/* Staff Table Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-slate-500" />
            <span className="text-sm font-bold text-slate-800">登録済みスタッフ一覧</span>
            <span className="ml-2 text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
              {usersList.length} 名
            </span>
          </div>
          <div className="text-[11px] text-slate-400">
            ログイン中管理者: <strong className="text-slate-600">{currentUserEmail || '管理者'}</strong>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
            <p className="text-xs">スタッフ情報を読み込み中...</p>
          </div>
        ) : usersList.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Users size={40} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm font-bold text-slate-600">登録スタッフがまだありません</p>
            <p className="text-xs text-slate-400 mt-1">「新規スタッフを事前登録」から Google アカウントを追加してください</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider">
                  <th className="py-3 px-5">スタッフ・Googleアカウント</th>
                  <th className="py-3 px-4">権限ロール</th>
                  <th className="py-3 px-4">所属施設 (兼務施設)</th>
                  <th className="py-3 px-4 text-center">認可ステータス</th>
                  <th className="py-3 px-5 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usersList.map((target) => {
                  const isCurrent = target.email.toLowerCase() === currentUserEmail?.toLowerCase();
                  const isSuspended = target.allowedFacilities.length === 0;
                  const isInvited = target.uid.startsWith('invited_');

                  return (
                    <tr key={target.uid} className={`hover:bg-slate-50/80 transition-colors ${isSuspended ? 'bg-slate-50/50 opacity-60' : ''}`}>
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            target.role === 'admin' 
                              ? 'bg-amber-100 text-amber-800' 
                              : target.role === 'viewer'
                                ? 'bg-slate-100 text-slate-700'
                                : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {target.displayName ? target.displayName[0] : target.email[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800 text-xs truncate">
                                {target.displayName || '氏名未設定'}
                              </span>
                              {isCurrent && (
                                <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded">
                                  あなた
                                </span>
                              )}
                              {isInvited && (
                                <span className="text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.2 rounded" title="初回GoogleログインでUIDが自動紐付けされます">
                                  事前登録済
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono truncate">
                              {target.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {target.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Sparkles size={12} className="text-amber-500" />
                            <span>システム管理者</span>
                          </span>
                        ) : target.role === 'viewer' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                            <Eye size={12} className="text-slate-500" />
                            <span>閲覧のみ (Viewer)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Edit3 size={12} className="text-emerald-500" />
                            <span>編集者 (Editor)</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {target.allowedFacilities.length === 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-red-600 font-bold bg-red-50 border border-red-200 px-2 py-0.5 rounded-lg">
                            <ShieldAlert size={12} />
                            <span>所属施設なし（アクセス不可）</span>
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {target.allowedFacilities.map(fId => {
                              const fObj = facilities.find(f => f.id === fId);
                              return (
                                <span 
                                  key={fId}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-200/80 text-blue-700 rounded-md text-[11px] font-medium"
                                >
                                  <Building2 size={11} className="text-blue-500" />
                                  <span>{fObj?.name || fId}</span>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {isSuspended ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-100/70 px-2.5 py-0.5 rounded-full">
                            <Ban size={12} />
                            <span>権限停止</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                            <CheckCircle2 size={12} className="text-emerald-500" />
                            <span>利用可能</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(target)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                            title="施設・権限を変更"
                          >
                            <Edit3 size={15} />
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => handleToggleSuspend(target)}
                            disabled={isCurrent}
                            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                              isSuspended
                                ? 'text-emerald-600 hover:bg-emerald-50'
                                : 'text-amber-600 hover:bg-amber-50'
                            } disabled:opacity-30 disabled:cursor-not-allowed`}
                            title={isSuspended ? 'アクセスを再開' : '一時的にアクセスを停止'}
                          >
                            {isSuspended ? <Check size={15} /> : <Ban size={15} />}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteUser(target)}
                            disabled={isCurrent}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title="ユーザーを完全に削除"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal for Add / Edit User */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-blue-700 to-indigo-700 text-white flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <ShieldCheck size={20} className="text-blue-200" />
                <h3 className="text-base font-bold">
                  {editingUser ? '職員の権限・所属施設を編集' : '新規スタッフのGoogle事前登録'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-5">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
                  <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                  <div className="font-semibold">{formError}</div>
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Google メールアドレス <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="nurse.staff@gmail.com または 組織ドメイン"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-xl text-xs text-slate-800 outline-none transition-all"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  スタッフがログインに使用する Google アカウントを入力してください。
                </p>
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  職員氏名 <span className="text-slate-400 font-normal">(任意)</span>
                </label>
                <input
                  type="text"
                  value={formDisplayName}
                  onChange={(e) => setFormDisplayName(e.target.value)}
                  placeholder="例: 佐藤 遥香"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-xl text-xs text-slate-800 outline-none transition-all"
                />
              </div>

              {/* Role: editor / viewer / admin */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  権限ロール <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Editor */}
                  <label className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-all ${
                    formRole === 'editor' 
                      ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-400/40 text-emerald-950' 
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="role"
                        value="editor"
                        checked={formRole === 'editor'}
                        onChange={() => setFormRole('editor')}
                        className="text-emerald-600"
                      />
                      <span className="text-xs font-bold flex items-center gap-1">
                        <Edit3 size={13} className="text-emerald-600" />
                        編集者 (editor)
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 pl-5">入力・更新・保存が可能</div>
                  </label>

                  {/* Viewer */}
                  <label className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-all ${
                    formRole === 'viewer' 
                      ? 'bg-slate-100 border-slate-500 ring-2 ring-slate-400/40 text-slate-900' 
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="role"
                        value="viewer"
                        checked={formRole === 'viewer'}
                        onChange={() => setFormRole('viewer')}
                        className="text-slate-600"
                      />
                      <span className="text-xs font-bold flex items-center gap-1">
                        <Eye size={13} className="text-slate-600" />
                        閲覧のみ (viewer)
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 pl-5">閲覧専用・入力はロック</div>
                  </label>

                  {/* Admin */}
                  <label className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-all ${
                    formRole === 'admin' 
                      ? 'bg-amber-50/80 border-amber-500 ring-2 ring-amber-400/40 text-amber-950' 
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="role"
                        value="admin"
                        checked={formRole === 'admin'}
                        onChange={() => setFormRole('admin')}
                        className="text-amber-600"
                      />
                      <span className="text-xs font-bold flex items-center gap-1">
                        <Sparkles size={13} className="text-amber-600" />
                        管理者 (admin)
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 pl-5">職員管理・マスタ全権限</div>
                  </label>
                </div>
              </div>

              {/* Allowed Facilities */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    所属施設・兼務施設 <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={handleSelectAllFacilities}
                      className="text-blue-600 hover:underline font-bold cursor-pointer"
                    >
                      全施設選択
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={handleClearFacilities}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      解除
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 max-h-48 overflow-y-auto">
                  {facilities.map((fac) => {
                    const isChecked = formFacilities.includes(fac.id);
                    return (
                      <label 
                        key={fac.id}
                        className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer ${
                          isChecked 
                            ? 'bg-blue-50/70 border-blue-300 text-blue-900 font-bold' 
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleFacility(fac.id)}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          <span>{fac.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ID: {fac.id}
                        </span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  チェックを入れた施設のみ、ログイン後に切り替え・アクセスが可能になります。
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer active:scale-[0.98]"
                >
                  {formSubmitting && <Loader2 size={14} className="animate-spin" />}
                  <span>{editingUser ? '権限を更新する' : 'スタッフを登録する'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
