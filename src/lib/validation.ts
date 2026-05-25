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
  highPercent: z.number().min(0).max(200),
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

export const FeedbackTypeSchema = z.enum(['bug', 'feature_request', 'other'])

export const FeedbackContextSchema = z.object({
  appSha: z.string().max(64).nullable(),
  url: z.string().url().max(2048),
  memberNumber: z.string().max(20).nullable(),
  division: DivisionSchema.nullable(),
  userAgent: z.string().max(500),
  viewport: z.string().regex(/^\d+x\d+$/),
  timestamp: z.string().min(1).max(40),
})

export const FeedbackInputSchema = z.object({
  type: FeedbackTypeSchema,
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(4000),
  context: FeedbackContextSchema,
})

export const FeedbackResponseSchema = z.object({
  ok: z.literal(true),
  issueUrl: z.string().url(),
  issueNumber: z.number().int().positive(),
})

export type FeedbackType = z.infer<typeof FeedbackTypeSchema>
export type FeedbackContext = z.infer<typeof FeedbackContextSchema>
export type FeedbackInput = z.infer<typeof FeedbackInputSchema>
