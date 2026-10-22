
/**
 * アンダーソン・土肥の基準に基づく判定値
 */
export const THRESHOLDS = {
  // 注意レベル（黄色）
  CAUTION: {
    TEMP: 37.0,
    BP_SYS: 140,
    BP_DIA: 90,
    BP_SYS_LOW: 100, 
    BP_DIA_LOW:50,  
    PULSE_HIGH: 110,
    PULSE_LOW: 60,
    SPO2: 94
  },
  // 中止・禁忌レベル（赤色）
  STOP: {
    TEMP: 38.0,
    BP_SYS: 180,
    BP_DIA: 100,
    BP_SYS_LOW: 90,  
    BP_DIA_LOW: 50,  
    PULSE_HIGH: 110,
    PULSE_LOW: 50,
    SPO2: 94
  }
};

/**
 * 明らかな入力ミス（物理的限界）の判定
 */
export const ERR_LIMITS = {
  TEMP_MIN: 33.0,
  TEMP_MAX: 43.0,
  BP_SYS_MIN: 40,
  BP_SYS_MAX: 280,
  BP_DIA_MIN: 30,
  BP_DIA_MAX: 180,
  PULSE_MIN: 30,
  PULSE_MAX: 220,
  SPO2_MIN: 50
};

import { Facility, Resident, VitalThresholds } from './types';

export const DEFAULT_THRESHOLDS: VitalThresholds = {
  tempHigh: 37.5,
  tempCaution: 37.0,
  bpSysHigh: 140,
  bpSysLow: 90,
  bpDiaHigh: 90,
  bpDiaLow: 50,
  pulseHigh: 110,
  pulseLow: 50,
  spo2Low: 94
};

export const DEFAULT_FACILITIES: Facility[] = [
  { 
    id: 'facility-a', 
    name: '陽光ケアホーム (本館)', 
    description: '特別養護老人ホーム',
    thresholds: { ...DEFAULT_THRESHOLDS }
  },
  { 
    id: 'facility-b', 
    name: '陽光デイサービス (別館)', 
    description: '通所介護・デイサービス',
    thresholds: { ...DEFAULT_THRESHOLDS }
  }
];

export const getInitialResidentsForFacility = (facilityId: string): Resident[] => {
  const isFacilityB = facilityId === 'facility-b';
  const prefix = isFacilityB ? 'デイ利用者' : '入所者';
  const count = isFacilityB ? 15 : 29;
  return Array.from({ length: count }, (_, i) => ({
    id: `res-${facilityId}-${i + 1}`,
    facilityId,
    name: `${prefix} ${String(i + 1).padStart(2, '0')}`,
    roomNumber: `${isFacilityB ? 200 : 100 + Math.floor(i / 2)}`
  }));
};

// 後方互換用デフォルト利用者リスト
export const INITIAL_RESIDENTS: Resident[] = getInitialResidentsForFacility('facility-a');

export const MEAL_LABELS = [
  '0 (欠食)', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10 (完食)'
];

export const DAYS_JP = ['日', '月', '火', '水', '木', '金', '土'];
