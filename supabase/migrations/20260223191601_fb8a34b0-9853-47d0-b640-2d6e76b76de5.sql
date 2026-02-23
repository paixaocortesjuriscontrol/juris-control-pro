
-- Force PostgREST schema cache reload after dropping overloaded functions
NOTIFY pgrst, 'reload schema';
