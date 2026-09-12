import { z } from 'zod';

export const seoPageTypeSchema = z.enum(['school', 'feature', 'other']);
export type SeoPageType = z.infer<typeof seoPageTypeSchema>;

export const pageIdentitySchema = z.object({
  pageType: seoPageTypeSchema,
  id: z.string().min(1).nullable(),
  slug: z.string().min(1).nullable(),
  url: z.string().url(),
});
export type PageIdentity = z.infer<typeof pageIdentitySchema>;

export const htmlFactSnapshotSchema = z.object({
  status: z.number().int().min(100).max(599),
  title: z.string().nullable(),
  description: z.string().nullable(),
  canonical: z.string().url().nullable(),
  robots: z.string().nullable(),
  h1: z.string().nullable(),
  internalLinks: z.array(z.string().url()),
});
export type HtmlFactSnapshot = z.infer<typeof htmlFactSnapshotSchema>;

const schoolDatabaseFactSchema = z.object({
  type: z.literal('school'),
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  isPublic: z.boolean(),
  aiSummary: z
    .object({
      summaryText: z.string().nullable(),
      metaTitle: z.string().nullable(),
      metaDescription: z.string().nullable(),
    })
    .nullable(),
});

const featureDatabaseFactSchema = z.object({
  type: z.literal('feature'),
  id: z.string().min(1),
  title: z.string().min(1),
  slug: z.string().min(1),
  isPublic: z.boolean(),
  metaTitle: z.string().nullable(),
  metaDescription: z.string().nullable(),
});

export const databaseFactSnapshotSchema = z
  .discriminatedUnion('type', [schoolDatabaseFactSchema, featureDatabaseFactSchema])
  .nullable();
export type DatabaseFactSnapshot = z.infer<typeof databaseFactSnapshotSchema>;

export const factContextSnapshotSchema = z.object({
  version: z.literal(1),
  collectedAt: z.string().datetime(),
  target: pageIdentitySchema,
  html: htmlFactSnapshotSchema,
  database: databaseFactSnapshotSchema,
  currentValues: z.object({
    updateSchoolMetaTitle: z.string().optional(),
    updateFeatureMetaDescription: z.string().optional(),
    updateSeoSummary: z.string().optional(),
    addApprovedInternalLink: z.string().optional(),
  }),
});
export type FactContextSnapshot = z.infer<typeof factContextSnapshotSchema>;
