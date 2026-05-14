export type Division =
  | 'Open'
  | 'Limited'
  | 'Limited10'
  | 'Production'
  | 'Revolver'
  | 'SingleStack'
  | 'CarryOptics'
  | 'LimitedOptics'
  | 'PCC'

export type ClassLetter = 'GM' | 'M' | 'A' | 'B' | 'C' | 'D' | 'U'

export type Flag =
  | 'S'
  | 'M'
  | 'E'
  | 'F'
  | 'A'
  | 'I'
  | 'X'
  | 'Y'
  | 'P'
  | 'Q'
  | 'N'
  | 'B'
  | 'C'
  | 'D'
  | 'G'
  | ''

export interface Classifier {
  date: string
  classifierCode: string
  classifierName?: string
  hitFactor?: number
  percent: number
  flag: Flag
  source: 'club' | 'majorMatch'
  matchName?: string
}

export interface ShooterRecord {
  memberNumber: string
  name: string
  membershipType: 'Annual' | 'ThreeYear' | 'FiveYear' | 'Lifetime' | 'Unknown'
  currentClasses: Partial<Record<Division, { letter: ClassLetter; percent: number }>>
  classifiers: Partial<Record<Division, Classifier[]>>
  fetchedAt: string
  source: 'fetch' | 'paste'
}

export interface ClassificationSnapshot {
  date: string
  percent: number
  classLetter: ClassLetter
}
