-- Drop existing INSERT policies
DROP POLICY IF EXISTS "Users can insert deposits" ON public.depositos_recursais;
DROP POLICY IF EXISTS "Users can insert costs" ON public.custas_processuais;

-- Create more permissive INSERT policies (criado_por is optional, set by trigger)
CREATE POLICY "Authenticated users can insert deposits"
  ON public.depositos_recursais
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert costs"
  ON public.custas_processuais
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create trigger to auto-set criado_por
CREATE OR REPLACE FUNCTION public.set_criado_por()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.criado_por IS NULL THEN
    NEW.criado_por := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply trigger to both tables
DROP TRIGGER IF EXISTS set_criado_por_depositos ON public.depositos_recursais;
CREATE TRIGGER set_criado_por_depositos
  BEFORE INSERT ON public.depositos_recursais
  FOR EACH ROW
  EXECUTE FUNCTION public.set_criado_por();

DROP TRIGGER IF EXISTS set_criado_por_custas ON public.custas_processuais;
CREATE TRIGGER set_criado_por_custas
  BEFORE INSERT ON public.custas_processuais
  FOR EACH ROW
  EXECUTE FUNCTION public.set_criado_por();