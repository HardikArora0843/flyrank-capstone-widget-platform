import { z } from 'zod';

const widgetFieldSchema = z.object({
  name: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_]+$/, 'Field name must be alphanumeric with underscores'),
  label: z.string().min(1).max(100),
  type: z.enum(['text', 'email', 'tel', 'number', 'textarea']),
  required: z.boolean().default(false),
  placeholder: z.string().max(100).optional(),
});

export const createWidgetSchema = z.object({
  name: z.string().min(2, 'Widget name must be at least 2 characters').max(255),
  type: z.enum(['signup', 'cta', 'popover']).default('signup'),
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().max(1000).default(''),
  buttonText: z.string().min(1, 'Button text is required').max(100).default('Submit'),
  fields: z.array(widgetFieldSchema).min(1, 'Widget must have at least one field'),
  allowedOrigins: z.array(z.string().min(1)).default(['*']),
  isActive: z.boolean().default(true),
});

export const updateWidgetSchema = createWidgetSchema.partial();
