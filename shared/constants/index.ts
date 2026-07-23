export const PLATFORMS = {
  crowdworks: 'クラウドワークス',
  coconala: 'ココナラ',
  lancers: 'ランサーズ',
  other: 'その他',
} as const

export const BUDGET_TYPES = {
  fixed: '固定報酬',
  hourly: '時間単価',
  monthly: '月額',
  performance: '成果報酬',
  unknown: '不明',
} as const

export const STATUSES = {
  draft: { l: '入力中', c: '#94a3b8' },
  extracted: { l: '確認待ち', c: '#64748b' },
  diagnosing: { l: '診断中', c: '#64748b' },
  review: { l: '判断中', c: '#3b82f6' },
  needs_question: { l: '質問中', c: '#8b5cf6' },
  skipped: { l: '見送り', c: '#94a3b8' },
  applied: { l: '応募済み', c: '#6366f1' },
  replied: { l: '返信あり', c: '#0ea5e9' },
  interview: { l: '面談', c: '#f59e0b' },
  won: { l: '受注', c: '#16a34a' },
  working: { l: '作業中', c: '#16a34a' },
  delivered: { l: '納品済み', c: '#059669' },
  completed: { l: '完了', c: '#047857' },
  paid: { l: '入金済み', c: '#047857' },
  lost: { l: '失注', c: '#dc2626' },
  cancelled: { l: 'キャンセル', c: '#dc2626' },
} as const

export const RATINGS = {
  good: { l: '良好', c: '#16a34a', bg: '#f0fdf4' },
  attention: { l: '注意', c: '#d97706', bg: '#fffbeb' },
  check: { l: '要確認', c: '#dc2626', bg: '#fef2f2' },
  unknown: { l: '判定不能', c: '#64748b', bg: '#f8fafc' },
} as const

export const AXIS_LABELS = {
  safety: { n: '安全性', d: '規約・支払い・発注者' },
  fitness: { n: '適合度', d: 'スキル・実績' },
  feasibility: { n: '完遂可能性', d: '工数・納期・稼働' },
  profitability: { n: '採算性', d: '実質時給・手取り' },
  winChance: { n: '受注可能性', d: '競争・差別化' },
} as const

export const REC = {
  apply: { t: '応募する', c: '#16a34a', bg: '#f0fdf4', ic: '✓' },
  question: { t: '質問してから判断', c: '#d97706', bg: '#fffbeb', ic: '?' },
  skip: { t: '見送り候補', c: '#dc2626', bg: '#fef2f2', ic: '✗' },
} as const

export const SKIP_REASONS = [
  '危険信号',
  '採算不一致',
  '工数・納期不一致',
  '稼働時間帯不一致',
  'スキル不足',
  'スコープ不明',
  '発注者から返信なし',
  '他者に決定',
  '募集終了・中止',
  '条件変更',
  '自分から辞退',
  '理由不明',
  'その他',
] as const

export const DEFAULT_FEE_RATES: Record<string, number> = {
  crowdworks: 20,
  coconala: 22,
  lancers: 20,
  other: 20,
}

export const EFFORT_CATEGORIES = [
  '要件確認',
  '調査・既存仕様把握',
  '環境構築',
  '設計',
  'UI・デザイン',
  '実装',
  'テスト',
  '納品・デプロイ',
  'MTG・連絡',
  '修正対応',
  '学習',
  '予備',
] as const

export const STORAGE_KEYS = {
  PROFILE: 'cb-profile',
  PIPELINE: 'cb-pipeline',
  STATS: 'cb-stats',
  DRAFT_INPUT: 'cb-draft-input',
} as const

export const PIPELINE_FILTERS = [
  'all',
  'review',
  'skipped',
  'applied',
  'replied',
  'interview',
  'won',
  'completed',
  'paid',
  'lost',
] as const

export const PIPELINE_FILTER_LABELS: Record<string, string> = {
  all: 'すべて',
  review: '判断中',
  skipped: '見送り',
  applied: '応募済み',
  replied: '返信あり',
  interview: '面談',
  won: '受注',
  completed: '完了',
  paid: '入金済み',
  lost: '失注',
}

export const BLOCK_RESOLVE_REASONS = [
  '誤検知',
  '発注者へ確認済み',
  'プラットフォーム上で許可済み',
  'リスクを理解して進める',
  'その他',
] as const

