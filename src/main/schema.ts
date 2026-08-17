import { z } from 'zod'

const slug = z
  .string()
  .min(1)
  .regex(/^[a-z0-9][a-z0-9-_]*$/i, 'ids may only contain letters, numbers, "-" and "_"')

/** Rejects `..` and absolute paths so a pack can never read outside its own folder. */
const relPath = z
  .string()
  .min(1)
  .refine((p) => !p.includes('..') && !/^([a-z]:)?[\\/]/i.test(p), 'must be a relative path')

const lessonRef = z.object({
  id: slug,
  title: z.string().min(1),
  file: relPath,
  minutes: z.number().int().positive().optional()
})

const testRef = z.object({
  id: slug,
  title: z.string().min(1),
  file: relPath
})

const chapterRef = z.object({
  id: slug,
  title: z.string().min(1),
  summary: z.string().optional(),
  lessons: z.array(lessonRef).min(1),
  test: testRef.optional()
})

export const courseManifestSchema = z.object({
  id: slug,
  title: z.string().min(1),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  version: z.string().min(1),
  author: z.string().optional(),
  tags: z.array(z.string()).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .optional(),
  estimatedHours: z.number().positive().optional(),
  chapters: z.array(chapterRef).min(1),
  finalExam: testRef.optional()
})

/**
 * The outline shape the authoring model must emit. Deliberately looser than
 * `courseManifestSchema` — there are no file paths yet, because nothing has
 * been written to disk at plan time.
 */
export const coursePlanSchema = z.object({
  id: slug,
  title: z.string().min(1),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .optional(),
  chapters: z
    .array(
      z.object({
        id: slug,
        title: z.string().min(1),
        summary: z.string().default(''),
        lessons: z
          .array(
            z.object({
              id: slug,
              title: z.string().min(1),
              summary: z.string().default('')
            })
          )
          .min(1)
      })
    )
    .min(1)
})

const baseQuestion = {
  id: z.string().min(1),
  prompt: z.string().min(1),
  explanation: z.string().optional(),
  points: z.number().positive().optional()
}

const questionSchema = z.discriminatedUnion('type', [
  z.object({
    ...baseQuestion,
    type: z.literal('single'),
    options: z.array(z.string()).min(2),
    answer: z.number().int().nonnegative()
  }),
  z.object({
    ...baseQuestion,
    type: z.literal('multi'),
    options: z.array(z.string()).min(2),
    answer: z.array(z.number().int().nonnegative()).min(1)
  }),
  z.object({ ...baseQuestion, type: z.literal('boolean'), answer: z.boolean() }),
  z.object({
    ...baseQuestion,
    type: z.literal('short'),
    accepted: z.array(z.string()).min(1),
    pattern: z.string().optional(),
    placeholder: z.string().optional()
  }),
  z.object({
    ...baseQuestion,
    type: z.literal('ordering'),
    items: z.array(z.string()).min(2),
    answer: z.array(z.string()).min(2)
  }),
  z.object({
    ...baseQuestion,
    type: z.literal('matching'),
    pairs: z.array(z.object({ left: z.string(), right: z.string() })).min(2)
  }),
  z.object({
    ...baseQuestion,
    type: z.literal('fill-blank'),
    text: z.string().min(1),
    blanks: z.array(z.array(z.string()).min(1)).min(1)
  })
])

export const testDocumentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  passingScore: z.number().min(0).max(100),
  shuffle: z.boolean().optional(),
  timeLimitMinutes: z.number().positive().optional(),
  questions: z.array(questionSchema).min(1)
})

export function formatZodError(error: z.ZodError): string {
  return error.issues
    .slice(0, 6)
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('; ')
}
