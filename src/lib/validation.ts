import { z } from 'zod'

export const DivisionSchema = z.enum([
  'Open',
  'Limited',
  'Limited10',
  'Production',
  'Revolver',
  'SingleStack',
  'CarryOptics',
  'LimitedOptics',
  'PCC',
])

export const ClassLetterSchema = z.enum(['GM', 'M', 'A', 'B', 'C', 'D', 'U'])

// B, C, D, G are retired as of April 2025 but still appear on historical rows
export const FlagSchema = z.enum(['S', 'M', 'E', 'F', 'A', 'I', 'X', 'Y', 'P', 'Q', 'N', 'B', 'C', 'D', 'G', ''])

export const ClassifierSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  classifierCode: z.string().min(1),
  classifierName: z.string().optional(),
  hitFactor: z.number().optional(),
  percent: z.number().min(0).max(200),
  flag: FlagSchema,
  source: z.enum(['club', 'majorMatch']),
  matchName: z.string().optional(),
})

export const CurrentClassSchema = z.object({
  letter: ClassLetterSchema,
  percent: z.number().min(0).max(200),
})

export const ShooterRecordSchema = z.object({
  memberNumber: z.string().min(1),
  name: z.string(),
  membershipType: z.enum(['Annual', 'ThreeYear', 'FiveYear', 'Lifetime', 'Unknown']),
  currentClasses: z.record(DivisionSchema, CurrentClassSchema),
  classifiers: z.record(DivisionSchema, z.array(ClassifierSchema)),
  fetchedAt: z.string(),
  source: z.enum(['fetch', 'paste']),
})

export type ValidatedClassifier = z.infer<typeof ClassifierSchema>
export type ValidatedShooterRecord = z.infer<typeof ShooterRecordSchema>
