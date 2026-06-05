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

export const FlagSchema = z.enum([
  'S',
  'M',
  'E',
  'F',
  'A',
  'I',
  'X',
  'Y',
  'P',
  'Q',
  'N',
  'B',
  'C',
  'D',
  'G',
  '',
])

export const ClassifierSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  classifierCode: z.string().min(1).max(32),
  classifierName: z.string().max(200).optional(),
  hitFactor: z.number().optional(),
  percent: z.number().min(0).max(200),
  flag: FlagSchema,
  source: z.enum(['club', 'majorMatch']),
  matchName: z.string().max(500).optional(),
})

export const CurrentClassSchema = z.object({
  letter: ClassLetterSchema,
  percent: z.number().min(0).max(200),
  highPercent: z.number().min(0).max(200),
})

export const ShooterRecordSchema = z.object({
  memberNumber: z.string().min(1).max(32),
  name: z.string().max(200),
  membershipType: z.enum(['Annual', 'ThreeYear', 'FiveYear', 'Lifetime', 'Unknown']),
  currentClasses: z.partialRecord(DivisionSchema, CurrentClassSchema),
  classifiers: z.partialRecord(DivisionSchema, z.array(ClassifierSchema).max(5000)),
  fetchedAt: z.string().max(40),
  source: z.enum(['fetch', 'paste']),
})

export type ValidatedClassifier = z.infer<typeof ClassifierSchema>
export type ValidatedShooterRecord = z.infer<typeof ShooterRecordSchema>

export const RecentLookupSchema = z.object({
  memberNumber: z.string().min(1).max(32),
  name: z.string().max(200),
  lastLookedUpAt: z.string().min(1).max(40),
})

export const FeedbackTypeSchema = z.enum(['bug', 'feature_request', 'other'])

export const FeedbackContextSchema = z.object({
  appSha: z.string().max(64).nullable(),
  url: z
    .string()
    .url()
    .max(2048)
    .refine((u) => /^https?:\/\//i.test(u), 'url must use http(s)')
    .nullable(),
  memberNumber: z
    .string()
    .max(20)
    .regex(/^[A-Za-z0-9-]*$/)
    .nullable(),
  division: DivisionSchema.nullable(),
  userAgent: z.string().max(500).nullable(),
  viewport: z
    .string()
    .regex(/^\d+x\d+$/)
    .nullable(),
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
  issueUrl: z
    .string()
    .url()
    .refine((u) => u.startsWith('https://github.com/'), 'must be a github.com URL'),
  issueNumber: z.number().int().positive(),
})

export type FeedbackType = z.infer<typeof FeedbackTypeSchema>
export type FeedbackContext = z.infer<typeof FeedbackContextSchema>
export type FeedbackInput = z.infer<typeof FeedbackInputSchema>
