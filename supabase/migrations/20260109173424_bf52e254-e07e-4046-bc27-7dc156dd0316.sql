-- Add 'cliente' role to the enum (must be committed separately)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cliente';