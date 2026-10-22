
export interface VitalThresholds {
  tempHigh: number;     // 体温 上限・発熱警告 (デフォルト: 37.5)
  tempCaution: number;  // 体温 微熱注意 (デフォルト: 37.0)
  bpSysHigh: number;    // 血圧(上/収縮期) 上限 (デフォルト: 140)
  bpSysLow: number;     // 血圧(上/収縮期) 下限 (デフォルト: 90)
  bpDiaHigh: number;    // 血圧(下/拡張期) 上限 (デフォルト: 90)
  bpDiaLow: number;     // 血圧(下/拡張期) 下限 (デフォルト: 50)
  pulseHigh: number;    // 脈拍 上限 (デフォルト: 110)
  pulseLow: number;     // 脈拍 下限 (デフォルト: 50)
  spo2Low: number;      // SpO2 下限 (デフォルト: 94)
}

export interface Facility {
  id: string;
  name: string;
  description?: string;
  thresholds?: VitalThresholds;
}

export type UserRole = 'editor' | 'viewer' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  role?: UserRole; // 権限ロール (editor: 編集者 / viewer: 閲覧者 / admin: 管理者)
  allowedFacilities: string[]; // 兼務施設ID配列 (例: ['facility-a', 'facility-b'])
  createdAt?: string;
  updatedAt?: string;
}

export interface Resident {
  id: string;
  facilityId: string; // 施設ID
  name: string;
  roomNumber: string;
  order?: number;
}

export interface Meal {
  main: number; // 0-10
  side: number; // 0-10
}

export interface VitalRecord {
  id?: string;
  facilityId: string; // 施設ID
  residentId: string;
  residentName: string;
  date: string;
  temperature: string;
  systolic: string;
  diastolic: string;
  pulse: string;
  spo2: string;
  mealMorning: Meal;
  mealNoon: Meal;
  mealNight: Meal;
  bowelCount: string;
  note: string;
  imageUrl?: string; // 添付写真のURL (Firebase Storageまたは圧縮画像データ)
  imageStoragePath?: string; // Firebase Storage内のパス
  isAbsent?: boolean; // 利用無しフラグ
}

export enum AppView {
  BATCH_INPUT = 'batch_input',
  INDIVIDUAL_HISTORY = 'individual_history',
  DASHBOARD = 'dashboard',
  RESIDENT_MASTER = 'resident_master',
  USER_MANAGEMENT = 'user_management'
}
