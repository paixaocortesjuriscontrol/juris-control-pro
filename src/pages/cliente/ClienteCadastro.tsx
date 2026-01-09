import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Scale, Lock, User, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";

interface ConviteInfo {
  id: string;
  email: string;
  status: string;
  expira_em: string;
  cliente: {
    nome: string;
  } | null;
}

export default function ClienteCadastro() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [convite, setConvite] = useState<ConviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Token de convite não fornecido");
      setLoading(false);
      return;
    }

    const fetchConvite = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from("convites_cliente")
          .select("id, email, status, expira_em, cliente:clientes(nome)")
          .eq("token", token)
          .single();

        if (fetchError || !data) {
          setError("Convite não encontrado ou inválido");
          return;
        }

        if (data.status !== "pendente") {
          setError("Este convite já foi utilizado");
          return;
        }

        if (new Date(data.expira_em) < new Date()) {
          setError("Este convite expirou. Solicite um novo convite ao escritório.");
          return;
        }

        // Handle nested client object
        const clienteData = Array.isArray(data.cliente) ? data.cliente[0] : data.cliente;
        setConvite({
          ...data,
          cliente: clienteData,
        });
        setNome(clienteData?.nome || "");
      } catch (err) {
        console.error("Error fetching invite:", err);
        setError("Erro ao carregar convite");
      } finally {
        setLoading(false);
      }
    };

    fetchConvite();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (senha.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return;
    }

    if (senha !== confirmarSenha) {
      toast.error("As senhas não conferem");
      return;
    }

    setSubmitting(true);

    try {
      const response = await supabase.functions.invoke("aceitar-convite-cliente", {
        body: { token, senha, nome },
      });

      if (response.error) {
        throw new Error(response.error.message || "Erro ao criar conta");
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      setSuccess(true);
      toast.success("Conta criada com sucesso!");
    } catch (err: any) {
      console.error("Error accepting invite:", err);
      toast.error(err.message || "Erro ao criar conta");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 p-4">
        <Card className="w-full max-w-md border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <Skeleton className="h-8 w-48 mx-auto" />
            <Skeleton className="h-4 w-64 mx-auto mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 p-4">
        <Card className="w-full max-w-md border-border/50 bg-card/80 backdrop-blur-sm text-center">
          <CardHeader>
            <div className="mx-auto p-4 bg-destructive/10 rounded-full mb-4">
              <XCircle className="w-12 h-12 text-destructive" />
            </div>
            <CardTitle>Convite Inválido</CardTitle>
            <CardDescription className="text-base">{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/cliente/login">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Voltar ao login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 p-4">
        <Card className="w-full max-w-md border-border/50 bg-card/80 backdrop-blur-sm text-center">
          <CardHeader>
            <div className="mx-auto p-4 bg-emerald-500/10 rounded-full mb-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
            </div>
            <CardTitle>Conta Criada!</CardTitle>
            <CardDescription className="text-base">
              Sua conta foi criada com sucesso. Agora você pode acessar o Portal do Cliente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/cliente/login">
              <Button className="gap-2">
                Fazer login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gold/20 rounded-xl">
              <Scale className="w-10 h-10 text-gold" />
            </div>
          </div>
          <h1 className="text-3xl font-serif font-bold text-white">JurisControl</h1>
          <p className="text-gold mt-2">Portal do Cliente</p>
        </div>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Criar sua conta</CardTitle>
            <CardDescription>
              Convite para: <span className="font-medium text-foreground">{convite?.email}</span>
            </CardDescription>
            {convite?.cliente?.nome && (
              <p className="text-sm text-muted-foreground mt-1">
                Cliente: {convite.cliente.nome}
              </p>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Seu nome</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="nome"
                    type="text"
                    placeholder="Seu nome completo"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="senha">Criar senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="senha"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    className="pl-10"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmar-senha">Confirmar senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirmar-senha"
                    type="password"
                    placeholder="Repita a senha"
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Criando conta..." : "Criar conta"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Link 
            to="/cliente/login" 
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-gold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Já tenho uma conta
          </Link>
        </div>
      </div>
    </div>
  );
}
