import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AppView, VitalRecord, Resident, Facility, UserProfile, VitalThresholds, UserRole } from './types';
import BatchInputTable from './components/BatchInputTable';
import IndividualHistory from './components/IndividualHistory';
import Dashboard from './components/Dashboard';
import ResidentMaster from './components/ResidentMaster';
import UserManagement from './components/UserManagement';
import AuthScreen from './components/AuthScreen';
import FacilitySwitcher from './components/FacilitySwitcher';
import { 
  LayoutGrid, 
  Users, 
  ClipboardList, 
  Info, 
  Settings, 
  LogOut, 
  Loader2, 
  Download, 
  CheckCircle2, 
  ShieldCheck,
  Building2,
  Eye,
  Edit3
} from 'lucide-react';
import { DEFAULT_FACILITIES, DEFAULT_THRESHOLDS, getInitialResidentsForFacility } from './constants';
import { auth, db, logOut } from './firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  query, 
  setDoc, 
  doc, 
  getDoc,
  getDocs,
  getDocFromServer, 
  deleteDoc, 
  orderBy, 
  where 
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './lib/firestoreErrors';
import { exportVitalRecordsToCSV } from './lib/csvExport';

const ADMIN_BOOTSTRAP_EMAIL = 'tatsukikai8@tatsukikai.com';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [authChecking, setAuthChecking] = useState<boolean>(false);
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<AppView>(AppView.BATCH_INPUT);
  const [records, setRecords] = useState<VitalRecord[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  
  // マルチテナント・施設関連ステート
  const [facilities, setFacilities] = useState<Facility[]>(DEFAULT_FACILITIES);
  const [allowedFacilityIds, setAllowedFacilityIds] = useState<string[]>(['facility-a', 'facility-b']);
  const [currentFacilityId, setCurrentFacilityId] = useState<string>(() => {
    return localStorage.getItem('vital_selected_facility_id') || 'facility-a';
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 管理者フラグの判定
  const isAdmin = useMemo(() => {
    if (!user) return false;
    if (user.email?.toLowerCase() === ADMIN_BOOTSTRAP_EMAIL.toLowerCase()) return true;
    return currentUserProfile?.role === 'admin';
  }, [user, currentUserProfile]);

  // 閲覧のみ（Viewer）フラグの判定
  const isViewer = useMemo(() => {
    return currentUserProfile?.role === 'viewer';
  }, [currentUserProfile]);

  // 編集権限フラグの判定
  const isEditor = useMemo(() => {
    return !isViewer;
  }, [isViewer]);

  // 現在選択中の施設オブジェクト
  const currentFacility = useMemo(() => {
    return facilities.find(f => f.id === currentFacilityId) ||
           DEFAULT_FACILITIES.find(f => f.id === currentFacilityId) || {
             id: currentFacilityId,
             name: '陽光ケアホーム',
             thresholds: DEFAULT_THRESHOLDS
           };
  }, [facilities, currentFacilityId]);

  // 現在選択中の施設の警告閾値
  const currentThresholds = useMemo<VitalThresholds>(() => {
    return currentFacility.thresholds || DEFAULT_THRESHOLDS;
  }, [currentFacility]);

  const handleDownloadCSV = () => {
    const result = exportVitalRecordsToCSV(records, residents, currentFacility.name);
    setToastMessage(`全 ${result.count} 件のバイタル記録をCSV出力しました (${result.filename})`);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleSelectFacility = (newFacilityId: string) => {
    if (newFacilityId === currentFacilityId) return;
    setCurrentFacilityId(newFacilityId);
    localStorage.setItem('vital_selected_facility_id', newFacilityId);
    const target = facilities.find(f => f.id === newFacilityId);
    setToastMessage(`「${target?.name || newFacilityId}」に切り替えました`);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // 役割ロールの正規化 (未設定や既存staffはeditor、adminはadmin、viewerはviewer)
  const normalizeRole = (rawRole: any, email: string): UserRole => {
    if (email.toLowerCase() === ADMIN_BOOTSTRAP_EMAIL.toLowerCase()) return 'admin';
    if (rawRole === 'viewer') return 'viewer';
    if (rawRole === 'admin') return 'admin';
    return 'editor';
  };

  // Google ログイン後の認可ガード・権限チェック処理
  const verifyUserAuthorization = useCallback(async (loggedUser: User) => {
    setAuthChecking(true);
    setAuthErrorMessage(null);

    const userEmail = loggedUser.email?.trim().toLowerCase() || '';
    const userUid = loggedUser.uid;

    try {
      // 1. まず users/{uid} を直接確認
      const userDocRef = doc(db, 'users', userUid);
      const userSnap = await getDoc(userDocRef);

      let foundProfile: UserProfile | null = null;

      if (userSnap.exists()) {
        const data = userSnap.data();
        foundProfile = {
          uid: userUid,
          email: data.email || userEmail,
          displayName: loggedUser.displayName || data.displayName || '',
          role: normalizeRole(data.role, userEmail),
          allowedFacilities: Array.isArray(data.allowedFacilities) ? data.allowedFacilities : []
        };
      } else {
        // 2. UIDドキュメントがない場合、管理者による事前登録（email照合）を検索
        const qEmail = query(
          collection(db, 'users'),
          where('email', '==', userEmail)
        );
        const querySnap = await getDocs(qEmail);

        if (!querySnap.empty) {
          const matchedDoc = querySnap.docs[0];
          const data = matchedDoc.data();
          foundProfile = {
            uid: userUid,
            email: userEmail,
            displayName: loggedUser.displayName || data.displayName || '',
            role: normalizeRole(data.role, userEmail),
            allowedFacilities: Array.isArray(data.allowedFacilities) ? data.allowedFacilities : []
          };

          // UID付きドキュメントへ移行 / 連携同期
          await setDoc(userDocRef, {
            ...data,
            uid: userUid,
            email: userEmail,
            displayName: foundProfile.displayName,
            role: foundProfile.role,
            updatedAt: new Date().toISOString()
          }, { merge: true });

          // 事前登録用仮ID（invited_xxx）だった場合はクリーンアップ
          if (matchedDoc.id !== userUid && matchedDoc.id.startsWith('invited_')) {
            await deleteDoc(doc(db, 'users', matchedDoc.id)).catch(() => {});
          }
        } else if (userEmail === ADMIN_BOOTSTRAP_EMAIL.toLowerCase()) {
          // 初期管理者（tatsukikai8@tatsukikai.com）の自動ブートストラップ
          const initialAdminProfile: UserProfile = {
            uid: userUid,
            email: userEmail,
            displayName: loggedUser.displayName || 'システム管理者',
            role: 'admin',
            allowedFacilities: DEFAULT_FACILITIES.map(f => f.id),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          await setDoc(userDocRef, initialAdminProfile);
          foundProfile = initialAdminProfile;
        }
      }

      // 認可判定: ユーザー登録が存在し、かつ allowedFacilities に1つ以上の施設が登録されていること
      const isPermitted = Boolean(
        foundProfile && 
        Array.isArray(foundProfile.allowedFacilities) && 
        foundProfile.allowedFacilities.length > 0
      );

      if (isPermitted && foundProfile) {
        // 認可成功: メイン画面へ遷移
        setCurrentUserProfile(foundProfile);
        setAllowedFacilityIds(foundProfile.allowedFacilities);
        
        // 保存されていた選択施設が許可リストにあれば優先、なければ先頭
        const savedId = localStorage.getItem('vital_selected_facility_id');
        if (savedId && foundProfile.allowedFacilities.includes(savedId)) {
          setCurrentFacilityId(savedId);
        } else {
          setCurrentFacilityId(foundProfile.allowedFacilities[0]);
          localStorage.setItem('vital_selected_facility_id', foundProfile.allowedFacilities[0]);
        }

        setUser(loggedUser);
        setIsAuthorized(true);
        setAuthErrorMessage(null);
      } else {
        // 認可失敗: 登録なしまたは権限なし -> エラー表示および自動ログアウト (signOut)
        console.warn(`[AuthGuard] Access denied for user: ${userEmail}. Allowed facilities: ${foundProfile?.allowedFacilities?.length || 0}`);
        const deniedMsg = 'このアカウントにはアクセス権限が付与されていません。管理者にお問い合わせください。';
        setAuthErrorMessage(deniedMsg);
        setIsAuthorized(false);
        setUser(null);
        setCurrentUserProfile(null);
        await signOut(auth);
      }
    } catch (err) {
      console.error("[AuthGuard] Error verifying authorization:", err);
      setAuthErrorMessage('このアカウントにはアクセス権限が付与されていません。管理者にお問い合わせください。');
      setIsAuthorized(false);
      setUser(null);
      setCurrentUserProfile(null);
      await signOut(auth).catch(() => {});
    } finally {
      setAuthChecking(false);
      setLoading(false);
    }
  }, []);

  // 初期化・認証監視
  useEffect(() => {
    // Validate connection to Firestore
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    // タイムアウト保護: 万一Firebase認証初期化が遅延した場合でもローディングが固まらないようにする
    const fallbackTimer = setTimeout(() => {
      setLoading(false);
    }, 2000);

    const unsubscribeAuth = onAuthStateChanged(auth, async (loggedUser) => {
      clearTimeout(fallbackTimer);
      if (loggedUser) {
        await verifyUserAuthorization(loggedUser);
      } else {
        setUser(null);
        setIsAuthorized(false);
        setCurrentUserProfile(null);
        setLoading(false);
        setAuthChecking(false);
      }
    });

    return () => {
      clearTimeout(fallbackTimer);
      unsubscribeAuth();
    };
  }, [verifyUserAuthorization]);

  // 1. 認証済みユーザーのプロファイル＆兼務施設のリアルタイム監視（管理者が権限を変更した際の即時反映）
  useEffect(() => {
    if (!user || !isAuthorized) return;

    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribeUser = onSnapshot(userDocRef, async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const facilitiesList = Array.isArray(data.allowedFacilities) ? data.allowedFacilities : [];
        
        // 途中で管理者に全施設を解除された場合 -> 即時ログアウト
        if (facilitiesList.length === 0) {
          console.warn("[AuthGuard] Access revoked in real-time.");
          setAuthErrorMessage('このアカウントにはアクセス権限が付与されていません。管理者にお問い合わせください。');
          setIsAuthorized(false);
          setUser(null);
          setCurrentUserProfile(null);
          await signOut(auth);
          return;
        }

        setAllowedFacilityIds(facilitiesList);
        setCurrentUserProfile(prev => prev ? {
          ...prev,
          displayName: data.displayName || prev.displayName,
          role: normalizeRole(data.role, user.email || prev.email),
          allowedFacilities: facilitiesList
        } : null);

        // 現在選択中の施設が許可リストに含まれていない場合は先頭施設に変更
        if (!facilitiesList.includes(currentFacilityId)) {
          setCurrentFacilityId(facilitiesList[0]);
          localStorage.setItem('vital_selected_facility_id', facilitiesList[0]);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    });

    // 施設マスタの初期登録
    const ensureFacilities = async () => {
      try {
        for (const f of DEFAULT_FACILITIES) {
          await setDoc(doc(db, 'facilities', f.id), f, { merge: true });
        }
      } catch (err) {
        console.error("Error initializing facilities in DB:", err);
      }
    };
    ensureFacilities();

    return () => {
      unsubscribeUser();
    };
  }, [user, isAuthorized, currentFacilityId]);

  // 2. 許可された各施設マスタのリアルタイム同期
  useEffect(() => {
    if (!user || !isAuthorized || allowedFacilityIds.length === 0) return;

    const unsubs: (() => void)[] = [];
    allowedFacilityIds.forEach(facilityId => {
      const unsub = onSnapshot(doc(db, 'facilities', facilityId), (snap) => {
        if (snap.exists()) {
          const fData = snap.data() as Facility;
          setFacilities(prev => {
            const index = prev.findIndex(item => item.id === facilityId);
            if (index >= 0) {
              const updated = [...prev];
              updated[index] = { ...updated[index], ...fData };
              return updated;
            } else {
              return [...prev, fData];
            }
          });
        }
      }, (err) => {
        console.warn(`Could not sync facility ${facilityId}:`, err);
      });
      unsubs.push(unsub);
    });

    return () => {
      unsubs.forEach(u => u());
    };
  }, [user, isAuthorized, allowedFacilityIds]);

  // 3. 現在選択中の施設(currentFacilityId)に限定したバイタル記録・利用者マスタの同期
  useEffect(() => {
    if (!user || !isAuthorized || !currentFacilityId) return;

    localStorage.setItem('vital_selected_facility_id', currentFacilityId);

    // 施設別バイタル記録のリアルタイム同期 (where句で施設フィルタ)
    const qRecords = query(
      collection(db, 'vital_records'),
      where('facilityId', '==', currentFacilityId)
    );
    const unsubscribeRecords = onSnapshot(
      qRecords,
      (snapshot) => {
        const recordsData: VitalRecord[] = [];
        snapshot.forEach((docSnap) => {
          recordsData.push({ id: docSnap.id, ...docSnap.data() } as VitalRecord);
        });
        setRecords(recordsData);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `vital_records (facilityId: ${currentFacilityId})`);
      }
    );

    // 施設別利用者マスタのリアルタイム同期 (where句で施設フィルタ)
    const qResidents = query(
      collection(db, 'residents'),
      where('facilityId', '==', currentFacilityId),
      orderBy('order', 'asc')
    );
    const unsubscribeResidents = onSnapshot(
      qResidents,
      async (snapshot) => {
        const residentsData: Resident[] = [];
        snapshot.forEach((docSnap) => {
          residentsData.push({ id: docSnap.id, ...docSnap.data() } as Resident);
        });
        if (residentsData.length > 0) {
          setResidents(residentsData);
        } else {
          // 該当施設の利用者データが空の場合は初期利用者をシード
          const initial = getInitialResidentsForFacility(currentFacilityId);
          setResidents(initial);
          try {
            const batchPromises = initial.map((res, index) => 
              setDoc(doc(db, 'residents', res.id), { ...res, order: index })
            );
            await Promise.all(batchPromises);
          } catch (err) {
            console.error("Error seeding initial residents for facility:", err);
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `residents (facilityId: ${currentFacilityId})`);
      }
    );

    return () => {
      unsubscribeRecords();
      unsubscribeResidents();
    };
  }, [user, isAuthorized, currentFacilityId]);

  /**
   * レコードを保存または更新する（必ずfacilityIdを付与）
   */
  const saveBatchRecords = async (newRecords: VitalRecord[]) => {
    if (!user || !isAuthorized || !currentFacilityId) return;
    if (isViewer) {
      alert('閲覧専用（viewer）アカウントのため、バイタル記録の登録・更新は行えません。');
      return;
    }
    try {
      const batchPromises = newRecords.map(nr => {
        const docId = `${currentFacilityId}_${nr.residentId}_${nr.date}`;
        const cleanData = JSON.parse(JSON.stringify({
          ...nr,
          facilityId: currentFacilityId
        }));
        return setDoc(doc(db, 'vital_records', docId), cleanData);
      });
      await Promise.all(batchPromises);
      setToastMessage('バイタル記録をクラウドへ保存しました');
      setTimeout(() => {
        setToastMessage(null);
      }, 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `vital_records`);
      throw error;
    }
  };

  /**
   * 利用者マスタを更新する
   */
  const updateResidents = async (newResidents: Resident[]) => {
    if (!user || !isAuthorized || !currentFacilityId) return;
    if (isViewer) {
      alert('閲覧専用（viewer）アカウントのため、利用者マスタの変更・保存は行えません。');
      return;
    }
    try {
      const currentResidentIds = residents.map(r => r.id);
      const newResidentIds = newResidents.map(r => r.id);
      const toDelete = currentResidentIds.filter(id => !newResidentIds.includes(id));
      
      const deletePromises = toDelete.map(id => deleteDoc(doc(db, 'residents', id)));
      const savePromises = newResidents.map((res, index) => {
        const cleanData = JSON.parse(JSON.stringify({
          ...res,
          facilityId: currentFacilityId,
          order: index
        }));
        return setDoc(doc(db, 'residents', res.id), cleanData);
      });

      await Promise.all([...deletePromises, ...savePromises]);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `residents`);
      throw error;
    }
  };

  /**
   * 施設名を更新する
   */
  const updateFacilityName = async (newName: string) => {
    if (!user || !isAuthorized || !currentFacilityId) return;
    if (isViewer) {
      alert('閲覧専用（viewer）アカウントのため、施設名の更新は行えません。');
      return;
    }
    try {
      await setDoc(doc(db, 'facilities', currentFacilityId), {
        id: currentFacilityId,
        name: newName
      }, { merge: true });
      setFacilities(prev => prev.map(f => f.id === currentFacilityId ? { ...f, name: newName } : f));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `facilities/${currentFacilityId}`);
    }
  };

  /**
   * 施設のバイタル警告閾値を更新する
   */
  const updateFacilityThresholds = async (newThresholds: VitalThresholds) => {
    if (!user || !isAuthorized || !currentFacilityId) return;
    if (isViewer) {
      alert('閲覧専用（viewer）アカウントのため、警告閾値の更新は行えません。');
      return;
    }
    try {
      await setDoc(doc(db, 'facilities', currentFacilityId), {
        id: currentFacilityId,
        thresholds: newThresholds
      }, { merge: true });
      setFacilities(prev => prev.map(f => f.id === currentFacilityId ? { ...f, thresholds: newThresholds } : f));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `facilities/${currentFacilityId}/thresholds`);
      throw error;
    }
  };

  const handleLogout = async () => {
    try {
      await logOut();
      setUser(null);
      setIsAuthorized(false);
      setCurrentUserProfile(null);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  if (loading || authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-700 font-bold text-sm">
            {authChecking ? 'アカウント権限を確認しています...' : '読み込み中...'}
          </p>
          <p className="text-slate-400 text-xs mt-1">施設データベースと照合中</p>
        </div>
      </div>
    );
  }

  // 未ログインまたは認可ガードを通過していない場合は Google ログイン画面を表示
  if (!user || !isAuthorized) {
    return (
      <AuthScreen 
        externalError={authErrorMessage} 
        isCheckingAuth={authChecking} 
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/30">
      <header className="bg-white border-b sticky top-0 z-50 no-print shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo and Facility Switcher */}
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2.5 rounded-xl shrink-0 shadow-xs">
                <ClipboardList className="text-white w-5 h-5" />
              </div>
              <div className="min-w-0 flex items-center gap-2.5">
                <div>
                  <h1 className="text-xl font-black text-slate-800 tracking-tight leading-none">VitalSign Pro</h1>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-blue-600 font-bold tracking-tighter uppercase">
                      Google 認証済
                    </span>
                    {isAdmin ? (
                      <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded border border-amber-300">
                        ADMIN
                      </span>
                    ) : isViewer ? (
                      <span className="text-[9px] bg-slate-100 text-slate-700 font-bold px-1.5 py-0.2 rounded border border-slate-300 flex items-center gap-0.5">
                        <Eye size={10} /> 閲覧のみ
                      </span>
                    ) : (
                      <span className="text-[9px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.2 rounded border border-emerald-300 flex items-center gap-0.5">
                        <Edit3 size={10} /> 編集者
                      </span>
                    )}
                  </div>
                </div>
                {/* 施設切り替えスイッチ */}
                <div className="hidden sm:block">
                  <FacilitySwitcher
                    facilities={facilities}
                    allowedFacilityIds={allowedFacilityIds}
                    currentFacilityId={currentFacilityId}
                    onSelectFacility={handleSelectFacility}
                  />
                </div>
              </div>
            </div>
            
            <nav className="hidden lg:flex space-x-1 sm:space-x-2">
              <button
                type="button"
                onClick={() => setCurrentView(AppView.BATCH_INPUT)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  currentView === AppView.BATCH_INPUT ? 'bg-blue-50 text-blue-700 shadow-xs' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <LayoutGrid size={16} />
                <span>一括入力</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentView(AppView.INDIVIDUAL_HISTORY)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  currentView === AppView.INDIVIDUAL_HISTORY ? 'bg-blue-50 text-blue-700 shadow-xs' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Users size={16} />
                <span>個人履歴</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentView(AppView.DASHBOARD)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  currentView === AppView.DASHBOARD ? 'bg-blue-50 text-blue-700 shadow-xs' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Info size={16} />
                <span>概要</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentView(AppView.RESIDENT_MASTER)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  currentView === AppView.RESIDENT_MASTER ? 'bg-blue-50 text-blue-700 shadow-xs' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Settings size={16} />
                <span>マスタ</span>
              </button>

              {/* 管理者専用: ユーザー管理タブ */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setCurrentView(AppView.USER_MANAGEMENT)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    currentView === AppView.USER_MANAGEMENT 
                      ? 'bg-amber-100/70 text-amber-900 border border-amber-300/80 shadow-xs' 
                      : 'text-amber-800 hover:bg-amber-50/70'
                  }`}
                  title="職員アカウント登録・所属施設権限管理"
                >
                  <ShieldCheck size={16} className="text-amber-600" />
                  <span>ユーザー管理</span>
                </button>
              )}
            </nav>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={handleDownloadCSV}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border border-slate-200 transition-all shadow-xs active:scale-[0.98] cursor-pointer"
                title="現在の全バイタル記録をCSV形式でダウンロード"
              >
                <Download size={15} className="text-blue-600" />
                <span className="hidden sm:inline">CSV出力</span>
                <span className="sm:hidden">CSV</span>
              </button>

              <div className="hidden sm:flex flex-col items-end mr-1 max-w-[170px]">
                <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider leading-none">
                  {isAdmin ? (
                    <span className="text-amber-600 font-bold">Admin</span>
                  ) : isViewer ? (
                    <span className="text-slate-500 font-bold flex items-center gap-0.5"><Eye size={10} /> Viewer</span>
                  ) : (
                    <span className="text-emerald-600 font-bold flex items-center gap-0.5"><Edit3 size={10} /> Editor</span>
                  )}
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-400 font-medium">Google Auth</span>
                </div>
                <span className="text-xs font-bold text-slate-700 truncate w-full text-right" title={user.email || ''}>
                  {currentUserProfile?.displayName || user.displayName || user.email || 'ログイン職員'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-2 p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                title="Googleアカウントからログアウト"
              >
                <LogOut size={19} />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation & Mobile Facility Switcher */}
        <div className="lg:hidden border-t bg-slate-50/50">
          <div className="px-4 py-2 border-b border-slate-200 sm:hidden flex justify-between items-center">
            <span className="text-[11px] font-bold text-slate-500">施設:</span>
            <FacilitySwitcher
              facilities={facilities}
              allowedFacilityIds={allowedFacilityIds}
              currentFacilityId={currentFacilityId}
              onSelectFacility={handleSelectFacility}
            />
          </div>
          <div className={`max-w-7xl mx-auto px-4 grid ${isAdmin ? 'grid-cols-5' : 'grid-cols-4'} gap-1 py-1`}>
            <button
              type="button"
              onClick={() => setCurrentView(AppView.BATCH_INPUT)}
              className={`flex flex-col items-center justify-center p-2 rounded-lg text-[10px] font-bold ${
                currentView === AppView.BATCH_INPUT ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500'
              }`}
            >
              <LayoutGrid size={16} className="mb-1" />
              一括
            </button>
            <button
              type="button"
              onClick={() => setCurrentView(AppView.INDIVIDUAL_HISTORY)}
              className={`flex flex-col items-center justify-center p-2 rounded-lg text-[10px] font-bold ${
                currentView === AppView.INDIVIDUAL_HISTORY ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500'
              }`}
            >
              <Users size={16} className="mb-1" />
              履歴
            </button>
            <button
              type="button"
              onClick={() => setCurrentView(AppView.DASHBOARD)}
              className={`flex flex-col items-center justify-center p-2 rounded-lg text-[10px] font-bold ${
                currentView === AppView.DASHBOARD ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500'
              }`}
            >
              <Info size={16} className="mb-1" />
              概要
            </button>
            <button
              type="button"
              onClick={() => setCurrentView(AppView.RESIDENT_MASTER)}
              className={`flex flex-col items-center justify-center p-2 rounded-lg text-[10px] font-bold ${
                currentView === AppView.RESIDENT_MASTER ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500'
              }`}
            >
              <Settings size={16} className="mb-1" />
              マスタ
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setCurrentView(AppView.USER_MANAGEMENT)}
                className={`flex flex-col items-center justify-center p-2 rounded-lg text-[10px] font-bold ${
                  currentView === AppView.USER_MANAGEMENT ? 'bg-amber-100 text-amber-900 shadow-xs' : 'text-amber-800'
                }`}
              >
                <ShieldCheck size={16} className="mb-1 text-amber-600" />
                権限
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-4 lg:p-8 bg-slate-50/40 w-full max-w-full">
        <div className="max-w-7xl mx-auto h-full w-full">
          {currentView === AppView.BATCH_INPUT && (
            <BatchInputTable 
              onSave={saveBatchRecords} 
              residents={residents} 
              records={records} 
              facilityName={currentFacility.name}
              thresholds={currentThresholds} 
              isReadOnly={isViewer}
            />
          )}
          {currentView === AppView.INDIVIDUAL_HISTORY && (
            <IndividualHistory 
              records={records} 
              residents={residents} 
              facilityName={currentFacility.name}
              thresholds={currentThresholds} 
            />
          )}
          {currentView === AppView.DASHBOARD && (
            <Dashboard 
              records={records} 
              residents={residents} 
              facilityName={currentFacility.name}
              thresholds={currentThresholds} 
            />
          )}
          {currentView === AppView.RESIDENT_MASTER && (
            <ResidentMaster 
              residents={residents} 
              onUpdate={updateResidents} 
              facilityName={currentFacility.name}
              facilityId={currentFacilityId}
              onFacilityNameUpdate={updateFacilityName}
              thresholds={currentThresholds}
              onThresholdsUpdate={updateFacilityThresholds}
              isReadOnly={isViewer}
            />
          )}
          {currentView === AppView.USER_MANAGEMENT && isAdmin && (
            <UserManagement 
              currentUserEmail={user.email}
              facilities={facilities}
            />
          )}
        </div>
      </main>

      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs sm:text-sm border border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-200 no-print">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <footer className="bg-white border-t py-4 px-4 sm:px-8 text-slate-400 no-print flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
        <div className="text-[10px] uppercase tracking-widest font-bold">
          &copy; 2024 VitalSign Pro - Secure Multi-Tenant Healthcare Cloud
        </div>
      </footer>
    </div>
  );
};

export default App;
